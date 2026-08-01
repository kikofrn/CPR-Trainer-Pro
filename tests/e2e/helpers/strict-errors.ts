import { expect, Page, ConsoleMessage } from '@playwright/test';

export interface ExpectedError {
  channel: 'console' | 'pageerror';
  message: string;
  pathname: string | null;
  count: number;
}

/**
 * URL Sourcing Policy:
 * - console events: parsed from msg.location().url
 * - pageerror events: parsed from page.url()
 * Stack bodies are excluded from comparison entirely because they embed the machine-local
 * dep-optimizer hash (e.g. ?v=4c6e4a4c), which breaks determinism across different machines.
 * Instead, we compare deterministic canonical fields using strict equality (===), no regexes.
 */
export function setupStrictErrors(page: Page, expected: ExpectedError[]) {
  const actualUnconsumed: string[] = [];
  const expectations = expected;

  const consume = (channel: 'console' | 'pageerror', message: string, pathname: string | null) => {
    for (let i = 0; i < expectations.length; i++) {
      const exp = expectations[i];
      if (exp.channel === channel && exp.message === message && exp.pathname === pathname && exp.count > 0) {
        exp.count--;
        return true;
      }
    }
    return false;
  };

  const getUrlPathname = (urlStr: string): string | null => {
    if (!urlStr || urlStr === '' || urlStr === 'about:blank') return null;
    try {
      return new URL(urlStr).pathname;
    } catch {
      return null;
    }
  };

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Extract exact first line of msg.text()
      const firstLine = text.split('\n')[0];
      const pathname = getUrlPathname(msg.location().url);

      if (!consume('console', firstLine, pathname)) {
        actualUnconsumed.push(`Unexpected console error: "${firstLine}" at ${pathname}`);
      }
    }
  });

  page.on('pageerror', (err: Error) => {
    // For pageerror, use exact err.message
    const message = err.message;
    const pathname = getUrlPathname(page.url());

    if (!consume('pageerror', message, pathname)) {
      actualUnconsumed.push(`Unexpected pageerror: "${message}" at ${pathname}`);
    }
  });

  return {
    verify: () => {
      expect(actualUnconsumed, 'Unexpected errors occurred').toEqual([]);
      const remaining = expectations.filter(e => e.count > 0);
      expect(remaining, 'Some expected errors were not consumed').toEqual([]);
    }
  };
}
