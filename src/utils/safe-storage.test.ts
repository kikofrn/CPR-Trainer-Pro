import { describe, it, expect, beforeEach, vi } from 'vitest';


describe('safeStorage', () => {
  let mockStorage = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    mockStorage.clear();

    (global as any).window = {
      localStorage: {
        getItem: vi.fn((key: string) => mockStorage.has(key) ? mockStorage.get(key) : null),
        setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
        removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
        clear: vi.fn(() => { mockStorage.clear(); })
      }
    };
  });

  it('failed write -> subsequent read returns the new value', async () => {
    const { safeStorage } = await import('./safe-storage');
    const key = 'test-write-fail';
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    safeStorage.setItem(key, 'new-value');
    expect(safeStorage.getItem(key)).toBe('new-value');
  });

  it('failed remove -> subsequent read returns default', async () => {
    const { safeStorage } = await import('./safe-storage');
    const key = 'test-remove-fail';
    window.localStorage.setItem(key, 'persisted-value');

    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('Cannot remove');
    });

    safeStorage.removeItem(key);
    expect(safeStorage.getItem(key, 'my-default')).toBe('my-default');
  });

  it('empty-string round-trip', async () => {
    const { safeStorage } = await import('./safe-storage');
    const key = 'test-empty-string';
    safeStorage.setItem(key, '');
    expect(safeStorage.getItem(key, 'default')).toBe('');
  });

  it('default handling', async () => {
    const { safeStorage } = await import('./safe-storage');
    const key = 'test-default';
    expect(safeStorage.getItem(key, 'fallback')).toBe('fallback');
  });

  it('fully-throwing storage end-to-end', async () => {
    const { safeStorage } = await import('./safe-storage');
    const key = 'test-throwing-all';
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => { throw new Error('Blocked') });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new Error('Blocked') });
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => { throw new Error('Blocked') });

    expect(safeStorage.getItem(key, 'def')).toBe('def');

    safeStorage.setItem(key, 'session-val');
    expect(safeStorage.getItem(key, 'def')).toBe('session-val');

    safeStorage.removeItem(key);
    expect(safeStorage.getItem(key, 'def')).toBe('def');
  });
});
