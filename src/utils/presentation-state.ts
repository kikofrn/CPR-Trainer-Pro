export function isPresentationActive(
  activeTab: 'video' | 'manual' | 'slideshow' | 'send-certs',
  activeCourseIndex: number | null,
  selectedManual: any | null,
  activeSlideshowIndex: number | null
): boolean {
  if (activeTab === 'video' && activeCourseIndex !== null) return true;
  if (activeTab === 'manual' && selectedManual !== null) return true;
  if (activeTab === 'slideshow' && activeSlideshowIndex !== null) return true;
  if (activeTab === 'send-certs') return true;
  return false;
}
