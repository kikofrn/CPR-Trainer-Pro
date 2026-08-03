import { describe, expect, it } from 'vitest';

import { detectDownloadPlatform } from './platform-detect';

describe('detectDownloadPlatform', () => {
  it.each([
    ['Windows client hint', { userAgentData: { platform: 'Windows' }, userAgent: 'ignored' }, 'windows'],
    ['macOS client hint', { userAgentData: { platform: 'macOS' }, maxTouchPoints: 0 }, 'macos'],
    ['iPhone user agent', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }, 'ios'],
    ['iPadOS masquerading as Mac', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', maxTouchPoints: 5 }, 'ios'],
    ['unknown platform', { userAgentData: { platform: 'Linux' }, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }, null],
  ] as const)('%s', (_name, navigatorLike, expected) => {
    expect(detectDownloadPlatform(navigatorLike)).toBe(expected);
  });
});
