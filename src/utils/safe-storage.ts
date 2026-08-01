const memoryFallback = new Map<string, string>();

export const safeStorage = {
  getItem(key: string, defaultValue: string | null = null): string | null {
    try {
      const value = window.localStorage.getItem(key);
      return value !== null ? value : (memoryFallback.has(key) ? memoryFallback.get(key) || null : defaultValue);
    } catch (e) {
      console.warn(`[safeStorage] Failed to read ${key} from localStorage, using fallback.`, e);
      return memoryFallback.has(key) ? memoryFallback.get(key) || null : defaultValue;
    }
  },

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[safeStorage] Failed to write ${key} to localStorage, using fallback.`, e);
    }
    // Always update fallback map so it stays consistent for the session
    memoryFallback.set(key, value);
  },

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to remove ${key} from localStorage.`, e);
    }
    memoryFallback.delete(key);
  },
};
