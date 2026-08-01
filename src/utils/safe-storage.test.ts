import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeStorage } from './safe-storage';

describe('safeStorage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (global as any).window = {
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      }
    };
  });

  it('failed write -> subsequent read returns the new value', () => {
    const key = 'test-write-fail';
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    safeStorage.setItem(key, 'new-value');
    expect(safeStorage.getItem(key)).toBe('new-value');
  });

  it('failed remove -> subsequent read returns default', () => {
    const key = 'test-remove-fail';
    window.localStorage.setItem(key, 'persisted-value'); // it's in localStorage

    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Cannot remove');
    });

    safeStorage.removeItem(key);
    // Even though it failed to remove from localStorage, it's tombstoned in the session
    expect(safeStorage.getItem(key, 'my-default')).toBe('my-default');
  });

  it('empty-string round-trip', () => {
    const key = 'test-empty-string';
    safeStorage.setItem(key, '');
    expect(safeStorage.getItem(key, 'default')).toBe('');
  });

  it('default handling', () => {
    const key = 'test-default';
    expect(safeStorage.getItem(key, 'fallback')).toBe('fallback');
  });

  it('fully-throwing storage end-to-end', () => {
    const key = 'test-throwing-all';
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('Blocked') });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Blocked') });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => { throw new Error('Blocked') });

    // Initial read is default
    expect(safeStorage.getItem(key, 'def')).toBe('def');

    // Write works in session
    safeStorage.setItem(key, 'session-val');
    expect(safeStorage.getItem(key, 'def')).toBe('session-val');

    // Remove works in session
    safeStorage.removeItem(key);
    expect(safeStorage.getItem(key, 'def')).toBe('def');
  });
});
