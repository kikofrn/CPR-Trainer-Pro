export interface ThumbnailEntry {
  key: string;
  fallback: string;
}

export const THUMBNAILS: Record<string, ThumbnailEntry> = {
  'cpr-std': { key: 'App Thumbnails/CPR AED for All Ages Cover.png', fallback: '/CPR AED for All Ages Cover.webp' },
  'cpr-va': { key: 'App Thumbnails/CPR AED for All Ages with VA.png', fallback: '/CPR AED for All Ages with VA.webp' },
  'cpr-pedi': { key: 'App Thumbnails/Pedi CPR AED Cover.png', fallback: '/Pediatric CPR AED Cover.webp' },
  'cpr-both': { key: 'App Thumbnails/Pedi CPR AED with VA Cover.png', fallback: '/Pedi CPR AED with VA Cover.webp' },
  'fa-std': { key: 'App Thumbnails/First Aid for All Ages Cover.png', fallback: '/First Aid for All Ages Cover.webp' },
  'fa-va': { key: 'App Thumbnails/First Aid for All Ages with VA.png', fallback: '/First Aid for All Ages with VA.webp' },
  'fa-pedi': { key: 'App Thumbnails/Pedi First Aid Cover.png', fallback: '/Pediatric First Aid Cover.webp' },
  'fa-both': { key: 'App Thumbnails/Pedi First Aid with VA Cover.png', fallback: '/Pedi First Aid with VA Cover.webp' }
};

export const THUMBNAIL_KEYS = Object.values(THUMBNAILS).map(t => t.key);
