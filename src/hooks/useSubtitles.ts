import { useState, useEffect } from 'react';
import { isTauri, mediaUrl as m } from '../media-resolver';
import { parseVTT, type SubtitleCue } from '../utils/vtt-parser';

interface Chapter {
  id: string;
  title: string;
  duration: string;
  filename: string;
  parentSectionId?: string;
  isSubtitle?: boolean;
}

export function useSubtitles(activeChapter: Chapter | null, activeCourseIndex: number | null) {
  const [showSubtitles, setShowSubtitles] = useState(() => {
    const saved = localStorage.getItem('eh_show_subtitles');
    return saved === null ? true : saved === 'true';
  });
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);

  // Fetch and parse subtitles when the active chapter changes (with AbortController to prevent race conditions)
  useEffect(() => {
    if (!activeChapter) {
      setSubtitleCues([]);
      setActiveCue(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const videoFilename = activeChapter.filename;
    const baseName = videoFilename.substring(0, videoFilename.lastIndexOf('.')) || videoFilename;
    const cleanBaseName = baseName.startsWith('/') ? baseName.slice(1) : baseName;
    const vttFilename = `${cleanBaseName}.vtt`;

    const loadSubtitles = async () => {
      if (isTauri) {
        try {
          // Tier 1: Native Rust command
          const { invoke } = await import('@tauri-apps/api/core');
          const text = await invoke<string>('read_subtitle_file', { filename: vttFilename });
          if (!cancelled) {
            const parsed = parseVTT(text);
            setSubtitleCues(parsed);
            console.log(`[Subtitles] Loaded ${parsed.length} cues via native command for ${vttFilename}`);
          }
          return;
        } catch (err) {
          console.warn('[Subtitles] Native command failed, trying Tier 2:', err);
        }

        try {
          // Tier 2: Relative fetch from public
          const res = await fetch(`/subtitles/${vttFilename}`, { signal: controller.signal });
          if (!res.ok) throw new Error('Relative fetch failed');
          const text = await res.text();
          if (!cancelled) {
            const parsed = parseVTT(text);
            setSubtitleCues(parsed);
            console.log(`[Subtitles] Loaded ${parsed.length} cues via relative fetch for ${vttFilename}`);
          }
          return;
        } catch (err) {
          if (controller.signal.aborted) return;
          console.warn('[Subtitles] Relative fetch failed, trying Tier 3:', err);
        }

        try {
          // Tier 3: Custom media protocol
          const subtitleUrl = m(`/subtitles/${vttFilename}`);
          const response = await fetch(subtitleUrl, { signal: controller.signal });
          if (!response.ok) throw new Error('Custom scheme fetch failed');
          const text = await response.text();
          if (!cancelled) {
            const parsed = parseVTT(text);
            setSubtitleCues(parsed);
            console.log(`[Subtitles] Loaded ${parsed.length} cues via custom scheme for ${vttFilename}`);
          }
        } catch (err) {
          if (!controller.signal.aborted && !cancelled) {
            console.error('[Subtitles] All subtitle loading attempts failed:', err);
            setSubtitleCues([]);
          }
        }
      } else {
        try {
          const response = await fetch(`/subtitles/${vttFilename}`, { signal: controller.signal });
          if (!response.ok) throw new Error('No subtitles found');
          const text = await response.text();
          if (!cancelled) {
            const parsed = parseVTT(text);
            setSubtitleCues(parsed);
          }
        } catch {
          if (!cancelled) setSubtitleCues([]);
        }
      }
    };

    loadSubtitles();
    setActiveCue(null);

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeChapter, activeCourseIndex]);

  return {
    showSubtitles,
    setShowSubtitles,
    subtitleCues,
    activeCue,
    setActiveCue
  };
}
