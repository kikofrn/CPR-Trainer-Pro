export type DownloadPlatform = 'windows' | 'macos' | 'ios';

export interface AppDownloadOption {
  platform: DownloadPlatform;
  label: string;
  url: string | null;
}

export const APP_DOWNLOADS: readonly AppDownloadOption[] = [
  {
    platform: 'windows',
    label: 'Windows',
    url: 'https://github.com/kikofrn/CPR-Trainer-Pro/releases/latest/download/CPRTrainerPro-Setup.exe',
  },
  { platform: 'macos', label: 'macOS', url: null },
  { platform: 'ios', label: 'iPhone & iPad', url: null },
];
