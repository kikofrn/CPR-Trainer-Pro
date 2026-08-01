// Media URL resolver for Tauri desktop + web compatibility
// 
// In web mode: files served from /filename (Vite public directory)
// In Tauri mode: files served via custom "media://" protocol handler
//   On Windows: http://media.localhost/<filename>
//   On macOS/Linux: media://localhost/<filename>

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

// On Windows Tauri, the media protocol base URL is always deterministic.
// Set it eagerly so mediaUrl() works synchronously from the very first render.
let mediaBase = isTauri ? 'http://media.localhost/' : '';
// mediaBase is set eagerly for Tauri since the Windows protocol URL is deterministic

async function init() {
  if (!isTauri) return;
  
  try {
    // Verify the protocol is working
    try {
      const testUrl = mediaBase + 'eha-icon.png';
      const resp = await fetch(testUrl, { method: 'HEAD' });
      console.log(`[MediaResolver] Protocol test (eha-icon.png): ${resp.status} ${resp.statusText}`);
    } catch (e) {
      console.warn('[MediaResolver] Protocol test failed:', e);
    }
    
    console.log('[MediaResolver] ✅ Ready. Base URL:', mediaBase);
  } catch (e) {
    console.error('[MediaResolver] ❌ Init failed:', e);
  }
}

const initPromise = init();

/**
 * Convert a media-directory filename to a URL that works in both web and Tauri.
 * 
 * Web:   "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 *     -> "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 * 
 * Tauri: "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"  
 *     -> "http://media.localhost/01_EHAcademy%20-%20CPR%20AED%20Course%20Video-Introduction.mp4"
 */
export function mediaUrl(filename: string): string {
  if (!isTauri || !mediaBase) {
    if (filename.startsWith('/subtitles/')) {
      return filename;
    }
    return cdnUrl(filename);
  }
  
  // Strip leading slash if present
  const clean = filename.startsWith('/') ? filename.slice(1) : filename;
  
  // URL-encode the filename to handle spaces and special characters
  return mediaBase + clean.split('/').map(s => encodeURIComponent(s)).join('/');
}

/**
 * Ensure the resolver is ready (call once at app startup).
 */
export async function waitForMediaResolver(): Promise<void> {
  await initPromise;
}

/**
 * Get the CDN URL for a media file (used as fallback when file isn't downloaded locally).
 * Always returns the remote Cloudflare CDN URL regardless of platform.
 * 
 * Example: "/slide-heart-attack.png" -> "https://media.ehacademy.com/slide-heart-attack.png"
 */
const CDN_BASE = 'https://media.ehacademy.com/';

export function cdnUrl(filename: string): string {
  const clean = filename.startsWith('/') ? filename.slice(1) : filename;
  return CDN_BASE + clean.split('/').map(s => encodeURIComponent(s)).join('/');
}

export { isTauri };
