import { isTauri } from '../media-resolver';

export const openExternalUrl = async (url: string) => {
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_browser', { url });
    } catch (e) {
      console.error("Failed to open browser via Tauri", e);
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};

export const openPortal = async () => {
  await openExternalUrl("https://ehacademy.com/login");
};
