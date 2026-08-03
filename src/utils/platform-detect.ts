import type { DownloadPlatform } from '../config/downloads';

export interface NavigatorPlatformInfo {
  userAgent?: string;
  maxTouchPoints?: number;
  userAgentData?: { platform?: string };
}

export function detectDownloadPlatform(
  platformInfo: NavigatorPlatformInfo = typeof navigator === 'undefined' ? {} : navigator,
): DownloadPlatform | null {
  const clientHintPlatform = platformInfo.userAgentData?.platform?.trim();
  const platform = clientHintPlatform || platformInfo.userAgent || '';

  if (/windows/i.test(platform)) return 'windows';
  if (/iphone|ipad|ipod/i.test(platform)) return 'ios';
  if (/mac|macintosh/i.test(platform) && (platformInfo.maxTouchPoints ?? 0) > 1) return 'ios';
  if (/mac|macintosh/i.test(platform)) return 'macos';

  return null;
}
