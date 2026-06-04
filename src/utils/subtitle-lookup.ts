import type { SubtitleCue } from './vtt-parser';

export function findActiveCue(
  cues: SubtitleCue[],
  currentTime: number
): SubtitleCue | null {
  if (cues.length === 0 || currentTime <= 0.01) return null;
  return cues.find((cue) => {
    const effectiveStart = cue.start < 1.2 ? 1.2 : cue.start;
    return currentTime >= effectiveStart && currentTime <= cue.end;
  }) || null;
}
