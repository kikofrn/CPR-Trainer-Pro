export type DownloadPlatform = 'windows' | 'macos' | 'ios';

export interface AppDownloadOption {
  platform: DownloadPlatform;
  label: string;
  subtitle: string;
  actionLabel: string;
  url: string | null;
  openInNewTab?: boolean;
}

export const APP_DOWNLOADS: readonly AppDownloadOption[] = [
  {
    platform: 'windows',
    label: 'Windows',
    subtitle: 'Desktop app with offline training access',
    actionLabel: 'Download for Windows',
    url: 'https://windownload.ehacademy.com',
  },
  {
    platform: 'macos',
    label: 'macOS',
    subtitle: 'Desktop app with offline training access',
    actionLabel: 'Download for Mac',
    url: 'https://macdownload.ehacademy.com',
  },
  {
    platform: 'ios',
    label: 'iPhone & iPad',
    subtitle: 'Mobile app with offline training access',
    actionLabel: 'Download on the App Store',
    url: 'https://apps.apple.com/us/app/cpr-trainer-pro/id6776328690',
    openInNewTab: true,
  },
];
