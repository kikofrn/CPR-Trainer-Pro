import { isTauri } from '../media-resolver';

export async function toggleFullscreen(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    const before = await win.isFullscreen();
    await win.setFullscreen(!before);
    return await win.isFullscreen();
  } catch (e) {
    console.error('[fullscreen] Toggle failed:', e);
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      return await getCurrentWindow().isFullscreen();
    } catch { return false; }
  }
}

export async function exitFullscreen(): Promise<void> {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    if (await win.isFullscreen()) await win.setFullscreen(false);
  } catch (e) { console.error('[fullscreen] Exit failed:', e); }
}

export async function checkFullscreen(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return await getCurrentWindow().isFullscreen();
  } catch { return false; }
}
