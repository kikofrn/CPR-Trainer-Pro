import { describe, expect, it } from 'vitest';

import { APP_DOWNLOADS } from './downloads';

describe('app download configuration', () => {
  it('contains one typed row for every supported platform', () => {
    expect(APP_DOWNLOADS.map(option => option.platform)).toEqual(['windows', 'macos', 'ios']);
    expect(APP_DOWNLOADS.every(option => option.label.length > 0)).toBe(true);
  });

  it('uses the verified evergreen Windows installer and marks unreleased platforms as coming soon', () => {
    expect(APP_DOWNLOADS).toEqual([
      {
        platform: 'windows',
        label: 'Windows',
        url: 'https://github.com/kikofrn/CPR-Trainer-Pro/releases/latest/download/CPRTrainerPro-Setup.exe',
      },
      { platform: 'macos', label: 'macOS', url: null },
      { platform: 'ios', label: 'iPhone & iPad', url: null },
    ]);
  });
});
