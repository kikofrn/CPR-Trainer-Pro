use futures_util::StreamExt;
use http::{header::*, response::Builder as ResponseBuilder, status::StatusCode};
use http_range::HttpRange;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};
use tokio_util::sync::CancellationToken;

const CDN_BASE: &str = "https://media.ehacademy.com/";
const MAX_PROTOCOL_CHUNK: u64 = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_PDF_BYTES: u64 = 128 * 1024 * 1024;
const MAX_TEXT_BYTES: u64 = 4 * 1024 * 1024;
const DOWNLOAD_STALL_TIMEOUT: Duration = Duration::from_secs(30);

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

fn media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("media"))
        .map_err(|error| format!("Unable to locate Application Support: {error}"))
}

fn ensure_media_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let path = media_dir(app)?;
    std::fs::create_dir_all(&path).map_err(|error| {
        format!(
            "CPR Trainer Pro cannot create its media library at {}. Check folder permissions and available disk space, then reopen the app. ({error})",
            path.display()
        )
    })?;
    exclude_from_backup(&path)?;
    std::fs::canonicalize(&path).map_err(|error| {
        format!(
            "Unable to resolve media library {}: {error}",
            path.display()
        )
    })
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
        [filename] => {
            APPROVED_ROOT_ASSETS.contains(filename) || is_approved_spanish_root_asset(filename)
        }
        [prefix, ..] => APPROVED_FOLDER_PREFIXES.contains(prefix),
        _ => false,
    }
}

fn is_approved_spanish_root_asset(filename: &str) -> bool {
    let bytes = filename.as_bytes();
    let numbered = bytes.len() > 3
        && bytes[0].is_ascii_digit()
        && bytes[1].is_ascii_digit()
        && bytes[2] == b'_';
    if !numbered {
        return false;
    }
    let name = &filename[3..];
    name.starts_with("EHAcademy - CPR AED Spanish Pres-")
        || name.starts_with("EHAcademy - First Aid Spanish Pres-")
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
        let ranges = match HttpRange::parse(range_header.to_str()?, len) {
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
    ensure_media_dir(&app).map(|path| path.display().to_string())
}

#[tauri::command]
fn list_media_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    fn collect(root: &Path, current: &Path, files: &mut Vec<String>) -> Result<(), String> {
        for entry in std::fs::read_dir(current)
            .map_err(|error| format!("Unable to read {}: {error}", current.display()))?
        {
            let entry = entry.map_err(|error| error.to_string())?;
            let metadata = entry
                .file_type()
                .map_err(|error| format!("Unable to inspect media entry: {error}"))?;
            if metadata.is_symlink() {
                continue;
            }
            if metadata.is_dir() {
                collect(root, &entry.path(), files)?;
            } else if metadata.is_file() {
                let relative = entry
                    .path()
                    .strip_prefix(root)
                    .map_err(|_| "Media entry escaped the app library".to_string())?
                    .to_string_lossy()
                    .to_string();
                if normalized_relative_path(&relative).is_ok() {
                    files.push(relative);
                }
            }
        }
        Ok(())
    }

    let root = ensure_media_dir(&app)?;
    let mut files = Vec::new();
    collect(&root, &root, &mut files)?;
    files.sort();
    Ok(files)
}

#[tauri::command]
fn read_subtitle_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    let relative = format!("subtitles/{filename}");
    let root = ensure_media_dir(&app)?;
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
    if expected_etag.trim().is_empty() {
        return Err("The media manifest did not provide an ETag".to_string());
    }

    let root = ensure_media_dir(app)?;
    let (destination, partial) = prepare_download_destination(&root, filename)?;
    if version.is_some() {
        let _ = tokio::fs::remove_file(&partial).await;
    }

    let mut existing_size = tokio::fs::metadata(&partial)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if existing_size > expected_size {
        tokio::fs::remove_file(&partial)
            .await
            .map_err(|error| format!("Unable to reset invalid partial download: {error}"))?;
        existing_size = 0;
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| format!("Unable to initialize secure download client: {error}"))?;
    let url = encoded_media_url(filename, version);
    let mut request = client.get(&url);
    if existing_size > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={existing_size}-"));
    }

    let response = tokio::select! {
        _ = cancellation.cancelled() => return Err("Download cancelled".to_string()),
        result = request.send() => result.map_err(|error| format!("Download request failed: {error}"))?,
    };
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
    exclude_from_backup(&destination)?;

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
fn cancel_media_downloads(registry: tauri::State<'_, DownloadRegistry>) -> Result<(), String> {
    let downloads = registry
        .0
        .lock()
        .map_err(|_| "Download registry is unavailable".to_string())?;
    for cancellation in downloads.values() {
        cancellation.cancel();
    }
    Ok(())
}

fn snapshot_path(root: &Path) -> PathBuf {
    root.join(".content-versions.json")
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

#[tauri::command]
fn read_version_snapshot(app: tauri::AppHandle) -> Result<String, String> {
    let root = ensure_media_dir(&app)?;
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
fn write_version_snapshot(app: tauri::AppHandle, content: String) -> Result<(), String> {
    if content.len() as u64 > MAX_TEXT_BYTES {
        return Err("Content snapshot exceeds the 4 MiB safety limit".to_string());
    }
    validate_snapshot(&content)?;

    let root = ensure_media_dir(&app)?;
    let path = snapshot_path(&root);
    let temp = root.join(".content-versions.json.tmp");
    if path.exists() {
        let metadata = std::fs::symlink_metadata(&path)
            .map_err(|error| format!("Unable to inspect content snapshot: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Content snapshot cannot be a symbolic link".to_string());
        }
    }
    if temp.exists() {
        let metadata = std::fs::symlink_metadata(&temp)
            .map_err(|error| format!("Unable to inspect temporary snapshot: {error}"))?;
        if metadata.file_type().is_symlink() {
            return Err("Temporary content snapshot cannot be a symbolic link".to_string());
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
    exclude_from_backup(&path)
}

#[tauri::command]
fn check_media_file_exists(app: tauri::AppHandle, filename: String) -> Result<bool, String> {
    let root = ensure_media_dir(&app)?;
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
    let root = ensure_media_dir(&app)?;
    let mut result = HashMap::new();
    for filename in filenames {
        let relative = normalized_relative_path(&filename)?;
        let clean = relative.to_string_lossy().to_string();
        let exists = resolve_existing_media_file(&root, &clean).is_ok();
        result.insert(clean, exists);
    }
    Ok(result)
}

#[tauri::command]
fn get_media_file_mtimes(
    app: tauri::AppHandle,
    filenames: Vec<String>,
) -> Result<HashMap<String, u64>, String> {
    let root = ensure_media_dir(&app)?;
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
    let root = ensure_media_dir(&app)?;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DownloadRegistry::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_media_storage_status,
            list_media_files,
            read_subtitle_file,
            download_media_file,
            cancel_media_downloads,
            check_media_file_exists,
            check_media_files_status,
            close_splashscreen,
            check_disk_space,
            read_version_snapshot,
            write_version_snapshot,
            get_media_file_mtimes,
        ])
        .register_asynchronous_uri_scheme_protocol("media", move |app, request, responder| {
            let response = ensure_media_dir(app.app_handle())
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
            match ensure_media_dir(app.handle()) {
                Ok(path) => log::info!("Media library: {}", path.display()),
                Err(error) => log::error!("{error}"),
            }
            Ok(())
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
        assert!(is_approved_download_path(
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
