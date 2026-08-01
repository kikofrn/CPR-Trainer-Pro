// Media URL resolver for Tauri desktop + web compatibility
//
// In web mode: files served from /filename (Vite public directory)
// In Tauri mode: files served via custom "media://" protocol handler
//   On macOS: media://localhost/<filename>

const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;

// The macOS custom-protocol URL is deterministic, so mediaUrl() can remain
// synchronous from the first render.
const MEDIA_BASE = 'media://localhost/';

async function init() {
  if (!isTauri) return;

  const { invoke } = await import('@tauri-apps/api/core');
  const storagePath = await invoke<string>('get_media_storage_status');
  console.info('[MediaResolver] Media library ready:', storagePath);
}

const initPromise = init();

/**
 * Convert a media-directory filename to a URL that works in both web and Tauri.
 * 
 * Web:   "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 *     -> "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"
 * 
 * Tauri: "/01_EHAcademy - CPR AED Course Video-Introduction.mp4"  
 *     -> "media://localhost/01_EHAcademy%20-%20CPR%20AED%20Course%20Video-Introduction.mp4"
 */
export function mediaUrl(filename: string): string {
  if (!isTauri) return filename;
  
  // Strip leading slash if present
  const clean = filename.startsWith('/') ? filename.slice(1) : filename;
  
  // URL-encode the filename to handle spaces and special characters
  return MEDIA_BASE + clean.split('/').map(s => encodeURIComponent(s)).join('/');
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
