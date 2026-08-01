const memoryFallback = new Map<string, string | null>();

export const safeStorage = {
  getItem(key: string, defaultValue: string | null = null): string | null {
    if (memoryFallback.has(key)) {
      const val = memoryFallback.get(key);
      return val === null ? defaultValue : val;
    }
    
    try {
      const value = window.localStorage.getItem(key);
      return value !== null ? value : defaultValue;
    } catch (e) {
      console.warn(`[safeStorage] Failed to read ${key} from localStorage, using default.`, e);
      return defaultValue;
    }
  },

  setItem(key: string, value: string): void {
    memoryFallback.set(key, value);
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[safeStorage] Failed to write ${key} to localStorage.`, e);
    }
  },

  removeItem(key: string): void {
    memoryFallback.set(key, null);
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[safeStorage] Failed to remove ${key} from localStorage.`, e);
    }
  },
};
