use futures_util::StreamExt;
use http::{header::*, response::Builder as ResponseBuilder, status::StatusCode};
use http_range::HttpRange;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tauri::{Emitter, Manager};

/// Strip the Windows extended-length path prefix (\\?\) from a path string.
fn clean_path(path: PathBuf) -> PathBuf {
    let path_str = path.to_string_lossy().to_string();
    if let Some(stripped) = path_str.strip_prefix("\\\\?\\") {
        PathBuf::from(stripped)
    } else {
        path
    }
}

/// Find the media directory dynamically based on environment priority:
/// 1. Standalone EXE directory (portable)
/// 2. Installer resource directory (standard installer deployment)
/// 3. CWD directory (development mode)
fn find_media_dir(app: &tauri::AppHandle) -> PathBuf {
    // 1. Return exe_dir/media (portable standalone mode) proactively
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_path = clean_path(exe_path);
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("media");
        }
    }

    // 2. Fallback to resource_dir/media
    if let Ok(resource_dir) = app.path().resource_dir() {
        return clean_path(resource_dir).join("media");
    }

    // 3. Fallback to CWD media/
    PathBuf::from("media")
}

/// Guess MIME type from file extension
fn mime_type(path: &str) -> &'static str {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "ogv" => "video/ogg",
        "mov" => "video/quicktime",
        "avi" => "video/x-msvideo",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "json" => "application/json",
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        _ => "application/octet-stream",
    }
}

/// Handle a media protocol request with Range header support for video streaming
fn handle_media_request(
    media_dir: &std::path::Path,
    request: http::Request<Vec<u8>>,
) -> Result<http::Response<Vec<u8>>, Box<dyn std::error::Error>> {
    // Decode the URL path to get the filename
    let raw_path = request.uri().path();
    let path_bytes = if raw_path.starts_with('/') {
        raw_path.as_bytes().get(1..).unwrap_or(&[])
    } else {
        raw_path.as_bytes()
    };
    let decoded = percent_encoding::percent_decode(path_bytes)
        .decode_utf8_lossy()
        .to_string();

    eprintln!("[media-protocol] Request: {}", decoded);

    // Security: prevent path traversal
    if decoded.contains("..") {
        return Ok(ResponseBuilder::new()
            .status(StatusCode::FORBIDDEN)
            .body(Vec::new())?);
    }

    let file_path = media_dir.join(&decoded);

    if !file_path.exists() {
        eprintln!("[media-protocol] File not found: {:?}", file_path);
        return Ok(ResponseBuilder::new()
            .status(StatusCode::NOT_FOUND)
            .body(format!("File not found: {}", decoded).into_bytes())?);
    }

    let content_type = mime_type(&decoded);
    let mut file = std::fs::File::open(&file_path)?;

    // Get file size
    let len = {
        let old_pos = file.stream_position()?;
        let len = file.seek(SeekFrom::End(0))?;
        file.seek(SeekFrom::Start(old_pos))?;
        len
    };

    let mut resp = ResponseBuilder::new()
        .header(CONTENT_TYPE, content_type)
        .header(ACCESS_CONTROL_ALLOW_ORIGIN, "*");

    // Handle Range requests for video streaming
    let http_response = if let Some(range_header) = request.headers().get("range") {
        let not_satisfiable = || {
            ResponseBuilder::new()
                .status(StatusCode::RANGE_NOT_SATISFIABLE)
                .header(CONTENT_RANGE, format!("bytes */{len}"))
                .body(vec![])
        };

        let ranges = if let Ok(ranges) = HttpRange::parse(range_header.to_str()?, len) {
            ranges
                .iter()
                .map(|r| (r.start, r.start + r.length - 1))
                .collect::<Vec<_>>()
        } else {
            return Ok(not_satisfiable()?);
        };

        // Max chunk size: 2MB
        const MAX_LEN: u64 = 2 * 1024 * 1024;

        if let Some(&(start, mut end)) = ranges.first() {
            if start >= len || end >= len || end < start {
                return Ok(not_satisfiable()?);
            }

            end = start + (end - start).min(len - start).min(MAX_LEN - 1);
            let bytes_to_read = end + 1 - start;

            let mut buf = Vec::with_capacity(bytes_to_read as usize);
            file.seek(SeekFrom::Start(start))?;
            file.take(bytes_to_read).read_to_end(&mut buf)?;

            resp = resp.header(CONTENT_RANGE, format!("bytes {start}-{end}/{len}"));
            resp = resp.header(CONTENT_LENGTH, end + 1 - start);
            resp = resp.header(ACCEPT_RANGES, "bytes");
            resp = resp.status(StatusCode::PARTIAL_CONTENT);
            resp.body(buf)
        } else {
            return Ok(not_satisfiable()?);
        }
    } else {
        // No Range header — serve entire file
        resp = resp.header(CONTENT_LENGTH, len);
        resp = resp.header(ACCEPT_RANGES, "bytes");
        let mut buf = Vec::with_capacity(len as usize);
        file.read_to_end(&mut buf)?;
        resp.body(buf)
    };

    http_response.map_err(Into::into)
}

#[tauri::command]
fn get_media_base_path(_app: tauri::AppHandle) -> Result<String, String> {
    // In custom protocol mode, we just return the protocol URL base
    // The frontend will use "http://media.localhost/<filename>" on Windows
    Ok("http://media.localhost/".to_string())
}

#[tauri::command]
fn list_media_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = find_media_dir(&app);
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                files.push(name.to_string());
            }
        }
    } else {
        return Err(format!("Failed to read media directory: {:?}", dir));
    }
    files.sort();
    Ok(files)
}

#[tauri::command]
fn open_browser(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_subtitle_file(app: tauri::AppHandle, filename: String) -> Result<String, String> {
    // Security check: prevent directory traversal
    if filename.contains("..") {
        return Err("Invalid filename: directory traversal detected".to_string());
    }

    let media_dir = find_media_dir(&app);
    // Clean filename and join with media/subtitles/
    let clean_name = filename.trim_start_matches('/');
    let file_path = media_dir.join("subtitles").join(clean_name);

    if !file_path.exists() {
        return Err(format!("Subtitle file not found: {:?}", file_path));
    }

    std::fs::read_to_string(&file_path).map_err(|e| format!("Failed to read subtitle file: {}", e))
}

#[tauri::command]
async fn download_media_file(
    app: tauri::AppHandle,
    base_url: String,
    filename: String,
    version: Option<String>,
) -> Result<(), String> {
    if filename.contains("..") {
        return Err("Invalid filename: directory traversal detected".to_string());
    }

    let media_dir = find_media_dir(&app);
    // Ensure media directory exists
    std::fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;

    let clean = filename.trim_start_matches('/');
    let dest_path = media_dir.join(clean);

    // Create parent directories if needed (e.g., subtitles/)
    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }

    // Build the full download URL
    let encoded_filename = clean
        .split('/')
        .map(|part| {
            percent_encoding::percent_encode(part.as_bytes(), percent_encoding::NON_ALPHANUMERIC)
                .to_string()
        })
        .collect::<Vec<_>>()
        .join("/");

    let mut url = format!("{}{}", base_url, encoded_filename);
    if let Some(ref v) = version {
        url = format!("{}?v={}", url, v);
    }

    eprintln!("[download] Starting download: {} -> {:?}", url, dest_path);

    let temp_path = dest_path.with_extension("tmp");
    let existing_size = if version.is_some() {
        0
    } else {
        tokio::fs::metadata(&temp_path)
            .await
            .map(|m| m.len())
            .unwrap_or(0)
    };

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if existing_size > 0 {
        req = req.header("Range", format!("bytes={}-", existing_size));
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {} for {}", response.status(), url));
    }

    let is_partial = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    let bytes_already_written = if is_partial { existing_size } else { 0 };
    let mut bytes_written: u64 = bytes_already_written;
    let total_bytes = bytes_already_written + response.content_length().unwrap_or(0);

    // Write to a temp file first, then rename (atomic-ish)
    let mut file = if is_partial {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&temp_path)
            .await
            .map_err(|e| format!("Failed to open temp file for appending: {}", e))?
    } else {
        tokio::fs::File::create(&temp_path)
            .await
            .map_err(|e| format!("Failed to create temp file: {}", e))?
    };

    let mut stream = response.bytes_stream();
    let mut last_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download stream error: {}", e))?;
        tokio::io::AsyncWriteExt::write_all(&mut file, &chunk)
            .await
            .map_err(|e| format!("Write failed: {}", e))?;
        bytes_written += chunk.len() as u64;

        // Emit progress events throttled to ~10Hz
        if last_emit.elapsed().as_millis() >= 100 {
            let _ = app.emit(
                "download-progress",
                serde_json::json!({
                    "filename": clean,
                    "bytes_written": bytes_written,
                    "total_bytes": total_bytes
                }),
            );
            last_emit = std::time::Instant::now();
        }
    }

    // Flush and close
    tokio::io::AsyncWriteExt::flush(&mut file)
        .await
        .map_err(|e| format!("Flush failed: {}", e))?;
    drop(file);

    // Verify integrity (Content-Length matching)
    if total_bytes > 0 && bytes_written != total_bytes {
        let _ = tokio::fs::remove_file(&temp_path).await; // Clean up broken file
        return Err(format!(
            "Download corrupted: Expected {} bytes but got {}",
            total_bytes, bytes_written
        ));
    }

    // Rename temp to final
    let mut rename_attempts = 5;
    let mut backoff = 200; // ms
    loop {
        match tokio::fs::rename(&temp_path, &dest_path).await {
            Ok(_) => break,
            Err(e) => {
                rename_attempts -= 1;
                if rename_attempts == 0 {
                    let _ = tokio::fs::remove_file(&temp_path).await; // Clean up .tmp
                    return Err(format!("Rename failed persistently: {}", e));
                }
                tokio::time::sleep(std::time::Duration::from_millis(backoff)).await;
                backoff *= 2;
            }
        }
    }

    eprintln!(
        "[download] ✅ Completed: {} ({} bytes)",
        clean, bytes_written
    );

    // Emit completion event
    let _ = app.emit(
        "download-complete",
        serde_json::json!({
            "filename": clean,
            "bytes_written": bytes_written,
            "total_bytes": total_bytes
        }),
    );

    Ok(())
}

#[tauri::command]
fn read_version_snapshot(app: tauri::AppHandle) -> Result<String, String> {
    let media_dir = find_media_dir(&app);
    let snapshot_path = media_dir.join(".content-versions.json");
    if !snapshot_path.exists() {
        return Ok("{}".to_string());
    }
    std::fs::read_to_string(&snapshot_path).map_err(|e| format!("Failed to read snapshot: {}", e))
}

#[tauri::command]
fn write_version_snapshot(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let media_dir = find_media_dir(&app);
    std::fs::create_dir_all(&media_dir)
        .map_err(|e| format!("Failed to create media directory: {}", e))?;
    let snapshot_path = media_dir.join(".content-versions.json");
    let temp_path = media_dir.join(".content-versions.json.tmp");
    std::fs::write(&temp_path, content)
        .map_err(|e| format!("Failed to write snapshot to temp: {}", e))?;
    std::fs::rename(&temp_path, &snapshot_path).map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to rename snapshot: {}", e)
    })
}

#[tauri::command]
fn check_media_file_exists(app: tauri::AppHandle, filename: String) -> Result<bool, String> {
    if filename.contains("..") {
        return Err("Invalid filename".to_string());
    }
    let media_dir = find_media_dir(&app);
    let clean = filename.trim_start_matches('/');
    let file_path = media_dir.join(clean);
    Ok(file_path.exists() && file_path.is_file())
}

#[tauri::command]
fn check_media_files_status(
    app: tauri::AppHandle,
    filenames: Vec<String>,
) -> Result<std::collections::HashMap<String, bool>, String> {
    let media_dir = find_media_dir(&app);
    let mut result = std::collections::HashMap::new();
    for filename in filenames {
        let clean = filename.trim_start_matches('/').to_string();
        let file_path = media_dir.join(&clean);
        result.insert(clean, file_path.exists() && file_path.is_file());
    }
    Ok(result)
}

#[tauri::command]
fn get_media_file_mtimes(
    app: tauri::AppHandle,
    filenames: Vec<String>,
) -> Result<std::collections::HashMap<String, u64>, String> {
    let media_dir = find_media_dir(&app);
    let mut result = std::collections::HashMap::new();
    for filename in filenames {
        if filename.contains("..") {
            continue;
        }
        let clean = filename.trim_start_matches('/').to_string();
        let file_path = media_dir.join(&clean);
        if let Ok(metadata) = std::fs::metadata(&file_path) {
            if let Ok(mtime) = metadata.modified() {
                if let Ok(duration) = mtime.duration_since(std::time::UNIX_EPOCH) {
                    result.insert(filename, duration.as_millis() as u64);
                }
            }
        }
    }
    Ok(result)
}

#[tauri::command]
async fn close_splashscreen(window: tauri::Window) {
    // Close splashscreen
    if let Some(splashscreen) = window.get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    // Show main window
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
fn check_disk_space(app: tauri::AppHandle) -> Result<u64, String> {
    use sysinfo::Disks;
    let media_dir = find_media_dir(&app);
    let disks = Disks::new_with_refreshed_list();

    let mut max_prefix_len = 0;
    let mut available_space = 0;

    let abs_media_dir = std::fs::canonicalize(&media_dir).unwrap_or_else(|_| media_dir.clone());
    let media_dir_str = abs_media_dir.to_string_lossy().to_lowercase();

    for disk in disks.list() {
        let mount_point = disk.mount_point().to_string_lossy().to_lowercase();
        if media_dir_str.starts_with(&mount_point) {
            if mount_point.len() > max_prefix_len {
                max_prefix_len = mount_point.len();
                available_space = disk.available_space();
            }
        }
    }

    // Fallback if we somehow can't match a disk
    if max_prefix_len == 0 {
        if let Some(first_disk) = disks.list().first() {
            available_space = first_disk.available_space();
        }
    }

    Ok(available_space)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_media_base_path,
            list_media_files,
            open_browser,
            read_subtitle_file,
            download_media_file,
            check_media_file_exists,
            check_media_files_status,
            close_splashscreen,
            check_disk_space,
            read_version_snapshot,
            write_version_snapshot,
            get_media_file_mtimes,
        ])
        // Register custom "media" protocol to serve files from media directory
        // On Windows: accessible via http://media.localhost/<filename>
        // On macOS/Linux: accessible via media://localhost/<filename>
        .register_asynchronous_uri_scheme_protocol("media", move |app, request, responder| {
            let media_dir = find_media_dir(app.app_handle());
            match handle_media_request(&media_dir, request) {
                Ok(response) => responder.respond(response),
                Err(e) => {
                    eprintln!("[media-protocol] Error: {}", e);
                    responder.respond(
                        ResponseBuilder::new()
                            .status(StatusCode::INTERNAL_SERVER_ERROR)
                            .header(CONTENT_TYPE, "text/plain")
                            .body(e.to_string().as_bytes().to_vec())
                            .unwrap(),
                    );
                }
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();

            // Log resolved media directory for tracking
            let resolved_media = find_media_dir(&handle);
            eprintln!(
                "[CPR Trainer Pro] Resolved media directory: {:?}",
                resolved_media
            );

            // Enable logging in production to persist errors to AppData/logs
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
