/**
 * WebVTT subtitle parser — extracted from App.tsx as a pure utility.
 * These functions are stateless and don't need to be recreated on every render.
 */

export interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/** Parse a WebVTT timestamp string (HH:MM:SS.mmm or MM:SS.mmm) into seconds. */
export function parseTimestamp(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  let hrs = 0;
  let mins = 0;
  let secs = 0;

  if (parts.length === 3) {
    hrs = parseInt(parts[0], 10);
    mins = parseInt(parts[1], 10);
    secs = parseFloat(parts[2]);
  } else if (parts.length === 2) {
    mins = parseInt(parts[0], 10);
    secs = parseFloat(parts[1]);
  }

  return hrs * 3600 + mins * 60 + secs;
}

/** Parse full VTT file text into an array of SubtitleCue objects. */
export function parseVTT(text: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = text.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    if (!block.includes('-->')) continue;

    const lines = block.split(/\r?\n/);
    let timeLine = '';
    const textLines: string[] = [];

    for (const line of lines) {
      if (line.includes('-->')) {
        timeLine = line;
      } else if (timeLine && line.trim()) {
        textLines.push(line.trim());
      }
    }

    if (timeLine) {
      const parts = timeLine.split('-->');
      if (parts.length === 2) {
        const start = parseTimestamp(parts[0]);
        const end = parseTimestamp(parts[1]);
        const textStr = textLines.join(' ').replace(/<[^>]*>/g, ''); // strip HTML tags
        if (!isNaN(start) && !isNaN(end)) {
          cues.push({ start, end, text: textStr });
        }
      }
    }
  }
  return cues;
}
