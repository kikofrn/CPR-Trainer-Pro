import { cdnUrl } from '../media-resolver';

export function resolveSlideUrl(
  slide: { type: string; filename?: string },
  m: (path: string) => string,
  fileStatuses: Record<string, unknown>
): string {
  const clean = slide.filename?.trim().replace(/^\//, '') || '';
  if (!clean) return '';

  const isDownloaded = Boolean(fileStatuses[clean]);
  if (slide.type === 'image' && !isDownloaded) {
    return cdnUrl(clean);
  }
  return m(`/${clean}`);
}
