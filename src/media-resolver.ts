// Media URL resolver for Tauri desktop + web compatibility
// 
// In web mode: files served from /filename (Vite public directory)
// In Tauri mode: files served via custom "media://" protocol handler
//   On Windows: http://media.localhost/<filename>
//   On macOS/Linux: media://localhost/<filename>

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

let mediaBase = '';
let initialized = false;

async function init() {
  if (!isTauri || initialized) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    
    // The backend returns the protocol base URL
    mediaBase = await invoke('get_media_base_path');
    
    // Ensure trailing slash
    if (!mediaBase.endsWith('/')) mediaBase += '/';
    
    initialized = true;
    console.log('[MediaResolver] ✅ Ready. Base URL:', mediaBase);
    
    // Quick test: verify the protocol works
    try {
      const testUrl = mediaBase + 'eha-icon.png';
      const resp = await fetch(testUrl, { method: 'HEAD' });
      console.log(`[MediaResolver] Protocol test (eha-icon.png): ${resp.status} ${resp.statusText}`);
    } catch (e) {
      console.warn('[MediaResolver] Protocol test failed:', e);
    }
  } catch (e) {
    console.error('[MediaResolver] ❌ Init failed:', e);
  }
}

const initPromise = init();

/**
 * Convert a public-directory filename to a URL that works in both web and Tauri.
 * 
 * Web:   "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 *     -> "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 * 
 * Tauri: "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"  
 *     -> "http://media.localhost/01_EHAcademy%20-%20CPR%20AED%20Course%20Video-Introduction.mp4"
 */
export function mediaUrl(filename: string): string {
  if (!isTauri || !initialized || !mediaBase) return filename;
  
  // Strip leading slash if present
  const clean = filename.startsWith('/') ? filename.slice(1) : filename;
  
  // URL-encode the filename to handle spaces and special characters
  return mediaBase + encodeURIComponent(clean);
}

/**
 * Ensure the resolver is ready (call once at app startup).
 */
export async function waitForMediaResolver(): Promise<void> {
  await initPromise;
}

export { isTauri };
