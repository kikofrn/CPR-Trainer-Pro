import { isTauri } from '../media-resolver';

const APPROVED_EXTERNAL_URLS = new Set([
  'https://ehacademy.com',
  'https://ehacademy.com/login',
  'https://ehacademy.hflip.co/InstructorOnboardingCPRAED',
  'https://ehacademy.hflip.co/InstructorOnboardingFirstAid',
  'mailto:info@ehacademy.com',
]);

export const openExternalUrl = async (url: string) => {
  if (!APPROVED_EXTERNAL_URLS.has(url)) {
    throw new Error(`External URL is not approved: ${url}`);
  }

  if (isTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
};

export const openPortal = async () => {
  await openExternalUrl("https://ehacademy.com/login");
};
