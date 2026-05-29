import Foundation
import os.log

@objc
public class DownloadPlugin: NSObject, URLSessionDownloadDelegate {
    public static let shared = DownloadPlugin()
    
    private var session: URLSession!
    private var callbacks: [String: (progress: (Double) -> Void, completion: (Result<URL, Error>) -> Void)] = [:]
    
    // Group status tracking
    private var groupStatusCache: [String: GroupStatus] = [:]
    
    private let logger = OSLog(subsystem: "com.ehacademy.cpr-trainer-pro", category: "DownloadPlugin")
    
    public struct GroupStatus: Codable {
        let groupId: String
        var filesTotal: Int
        var filesDownloaded: Int
        var bytesTotal: UInt64
        var bytesDownloaded: UInt64
        var state: String
    }
    
    private override init() {
        super.init()
        let config = URLSessionConfiguration.background(withIdentifier: "com.ehacademy.downloads")
        config.sessionSendsLaunchEvents = true
        config.isDiscretionary = false
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
        
        // Recover state on initialization
        self.recoverState()
    }
    
    private func recoverState() {
        self.session.getAllTasks { tasks in
            for task in tasks {
                guard let desc = task.taskDescription else { continue }
                let parts = desc.components(separatedBy: "|")
                if parts.count == 2 {
                    let groupId = parts[0]
                    os_log("Recovered task for group %{public}@: %{public}@", log: self.logger, type: .info, groupId, parts[1])
                    // We could rebuild GroupStatus here if needed, but typically we query it on demand
                }
            }
        }
    }
    
    @objc public func startDownloadGroup(groupId: String, baseUrl: String, files: [String], destDir: String) {
        os_log("Starting group %{public}@ with %d files", log: self.logger, type: .info, groupId, files.count)
        
        let fileManager = FileManager.default
        let destURL = URL(fileURLWithPath: destDir)
        
        // Ensure destination directory exists
        try? fileManager.createDirectory(at: destURL, withIntermediateDirectories: true, attributes: nil)
        
        for file in files {
            // Clean leading slash if any
            let cleanFile = file.hasPrefix("/") ? String(file.dropFirst()) : file
            
            // Check if file already exists
            let targetURL = destURL.appendingPathComponent(cleanFile)
            if fileManager.fileExists(atPath: targetURL.path) {
                continue // Already downloaded
            }
            
            // Create target subdirectories if necessary (e.g. for subtitles/en.vtt)
            let parentURL = targetURL.deletingLastPathComponent()
            try? fileManager.createDirectory(at: parentURL, withIntermediateDirectories: true, attributes: nil)
            
            // Encode the filename for URL
            let encodedFilename = cleanFile.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? cleanFile
            
            guard let downloadUrl = URL(string: baseUrl)?.appendingPathComponent(encodedFilename) else {
                os_log("Invalid URL for %{public}@", log: self.logger, type: .error, file)
                continue
            }
            
            let task = self.session.downloadTask(with: downloadUrl)
            
            // Store metadata in taskDescription: "groupId|destPath"
            task.taskDescription = "\(groupId)|\(targetURL.path)"
            task.resume()
        }
    }
    
    @objc public func pauseGroup(groupId: String) {
        self.session.getAllTasks { tasks in
            for task in tasks {
                guard let desc = task.taskDescription, desc.hasPrefix("\(groupId)|") else { continue }
                if let downloadTask = task as? URLSessionDownloadTask {
                    downloadTask.suspend()
                }
            }
        }
    }
    
    @objc public func resumeGroup(groupId: String) {
        self.session.getAllTasks { tasks in
            for task in tasks {
                guard let desc = task.taskDescription, desc.hasPrefix("\(groupId)|") else { continue }
                task.resume()
            }
        }
    }
    
    @objc public func cancelGroup(groupId: String) {
        self.session.getAllTasks { tasks in
            for task in tasks {
                guard let desc = task.taskDescription, desc.hasPrefix("\(groupId)|") else { continue }
                task.cancel()
            }
        }
    }
    
    // MARK: - URLSessionDownloadDelegate
    
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let desc = downloadTask.taskDescription else { return }
        let parts = desc.components(separatedBy: "|")
        guard parts.count == 2 else { return }
        let groupId = parts[0]
        let destPath = parts[1]
        let filename = URL(fileURLWithPath: destPath).lastPathComponent
        
        // Notify Tauri app
        groupId.withCString { cGroupId in
            filename.withCString { cFilename in
                rust_on_download_progress(cGroupId, cFilename, totalBytesWritten, totalBytesExpectedToWrite)
            }
        }
    }
    
    public func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let desc = downloadTask.taskDescription else { return }
        let parts = desc.components(separatedBy: "|")
        guard parts.count == 2 else { return }
        let groupId = parts[0]
        let destPath = parts[1]
        
        let destURL = URL(fileURLWithPath: destPath)
        let fileManager = FileManager.default
        
        do {
            if fileManager.fileExists(atPath: destURL.path) {
                try fileManager.removeItem(at: destURL)
            }
            try fileManager.moveItem(at: location, to: destURL)
            os_log("Successfully moved downloaded file to %{public}@", log: self.logger, type: .info, destPath)
            
            let filename = destURL.lastPathComponent
            
            groupId.withCString { cGroupId in
                filename.withCString { cFilename in
                    rust_on_download_complete(cGroupId, cFilename)
                }
            }
            
        } catch {
            os_log("Failed to move downloaded file to %{public}@: %{public}@", log: self.logger, type: .error, destPath, error.localizedDescription)
        }
    }
    
    public func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            os_log("Download task failed: %{public}@", log: self.logger, type: .error, error.localizedDescription)
        }
    }
    
    public func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        // App was woken up to handle background events. We should call the completion handler.
        // We will notify the app delegate to execute the completion handler.
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: NSNotification.Name("BackgroundSessionFinished"), object: nil)
        }
    }
}

// MARK: - C FFI Interface for Rust

@_cdecl("swift_start_download_group")
public func swift_start_download_group(group_id: UnsafePointer<CChar>, base_url: UnsafePointer<CChar>, files_json: UnsafePointer<CChar>, dest_dir: UnsafePointer<CChar>) {
    let groupId = String(cString: group_id)
    let baseUrl = String(cString: base_url)
    let destDir = String(cString: dest_dir)
    let filesJsonStr = String(cString: files_json)
    
    var fileArray = [String]()
    if let data = filesJsonStr.data(using: .utf8) {
        if let decoded = try? JSONDecoder().decode([String].self, from: data) {
            fileArray = decoded
        }
    }
    
    DownloadPlugin.shared.startDownloadGroup(groupId: groupId, baseUrl: baseUrl, files: fileArray, destDir: destDir)
}

@_cdecl("swift_pause_download_group")
public func swift_pause_download_group(group_id: UnsafePointer<CChar>) {
    let groupId = String(cString: group_id)
    DownloadPlugin.shared.pauseGroup(groupId: groupId)
}

@_cdecl("swift_resume_download_group")
public func swift_resume_download_group(group_id: UnsafePointer<CChar>) {
    let groupId = String(cString: group_id)
    DownloadPlugin.shared.resumeGroup(groupId: groupId)
}

@_cdecl("swift_cancel_download_group")
public func swift_cancel_download_group(group_id: UnsafePointer<CChar>) {
    let groupId = String(cString: group_id)
    DownloadPlugin.shared.cancelGroup(groupId: groupId)
}
