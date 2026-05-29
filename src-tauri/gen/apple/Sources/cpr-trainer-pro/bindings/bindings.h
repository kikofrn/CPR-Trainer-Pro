#pragma once

namespace ffi {
    extern "C" {
        void start_app();
        void rust_on_download_progress(const char* group_id, const char* filename, long long bytes_written, long long total_bytes);
        void rust_on_download_complete(const char* group_id, const char* filename);
    }
}

