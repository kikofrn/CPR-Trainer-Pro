import { useState, useEffect, useCallback } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialize with the CORRECT value synchronously to prevent a flash
  // of the wrong layout (e.g., desktop layout flashing on mobile)
  const getInitialValue = () => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState(getInitialValue);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // Sync immediately in case the value changed between render and effect
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
