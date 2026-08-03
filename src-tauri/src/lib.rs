use futures_util::StreamExt;
use http::{header::*, response::Builder as ResponseBuilder, status::StatusCode};
use http_range::HttpRange;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tokio_util::sync::CancellationToken;

const CDN_BASE: &str = "https://media.ehacademy.com/";
const MAX_PROTOCOL_CHUNK: u64 = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_PDF_BYTES: u64 = 128 * 1024 * 1024;
const MAX_TEXT_BYTES: u64 = 4 * 1024 * 1024;
const DOWNLOAD_STALL_TIMEOUT: Duration = Duration::from_secs(30);
const MAX_DOWNLOAD_FILE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_USB_FILES: usize = 10_000;
const MAX_USB_FILE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_USB_TOTAL_BYTES: u64 = 12 * 1024 * 1024 * 1024;

const MEDIA_EXTENSIONS: &[&str] = &["mp4", "png", "jpg", "jpeg", "webp", "pdf", "vtt"];
const APPROVED_FOLDER_PREFIXES: &[&str] = &[
    "App Thumbnails",
    "CPR AED Presentation Slides",
    "CPR AED VA Slides",
    "First Aid Presentation Slides",
    "First Aid VA Slides",
    "Pedi CPR Presentation Slides",
    "Pedi First Aid Presentation Slides",
    "subtitles",
];
const APPROVED_ROOT_ASSETS: &[&str] = &[
    "instructor_manual.pdf",
    "pediatric_student_manual.pdf",
    "student_manual.pdf",
];

#[derive(Default)]
struct DownloadRegistry(Mutex<HashMap<String, CancellationToken>>);

#[derive(Default)]
struct UsbImportRegistry(Mutex<Option<CancellationToken>>);

#[derive(Default)]
struct UsbDriveDetectionState(Mutex<UsbDriveDetectionSession>);

struct UsbDriveDetectionSession {
    suppressed: bool,
    handled_mounts: HashSet<PathBuf>,
}

impl Default for UsbDriveDetectionSession {
    fn default() -> Self {
        Self {
            suppressed: true,
            handled_mounts: HashSet::new(),
        }
    }
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UsbMediaManifest {
    schema_version: u64,
    #[serde(alias = "generationDate", alias = "generated")]
    generated_at: String,
    app_version: String,
    files: Vec<UsbMediaFile>,
}

#[derive(Clone, Deserialize)]
struct UsbMediaFile {
    key: String,
    size: u64,
    etag: String,
    sha256: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UsbImportSummary {
    app_version: String,
    generated_at: String,
    file_count: usize,
    total_bytes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct UsbDriveDetected {
    folder: String,
    summary: UsbImportSummary,
}

#[derive(Default)]
struct MediaLibrary(OnceLock<Result<PathBuf, String>>);

#[derive(Default)]
struct DisplaySleepAssertion(Mutex<Option<u32>>);

#[cfg(target_os = "macos")]
#[link(name = "IOKit", kind = "framework")]
extern "C" {
    fn IOPMAssertionCreateWithName(
        assertion_type: *const std::ffi::c_void,
        assertion_level: u32,
        reason: *const std::ffi::c_void,
        assertion_id: *mut u32,
    ) -> i32;
    fn IOPMAssertionRelease(assertion_id: u32) -> i32;
}

impl DisplaySleepAssertion {
    fn set_active(&self, active: bool) -> Result<(), String> {
        let mut assertion = self
            .0
            .lock()
            .map_err(|_| "Display sleep assertion is unavailable".to_string())?;
        if active == assertion.is_some() {
            return Ok(());
        }

        #[cfg(target_os = "macos")]
        unsafe {
            if active {
                use objc2_foundation::NSString;
                let assertion_type = NSString::from_str("PreventUserIdleDisplaySleep");
                let reason = NSString::from_str("CPR Trainer Pro is presenting course media");
                let mut assertion_id = 0;
                let status = IOPMAssertionCreateWithName(
                    (&*assertion_type as *const NSString).cast(),
                    255,
                    (&*reason as *const NSString).cast(),
                    &mut assertion_id,
                );
                if status != 0 {
                    return Err(format!(
                        "macOS rejected the display sleep assertion ({status})"
                    ));
                }
                *assertion = Some(assertion_id);
            } else if let Some(assertion_id) = assertion.take() {
                let status = IOPMAssertionRelease(assertion_id);
                if status != 0 {
                    return Err(format!(
                        "macOS could not release the display sleep assertion ({status})"
                    ));
                }
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            *assertion = active.then_some(1);
        }
        Ok(())
    }

    fn release_nonfatal(&self) {
        if let Err(error) = self.set_active(false) {
            log::warn!("{error}");
        }
    }
}

impl Drop for DisplaySleepAssertion {
    fn drop(&mut self) {
        self.release_nonfatal();
    }
}

#[cfg(target_os = "macos")]
fn register_power_notifications(app: tauri::AppHandle) {
    use block2::RcBlock;
    use objc2_app_kit::{
        NSWorkspace, NSWorkspaceDidWakeNotification, NSWorkspaceWillSleepNotification,
    };
    use objc2_foundation::NSNotification;
    use std::ptr::NonNull;

    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    let sleep_app = app.clone();
    let sleep_block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        if let Some(assertion) = sleep_app.try_state::<DisplaySleepAssertion>() {
            assertion.release_nonfatal();
        }
        let _ = sleep_app.emit("system:sleep", ());
    });
    let wake_block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        let _ = app.emit("system:wake", ());
    });

    unsafe {
        let sleep_observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceWillSleepNotification),
            None,
            None,
            &sleep_block,
        );
        let wake_observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceDidWakeNotification),
            None,
            None,
            &wake_block,
        );
        std::mem::forget(sleep_observer);
        std::mem::forget(wake_observer);
    }
}

#[cfg(not(target_os = "macos"))]
fn register_power_notifications(_app: tauri::AppHandle) {}

fn configured_media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("media"))
        .map_err(|error| format!("Unable to locate Application Support: {error}"))
}

fn initialize_media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = configured_media_dir(app)?;
    std::fs::create_dir_all(&path).map_err(|error| {
        format!(
            "CPR Trainer Pro cannot create its media library at {}. Check folder permissions and available disk space, then reopen the app. ({error})",
            path.display()
        )
    })?;
    let canonical = std::fs::canonicalize(&path).map_err(|error| {
        format!(
            "Unable to resolve media library {}: {error}",
            path.display()
        )
    })?;
    exclude_from_backup_nonfatal(&canonical);
    Ok(canonical)
}

fn cached_media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.try_state::<MediaLibrary>()
        .ok_or_else(|| "Media library state is unavailable".to_string())?
        .0
        .get()
        .ok_or_else(|| "Media library has not been initialized".to_string())?
        .clone()
}

fn exclude_from_backup_nonfatal(path: &Path) {
    if let Err(error) = exclude_from_backup(path) {
        log::warn!("{error}");
    }
}

#[cfg(target_os = "macos")]
fn exclude_from_backup(path: &Path) -> Result<(), String> {
    use objc2_foundation::{NSNumber, NSString, NSURLIsExcludedFromBackupKey, NSURL};

    let value = NSNumber::numberWithBool(true);
    let url = NSURL::fileURLWithPath_isDirectory(
        &NSString::from_str(&path.to_string_lossy()),
        path.is_dir(),
    );
    unsafe {
        url.setResourceValue_forKey_error(Some(&value), NSURLIsExcludedFromBackupKey)
            .map_err(|error| {
                format!(
                    "Unable to exclude {} from Time Machine backups: {error}",
                    path.display()
                )
            })
    }
}

#[cfg(not(target_os = "macos"))]
fn exclude_from_backup(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn normalized_relative_path(input: &str) -> Result<PathBuf, String> {
    let trimmed = input.trim();
    if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.starts_with('\\') {
        return Err("Media path must be a non-empty relative path".to_string());
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("Absolute media paths are not allowed".to_string());
    }

    for component in path.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(format!("Invalid media path component in {trimmed}"));
        }
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "Media path requires an approved extension".to_string())?;
    if !MEDIA_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!("Unsupported media extension: {extension}"));
    }

    Ok(path.to_path_buf())
}

fn is_approved_download_path(relative: &Path) -> bool {
    let components = relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>();

    match components.as_slice() {
        [filename] => APPROVED_ROOT_ASSETS.contains(filename),
        [prefix, ..] => APPROVED_FOLDER_PREFIXES.contains(prefix),
        _ => false,
    }
}

fn verify_no_symlinks(
    root: &Path,
    relative: &Path,
    allow_missing_leaf: bool,
) -> Result<(), String> {
    let mut current = root.to_path_buf();
    let component_count = relative.components().count();

    for (index, component) in relative.components().enumerate() {
        let Component::Normal(value) = component else {
            return Err("Invalid media path".to_string());
        };
        current.push(value);
        match std::fs::symlink_metadata(&current) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err(format!(
                    "Symbolic links are not allowed: {}",
                    current.display()
                ));
            }
            Ok(_) => {}
            Err(error)
                if error.kind() == std::io::ErrorKind::NotFound
                    && allow_missing_leaf
                    && index + 1 == component_count => {}
            Err(error) => {
                return Err(format!("Unable to inspect {}: {error}", current.display()));
            }
        }
    }
    Ok(())
}

fn resolve_existing_media_file(root: &Path, input: &str) -> Result<PathBuf, String> {
    let relative = normalized_relative_path(input)?;
    verify_no_symlinks(root, &relative, false)?;
    let candidate = root.join(relative);
    let canonical = std::fs::canonicalize(&candidate).map_err(|error| {
        format!(
            "Media file is unavailable: {} ({error})",
            candidate.display()
        )
    })?;
    if !canonical.starts_with(root) || !canonical.is_file() {
        return Err("Media path is outside the app library or is not a file".to_string());
    }
    Ok(canonical)
}

fn prepare_download_destination(root: &Path, input: &str) -> Result<(PathBuf, PathBuf), String> {
    let relative = normalized_relative_path(input)?;
    if !is_approved_download_path(&relative) {
        return Err(format!(
            "Media path is not in the approved catalog: {input}"
        ));
    }

    let destination = root.join(&relative);
    let parent = destination
        .parent()
        .ok_or_else(|| "Media destination has no parent directory".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| {
        format!(
            "Unable to create media folder {}: {error}",
            parent.display()
        )
    })?;

    let parent_relative = parent
        .strip_prefix(root)
        .map_err(|_| "Media destination escaped the app library".to_string())?;
    if !parent_relative.as_os_str().is_empty() {
        verify_no_symlinks(root, parent_relative, false)?;
    }
    if destination.exists() {
        verify_no_symlinks(root, &relative, false)?;
    }

    let canonical_parent = std::fs::canonicalize(parent).map_err(|error| {
        format!(
            "Unable to resolve media folder {}: {error}",
            parent.display()
        )
    })?;
    if !canonical_parent.starts_with(root) {
        return Err("Media destination escaped the app library".to_string());
    }

    let partial = destination.with_file_name(format!(
        "{}.download.part",
        destination
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "Media filename is not valid UTF-8".to_string())?
    ));
    if partial.exists() {
        let metadata = std::fs::symlink_metadata(&partial)
            .map_err(|error| format!("Unable to inspect partial download: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Partial download cannot be a symbolic link".to_string());
        }
    }
    Ok((destination, partial))
}

fn mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "mp4" => "video/mp4",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "pdf" => "application/pdf",
        "vtt" => "text/vtt; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn response_with_common_headers(content_type: &str, len: u64) -> http::response::Builder {
    ResponseBuilder::new()
        .header(CONTENT_TYPE, content_type)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header(ACCEPT_RANGES, "bytes")
        .header(CACHE_CONTROL, "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .header(CONTENT_LENGTH, len)
}

fn handle_media_request(
    media_root: &Path,
    request: http::Request<Vec<u8>>,
) -> Result<http::Response<Vec<u8>>, Box<dyn std::error::Error>> {
    if request.method() != http::Method::GET && request.method() != http::Method::HEAD {
        return Ok(ResponseBuilder::new()
            .status(StatusCode::METHOD_NOT_ALLOWED)
            .body(Vec::new())?);
    }

    let raw_path = request.uri().path().trim_start_matches('/');
    let decoded = percent_encoding::percent_decode_str(raw_path)
        .decode_utf8()
        .map_err(|_| "Media path is not valid UTF-8")?;
    let file_path = match resolve_existing_media_file(media_root, &decoded) {
        Ok(path) => path,
        Err(_) => {
            return Ok(ResponseBuilder::new()
                .status(StatusCode::NOT_FOUND)
                .body(Vec::new())?)
        }
    };

    let content_type = mime_type(&file_path);
    let mut file = File::open(&file_path)?;
    let len = file.metadata()?.len();

    if request.method() == http::Method::HEAD {
        return Ok(response_with_common_headers(content_type, len).body(Vec::new())?);
    }

    if let Some(range_header) = request.headers().get(RANGE) {
        let not_satisfiable = || {
            ResponseBuilder::new()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(CONTENT_RANGE, format!("bytes */{len}"))
                .body(Vec::new())
        };
        let Ok(range_value) = range_header.to_str() else {
            return Ok(not_satisfiable()?);
        };
        let ranges = match HttpRange::parse(range_value, len) {
            Ok(ranges) => ranges,
            Err(_) => return Ok(not_satisfiable()?),
        };
        let Some(range) = ranges.first() else {
            return Ok(not_satisfiable()?);
        };
        if range.start >= len || range.length == 0 {
            return Ok(not_satisfiable()?);
        }

        let bytes_to_read = range.length.min(MAX_PROTOCOL_CHUNK).min(len - range.start);
        let end = range.start + bytes_to_read - 1;
        let mut body = vec![0; bytes_to_read as usize];
        file.seek(SeekFrom::Start(range.start))?;
        file.read_exact(&mut body)?;

        return Ok(response_with_common_headers(content_type, bytes_to_read)
            .status(StatusCode::PARTIAL_CONTENT)
            .header(CONTENT_RANGE, format!("bytes {}-{end}/{len}", range.start))
            .body(body)?);
    }

    if content_type == "video/mp4" {
        if len == 0 {
            return Ok(ResponseBuilder::new()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(CONTENT_RANGE, "bytes */0")
                .body(Vec::new())?);
        }
        let bytes_to_read = len.min(MAX_PROTOCOL_CHUNK);
        let end = bytes_to_read - 1;
        let mut body = vec![0; bytes_to_read as usize];
        file.read_exact(&mut body)?;
        return Ok(response_with_common_headers(content_type, bytes_to_read)
            .status(StatusCode::PARTIAL_CONTENT)
            .header(CONTENT_RANGE, format!("bytes 0-{end}/{len}"))
            .body(body)?);
    }

    let limit = match content_type {
        "application/pdf" => MAX_PDF_BYTES,
        "text/vtt; charset=utf-8" => MAX_TEXT_BYTES,
        _ => MAX_IMAGE_BYTES,
    };
    if len > limit {
        return Ok(ResponseBuilder::new()
            .status(StatusCode::PAYLOAD_TOO_LARGE)
            .body(Vec::new())?);
    }

    let mut body = Vec::with_capacity(len as usize);
    file.read_to_end(&mut body)?;
    Ok(response_with_common_headers(content_type, len).body(body)?)
}

#[tauri::command]
fn get_media_storage_status(app: tauri::AppHandle) -> Result<String, String> {
    cached_media_dir(&app).map(|path| path.display().to_string())
}

#[tauri::command]
fn read_subtitle_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let relative = format!("subtitles/{filename}");
    let root = cached_media_dir(&app)?;
    let path = resolve_existing_media_file(&root, &relative)?;
    let metadata = path.metadata().map_err(|error| error.to_string())?;
    if metadata.len() > MAX_TEXT_BYTES {
        return Err("Subtitle file exceeds the 4 MiB safety limit".to_string());
    }
    std::fs::read_to_string(path).map_err(|error| format!("Unable to read subtitles: {error}"))
}

fn normalized_etag(value: &str) -> &str {
    value
        .trim()
        .strip_prefix("W/")
        .unwrap_or(value.trim())
        .trim_matches('"')
}

fn if_range_etag(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.starts_with('"') || trimmed.starts_with("W/\"") {
        trimmed.to_string()
    } else {
        format!("\"{trimmed}\"")
    }
}

fn download_client() -> Result<reqwest::Client, String> {
    static CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(10))
                .build()
                .map_err(|error| format!("Unable to initialize secure download client: {error}"))
        })
        .clone()
}

fn encoded_media_url(filename: &str, version: Option<&str>) -> String {
    let encoded = filename
        .split('/')
        .map(|segment| {
            percent_encoding::utf8_percent_encode(segment, percent_encoding::NON_ALPHANUMERIC)
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("/");
    match version {
        Some(version) => format!(
            "{CDN_BASE}{encoded}?v={}",
            percent_encoding::utf8_percent_encode(version, percent_encoding::NON_ALPHANUMERIC)
        ),
        None => format!("{CDN_BASE}{encoded}"),
    }
}

fn should_reset_partial_download(existing_size: u64, expected_size: u64) -> bool {
    existing_size >= expected_size
}

#[allow(clippy::too_many_arguments)]
async fn download_media_file_inner(
    app: &tauri::AppHandle,
    filename: &str,
    version: Option<&str>,
    expected_size: u64,
    expected_etag: &str,
    cancellation: &CancellationToken,
) -> Result<(), String> {
    if expected_size == 0 {
        return Err("The media manifest reported an invalid zero-byte file".to_string());
    }
    if expected_size > MAX_DOWNLOAD_FILE_BYTES {
        return Err("The media manifest file exceeds the 2 GiB transfer ceiling".to_string());
    }
    if expected_etag.trim().is_empty() {
        return Err("The media manifest did not provide an ETag".to_string());
    }

    let root = cached_media_dir(app)?;
    let (destination, partial) = prepare_download_destination(&root, filename)?;
    if version.is_some() {
        let _ = tokio::fs::remove_file(&partial).await;
    }

    let mut existing_size = tokio::fs::metadata(&partial)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if should_reset_partial_download(existing_size, expected_size) {
        tokio::fs::remove_file(&partial)
            .await
            .map_err(|error| format!("Unable to reset invalid partial download: {error}"))?;
        existing_size = 0;
    }

    let client = download_client()?;
    let url = encoded_media_url(filename, version);
    let mut request = client.get(&url);
    if existing_size > 0 {
        request = request
            .header(reqwest::header::RANGE, format!("bytes={existing_size}-"))
            .header(reqwest::header::IF_RANGE, if_range_etag(expected_etag));
    }

    let response = tokio::select! {
        _ = cancellation.cancelled() => return Err("Download cancelled".to_string()),
        result = request.send() => result.map_err(|error| format!("Download request failed: {error}"))?,
    };
    if response.status() == reqwest::StatusCode::RANGE_NOT_SATISFIABLE {
        tokio::fs::remove_file(&partial)
            .await
            .map_err(|error| format!("Unable to reset rejected partial download: {error}"))?;
        return Err("Download server rejected the resume range with HTTP 416".to_string());
    }
    if !response.status().is_success() {
        return Err(format!(
            "Download server returned HTTP {}",
            response.status()
        ));
    }

    let response_etag = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Download response did not include an ETag".to_string())?;
    if normalized_etag(response_etag) != normalized_etag(expected_etag) {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err("Download ETag did not match the content manifest".to_string());
    }

    let is_partial = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if is_partial && existing_size > 0 {
        let expected_prefix = format!("bytes {existing_size}-");
        let expected_suffix = format!("/{expected_size}");
        let content_range = response
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| "Resume response did not include Content-Range".to_string())?;
        if !content_range.starts_with(&expected_prefix)
            || !content_range.ends_with(&expected_suffix)
        {
            return Err("Resume response did not match the partial download".to_string());
        }
    }
    let bytes_already_written = if is_partial { existing_size } else { 0 };
    let mut bytes_written = bytes_already_written;
    let mut output = if is_partial {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&partial)
            .await
            .map_err(|error| format!("Unable to resume partial download: {error}"))?
    } else {
        tokio::fs::File::create(&partial)
            .await
            .map_err(|error| format!("Unable to create partial download: {error}"))?
    };

    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();
    loop {
        let next = tokio::select! {
            _ = cancellation.cancelled() => return Err("Download cancelled".to_string()),
            result = tokio::time::timeout(DOWNLOAD_STALL_TIMEOUT, stream.next()) => {
                result.map_err(|_| "Download stalled for more than 30 seconds".to_string())?
            }
        };
        let Some(chunk) = next else {
            break;
        };
        let chunk = chunk.map_err(|error| format!("Download stream failed: {error}"))?;
        tokio::io::AsyncWriteExt::write_all(&mut output, &chunk)
            .await
            .map_err(|error| format!("Unable to write media file: {error}"))?;
        bytes_written += chunk.len() as u64;
        if bytes_written > expected_size {
            drop(output);
            let _ = tokio::fs::remove_file(&partial).await;
            return Err("Download exceeded the manifest size".to_string());
        }

        if last_emit.elapsed() >= Duration::from_millis(100) {
            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "filename": filename,
                    "bytes_written": bytes_written,
                    "total_bytes": expected_size
                }),
            );
            last_emit = std::time::Instant::now();
        }
    }

    tokio::io::AsyncWriteExt::flush(&mut output)
        .await
        .map_err(|error| format!("Unable to flush media file: {error}"))?;
    output
        .sync_all()
        .await
        .map_err(|error| format!("Unable to synchronize media file: {error}"))?;
    drop(output);

    if bytes_written != expected_size {
        return Err(format!(
            "Download size mismatch: manifest expected {expected_size} bytes, received {bytes_written}"
        ));
    }

    tokio::fs::rename(&partial, &destination)
        .await
        .map_err(|error| format!("Unable to install verified media file: {error}"))?;
    exclude_from_backup_nonfatal(&destination);

    let _ = app.emit(
        "download-complete",
        serde_json::json!({
            "filename": filename,
            "bytes_written": bytes_written,
            "total_bytes": expected_size
        }),
    );
    Ok(())
}

#[tauri::command]
async fn download_media_file(
    app: tauri::AppHandle,
    registry: tauri::State<'_, DownloadRegistry>,
    filename: String,
    version: Option<String>,
    expected_size: u64,
    expected_etag: String,
) -> Result<(), String> {
    let cancellation = CancellationToken::new();
    {
        let mut downloads = registry
            .0
            .lock()
            .map_err(|_| "Download registry is unavailable".to_string())?;
        if downloads.contains_key(&filename) {
            return Err(format!("A download is already active for {filename}"));
        }
        downloads.insert(filename.clone(), cancellation.clone());
    }

    let result = download_media_file_inner(
        &app,
        &filename,
        version.as_deref(),
        expected_size,
        &expected_etag,
        &cancellation,
    )
    .await;

    if let Err(error) = &result {
        log::warn!("Media download failed for {filename}: {error}");
    }
    if let Ok(mut downloads) = registry.0.lock() {
        downloads.remove(&filename);
    }
    result
}

#[tauri::command]
async fn cancel_media_downloads(
    registry: tauri::State<'_, DownloadRegistry>,
    filename: Option<String>,
) -> Result<(), String> {
    {
        let downloads = registry
            .0
            .lock()
            .map_err(|_| "Download registry is unavailable".to_string())?;
        match filename.as_deref() {
            Some(filename) => {
                if let Some(cancellation) = downloads.get(filename) {
                    cancellation.cancel();
                }
            }
            None => {
                for cancellation in downloads.values() {
                    cancellation.cancel();
                }
            }
        }
    }

    let wait_for_unwind = async {
        loop {
            let is_active = {
                let downloads = registry
                    .0
                    .lock()
                    .map_err(|_| "Download registry is unavailable".to_string())?;
                match filename.as_deref() {
                    Some(filename) => downloads.contains_key(filename),
                    None => !downloads.is_empty(),
                }
            };
            if !is_active {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    };

    tokio::time::timeout(Duration::from_secs(3), wait_for_unwind)
        .await
        .map_err(|_| "Timed out waiting for the cancelled download to stop".to_string())?
}

fn read_usb_manifest(selected_folder: &str) -> Result<(PathBuf, UsbMediaManifest), String> {
    let selected = PathBuf::from(selected_folder);
    let selected_metadata = std::fs::symlink_metadata(&selected)
        .map_err(|error| format!("Unable to inspect the selected USB folder: {error}"))?;
    if selected_metadata.file_type().is_symlink() || !selected_metadata.is_dir() {
        return Err(
            "Select a real folder on the conference drive, not a symbolic link".to_string(),
        );
    }
    let selected = std::fs::canonicalize(&selected)
        .map_err(|error| format!("Unable to open the selected USB folder: {error}"))?;

    let root_manifest = selected.join("eha-usb-manifest.json");
    let nested_media = selected.join("media");
    let (media_root, manifest_path) = if root_manifest.is_file() && nested_media.is_dir() {
        (nested_media, root_manifest)
    } else {
        let local_manifest = selected.join("eha-usb-manifest.json");
        let sibling_manifest = selected
            .parent()
            .map(|parent| parent.join("eha-usb-manifest.json"));
        let manifest_path = if local_manifest.is_file() {
            local_manifest
        } else if sibling_manifest.as_ref().is_some_and(|path| path.is_file()) {
            sibling_manifest.expect("sibling manifest was checked")
        } else {
            return Err(
                "The USB manifest was not accessible. Select the conference drive root containing both eha-usb-manifest.json and media/."
                    .to_string(),
            );
        };
        (selected, manifest_path)
    };

    let media_root = std::fs::canonicalize(&media_root)
        .map_err(|error| format!("Unable to open the USB media folder: {error}"))?;
    let metadata = std::fs::metadata(&manifest_path)
        .map_err(|error| format!("Unable to inspect the USB manifest: {error}"))?;
    if metadata.len() > MAX_TEXT_BYTES {
        return Err("The USB manifest exceeds the 4 MiB safety limit".to_string());
    }
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Unable to read the USB manifest: {error}"))?;
    let manifest: UsbMediaManifest = serde_json::from_str(&content)
        .map_err(|error| format!("The USB manifest is invalid: {error}"))?;
    validate_usb_manifest(&media_root, &manifest)?;
    Ok((media_root, manifest))
}

fn validate_usb_manifest(root: &Path, manifest: &UsbMediaManifest) -> Result<(), String> {
    if manifest.schema_version != 1 {
        return Err(format!(
            "The USB manifest uses unsupported schema {}",
            manifest.schema_version
        ));
    }
    if manifest.generated_at.trim().is_empty() || manifest.app_version.trim().is_empty() {
        return Err("The USB manifest is missing generation or app-version metadata".to_string());
    }
    if manifest.files.is_empty() || manifest.files.len() > MAX_USB_FILES {
        return Err("The USB manifest contains an invalid number of files".to_string());
    }

    let mut keys = HashSet::new();
    let mut total = 0u64;
    for file in &manifest.files {
        let relative = normalized_relative_path(&file.key)?;
        if !is_approved_download_path(&relative) {
            return Err(format!(
                "USB media is outside the approved catalog: {}",
                file.key
            ));
        }
        if !keys.insert(relative.clone()) {
            return Err(format!("The USB manifest repeats {}", file.key));
        }
        if file.size == 0 || file.size > MAX_USB_FILE_BYTES {
            return Err(format!(
                "The USB manifest reports an invalid size for {}",
                file.key
            ));
        }
        total = total
            .checked_add(file.size)
            .ok_or_else(|| "The USB manifest size overflowed".to_string())?;
        if total > MAX_USB_TOTAL_BYTES {
            return Err("The USB import exceeds the 12 GiB transfer ceiling".to_string());
        }
        if file.etag.trim().is_empty()
            || file.sha256.len() != 64
            || !file.sha256.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(format!(
                "The USB manifest has invalid verification data for {}",
                file.key
            ));
        }
        verify_no_symlinks(root, &relative, false)?;
        let source = std::fs::canonicalize(root.join(&relative))
            .map_err(|error| format!("USB media is missing: {} ({error})", file.key))?;
        if !source.starts_with(root) || !source.is_file() {
            return Err(format!(
                "USB media escaped the selected library: {}",
                file.key
            ));
        }
        let source_size = source
            .metadata()
            .map_err(|error| format!("Unable to inspect USB media {}: {error}", file.key))?
            .len();
        if source_size != file.size {
            return Err(format!(
                "USB media size does not match the manifest: {}",
                file.key
            ));
        }
    }
    Ok(())
}

fn usb_import_summary(manifest: &UsbMediaManifest) -> UsbImportSummary {
    UsbImportSummary {
        app_version: manifest.app_version.clone(),
        generated_at: manifest.generated_at.clone(),
        file_count: manifest.files.len(),
        total_bytes: manifest.files.iter().map(|file| file.size).sum(),
    }
}

fn detect_usb_drive_at_mount(mount_point: &Path) -> Option<UsbDriveDetected> {
    let manifest_path = mount_point.join("eha-usb-manifest.json");
    let metadata = std::fs::metadata(manifest_path).ok()?;
    if !metadata.is_file() {
        return None;
    }

    let folder = mount_point.to_str()?.to_string();
    let (_, manifest) = read_usb_manifest(&folder).ok()?;
    Some(UsbDriveDetected {
        folder,
        summary: usb_import_summary(&manifest),
    })
}

fn poll_for_usb_drives(app: &tauri::AppHandle) {
    use sysinfo::Disks;

    let disks = Disks::new_with_refreshed_list();
    let mounted: HashSet<PathBuf> = disks
        .list()
        .iter()
        .map(|disk| disk.mount_point().to_path_buf())
        .collect();

    let import_is_active = app
        .try_state::<UsbImportRegistry>()
        .and_then(|registry| registry.0.lock().ok().map(|active| active.is_some()))
        .unwrap_or(true);
    let Some(state) = app.try_state::<UsbDriveDetectionState>() else {
        return;
    };

    let candidates = {
        let Ok(mut session) = state.0.lock() else {
            return;
        };
        session
            .handled_mounts
            .retain(|mount| mounted.contains(mount));
        if session.suppressed || import_is_active {
            return;
        }
        mounted
            .iter()
            .filter(|mount| !session.handled_mounts.contains(*mount))
            .cloned()
            .collect::<Vec<_>>()
    };

    for mount in candidates {
        let Some(payload) = detect_usb_drive_at_mount(&mount) else {
            continue;
        };
        let import_started_during_validation = app
            .try_state::<UsbImportRegistry>()
            .and_then(|registry| registry.0.lock().ok().map(|active| active.is_some()))
            .unwrap_or(true);
        if import_started_during_validation {
            continue;
        }
        let should_emit = {
            let Ok(mut session) = state.0.lock() else {
                return;
            };
            if session.suppressed || session.handled_mounts.contains(&mount) {
                false
            } else {
                session.handled_mounts.insert(mount);
                true
            }
        };
        if should_emit {
            let _ = app.emit("usb-drive-detected", &payload);
        }
    }
}

fn start_usb_drive_polling(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            poll_for_usb_drives(&app);
            tokio::time::sleep(Duration::from_secs(4)).await;
        }
    });
}

#[tauri::command]
fn inspect_usb_media_folder(selected_folder: String) -> Result<UsbImportSummary, String> {
    let (_, manifest) = read_usb_manifest(&selected_folder)?;
    Ok(usb_import_summary(&manifest))
}

#[tauri::command]
fn set_usb_drive_detection_suppressed(
    state: tauri::State<'_, UsbDriveDetectionState>,
    suppressed: bool,
) -> Result<(), String> {
    let mut session = state
        .0
        .lock()
        .map_err(|_| "USB drive detection is unavailable".to_string())?;
    session.suppressed = suppressed;
    Ok(())
}

fn available_space_for(path: &Path) -> u64 {
    use sysinfo::Disks;
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .filter(|disk| path.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().as_os_str().len())
        .map(|disk| disk.available_space())
        .unwrap_or(0)
}

fn snapshot_matches(root: &Path, file: &UsbMediaFile) -> bool {
    let Ok(content) = std::fs::read_to_string(snapshot_path(root)) else {
        return false;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&content) else {
        return false;
    };
    value
        .get("files")
        .and_then(|files| files.get(&file.key))
        .is_some_and(|entry| {
            entry.get("etag").and_then(|value| value.as_str()) == Some(file.etag.as_str())
                && entry.get("size").and_then(|value| value.as_u64()) == Some(file.size)
        })
        && root
            .join(&file.key)
            .metadata()
            .is_ok_and(|metadata| metadata.len() == file.size)
}

async fn import_usb_file(
    app: &tauri::AppHandle,
    source_root: &Path,
    destination_root: &Path,
    file: &UsbMediaFile,
    generated_at: &str,
    completed_bytes: u64,
    total_bytes: u64,
    cancellation: &CancellationToken,
) -> Result<(), String> {
    let relative = normalized_relative_path(&file.key)?;
    let source = std::fs::canonicalize(source_root.join(&relative))
        .map_err(|error| format!("Unable to open USB media {}: {error}", file.key))?;
    if !source.starts_with(source_root) {
        return Err(format!(
            "USB media escaped the selected library: {}",
            file.key
        ));
    }
    let (destination, _) = prepare_download_destination(destination_root, &file.key)?;
    let partial = destination.with_file_name(format!(
        "{}.usb-import.part",
        destination
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| "USB media filename is not valid UTF-8".to_string())?
    ));
    if partial.exists() {
        let metadata = std::fs::symlink_metadata(&partial)
            .map_err(|error| format!("Unable to inspect USB partial file: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("USB partial file cannot be a symbolic link".to_string());
        }
        if metadata.len() > file.size {
            tokio::fs::remove_file(&partial)
                .await
                .map_err(|error| format!("Unable to reset USB partial file: {error}"))?;
        }
    }

    let existing_size = tokio::fs::metadata(&partial)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    if existing_size > 0 {
        let mut existing = tokio::fs::File::open(&partial)
            .await
            .map_err(|error| format!("Unable to resume USB partial file: {error}"))?;
        let mut buffer = vec![0u8; 1024 * 1024];
        loop {
            let read = tokio::io::AsyncReadExt::read(&mut existing, &mut buffer)
                .await
                .map_err(|error| format!("Unable to verify USB partial file: {error}"))?;
            if read == 0 {
                break;
            }
            hasher.update(&buffer[..read]);
        }
    }

    let mut input = tokio::fs::File::open(&source)
        .await
        .map_err(|error| format!("Unable to read USB media {}: {error}", file.key))?;
    tokio::io::AsyncSeekExt::seek(&mut input, std::io::SeekFrom::Start(existing_size))
        .await
        .map_err(|error| format!("Unable to resume USB media {}: {error}", file.key))?;
    let mut output = tokio::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&partial)
        .await
        .map_err(|error| format!("Unable to write imported media {}: {error}", file.key))?;
    let mut file_bytes = existing_size;
    let mut buffer = vec![0u8; 1024 * 1024];
    let mut last_emit = std::time::Instant::now();
    loop {
        let read = tokio::select! {
            _ = cancellation.cancelled() => return Err("USB import cancelled".to_string()),
            result = tokio::io::AsyncReadExt::read(&mut input, &mut buffer) => {
                result.map_err(|error| format!("Unable to read USB media {}: {error}", file.key))?
            }
        };
        if read == 0 {
            break;
        }
        tokio::io::AsyncWriteExt::write_all(&mut output, &buffer[..read])
            .await
            .map_err(|error| format!("Unable to write imported media {}: {error}", file.key))?;
        hasher.update(&buffer[..read]);
        file_bytes += read as u64;
        if file_bytes > file.size {
            drop(output);
            let _ = tokio::fs::remove_file(&partial).await;
            return Err(format!(
                "USB media exceeded its manifest size: {}",
                file.key
            ));
        }
        if last_emit.elapsed() >= Duration::from_millis(100) {
            let _ = app.emit(
                "usb-import-progress",
                serde_json::json!({
                    "filename": file.key,
                    "fileBytes": file_bytes,
                    "fileTotal": file.size,
                    "completedBytes": completed_bytes + file_bytes,
                    "totalBytes": total_bytes,
                }),
            );
            last_emit = std::time::Instant::now();
        }
    }
    tokio::io::AsyncWriteExt::flush(&mut output)
        .await
        .map_err(|error| format!("Unable to synchronize imported media {}: {error}", file.key))?;
    output
        .sync_all()
        .await
        .map_err(|error| format!("Unable to synchronize imported media {}: {error}", file.key))?;
    drop(output);

    let digest = format!("{:x}", hasher.finalize());
    if file_bytes != file.size || !digest.eq_ignore_ascii_case(&file.sha256) {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(format!(
            "USB media failed SHA-256 or size verification: {}",
            file.key
        ));
    }
    tokio::fs::rename(&partial, &destination)
        .await
        .map_err(|error| format!("Unable to install imported media {}: {error}", file.key))?;
    exclude_from_backup_nonfatal(&destination);
    update_snapshot_entry(destination_root, file, generated_at)?;
    let _ = app.emit(
        "usb-import-file-complete",
        serde_json::json!({ "filename": file.key }),
    );
    Ok(())
}

async fn import_usb_media_folder_inner(
    app: &tauri::AppHandle,
    selected_folder: &str,
    cancellation: &CancellationToken,
) -> Result<UsbImportSummary, String> {
    let (source_root, manifest) = read_usb_manifest(selected_folder)?;
    let destination_root = cached_media_dir(app)?;
    let total_bytes: u64 = manifest.files.iter().map(|file| file.size).sum();
    let pending_bytes: u64 = manifest
        .files
        .iter()
        .filter(|file| !snapshot_matches(&destination_root, file))
        .map(|file| file.size)
        .sum();
    let available = available_space_for(&destination_root);
    let reserve = 256 * 1024 * 1024u64;
    if available > 0 && available < pending_bytes.saturating_add(reserve) {
        return Err(format!(
            "Not enough disk space for the USB import. {} MiB is required plus a 256 MiB reserve, but only {} MiB is available.",
            pending_bytes / 1024 / 1024,
            available / 1024 / 1024,
        ));
    }

    let summary = usb_import_summary(&manifest);
    let _ = app.emit("usb-import-started", &summary);
    let mut completed_bytes = 0u64;
    for file in &manifest.files {
        if cancellation.is_cancelled() {
            return Err("USB import cancelled".to_string());
        }
        if snapshot_matches(&destination_root, file) {
            completed_bytes += file.size;
            let _ = app.emit(
                "usb-import-progress",
                serde_json::json!({
                    "filename": file.key,
                    "fileBytes": file.size,
                    "fileTotal": file.size,
                    "completedBytes": completed_bytes,
                    "totalBytes": total_bytes,
                }),
            );
            continue;
        }
        import_usb_file(
            app,
            &source_root,
            &destination_root,
            file,
            &manifest.generated_at,
            completed_bytes,
            total_bytes,
            cancellation,
        )
        .await?;
        completed_bytes += file.size;
    }
    let _ = app.emit("usb-import-complete", &summary);
    Ok(summary)
}

#[tauri::command]
async fn import_usb_media_folder(
    app: tauri::AppHandle,
    registry: tauri::State<'_, UsbImportRegistry>,
    selected_folder: String,
) -> Result<UsbImportSummary, String> {
    let cancellation = CancellationToken::new();
    {
        let mut active = registry
            .0
            .lock()
            .map_err(|_| "USB import registry is unavailable".to_string())?;
        if active.is_some() {
            return Err("A USB media import is already active".to_string());
        }
        *active = Some(cancellation.clone());
    }
    let result = import_usb_media_folder_inner(&app, &selected_folder, &cancellation).await;
    if let Ok(mut active) = registry.0.lock() {
        *active = None;
    }
    if let Err(error) = &result {
        log::warn!("USB media import stopped: {error}");
    }
    result
}

#[tauri::command]
async fn cancel_usb_media_import(
    registry: tauri::State<'_, UsbImportRegistry>,
) -> Result<(), String> {
    {
        let active = registry
            .0
            .lock()
            .map_err(|_| "USB import registry is unavailable".to_string())?;
        if let Some(cancellation) = active.as_ref() {
            cancellation.cancel();
        } else {
            return Ok(());
        }
    }
    tokio::time::timeout(Duration::from_secs(3), async {
        loop {
            let is_active = registry
                .0
                .lock()
                .map_err(|_| "USB import registry is unavailable".to_string())?
                .is_some();
            if !is_active {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(20)).await;
        }
    })
    .await
    .map_err(|_| "Timed out waiting for the USB import to stop".to_string())?
}

fn snapshot_path(root: &Path) -> PathBuf {
    root.join(".content-versions.json")
}

fn write_snapshot_content(root: &Path, content: &str) -> Result<(), String> {
    if content.len() as u64 > MAX_TEXT_BYTES {
        return Err("Content snapshot exceeds the 4 MiB safety limit".to_string());
    }
    validate_snapshot(content)?;
    let path = snapshot_path(root);
    let temp = root.join(".content-versions.json.tmp");
    for candidate in [&path, &temp] {
        if candidate.exists() {
            let metadata = std::fs::symlink_metadata(candidate)
                .map_err(|error| format!("Unable to inspect content snapshot: {error}"))?;
            if metadata.file_type().is_symlink() {
                return Err("Content snapshot cannot be a symbolic link".to_string());
            }
        }
    }
    let mut output = File::create(&temp)
        .map_err(|error| format!("Unable to create temporary content snapshot: {error}"))?;
    output
        .write_all(content.as_bytes())
        .and_then(|_| output.flush())
        .and_then(|_| output.sync_all())
        .map_err(|error| format!("Unable to save content snapshot: {error}"))?;
    drop(output);
    std::fs::rename(&temp, &path)
        .map_err(|error| format!("Unable to install content snapshot atomically: {error}"))?;
    exclude_from_backup_nonfatal(&path);
    Ok(())
}

fn update_snapshot_entry(
    root: &Path,
    file: &UsbMediaFile,
    generated_at: &str,
) -> Result<(), String> {
    let path = snapshot_path(root);
    let mut snapshot = std::fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .filter(|value| value.get("schema").and_then(|value| value.as_u64()) == Some(1))
        .unwrap_or_else(|| {
            serde_json::json!({
                "schema": 1,
                "avgSpeedBps": 0,
                "files": {}
            })
        });
    if !snapshot
        .get("files")
        .is_some_and(serde_json::Value::is_object)
    {
        snapshot["files"] = serde_json::json!({});
    }
    snapshot["files"][&file.key] = serde_json::json!({
        "etag": file.etag,
        "uploaded": generated_at,
        "size": file.size,
    });
    let content = serde_json::to_string_pretty(&snapshot)
        .map_err(|error| format!("Unable to serialize content snapshot: {error}"))?;
    write_snapshot_content(root, &content)
}

#[derive(Deserialize)]
struct ContentSnapshot {
    schema: u64,
    #[serde(rename = "avgSpeedBps")]
    avg_speed_bps: f64,
    files: HashMap<String, SnapshotEntry>,
}

#[derive(Deserialize)]
struct SnapshotEntry {
    etag: String,
    uploaded: String,
    size: u64,
}

fn validate_snapshot(content: &str) -> Result<(), String> {
    let snapshot: ContentSnapshot = serde_json::from_str(content)
        .map_err(|error| format!("Content snapshot has an invalid schema: {error}"))?;
    if snapshot.schema != 1 {
        return Err(format!(
            "Content snapshot uses unsupported schema {}",
            snapshot.schema
        ));
    }
    if !snapshot.avg_speed_bps.is_finite() || snapshot.avg_speed_bps < 0.0 {
        return Err("Content snapshot has an invalid average speed".to_string());
    }
    for (filename, entry) in snapshot.files {
        normalized_relative_path(&filename)
            .map_err(|error| format!("Content snapshot path is invalid: {error}"))?;
        if entry.etag.trim().is_empty() || entry.uploaded.trim().is_empty() || entry.size == 0 {
            return Err(format!(
                "Content snapshot metadata is incomplete for {filename}"
            ));
        }
    }
    Ok(())
}

fn read_snapshot_content(root: &Path) -> Result<String, String> {
    let path = snapshot_path(&root);
    if !path.exists() {
        return Ok("{}".to_string());
    }
    let metadata = std::fs::symlink_metadata(&path)
        .map_err(|error| format!("Unable to inspect content snapshot: {error}"))?;
    if metadata.file_type().is_symlink() || metadata.len() > MAX_TEXT_BYTES {
        return Err("Content snapshot failed its safety checks".to_string());
    }
    let content = std::fs::read_to_string(&path)
        .map_err(|error| format!("Unable to read content snapshot: {error}"))?;
    if let Err(error) = validate_snapshot(&content) {
        log::warn!("Removing corrupt content snapshot at {}", path.display());
        std::fs::remove_file(&path)
            .map_err(|error| format!("Unable to reset corrupt content snapshot: {error}"))?;
        log::warn!("Content snapshot was reset: {error}");
        return Ok("{}".to_string());
    }
    Ok(content)
}

#[tauri::command]
fn read_version_snapshot(app: tauri::AppHandle) -> Result<String, String> {
    let root = cached_media_dir(&app)?;
    read_snapshot_content(&root)
}

#[tauri::command]
fn write_version_snapshot(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let root = cached_media_dir(&app)?;
    write_snapshot_content(&root, &content)
}

#[tauri::command]
fn check_media_file_exists(app: tauri::AppHandle, filename: String) -> Result<bool, String> {
    let root = cached_media_dir(&app)?;
    match resolve_existing_media_file(&root, &filename) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
fn check_media_files_status(
    app: tauri::AppHandle,
    filenames: Vec<String>,
) -> Result<HashMap<String, bool>, String> {
    let root = cached_media_dir(&app)?;
    let mut result = HashMap::new();
    for filename in filenames {
        match normalized_relative_path(&filename) {
            Ok(relative) => {
                let clean = relative.to_string_lossy().to_string();
                let exists = resolve_existing_media_file(&root, &clean).is_ok();
                result.insert(clean, exists);
            }
            Err(error) => {
                log::warn!("Ignoring invalid media status path {filename}: {error}");
                result.insert(filename, false);
            }
        }
    }
    Ok(result)
}

#[tauri::command]
fn get_media_file_mtimes(
    app: tauri::AppHandle,
    filenames: Vec<String>,
) -> Result<HashMap<String, u64>, String> {
    let root = cached_media_dir(&app)?;
    let mut result = HashMap::new();
    for filename in filenames {
        if let Ok(path) = resolve_existing_media_file(&root, &filename) {
            if let Ok(modified) = path.metadata().and_then(|metadata| metadata.modified()) {
                if let Ok(duration) = modified.duration_since(std::time::UNIX_EPOCH) {
                    result.insert(filename, duration.as_millis() as u64);
                }
            }
        }
    }
    Ok(result)
}

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn check_disk_space(app: tauri::AppHandle) -> Result<u64, String> {
    use sysinfo::Disks;
    let root = cached_media_dir(&app)?;
    let disks = Disks::new_with_refreshed_list();
    let mut best_match = (0usize, 0u64);

    for disk in disks.list() {
        let mount = disk.mount_point();
        if root.starts_with(mount) {
            let length = mount.as_os_str().len();
            if length > best_match.0 {
                best_match = (length, disk.available_space());
            }
        }
    }
    Ok(best_match.1)
}

#[tauri::command]
fn set_display_sleep_prevention(
    assertion: tauri::State<'_, DisplaySleepAssertion>,
    active: bool,
) -> Result<(), String> {
    assertion.set_active(active)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DownloadRegistry::default())
        .manage(UsbImportRegistry::default())
        .manage(UsbDriveDetectionState::default())
        .manage(MediaLibrary::default())
        .manage(DisplaySleepAssertion::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_media_storage_status,
            read_subtitle_file,
            download_media_file,
            cancel_media_downloads,
            inspect_usb_media_folder,
            import_usb_media_folder,
            cancel_usb_media_import,
            set_usb_drive_detection_suppressed,
            check_media_file_exists,
            check_media_files_status,
            close_splashscreen,
            check_disk_space,
            read_version_snapshot,
            write_version_snapshot,
            get_media_file_mtimes,
            set_display_sleep_prevention,
        ])
        .register_asynchronous_uri_scheme_protocol("media", move |app, request, responder| {
            let response = cached_media_dir(app.app_handle())
                .and_then(|root| {
                    handle_media_request(&root, request).map_err(|error| error.to_string())
                })
                .unwrap_or_else(|error| {
                    ResponseBuilder::new()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .header(CONTENT_TYPE, "text/plain; charset=utf-8")
                        .body(error.into_bytes())
                        .expect("static error response must be valid")
                });
            responder.respond(response);
        })
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            let initialization = initialize_media_dir(app.handle());
            let library = app.state::<MediaLibrary>();
            if library.0.set(initialization.clone()).is_err() {
                log::error!("Media library was initialized more than once");
            }
            match initialization {
                Ok(path) => log::info!("Media library: {}", path.display()),
                Err(error) => log::error!("{error}"),
            }
            register_power_notifications(app.handle().clone());
            start_usb_drive_polling(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, tauri::WindowEvent::Destroyed) {
                if let Some(assertion) = window.app_handle().try_state::<DisplaySleepAssertion>() {
                    assertion.release_nonfatal();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root(label: &str) -> PathBuf {
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!(
            "cpr-trainer-{label}-{}-{unique}",
            std::process::id()
        ))
    }

    #[test]
    fn rejects_absolute_and_parent_paths() {
        assert!(normalized_relative_path("../video.mp4").is_err());
        assert!(normalized_relative_path("/tmp/video.mp4").is_err());
        assert!(normalized_relative_path("slides/../../video.mp4").is_err());
    }

    #[test]
    fn rejects_executable_and_document_extensions() {
        assert!(normalized_relative_path("video.js").is_err());
        assert!(normalized_relative_path("manifest.json").is_err());
        assert!(normalized_relative_path("notes.md").is_err());
        assert!(normalized_relative_path("image.svg").is_err());
    }

    #[test]
    fn allows_catalog_prefixes_and_known_root_assets() {
        let slide =
            normalized_relative_path("CPR AED Presentation Slides/01_EHAcademy - Introduction.png")
                .unwrap();
        assert!(is_approved_download_path(&slide));
        assert!(is_approved_download_path(
            &normalized_relative_path("instructor_manual.pdf").unwrap()
        ));
        assert!(!is_approved_download_path(
            &normalized_relative_path("01_EHAcademy - CPR AED Spanish Pres-Introduccion.png")
                .unwrap()
        ));
        assert!(!is_approved_download_path(
            &normalized_relative_path("unapproved-video.mp4").unwrap()
        ));
        assert!(!is_approved_download_path(
            &normalized_relative_path("01_extra_EHAcademy - CPR AED Spanish Pres-Introduccion.png")
                .unwrap()
        ));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_media_files() {
        use std::os::unix::fs::symlink;

        let root = std::env::temp_dir().join(format!(
            "cpr-trainer-path-test-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("thread")
        ));
        let outside = root.with_extension("outside.mp4");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(&outside, b"outside").unwrap();
        symlink(&outside, root.join("linked.mp4")).unwrap();

        assert!(resolve_existing_media_file(&root, "linked.mp4").is_err());

        std::fs::remove_file(root.join("linked.mp4")).unwrap();
        std::fs::remove_file(outside).unwrap();
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn normalizes_http_etags_without_changing_multipart_values() {
        assert_eq!(normalized_etag("\"abc-2\""), "abc-2");
        assert_eq!(normalized_etag("W/\"abc\""), "abc");
        assert_eq!(if_range_etag("abc-2"), "\"abc-2\"");
        assert_eq!(if_range_etag("\"abc-2\""), "\"abc-2\"");
    }

    #[test]
    fn partial_download_resets_at_or_above_expected_size() {
        assert!(!should_reset_partial_download(99, 100));
        assert!(should_reset_partial_download(100, 100));
        assert!(should_reset_partial_download(101, 100));
    }

    #[test]
    fn validates_the_content_snapshot_schema() {
        let valid = r#"{
            "schema": 1,
            "avgSpeedBps": 42.5,
            "files": {
                "App Thumbnails/cpr-aed.png": {
                    "etag": "abc-2",
                    "uploaded": "2026-07-31T00:00:00Z",
                    "size": 123
                }
            }
        }"#;
        assert!(validate_snapshot(valid).is_ok());
        assert!(validate_snapshot("[]").is_err());
        assert!(validate_snapshot(r#"{"schema":2,"avgSpeedBps":0,"files":{}}"#).is_err());
        assert!(validate_snapshot(r#"{"schema":1,"avgSpeedBps":0,"files":{"video.mp4":{"etag":"","uploaded":"now","size":1}}}"#).is_err());
    }

    #[test]
    fn corrupt_snapshot_is_removed_and_recovers_empty() {
        let root = test_root("snapshot-recovery");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(snapshot_path(&root), b"not-json").unwrap();
        assert_eq!(read_snapshot_content(&root).unwrap(), "{}");
        assert!(!snapshot_path(&root).exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn validates_usb_catalog_shape_and_source_files() {
        let root = test_root("usb-manifest");
        let folder = root.join("CPR AED Presentation Slides");
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join("slide.png"), b"usb").unwrap();
        let root = std::fs::canonicalize(root).unwrap();
        let manifest = UsbMediaManifest {
            schema_version: 1,
            generated_at: "2026-08-01T00:00:00Z".to_string(),
            app_version: "3.0.0".to_string(),
            files: vec![UsbMediaFile {
                key: "CPR AED Presentation Slides/slide.png".to_string(),
                size: 3,
                etag: "etag".to_string(),
                sha256: "0".repeat(64),
            }],
        };
        let result = validate_usb_manifest(&root, &manifest);
        assert!(result.is_ok(), "{result:?}");
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn detects_only_valid_root_usb_manifests() {
        assert!(UsbDriveDetectionSession::default().suppressed);

        let root = test_root("usb-detection");
        let valid_root = root.join("valid");
        let media_folder = valid_root.join("media").join("CPR AED Presentation Slides");
        std::fs::create_dir_all(&media_folder).unwrap();
        std::fs::write(media_folder.join("slide.png"), b"usb").unwrap();
        std::fs::write(
            valid_root.join("eha-usb-manifest.json"),
            serde_json::json!({
                "schemaVersion": 1,
                "generatedAt": "2026-08-03T00:00:00Z",
                "appVersion": "3.0.0",
                "files": [{
                    "key": "CPR AED Presentation Slides/slide.png",
                    "size": 3,
                    "etag": "etag",
                    "sha256": "0".repeat(64),
                }],
            })
            .to_string(),
        )
        .unwrap();
        let valid_root = std::fs::canonicalize(valid_root).unwrap();
        let detected = detect_usb_drive_at_mount(&valid_root).expect("valid drive is detected");
        assert_eq!(detected.folder, valid_root.to_string_lossy());
        assert_eq!(detected.summary.file_count, 1);
        assert_eq!(detected.summary.total_bytes, 3);

        let missing_root = root.join("missing");
        std::fs::create_dir_all(&missing_root).unwrap();
        assert!(detect_usb_drive_at_mount(&missing_root).is_none());

        let invalid_root = root.join("invalid");
        std::fs::create_dir_all(&invalid_root).unwrap();
        std::fs::write(invalid_root.join("eha-usb-manifest.json"), b"not-json").unwrap();
        assert!(detect_usb_drive_at_mount(&invalid_root).is_none());

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn protocol_bounds_video_responses_and_honors_head() {
        let root = test_root("protocol");
        std::fs::create_dir_all(&root).unwrap();
        let root = std::fs::canonicalize(root).unwrap();
        std::fs::write(root.join("video.mp4"), vec![7; 3 * 1024 * 1024]).unwrap();
        std::fs::write(root.join("image.png"), b"png").unwrap();

        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::GET)
                .uri("media://localhost/video.mp4")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len(), MAX_PROTOCOL_CHUNK as usize);

        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::GET)
                .uri("media://localhost/video.mp4")
                .header(RANGE, "bytes=1-3145727")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.body().len(), MAX_PROTOCOL_CHUNK as usize);
        assert_eq!(
            response.headers().get(CONTENT_RANGE).unwrap(),
            "bytes 1-2097152/3145728"
        );

        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::HEAD)
                .uri("media://localhost/image.png")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.body().is_empty());
        assert_eq!(response.headers().get(CONTENT_LENGTH).unwrap(), "3");

        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::POST)
                .uri("media://localhost/image.png")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);

        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::GET)
                .uri("media://localhost/video.mp4")
                .header(RANGE, "bytes=999999999-")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE);

        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn protocol_rejects_encoded_traversal() {
        let root = test_root("protocol-traversal");
        std::fs::create_dir_all(&root).unwrap();
        let root = std::fs::canonicalize(root).unwrap();
        let response = handle_media_request(
            &root,
            http::Request::builder()
                .method(http::Method::GET)
                .uri("media://localhost/%2E%2E/secret.mp4")
                .body(Vec::new())
                .unwrap(),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        std::fs::remove_dir_all(root).unwrap();
    }
}
