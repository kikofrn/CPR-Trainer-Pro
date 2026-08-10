import { describe, expect, it } from 'vitest';

import { APP_DOWNLOADS } from './downloads';

describe('app download configuration', () => {
  it('contains one typed row for every supported platform', () => {
    expect(APP_DOWNLOADS.map(option => option.platform)).toEqual(['windows', 'macos', 'ios']);
    expect(APP_DOWNLOADS.every(option => option.label.length > 0)).toBe(true);
  });

  it('uses the live branded download destinations for every platform', () => {
    expect(APP_DOWNLOADS).toEqual([
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
    ]);
  });
});
