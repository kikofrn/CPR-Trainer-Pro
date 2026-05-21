use http::{header::*, response::Builder as ResponseBuilder, status::StatusCode};
use http_range::HttpRange;
use std::io::{Read, Seek, SeekFrom};
use std::path::PathBuf;
use tauri::Manager;

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
    // 1. Check exe_dir/media (portable standalone mode)
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_path = clean_path(exe_path);
        if let Some(exe_dir) = exe_path.parent() {
            let media_dir = exe_dir.join("media");
            if media_dir.exists() && media_dir.is_dir() {
                return media_dir;
            }
        }
    }

    // 2. Check resource_dir/media (installer bundle mode)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let media_dir = clean_path(resource_dir).join("media");
        if media_dir.exists() && media_dir.is_dir() {
            return media_dir;
        }
    }

    // 3. Fallback to CWD media/ (development mode)
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
    
    std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read subtitle file: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_media_base_path,
            list_media_files,
            open_browser,
            read_subtitle_file,
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
            eprintln!("[CPR Trainer Pro] Resolved media directory: {:?}", resolved_media);

            // Enable OS-level screen capture protection (DRM)
            // Makes window content appear black in screenshots, recordings, and screen shares.
            if let Some(window) = app.get_webview_window("main") {
                match window.set_content_protected(true) {
                    Ok(_) => eprintln!("[CPR Trainer Pro] ✅ Screen capture protection enabled"),
                    Err(e) => eprintln!("[CPR Trainer Pro] ⚠️ Could not enable screen capture protection: {}", e),
                }
            }

            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
