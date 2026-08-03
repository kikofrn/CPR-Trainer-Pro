import { useState, useRef, useEffect, lazy, Suspense, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Loader2
} from 'lucide-react';
import { COURSES, MANUALS, Manual, SLIDESHOWS } from './chapters';
import type { ManualFlipbookRef } from './components/ManualFlipbook';
const ManualFlipbook = lazy(() => import('./components/ManualFlipbook'));
import { mediaUrl as m, waitForMediaResolver, isTauri } from './media-resolver';
import { CprIcon, FirstAidIcon } from './components/Icons';
import { downloadManager, DownloadState, formatSpeed } from './download-manager';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseVTT, type SubtitleCue } from './utils/vtt-parser';
import { getRelevantKeys, checkUpdates, ChangedFile, ManifestFile } from './update-checker';
import { snapshotStore } from './snapshot-store';
import { THUMBNAIL_KEYS } from './thumbnails';
import { UpdatePrompt } from './components/UpdatePrompt';
const SendCertsPage = lazy(() => import('./components/SendCertsPage').then(m => ({ default: m.SendCertsPage })));
const HowToGuideModal = lazy(() => import('./components/HowToGuideModal').then(m => ({ default: m.HowToGuideModal })));
import { HeaderNav } from './components/HeaderNav';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { SlideshowPlayer } from './components/SlideshowPlayer';
import { UsbImportModal, type UsbImportProgress, type UsbImportSummary } from './components/UsbImportModal';
import { toggleFullscreen, exitFullscreen, checkFullscreen } from './utils/fullscreen';
import { canPresent, startPresenting, stopPresenting, sendToViewer } from './utils/presenter';
import { findActiveCue } from './utils/subtitle-lookup';
import { resolveSlideUrl } from './utils/slide-url';

async function setDisplaySleepPrevention(active: boolean): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('set_display_sleep_prevention', { active });
  } catch (error) {
    console.warn('[presenter] Display sleep assertion could not be updated:', error);
  }
}

export function syncPresenterSubtitle(
  isPresentingExternally: boolean,
  showSubtitles: boolean,
  activeCue: Pick<SubtitleCue, 'text'> | null,
  sender: typeof sendToViewer = sendToViewer,
): void {
  if (!isPresentingExternally) return;
  void sender('presentation:subtitle', {
    text: showSubtitles ? (activeCue?.text || '') : '',
  });
}

function EHLogo({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center bg-transparent overflow-hidden ${className}`}>
      <img 
        src="/eha-icon.png" 
        alt="EH Academy" 
        className="w-full h-full object-contain"
      />
    </div>
  );
}

// SubtitleCue type imported from utils/vtt-parser.ts

export default function App() {
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaStorageError, setMediaStorageError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPresentingExternally, setIsPresentingExternally] = useState(false);
  const [hasExternalMonitor, setHasExternalMonitor] = useState(false);
  const [isPresenterStarting, setIsPresenterStarting] = useState(false);
  const [presenterError, setPresenterError] = useState<string | null>(null);
  const [presenterDuration, setPresenterDuration] = useState(0);
  const [viewerListenersReady, setViewerListenersReady] = useState(false);
  const presenterStartingRef = useRef(false);
  const usbImportActiveRef = useRef(false);
  const [isUsbImportActive, setIsUsbImportActive] = useState(false);
  const usbCancelRequestedRef = useRef(false);
  const shouldPreventSleepRef = useRef(false);
  const [usbFolder, setUsbFolder] = useState<string | null>(null);
  const [usbSummary, setUsbSummary] = useState<UsbImportSummary | null>(null);
  const [usbProgress, setUsbProgress] = useState<UsbImportProgress | null>(null);
  const [usbStatus, setUsbStatus] = useState<'ready' | 'importing' | 'cancelling' | 'complete' | 'error'>('ready');
  const [usbError, setUsbError] = useState<string | null>(null);
  
  const [contentUpdateFiles, setContentUpdateFiles] = useState<ChangedFile[]>([]);
  const [showContentUpdatePrompt, setShowContentUpdatePrompt] = useState(false);
  const [contentUpdateAvgSpeed, setContentUpdateAvgSpeed] = useState(0);
  const manifestStashRef = useRef<Record<string, { etag: string; uploaded: string; size: number }>>({});
  const pendingUpdatesRef = useRef<Record<string, { originalKey: string; etag: string; uploaded: string; size: number }>>({});

  useEffect(() => {
    if (!isTauri || !navigator.onLine || isPresentingExternally) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    async function checkContentUpdates() {
      try {
        const res = await fetch('https://media.ehacademy.com/api/manifest', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const data = await res.json();
        const manifestFiles: ManifestFile[] = data.files;
        downloadManager.refreshManifest(manifestFiles);

        const relevantKeys = getRelevantKeys(SLIDESHOWS, COURSES, MANUALS, THUMBNAIL_KEYS);
        
        // get local existence
        const localExistsMap = await downloadManager.checkStatusesForFiles(Array.from(relevantKeys));
        
        // get mtimes
        const { invoke } = await import('@tauri-apps/api/core');
        const mtimes: Record<string, number> = await invoke('get_media_file_mtimes', { filenames: Array.from(relevantKeys) });

        const localFiles: Record<string, { mtime: number }> = {};
        for (const key of relevantKeys) {
          const clean = key.trim().replace(/^\//, '');
          if (localExistsMap[clean] && mtimes[key]) {
            localFiles[key] = { mtime: mtimes[key] };
          }
        }

        const snapshot = await snapshotStore.readSnapshot();
        setContentUpdateAvgSpeed(snapshot.avgSpeedBps);

        const result = checkUpdates(
          relevantKeys,
          manifestFiles,
          snapshot.files,
          localFiles,
          new Set(THUMBNAIL_KEYS)
        );

        await snapshotStore.mergeFiles(result.missingEtagsToUpdate);
        await snapshotStore.setLastCheck(new Date().toISOString());

        const manifestMap = new Map<string, ManifestFile>();
        manifestFiles.forEach(m => manifestMap.set(m.key, m));

        const missingThumbnails = THUMBNAIL_KEYS
          .filter(k => !localExistsMap[k.replace(/^\//, '')])
          .map(k => {
            const m = manifestMap.get(k);
            return m ? {
              key: k,
              version: m.etag,
              size: m.size,
              isSilent: true,
            } : null;
          })
          .filter((f): f is ChangedFile => f !== null);

        if (missingThumbnails.length > 0) {
          result.changedFiles.push(...missingThumbnails);
        }

        if (result.changedFiles.length > 0) {
          const silentFiles = result.changedFiles.filter(f => f.isSilent);
          const promptFiles = result.changedFiles.filter(f => !f.isSilent);

          for (const f of result.changedFiles) {
            const manifest = manifestMap.get(f.key);
            if (manifest) {
              manifestStashRef.current[f.key] = {
                etag: manifest.etag,
                uploaded: manifest.uploaded,
                size: manifest.size,
              };
            }
          }

          if (silentFiles.length > 0) {
            silentFiles.forEach(f => {
              const stash = manifestStashRef.current[f.key];
              if (stash) {
                const normalized = f.key.trim().replace(/^\//, '');
                pendingUpdatesRef.current[normalized] = { originalKey: f.key, ...stash };
              }
            });
            downloadManager.queueSpecificFiles(silentFiles.map(f => ({
              filename: f.key,
              version: f.version,
              size: f.size,
            })));
          }

          if (promptFiles.length > 0) {
            setContentUpdateFiles(promptFiles);
            setShowContentUpdatePrompt(true);
          }
        }
      } catch (err) {
        // silently skip on error or timeout
      }
    }
    
    checkContentUpdates();
    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [isPresentingExternally]);



  // Initialize media resolver for Tauri desktop support
  useEffect(() => {
    let resolved = false;
    waitForMediaResolver()
      .then(() => {
        resolved = true;
        setMediaReady(true);
      })
      .catch((err) => {
        console.error("Media resolver failed:", err);
        setMediaStorageError(String(err));
        resolved = true;
        setMediaReady(true);
      });
      
    const failsafe = setTimeout(() => {
      if (!resolved) {
        console.warn("Media resolver timed out after 10s, forcing splashscreen close.");
        setMediaReady(true);
      }
    }, 10000);
    
    return () => clearTimeout(failsafe);
  }, []);

  const appStartTime = useRef(Date.now());

  // Hide splashscreen and show main window when media is ready
  useEffect(() => {
    if (mediaReady && isTauri) {
      const elapsed = Date.now() - appStartTime.current;
      const delayToReady = Math.max(0, 1000 - elapsed);

      const outerTimer = setTimeout(() => {
        localStorage.setItem('splash_status', 'ready');
        
        innerTimerRef = setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('close_splashscreen').catch(e => 
              console.error('[Tauri] Splashscreen transition failed:', e)
            );
          });
        }, 100);
      }, delayToReady);

      let innerTimerRef: ReturnType<typeof setTimeout> | undefined;
      return () => {
        clearTimeout(outerTimer);
        if (innerTimerRef) clearTimeout(innerTimerRef);
      };
    }
  }, [mediaReady]);
  const [activeCourseIndex, setActiveCourseIndex] = useState<number | null>(null);
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(volume);
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => { volumeRef.current = volume; }, [volume]);


  

  const [isContinuousPlay, setIsContinuousPlay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [selectedManual, setSelectedManual] = useState<Manual | null>(null);
  const [activeTab, setActiveTab] = useState<'video' | 'manual' | 'slideshow' | 'send-certs'>('video');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showManualSelector, setShowManualSelector] = useState(false);
  const [previewManualIndex, setPreviewManualIndex] = useState(0);
  const [showCprSelector, setShowCprSelector] = useState(false);
  const [showFaSelector, setShowFaSelector] = useState(false);
  // faDrilldown state removed — was dead code (never read)
  
  // Elite Toggles
  const [cprVaEnabled, setCprVaEnabled] = useState(false);
  const [cprPediatric, setCprPediatric] = useState(false);
  const [faVaEnabled, setFaVaEnabled] = useState(false);
  const [faPediatric, setFaPediatric] = useState(false);
  
  const [activeSlideshowIndex, setActiveSlideshowIndex] = useState<number | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideshowIsPlaying, setSlideshowIsPlaying] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedManualSections, setExpandedManualSections] = useState<Record<number, boolean>>({});
  const [manualOutline, setManualOutline] = useState<any[]>([]);
  const [showHowTo, setShowHowTo] = useState(false);
  const [activeGuidePath, setActiveGuidePath] = useState<'menu' | 'app' | 'teaching' | 'portal'>('menu');
  const [portalStep, setPortalStep] = useState(1);
  
  // Easter egg
  const [clickTimestamps, setClickTimestamps] = useState<number[]>([]);
  const [easterEggLevel, setEasterEggLevel] = useState<0 | 1 | 2>(0);

  const handleInfoClick = () => {
    const now = Date.now();
    setClickTimestamps(prev => {
      const recent = prev.filter(t => now - t <= 12000);
      recent.push(now);
      
      const clicksIn12s = recent.length;
      const clicksIn6s = recent.filter(t => now - t <= 6000).length;

      if (clicksIn12s >= 20) {
        setEasterEggLevel(2);
      } else if (clicksIn6s >= 10 && easterEggLevel < 1) {
        setEasterEggLevel(1);
      }
      
      return recent;
    });
  };

  const easterEggHoldTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInfoPointerDown = () => {
    easterEggHoldTimeoutRef.current = setTimeout(() => {
      setEasterEggLevel(0);
      setClickTimestamps([]);
    }, 6000);
  };

  const handleInfoPointerUp = () => {
    if (easterEggHoldTimeoutRef.current) {
      clearTimeout(easterEggHoldTimeoutRef.current);
      easterEggHoldTimeoutRef.current = null;
    }
  };

  // Subtitle & Double-Buffering States/Refs
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
  
  // Real-time volume updates for active players
  useEffect(() => {
    const active = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
    if (active) active.volume = isMuted ? 0 : volume;
    if (slideVideoRef.current) slideVideoRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, activePlayer]);

  const [showSubtitles, setShowSubtitles] = useState(() => {
    const saved = localStorage.getItem('eh_show_subtitles');
    return saved === null ? true : saved === 'true';
  });
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const presentingModeRef = useRef<'video' | 'slideshow' | null>(null);
  const isPresentingExternallyRef = useRef(false);
  const presenterDurationRef = useRef(0);
  const subtitleCuesRef = useRef(subtitleCues);
  const activeCueRef = useRef<SubtitleCue | null>(null);
  const handleEndedCoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    isPresentingExternallyRef.current = isPresentingExternally;
  }, [isPresentingExternally]);

  useEffect(() => {
    subtitleCuesRef.current = subtitleCues;
  }, [subtitleCues]);

  const updatePresenterDuration = (duration: number) => {
    const safe = Number.isFinite(duration) && duration > 0 ? duration : 0;
    if (Math.abs(presenterDurationRef.current - safe) < 0.01) return;
    presenterDurationRef.current = safe;
    setPresenterDuration(safe);
  };

  const setActiveCueIfChanged = (cue: SubtitleCue | null) => {
    const current = activeCueRef.current;
    if (current?.start === cue?.start && current?.end === cue?.end && current?.text === cue?.text) {
      return;
    }
    activeCueRef.current = cue;
    setActiveCue(cue);
  };
  const [lastCprView, setLastCprView] = useState<'video' | 'slideshow' | null>(null);
  const [lastFaView, setLastFaView] = useState<'video' | 'slideshow' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const slideVideoRef = useRef<HTMLVideoElement>(null);
  const slideshowContainerRef = useRef<HTMLDivElement>(null);
  const flipbookRef = useRef<ManualFlipbookRef>(null);

  useEffect(() => {
    if (videoRefA.current) {
      videoRefA.current.playbackRate = playbackRate;
      videoRefA.current.defaultPlaybackRate = playbackRate;
    }
    if (videoRefB.current) {
      videoRefB.current.playbackRate = playbackRate;
      videoRefB.current.defaultPlaybackRate = playbackRate;
    }
  }, [playbackRate, activePlayer, activeChapterIndex]);
  
  // Download manager state
  const [dlState, setDlState] = useState<DownloadState>(downloadManager.getActiveState());
  const [downloadingChapterIndex, setDownloadingChapterIndex] = useState<number | null>(null);
  const [downloadingManualId, setDownloadingManualId] = useState<string | null>(null);
  const [downloadingSlideIndex, setDownloadingSlideIndex] = useState<number | null>(null);

  useEffect(() => {
    if (downloadingChapterIndex !== null && activeCourseIndex !== null) {
      const chapter = COURSES[activeCourseIndex]?.chapters[downloadingChapterIndex];
      if (chapter && chapter.filename) {
        const clean = chapter.filename.trim().replace(/^\//, '');
        if (dlState.fileStatuses[clean]) {
          if (isPresentingExternallyRef.current) return;
          const targetIndex = downloadingChapterIndex;
          setDownloadingChapterIndex(null);
          
          setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
          setActiveChapterIndex(targetIndex);
          if (activeCourseIndex !== null) saveProgress(activeCourseIndex, targetIndex);
          
          setShowNextOverlay(false);
          setIsPlaying(true);
          setActiveTab('video');
          if (window.innerWidth < 1024) setShowSidebar(false);
        }
      }
    }
  }, [dlState.fileStatuses, downloadingChapterIndex, activeCourseIndex]);

  // Watch for manual download complete
  useEffect(() => {
    if (downloadingManualId !== null && isTauri) {
      const manual = MANUALS.find(m => m.id === downloadingManualId);
      if (manual && manual.filename) {
        const clean = manual.filename.trim().replace(/^\//, '');
        if (dlState.fileStatuses[clean]) {
          if (isPresentingExternallyRef.current) return;
          setSelectedManual(manual);
          setShowSidebar(true);
          setDownloadingManualId(null);
        }
      }
    }
  }, [dlState.fileStatuses, downloadingManualId, isTauri]);

  // Watch for slide download complete
  useEffect(() => {
    if (downloadingSlideIndex !== null && isTauri && activeSlideshowIndex !== null) {
      const slideshow = SLIDESHOWS[activeSlideshowIndex];
      if (!slideshow) return;
      const slide = slideshow.slides[downloadingSlideIndex];
      if (slide && slide.filename) {
        const clean = slide.filename.trim().replace(/^\//, '');
        if (dlState.fileStatuses[clean]) {
          if (isPresentingExternallyRef.current) return;
          const targetIndex = downloadingSlideIndex;
          setDownloadingSlideIndex(null);
          
          if (slideVideoRef.current) slideVideoRef.current.pause();
          setActiveSlideIndex(targetIndex);
          setSlideshowIsPlaying(true);
          setActiveTab('slideshow');
          setShowSidebar(true);
        }
      }
    }
  }, [dlState.fileStatuses, downloadingSlideIndex, isTauri, activeSlideshowIndex]);

  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  useEffect(() => {
    const unsub = downloadManager.subscribe(setDlState);
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = downloadManager.onFileComplete((normalizedFilename) => {
      const pending = pendingUpdatesRef.current[normalizedFilename];
      if (pending) {
        const { originalKey, etag, uploaded, size } = pending;
        snapshotStore.mergeFiles({
          [originalKey]: { etag, uploaded, size }
        }).catch(console.error);
        delete pendingUpdatesRef.current[normalizedFilename];
      }
    });
    return unsub;
  }, []);

  // Shared function to handle manual selection & auto-download
  const selectManual = (manual: any) => {
    if (manual && isTauri && manual.filename) {
      const clean = manual.filename.trim().replace(/^\//, '');
      if (!dlState.fileStatuses[clean]) {
        setDownloadingManualId(manual.id);
        setActiveTab('manual');
        downloadManager.startSingleDownload(manual.filename);
        return;
      }
    }
    setSelectedManual(manual);
    if (manual) setShowSidebar(true);
  };

  // First-launch download prompt
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  useEffect(() => {
    if (isTauri && !localStorage.getItem('eh_download_prompted')) {
      const timer = setTimeout(() => setShowDownloadPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  const activeCourse = activeCourseIndex !== null ? COURSES[activeCourseIndex] : null;
  const activeChapter = activeCourse ? activeCourse.chapters[activeChapterIndex] : null;
  
  
  
  const activeSlideshow = activeSlideshowIndex !== null ? SLIDESHOWS[activeSlideshowIndex] : null;
  const activeSlide = activeSlideshow ? activeSlideshow.slides[activeSlideIndex] : null;

  const handleItemClick = (type: string, index: number) => {
    if (isPresentingExternallyRef.current) {
      setPresenterError('Stop presenting to switch courses');
      return;
    }

    let isCpr = false;
    if (type === 'video') {
      const id = COURSES[index]?.id;
      isCpr = id === 'cpr-aed' || id === 'pediatric-cpr-aed';
    } else if (type === 'slideshow') {
      const id = SLIDESHOWS[index]?.id;
      isCpr = id === 'cpr-aed-course' || id === 'cpr-aed-spanish-course' || id === 'pediatric-cpr-aed-course';
    }

    if (isCpr) setLastCprView(type as 'video' | 'slideshow');
    else setLastFaView(type as 'video' | 'slideshow');

    if (type === 'video') {
      switchCourse(index);
      setActiveTab('video');
    } else {
      switchSlideshow(index);
      setActiveTab('slideshow');
    }
    setShowSidebar(true);
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowManualSelector(false);
  };

  const activeVideoId = activeCourseIndex !== null ? COURSES[activeCourseIndex]?.id : null;
  const activeSlideshowId = activeSlideshowIndex !== null ? SLIDESHOWS[activeSlideshowIndex]?.id : null;

  const isCprActive = 
    (activeTab === 'video' && (activeVideoId === 'cpr-aed' || activeVideoId === 'pediatric-cpr-aed')) || 
    (activeTab === 'slideshow' && (activeSlideshowId === 'cpr-aed-course' || activeSlideshowId === 'cpr-aed-spanish-course' || activeSlideshowId === 'pediatric-cpr-aed-course'));

  const isFaActive = 
    (activeTab === 'video' && (activeVideoId === 'first-aid' || activeVideoId === 'pediatric-first-aid')) ||
    (activeTab === 'slideshow' && (activeSlideshowId === 'first-aid-course' || activeSlideshowId === 'first-aid-spanish-course' || activeSlideshowId === 'pediatric-first-aid-course'));



  useEffect(() => {
    if (activeChapter?.parentSectionId) {
      setExpandedSections(prev => ({
        ...prev,
        [activeChapter.parentSectionId!]: true
      }));
    }
  }, [activeChapter]);

  // Reset outline when manual changes
  useEffect(() => {
    if (selectedManual) {
      setManualOutline([]);
      setExpandedManualSections({});
    }
  }, [selectedManual]);

  // Track internet connectivity status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // parseTimestamp and parseVTT moved to src/utils/vtt-parser.ts

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
    const cleanBaseName = (baseName.split('/').pop() || baseName).replace(/^\/+/, '');
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
  }, [activeChapterIndex, activeCourseIndex]);

  const nextChapter = activeCourse && activeChapterIndex < activeCourse.chapters.length - 1 
    ? activeCourse.chapters[activeChapterIndex + 1] 
    : null;

  const isTargetDownloaded = isTauri && activeChapter ? !!dlState.fileStatuses[activeChapter.filename.replace(/^\//, '')] : false;
  const isNextDownloaded = isTauri && nextChapter ? !!dlState.fileStatuses[nextChapter.filename.replace(/^\//, '')] : false;

  // Manage double-buffered preloading for Video Players A & B
  useEffect(() => {
    if (!activeChapter) return;

    const getUrl = (chapter: any, downloaded: boolean) => {
      const url = m(chapter.filename);
      return isTauri ? url + (downloaded ? "?t=ready" : "?t=loading") : url;
    };

    const activeUrl = getUrl(activeChapter, isTargetDownloaded);
    const nextUrl = nextChapter ? getUrl(nextChapter, isNextDownloaded) : "";

    // Load active player immediately
    if (activePlayer === 'A') {
      if (videoRefA.current && videoRefA.current.src !== activeUrl) {
        videoRefA.current.src = activeUrl;
        videoRefA.current.load();
      }
    } else {
      if (videoRefB.current && videoRefB.current.src !== activeUrl) {
        videoRefB.current.src = activeUrl;
        videoRefB.current.load();
      }
    }

    // Delay loading the next video on the inactive player to allow the 500ms cross-fade to finish
    // completely. This prevents the inactive player from resetting its poster visible on top.
    const timer = setTimeout(() => {
      if (activePlayer === 'A') {
        if (videoRefB.current && nextUrl && videoRefB.current.src !== nextUrl) {
          videoRefB.current.src = nextUrl;
          videoRefB.current.load();
        }
      } else {
        if (videoRefA.current && nextUrl && videoRefA.current.src !== nextUrl) {
          videoRefA.current.src = nextUrl;
          videoRefA.current.load();
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [activeChapterIndex, activeCourseIndex, activePlayer, isTargetDownloaded, isNextDownloaded]);

  // Synchronize playing state, volume cross-fading, and legacy ref when active player swaps
  useEffect(() => {
    const active = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
    const inactive = activePlayer === 'A' ? videoRefB.current : videoRefA.current;

    videoRef.current = active;

    if (isPresentingExternallyRef.current) return;

    let activeInterval: any = null;
    let inactiveInterval: any = null;
    let isCancelled = false;

    if (isPlaying) {
      // Start the new active video playing
      if (active) {
        active.muted = isMuted;
        if (!isMuted) {
          active.volume = 0.0;
          active.play()
            .then(() => {
              if (isCancelled) return;
              // Fade up the active player's volume
              const duration = 500; // ms
              const step = 50; // ms
              const increment = step / duration;
              let currentVolume = 0.0;
              activeInterval = setInterval(() => {
                const target = volumeRef.current;
                const dynamicIncrement = (step / duration) * target;
                currentVolume = Math.min(target, currentVolume + dynamicIncrement);
                if (active) active.volume = currentVolume;
                if (currentVolume >= target) {
                  clearInterval(activeInterval);
                }
              }, step);
            })
            .catch(e => console.error("Play failed", e));
        } else {
          active.volume = 0.0;
          active.play().catch(e => console.error("Play failed", e));
        }
      }

      // Fade out and then pause the inactive video
      if (inactive) {
        inactive.muted = isMuted;
        if (!isMuted && !inactive.paused) {
          const duration = 500; // ms
          const step = 50; // ms
          const decrement = step / duration;
          let currentVolume = inactive.volume;
          inactiveInterval = setInterval(() => {
            currentVolume = Math.max(0.0, currentVolume - decrement);
            if (inactive) inactive.volume = currentVolume;
            if (currentVolume <= 0.0) {
              clearInterval(inactiveInterval);
              inactive.pause();
            }
          }, step);
        } else {
          inactive.pause();
        }
      }
    } else {
      if (active) active.pause();
      if (inactive) inactive.pause();
    }

    return () => {
      isCancelled = true;
      if (activeInterval) clearInterval(activeInterval);
      if (inactiveInterval) clearInterval(inactiveInterval);
    };
  }, [activePlayer, isPlaying, isMuted, activeCourseIndex, activeChapterIndex]);

  const saveProgress = (courseIndex: number, chapterIndex: number) => {
    if (courseIndex !== null && COURSES[courseIndex]) {
      localStorage.setItem(`course_progress_${COURSES[courseIndex].id}`, chapterIndex.toString());
    }
  };

  const selectChapter = (index: number) => {
    if (activeCourseIndex === null || !COURSES[activeCourseIndex]) return;
    const chapter = COURSES[activeCourseIndex].chapters[index];
    if (!chapter) return;

    if (isTauri && chapter.filename) {
      const clean = chapter.filename.trim().replace(/^\//, '');
      if (!dlState.fileStatuses[clean]) {
        setDownloadingChapterIndex(index);
        downloadManager.startSingleDownload(chapter.filename);
        return;
      }
    }

    if (index !== activeChapterIndex) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      setActiveChapterIndex(index);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, index);
    }
    setShowNextOverlay(false);
    if (isPresentingExternallyRef.current && chapter.filename) {
      setIsPlaying(true);
      setActiveTab('video');
      if (window.innerWidth < 1024) setShowSidebar(false);
      void loadPresentedVideo(chapter.filename, true);
      return;
    }
    setIsPlaying(true);
    setActiveTab('video'); // Switch view tab to show the playing video
    if (window.innerWidth < 1024) setShowSidebar(false);
  };

  const switchCourse = (index: number) => {
    setActivePlayer('A');
    setActiveCourseIndex(index);
    let savedChapter = 0;
    if (COURSES[index]) {
      const saved = localStorage.getItem(`course_progress_${COURSES[index].id}`);
      if (saved) savedChapter = parseInt(saved, 10) || 0;
    }
    setActiveChapterIndex(savedChapter);
    setIsPlaying(false);
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowNextOverlay(false);
    setShowSidebar(true);
    // Auto-download course media
    if (isTauri && COURSES[index]) {
      const courseId = COURSES[index].id;
      const category = courseId === 'cpr-aed' || courseId === 'pediatric-cpr-aed'
        ? 'cpr-aed'
        : 'first-aid';
      downloadManager.startBulkDownload(category as any);
    }
  };

  const getActiveCourseVideo = (): HTMLVideoElement | null => {
    if (videoRef.current) return videoRef.current;
    if (videoRefA.current && !videoRefA.current.paused) return videoRefA.current;
    if (videoRefB.current && !videoRefB.current.paused) return videoRefB.current;
    return activePlayer === 'A'
      ? videoRefA.current
      : videoRefB.current;
  };

  const restoreLocalMediaRef = useRef<null | (() => void)>(null);

  const silenceLocalMedia = () => {
    restoreLocalMediaRef.current?.();

    const videos = [videoRefA.current, videoRefB.current, slideVideoRef.current]
      .filter(Boolean) as HTMLVideoElement[];
    const previous = videos.map((el) => ({ el, muted: el.muted }));
    videos.forEach((el) => {
      try { el.pause(); el.muted = true; } catch {}
    });
    restoreLocalMediaRef.current = () => {
      previous.forEach(({ el, muted }) => {
        try { el.muted = muted; } catch {}
      });
    };
  };

  const restoreLocalMedia = () => {
    restoreLocalMediaRef.current?.();
    restoreLocalMediaRef.current = null;
  };

  const resetPresenterState = () => {
    void downloadManager.setSuppressed(false);
    presentingModeRef.current = null;
    isPresentingExternallyRef.current = false;
    presenterDurationRef.current = 0;
    setPresenterDuration(0);
    setIsPresentingExternally(false);
    setPresenterError(null);
    setIsPresenterStarting(false);
    restoreLocalMedia();
    setActiveCueIfChanged(null);
  };

  const loadViewerVideo = async (
    filename: string, autoPlay: boolean, currentTime = 0
  ): Promise<boolean> => {
    const clean = filename.trim().replace(/^\//, '');
    if (!clean) return false;

    const loaded = await sendToViewer('presentation:load', {
      type: 'video', url: m(`/${clean}`), autoPlay, currentTime,
    });
    if (!loaded) return false;
    setPresenterError(null);
    await sendToViewer('presentation:volume', { volume, muted: isMuted });
    await sendToViewer('presentation:rate', { rate: playbackRate });
    return true;
  };

  const loadSlideToViewer = async (
    slide: any, autoPlay: boolean, currentTime = 0
  ): Promise<boolean> => {
    if (slide.type !== 'video' && slide.type !== 'image') {
      console.warn('[presenter] Unsupported slide type:', slide.type);
      return false;
    }
    const url = resolveSlideUrl(slide, m, dlState.fileStatuses);
    if (!url) return false;

    const loaded = await sendToViewer('presentation:load', {
      type: slide.type, url,
      autoPlay: slide.type === 'video' && autoPlay,
      currentTime: slide.type === 'video' ? currentTime : 0,
    });
    if (!loaded) return false;
    setPresenterError(null);
    if (slide.type === 'video') {
      await sendToViewer('presentation:volume', { volume, muted: isMuted });
      await sendToViewer('presentation:rate', { rate: playbackRate });
    }
    return true;
  };

  const loadPresentedVideo = async (
    filename: string, autoPlay: boolean, currentTime = 0
  ): Promise<boolean> => {
    const previousMode = presentingModeRef.current;
    const ok = await loadViewerVideo(filename, autoPlay, currentTime);
    if (ok) {
      presentingModeRef.current = 'video';
    } else {
      presentingModeRef.current = previousMode;
      setPresenterError('Could not load chapter on presenter display');
    }
    return ok;
  };

  const loadPresentedSlide = async (
    slide: any, autoPlay: boolean, currentTime = 0
  ): Promise<boolean> => {
    const previousMode = presentingModeRef.current;
    const ok = await loadSlideToViewer(slide, autoPlay, currentTime);
    if (ok) {
      presentingModeRef.current = 'slideshow';
    } else {
      presentingModeRef.current = previousMode;
      setPresenterError('Could not load slide on presenter display');
    }
    return ok;
  };

  useEffect(() => {
    if (!isTauri) {
      setViewerListenersReady(true);
      return;
    }
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    import('@tauri-apps/api/event').then(async ({ listen }) => {
      const add = async (event: string, cb: (e: any) => void) => {
        const unlisten = await listen(event, cb);
        if (cancelled) unlisten();
        else unlisteners.push(unlisten);
      };

      await add('viewer:timeupdate', (event: any) => {
        if (!isPresentingExternallyRef.current) return;
        const rawTime = Number(event.payload?.currentTime);
        const rawDuration = Number(event.payload?.duration);
        const currentTime = Number.isFinite(rawTime) && rawTime >= 0 ? rawTime : 0;
        const duration = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : 0;

        if (duration > 0) updatePresenterDuration(duration);

        const raw = duration > 0 ? (currentTime / duration) * 100 : 0;
        const p = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        setProgress(p);
        setActiveCueIfChanged(findActiveCue(subtitleCuesRef.current, currentTime));
      });

      await add('viewer:ended', () => {
        if (!isPresentingExternallyRef.current) return;
        if (presentingModeRef.current === 'slideshow') {
          setSlideshowIsPlaying(false);
          return;
        }
        handleEndedCoreRef.current();
      });

      await add('viewer:play-error', (event: any) => {
        if (!isPresentingExternallyRef.current) return;
        const message = event.payload?.message || 'Presenter video could not start';
        console.error('[presenter] Viewer play failed:', message);
        setPresenterError(message);
        if (presentingModeRef.current === 'slideshow') setSlideshowIsPlaying(false);
        else setIsPlaying(false);
      });

      await add('viewer:load-error', (event: any) => {
        if (!isPresentingExternallyRef.current) return;
        const message = event.payload?.message || 'Presenter media failed to load';
        console.error('[presenter] Viewer media failed:', event.payload);
        setPresenterError(message);
        if (presentingModeRef.current === 'slideshow') setSlideshowIsPlaying(false);
        else setIsPlaying(false);
      });

      await add('system:sleep', () => {
        void setDisplaySleepPrevention(false);
      });

      await add('system:wake', () => {
        if (shouldPreventSleepRef.current) {
          void setDisplaySleepPrevention(true);
        }
      });

      if (!cancelled) setViewerListenersReady(true);
    }).catch((e) => {
      console.error('[presenter] Viewer listener setup failed:', e);
      setPresenterError('Presenter controls could not initialize');
      setViewerListenersReady(false);
    });

    return () => { cancelled = true; unlisteners.forEach((fn) => fn()); };
  }, []);

  useEffect(() => () => {
    void setDisplaySleepPrevention(false);
    void stopPresenting();
  }, []);

  useEffect(() => {
    const shouldPrevent = isPresentingExternally
      || isFullScreen
      || (activeTab === 'slideshow' && slideshowIsPlaying && Boolean(activeSlideshow));
    shouldPreventSleepRef.current = shouldPrevent;
    void setDisplaySleepPrevention(shouldPrevent);
  }, [isPresentingExternally, isFullScreen, activeTab, slideshowIsPlaying, activeSlideshow]);

  useEffect(() => { checkFullscreen().then(setIsFullScreen); }, []);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const sync = async () => { setIsFullScreen(await win.isFullscreen()); };
      const u1 = await win.onFocusChanged(sync);
      const u2 = await win.onResized(sync);
      if (cancelled) { u1(); u2(); }
      else { unlisteners.push(u1, u2); }
    }).catch(console.error);

    return () => { cancelled = true; unlisteners.forEach((fn) => fn()); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const check = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const can = await canPresent();
        if (cancelled) return;
        setHasExternalMonitor(can);
        if (!can && isPresentingExternallyRef.current) {
          await stopPresenting();
          resetPresenterState();
        }
      } finally {
        inFlight = false;
      }
    };

    check();
    const interval = setInterval(check, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isPresentingExternally]);

  const handleFullscreenToggle = async () => {
    setIsFullScreen(await toggleFullscreen());
  };

  const handleFullscreenExit = async () => {
    await exitFullscreen();
    setIsFullScreen(await checkFullscreen());
  };

  const handleStartPresenting = async () => {
    if (presenterStartingRef.current || usbImportActiveRef.current) return;
    const hasPresentableContent = (activeTab === 'video'
      && Boolean(activeCourse?.chapters[activeChapterIndex]?.filename))
      || (activeTab === 'slideshow' && Boolean(activeSlideshow && activeSlide));
    if (!hasPresentableContent) {
      setPresenterError('Open a course video or slideshow before starting Presenter');
      return;
    }
    presenterStartingRef.current = true;
    setIsPresenterStarting(true);
    setPresenterError(null);

    try {
      await downloadManager.setSuppressed(true);
      const shouldAutoPlay = activeTab === 'video' ? isPlaying : slideshowIsPlaying;
      const startTime = activeTab === 'video'
        ? (getActiveCourseVideo()?.currentTime ?? 0)
        : (activeSlide?.type === 'video' ? (slideVideoRef.current?.currentTime ?? 0) : 0);
      const success = await startPresenting(() => {
        resetPresenterState();
      });
      if (!success) {
        resetPresenterState();
        setPresenterError('No external display was available or the presenter window could not open');
        return;
      }

      isPresentingExternallyRef.current = true;
      setIsPresentingExternally(true);
      silenceLocalMedia();

      let loaded = false;

      if (activeTab === 'video' && activeCourse) {
        const chapter = activeCourse.chapters[activeChapterIndex];
        if (chapter?.filename) {
          presentingModeRef.current = 'video';
          loaded = await loadViewerVideo(chapter.filename, shouldAutoPlay, startTime);
        }
      } else if (activeTab === 'slideshow' && activeSlideshow && activeSlide) {
        presentingModeRef.current = 'slideshow';
        loaded = await loadSlideToViewer(activeSlide, shouldAutoPlay, startTime);
      }

      if (!loaded) {
        await stopPresenting();
        resetPresenterState();
        setPresenterError('Could not load content on the presenter display');
      }
    } catch (e) {
      console.error('[presenter] Start failed:', e);
      await stopPresenting();
      resetPresenterState();
      setPresenterError('Could not start presenter display');
    } finally {
      presenterStartingRef.current = false;
      setIsPresenterStarting(false);
    }
  };

  const handleStopPresenting = async () => {
    await stopPresenting();
    resetPresenterState();
  };

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) =>
      listen<UsbImportProgress>('usb-import-progress', (event) => {
        setUsbProgress(event.payload);
      })
    ).then((cleanup) => { unlisten = cleanup; }).catch(console.error);
    return () => unlisten?.();
  }, []);

  const handleOpenUsbImport = async () => {
    if (isPresentingExternallyRef.current || usbImportActiveRef.current) return;
    setUsbError(null);
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        title: 'Choose Conference Media Library',
        directory: true,
        multiple: false,
        recursive: true,
        canCreateDirectories: false,
        fileAccessMode: 'scoped',
      });
      if (!selected || Array.isArray(selected)) return;
      const { invoke } = await import('@tauri-apps/api/core');
      const summary = await invoke<UsbImportSummary>('inspect_usb_media_folder', { selectedFolder: selected });
      setUsbFolder(selected);
      setUsbSummary(summary);
      setUsbProgress(null);
      setUsbStatus('ready');
    } catch (error) {
      setUsbFolder(null);
      setUsbSummary({ appVersion: 'Unknown', generatedAt: '', fileCount: 0, totalBytes: 0 });
      setUsbStatus('error');
      setUsbError(String(error));
    }
  };

  const handleStartUsbImport = async () => {
    if (!usbFolder || !usbSummary || isPresentingExternallyRef.current || usbImportActiveRef.current) return;
    usbImportActiveRef.current = true;
    setIsUsbImportActive(true);
    usbCancelRequestedRef.current = false;
    setUsbStatus('importing');
    setUsbError(null);
    await downloadManager.setSuppressed(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke<UsbImportSummary>('import_usb_media_folder', { selectedFolder: usbFolder });
      setUsbStatus('complete');
      await downloadManager.checkAllStatuses();
    } catch (error) {
      if (usbCancelRequestedRef.current) {
        setUsbStatus('ready');
      } else {
        setUsbStatus('error');
        setUsbError(String(error));
      }
    } finally {
      usbImportActiveRef.current = false;
      setIsUsbImportActive(false);
      await downloadManager.setSuppressed(false);
    }
  };

  const handleRetryUsbImport = () => {
    if (usbFolder) {
      void handleStartUsbImport();
      return;
    }
    setUsbSummary(null);
    setUsbProgress(null);
    setUsbError(null);
    void handleOpenUsbImport();
  };

  const handleCancelUsbImport = async () => {
    if (!usbImportActiveRef.current) return;
    usbCancelRequestedRef.current = true;
    setUsbStatus('cancelling');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_usb_media_import');
      setUsbStatus('ready');
    } catch (error) {
      setUsbStatus('error');
      setUsbError(String(error));
    }
  };

  useEffect(() => {
    syncPresenterSubtitle(isPresentingExternally, showSubtitles, activeCue);
  }, [activeCue, isPresentingExternally, showSubtitles]);

  useEffect(() => {
    if (isPresentingExternally)
      sendToViewer('presentation:volume', { volume, muted: isMuted });
  }, [volume, isMuted, isPresentingExternally]);

  useEffect(() => {
    if (isPresentingExternally)
      sendToViewer('presentation:rate', { rate: playbackRate });
  }, [playbackRate, isPresentingExternally]);

  useEffect(() => {
    if (!isFullScreen) setIsUiVisible(true);
  }, [isFullScreen]);

  const handleVideoSeek = (time: number, duration: number) => {
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    if (!safeDuration) return;

    const safeTime = Number.isFinite(time)
      ? Math.max(0, Math.min(time, safeDuration))
      : 0;

    const p = (safeTime / safeDuration) * 100;
    setProgress(Math.max(0, Math.min(100, p)));

    if (isPresentingExternallyRef.current) {
      void sendToViewer('presentation:seek', { time: safeTime }).then((sent) => {
        if (!sent) setPresenterError('Could not seek presenter video');
      });
      setActiveCueIfChanged(findActiveCue(subtitleCuesRef.current, safeTime));
      return;
    }
    const video = getActiveCourseVideo();
    if (video) video.currentTime = safeTime;
  };



  const handleEnded = () => {
    if (isPresentingExternallyRef.current) return;
    handleEndedCoreRef.current();
  };

  const handleTimeUpdate = (video: HTMLVideoElement) => {
    if (isPresentingExternallyRef.current) return;
    const currentTime = video.currentTime;
    const p = (currentTime / (video.duration || 1)) * 100;
    setProgress(isNaN(p) ? 0 : p);

    setActiveCueIfChanged(findActiveCue(subtitleCues, currentTime));
  };

  const togglePlay = () => {
    if (isPresentingExternallyRef.current) {
      const currentlyPlaying = isPlaying;
      setIsPlaying(!currentlyPlaying);
      setActiveTab('video');
      void sendToViewer(currentlyPlaying ? 'presentation:pause' : 'presentation:play').then((sent) => {
        if (!sent) setPresenterError('Could not control presenter video');
      });
      return;
    }
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setActiveTab('video');
          })
          .catch(e => console.error("Play failed", e));
      }
    }
  };

  const handleNext = () => {
    if (activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      selectChapter(activeChapterIndex + 1);
    }
  };

  const handleEndedCore = useCallback(() => {
    setIsPlaying(false);
    if (isContinuousPlay && activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      selectChapter(activeChapterIndex + 1);
    } else {
      setShowNextOverlay(true);
    }
  }, [isContinuousPlay, activeCourse, activeChapterIndex]);

  useEffect(() => {
    handleEndedCoreRef.current = handleEndedCore;
  }, [handleEndedCore]);

  const handlePrev = () => {
    if (activeChapterIndex > 0) {
      selectChapter(activeChapterIndex - 1);
    }
  };

  const switchSlideshow = (index: number) => {
    setIsPlaying(false);
    setActiveSlideshowIndex(index);
    setActiveSlideIndex(0);
    setSlideshowIsPlaying(true);
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowSidebar(true);
  };

  const selectSlide = (index: number) => {
    if (!activeSlideshow) return;
    const slide = activeSlideshow.slides[index];
    if (!slide) return;

    // For VIDEO slides: gate on download (same as video chapters)
    if (isTauri && slide.type === 'video' && slide.filename) {
      const clean = slide.filename.trim().replace(/^\//, '');
      if (!dlState.fileStatuses[clean]) {
        // Only trigger if we're not already downloading this slide
        if (downloadingSlideIndex !== index) {
          setDownloadingSlideIndex(index);
          downloadManager.startSingleDownload(slide.filename);
        }
        return; // Wait for download to complete
      }
    }

    if (isPresentingExternallyRef.current) {
      slideVideoRef.current?.pause();
      setActiveSlideIndex(index);
      setSlideshowIsPlaying(slide.type === 'video');
      setActiveTab('slideshow');
      void loadPresentedSlide(slide, slide.type === 'video');
      return;
    }

    // For IMAGE slides (or already-downloaded videos): navigate immediately
    // Images load from CDN online or from local cache if already downloaded
    // Use the sidebar download button to explicitly download individual slides
    if (slideVideoRef.current) slideVideoRef.current.pause();
    setActiveSlideIndex(index);
    setSlideshowIsPlaying(true);
    setActiveTab('slideshow');
  };

  const nextSlide = () => {
    if (activeSlideshow && activeSlideIndex < activeSlideshow.slides.length - 1) {
      selectSlide(activeSlideIndex + 1);
    }
  };

  const prevSlide = () => {
    if (activeSlideIndex > 0) {
      selectSlide(activeSlideIndex - 1);
    }
  };
  
  const toggleSlideshowPlay = () => {
    if (isPresentingExternallyRef.current && activeSlide?.type === 'video') {
      const currentlyPlaying = slideshowIsPlaying;
      setSlideshowIsPlaying(!currentlyPlaying);
      void sendToViewer(currentlyPlaying ? 'presentation:pause' : 'presentation:play').then((sent) => {
        if (!sent) setPresenterError('Could not control presenter slide');
      });
      return;
    }
    if (slideVideoRef.current && activeSlide?.type === 'video') {
      if (slideshowIsPlaying) {
        slideVideoRef.current.pause();
      } else {
        slideVideoRef.current.play().catch(e => console.error("Play failed", e));
      }
      setSlideshowIsPlaying(!slideshowIsPlaying);
    }
  };

  useEffect(() => {
    if (isPresentingExternallyRef.current) return;
    if (slideshowIsPlaying && slideVideoRef.current && activeSlide?.type === 'video') {
      slideVideoRef.current.play().catch(e => console.error("Play failed", e));
    }
  }, [activeSlideIndex, activeSlideshowIndex, activeSlide, slideshowIsPlaying]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keyboard shortcuts when user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Spacebar to play/pause video
      if (e.key === ' ') {
        if (activeTab === 'video' && activeCourse && videoRef.current) {
          e.preventDefault();
          if (isPlaying) {
            videoRef.current.pause();
            setIsPlaying(false);
          } else {
            videoRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
          }
        } else if (activeTab === 'slideshow' && activeSlideshow && slideVideoRef.current && activeSlide?.type === 'video') {
          e.preventDefault();
          if (slideshowIsPlaying) {
            slideVideoRef.current.pause();
          } else {
            slideVideoRef.current.play().catch(console.error);
          }
          setSlideshowIsPlaying(!slideshowIsPlaying);
        }
      } else if (e.key === 'ArrowRight') {
        if (activeTab === 'slideshow' && activeSlideshow) {
          if (activeSlideIndex < activeSlideshow.slides.length - 1) {
            selectSlide(activeSlideIndex + 1);
          }
        } else if (activeTab === 'video' && activeCourse) {
          if (activeChapterIndex < activeCourse.chapters.length - 1) {
            selectChapter(activeChapterIndex + 1);
          }
        } else if (activeTab === 'manual') {
          if (flipbookRef.current) flipbookRef.current.flipNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeTab === 'slideshow' && activeSlideshow) {
          if (activeSlideIndex > 0) {
            selectSlide(activeSlideIndex - 1);
          }
        } else if (activeTab === 'video' && activeCourse) {
          if (activeChapterIndex > 0) {
            selectChapter(activeChapterIndex - 1);
          }
        } else if (activeTab === 'manual') {
          if (flipbookRef.current) flipbookRef.current.flipPrev();
        }
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
        if (isTauri) {
          import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
            getCurrentWindow().setFullscreen(false);
          }).catch(console.error);
        }
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (isTauri) {
          import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
            const win = getCurrentWindow();
            const isFs = await win.isFullscreen();
            win.setFullscreen(!isFs);
          }).catch(console.error);
        }
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsUiVisible(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [activeTab, activeSlideshow, activeSlideIndex, activeCourse, activeSlide, isPlaying, slideshowIsPlaying, activeChapterIndex]);

  // UI Fade effect
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    const handleActivity = () => {
      setIsUiVisible(true);
      clearTimeout(timer);
      if (isPlaying || slideshowIsPlaying) {
        timer = setTimeout(() => {
          setIsUiVisible(false);
        }, 3000);
      }
    };

    if ((activeTab === 'video' && !isPlaying) || (activeTab === 'slideshow' && !slideshowIsPlaying)) {
      setIsUiVisible(true);
      return;
    }

    handleActivity();
    
    const container1 = videoContainerRef.current;
    const container2 = slideshowContainerRef.current;
    
    if (container1) {
      container1.addEventListener('mousemove', handleActivity);
      container1.addEventListener('click', handleActivity);
    }
    if (container2) {
      container2.addEventListener('mousemove', handleActivity);
      container2.addEventListener('click', handleActivity);
    }
    window.addEventListener('mousemove', handleActivity);

    return () => {
      if (container1) {
        container1.removeEventListener('mousemove', handleActivity);
        container1.removeEventListener('click', handleActivity);
      }
      if (container2) {
        container2.removeEventListener('mousemove', handleActivity);
        container2.removeEventListener('click', handleActivity);
      }
      window.removeEventListener('mousemove', handleActivity);
      clearTimeout(timer);
    };
  }, [isPlaying, slideshowIsPlaying, activeTab]);

  // Close all dropdowns when clicking outside the header area
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('header')) {
        setShowCprSelector(false);
        setShowFaSelector(false);
        setShowManualSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prevent video background play & dropdown menu flickering when tab changes
  useEffect(() => {
    if (activeTab !== 'video') {
      if (videoRefA.current) videoRefA.current.pause();
      if (videoRefB.current) videoRefB.current.pause();
      setIsPlaying(false);
    }
    if (activeTab !== 'slideshow') {
      if (slideVideoRef.current) slideVideoRef.current.pause();
      setSlideshowIsPlaying(false);
    }
  }, [activeTab]);

  return (
    <div className="flex h-screen bg-black text-eh-peach overflow-hidden medical-gradient relative">
      {mediaStorageError && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-6">
          <div className="w-full max-w-lg border border-eh-red/40 bg-[#151619] p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-white">Media library unavailable</h2>
            <p className="mt-3 text-sm leading-6 text-eh-peach/80">
              CPR Trainer Pro could not open its media library in Application Support. Check available disk space and folder permissions, then reopen the app.
            </p>
            <p className="mt-4 break-words font-mono text-xs leading-5 text-eh-red/80">
              {mediaStorageError}
            </p>
          </div>
        </div>
      )}
      {showContentUpdatePrompt && !isPresentingExternally && !isUsbImportActive && (
        <UpdatePrompt
          files={contentUpdateFiles}
          avgSpeedBps={contentUpdateAvgSpeed}
          onUpdateNow={() => {
            setShowContentUpdatePrompt(false);
            contentUpdateFiles.forEach(f => {
              const stash = manifestStashRef.current[f.key];
              if (stash) {
                const normalized = f.key.trim().replace(/^\//, '');
                pendingUpdatesRef.current[normalized] = { originalKey: f.key, ...stash };
              }
            });
            downloadManager.queueSpecificFiles(
              contentUpdateFiles.map(f => ({
                filename: f.key,
                version: f.version,
                size: f.size,
              }))
            );
          }}
          onDismiss={() => {
            setShowContentUpdatePrompt(false);
          }}
        />
      )}
      {usbSummary && (
        <UsbImportModal
          summary={usbSummary}
          progress={usbProgress}
          status={usbStatus}
          error={usbError}
          onStart={() => void handleStartUsbImport()}
          onRetry={handleRetryUsbImport}
          onCancel={() => void handleCancelUsbImport()}
          onClose={() => {
            if (usbImportActiveRef.current) return;
            setUsbSummary(null);
            setUsbFolder(null);
            setUsbProgress(null);
            setUsbError(null);
          }}
        />
      )}
      {/* Sidebar Navigation */}
      <AnimatePresence mode="wait">
        {showSidebar && !isFullScreen && (
          <Sidebar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            setActiveCourseIndex={setActiveCourseIndex}
            setActiveSlideshowIndex={setActiveSlideshowIndex}
            setSelectedManual={selectManual}
            setActiveTab={setActiveTab}
            activeTab={activeTab}
            activeCourse={activeCourse}
            activeSlideshow={activeSlideshow}
            selectedManual={selectedManual}
            manualOutline={manualOutline}
            expandedManualSections={expandedManualSections}
            setExpandedManualSections={setExpandedManualSections}
            flipbookRef={flipbookRef}
            MANUALS={MANUALS}
            activeSlideIndex={activeSlideIndex}
            expandedSections={expandedSections}
            setExpandedSections={setExpandedSections}
            setActiveSlideIndex={setActiveSlideIndex}
            selectSlide={selectSlide}
            slideshowIsPlaying={slideshowIsPlaying}
            setSlideshowIsPlaying={setSlideshowIsPlaying}
            toggleSlideshowPlay={toggleSlideshowPlay}
            activeChapterIndex={activeChapterIndex}
            selectChapter={selectChapter}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            isTauri={isTauri}
            dlState={dlState}
            easterEggLevel={easterEggLevel}
            downloadManager={downloadManager}
            isSettingsExpanded={isSettingsExpanded}
            setIsSettingsExpanded={setIsSettingsExpanded}
            isContinuousPlay={isContinuousPlay}
            setIsContinuousPlay={setIsContinuousPlay}
            handleInfoClick={handleInfoClick}
            handleInfoPointerDown={handleInfoPointerDown}
            handleInfoPointerUp={handleInfoPointerUp}
            showHowTo={showHowTo}
            setShowHowTo={setShowHowTo}
            setActiveGuidePath={setActiveGuidePath}
            setPortalStep={setPortalStep}
            EHLogo={EHLogo}
          />
        )}
      </AnimatePresence>
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full">
        {presenterError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-900/95 px-5 py-3 text-sm font-medium text-white shadow-lg">
            <span>{presenterError}</span>
            <button onClick={() => setPresenterError(null)} className="text-white/60 hover:text-white" title="Dismiss">&times;</button>
          </div>
        )}
        {/* Top Header */}
        {!isFullScreen && <HeaderNav
          dlState={dlState}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          setActiveCourseIndex={setActiveCourseIndex}
          activeCourseIndex={activeCourseIndex}
          setActiveSlideshowIndex={setActiveSlideshowIndex}
          activeSlideshowIndex={activeSlideshowIndex}
          setSelectedManual={selectManual}
          setActiveTab={setActiveTab}
          lastCprView={lastCprView}
          showCprSelector={showCprSelector}
          setShowCprSelector={setShowCprSelector}
          isCprActive={isCprActive}
          cprVaEnabled={cprVaEnabled}
          setCprVaEnabled={setCprVaEnabled}
          cprPediatric={cprPediatric}
          setCprPediatric={setCprPediatric}
          lastFaView={lastFaView}
          showFaSelector={showFaSelector}
          setShowFaSelector={setShowFaSelector}
          isFaActive={isFaActive}
          faPediatric={faPediatric}
          setFaPediatric={setFaPediatric}
          faVaEnabled={faVaEnabled}
          setFaVaEnabled={setFaVaEnabled}
          setShowManualSelector={setShowManualSelector}
          showManualSelector={showManualSelector}
          selectedManual={selectedManual}
          activeTab={activeTab}
          previewManualIndex={previewManualIndex}
          setPreviewManualIndex={setPreviewManualIndex}
          easterEggLevel={easterEggLevel}
          activeCourse={activeCourse}
          activeChapterIndex={activeChapterIndex}
          handleItemClick={handleItemClick}
          MANUALS={MANUALS}
          EHLogo={EHLogo}
          CprIcon={CprIcon}
          FirstAidIcon={FirstAidIcon}
          isFullScreen={isFullScreen}
          isPresentingExternally={isPresentingExternally}
          hasExternalMonitor={hasExternalMonitor && viewerListenersReady}
          isPresenterStarting={isPresenterStarting}
          presenterError={presenterError}
          handleStartPresenting={handleStartPresenting}
          handleStopPresenting={handleStopPresenting}
          handleFullscreenToggle={handleFullscreenToggle}
          handleOpenUsbImport={handleOpenUsbImport}
          isUsbImportActive={isUsbImportActive}
        />}
        {/* Player Section */}
        <div className="flex-1 relative bg-black overflow-hidden h-full flex items-center justify-center">
          
          {/* Default Background Logo and Copyright */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-opacity duration-1000 pointer-events-none ${
            (((!activeCourse && activeTab === 'video') || (!selectedManual && activeTab === 'manual') || (!activeSlideshow && activeTab === 'slideshow')) && activeTab !== 'send-certs') ? 'opacity-100' : 'opacity-0'
          }`}>
             <img src="/eha-idle-screen.png" alt="EH Academy" className="w-full max-w-3xl object-contain mb-auto mt-auto" />
             
             {/* Copyright Banner on Idle Screen */}
             <div className="mt-auto pt-8 w-full max-w-4xl text-center">
                <p className="text-[10px] md:text-xs leading-relaxed text-white/40 hover:text-white/60 transition-colors duration-500 select-none font-medium tracking-wide">
                  © 2025 Everyday Hero Academy Inc. All rights reserved. This software and all course materials are proprietary and protected by copyright law. Unauthorized reproduction, distribution, or use outside of EHA‑approved training is strictly prohibited.
                </p>
             </div>
          </div>


          {/* Send Certs Tab Container */}
          <div className={`w-full h-full relative z-10 bg-black ${activeTab === 'send-certs' ? '' : 'hidden'}`}>
            {activeTab === 'send-certs' && (
              <Suspense fallback={<div className="flex w-full h-full items-center justify-center text-white/50"><Loader2 className="animate-spin w-8 h-8" /></div>}>
                <SendCertsPage 
                isOnline={isOnline}
                setIsOnline={setIsOnline}
                onReturnToMenu={() => setActiveTab('video')}
                onOpenGuide={() => {
                  setShowHowTo(true);
                  setActiveGuidePath('menu');
                }}
              />
              </Suspense>
            )}
          </div>
          {/* Manual Tab Container */}
          <div className={`w-full h-full relative z-10 ${activeTab === 'manual' && selectedManual ? 'block' : 'hidden'}`}>
            {selectedManual && (
              <ErrorBoundary
                onReset={() => {
                  setSelectedManual(null);
                  setActiveTab('video');
                }}
              >
                <ManualFlipbook 
                  key={selectedManual.id}
                  ref={flipbookRef}
                  pdfUrl={m(`/${selectedManual.filename}`)}
                  title={selectedManual.title}
                  onClose={() => {
                    setSelectedManual(null);
                    setActiveTab('video');
                  }}
                  onOutlineLoaded={(outline) => setManualOutline(outline.filter((item: any) => item.title !== 'Untitled'))}
                  showEasterEgg={easterEggLevel > 0}
                />
              </ErrorBoundary>
            )}
          </div>

          {/* Download Overlay Container (Tab-Aware) */}
          {/* Only show the overlay when the user is on the relevant tab for the active download */}
          {(() => {
            // Determine if we should show the overlay based on current tab context
            const showChapterOverlay = downloadingChapterIndex !== null && activeTab === 'video';
            const showManualOverlay = downloadingManualId !== null && activeTab === 'manual';
            const showSlideOverlay = downloadingSlideIndex !== null && activeTab === 'slideshow';
            const showOverlay = showChapterOverlay || showManualOverlay || showSlideOverlay;

            if (!showOverlay) return null;

            // Determine the target filename being waited on
            let targetFilename = '';
            let overlayLabel = '';
            if (showChapterOverlay && activeCourse) {
              const chapter = activeCourse.chapters[downloadingChapterIndex];
              targetFilename = chapter?.filename?.trim().replace(/^\//, '') || '';
              overlayLabel = 'Course Chapter';
            } else if (showManualOverlay) {
              const manual = MANUALS.find((m: any) => m.id === downloadingManualId);
              targetFilename = manual?.filename?.trim().replace(/^\//, '') || '';
              overlayLabel = 'Training Manual';
            } else if (showSlideOverlay && activeSlideshow) {
              const slide = activeSlideshow.slides[downloadingSlideIndex];
              targetFilename = slide?.filename?.trim().replace(/^\//, '') || '';
              overlayLabel = 'Slideshow Video';
            }

            // Check if the target file is the one currently being downloaded
            const currentFileClean = dlState.currentFile?.trim().replace(/^\//, '') || '';
            const isTargetActivelyDownloading = targetFilename && currentFileClean === targetFilename;
            const progressPct = isTargetActivelyDownloading && dlState.currentFileTotalBytes > 0
              ? Math.round((dlState.currentFileBytesWritten / dlState.currentFileTotalBytes) * 100)
              : 0;

            return (
              <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm">
                <div className="relative w-32 h-32 mb-6">
                  <div className="absolute inset-0 border-4 border-white/10 rounded-full" />
                  {isTargetActivelyDownloading ? (
                    <div 
                      className="absolute inset-0 border-4 border-eh-blue rounded-full transition-all duration-300"
                      style={{ 
                        clipPath: `polygon(50% 50%, 50% 0, ${progressPct > 12.5 ? '100% 0,' : ''} ${progressPct > 37.5 ? '100% 100%,' : ''} ${progressPct > 62.5 ? '0 100%,' : ''} ${progressPct > 87.5 ? '0 0,' : ''} ${
                          progressPct <= 12.5 ? 50 + (progressPct * 4) + '% 0' :
                          progressPct <= 37.5 ? '100% ' + ((progressPct - 12.5) * 4) + '%' :
                          progressPct <= 62.5 ? (100 - (progressPct - 37.5) * 4) + '% 100%' :
                          progressPct <= 87.5 ? '0 ' + (100 - (progressPct - 62.5) * 4) + '%' :
                          (progressPct - 87.5) * 4 + '% 0'
                        })` 
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 border-4 border-eh-blue/30 rounded-full animate-pulse" />
                  )}
                  <video 
                    src="/CPR-Dummies.mp4"
                    autoPlay 
                    loop 
                    muted 
                    playsInline 
                    className="absolute inset-2 w-28 h-28 object-cover rounded-full"
                  />
                </div>
                <h3 className="text-eh-peach font-bold text-lg mb-2">
                  {isTargetActivelyDownloading 
                    ? `Downloading ${overlayLabel}...` 
                    : `Preparing ${overlayLabel}...`}
                </h3>
                <p className="text-white/60 mb-4 text-center max-w-md text-sm">
                  {isTargetActivelyDownloading 
                    ? 'This media must be downloaded before playback can begin. It will automatically play once the download completes.'
                    : 'Your download is queued and will begin shortly. Other files are being downloaded first.'}
                </p>
                <div className="flex flex-col items-center space-y-1">
                  <span className="text-eh-blue-light font-mono font-bold text-xl">
                    {isTargetActivelyDownloading ? `${progressPct}%` : 'Queued'}
                  </span>
                  {isTargetActivelyDownloading && (
                    <span className="text-white/40 text-xs font-mono uppercase tracking-widest">
                      {formatSpeed(dlState.currentSpeed)}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => {
                    downloadManager.cancelDownload();
                    setDownloadingChapterIndex(null);
                    setDownloadingManualId(null);
                    setDownloadingSlideIndex(null);
                  }}
                  className="mt-8 px-6 py-2 rounded-full border border-white/20 text-white/70 hover:bg-white/10 hover:text-white transition-all text-sm font-bold tracking-wider cursor-pointer"
                >
                  Cancel Download
                </button>
              </div>
            );
          })()}

          {/* Video Tab Container */}
          <div className={`w-full h-full relative z-10 flex items-center justify-center ${activeTab === 'video' && activeCourse ? '' : 'hidden'}`}>
            <VideoPlayer
              activeCourse={activeCourse}
              activeChapter={activeChapter}
              activeChapterIndex={activeChapterIndex}
              setActiveCourseIndex={setActiveCourseIndex}
              selectChapter={selectChapter}
              isUiVisible={isUiVisible}
              videoContainerRef={videoContainerRef}
              videoRefA={videoRefA}
              videoRefB={videoRefB}
              activePlayer={activePlayer}
              videoRef={videoRef}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              volume={volume}
              setVolume={setVolume}
              handleEnded={handleEnded}
              handleTimeUpdate={handleTimeUpdate}
              showSubtitles={showSubtitles}
              setShowSubtitles={setShowSubtitles}
              activeCue={activeCue}
              showNextOverlay={showNextOverlay}
              handleNext={handleNext}
              handlePrev={handlePrev}
              progress={progress}
              setProgress={setProgress}
              isPlaying={isPlaying}
              togglePlay={togglePlay}
              playbackRate={playbackRate}
              setPlaybackRate={setPlaybackRate}
              handleVideoSeek={handleVideoSeek}
              isFullScreen={isFullScreen}
              onFullscreenToggle={handleFullscreenToggle}
              onFullscreenExit={handleFullscreenExit}
              hasExternalMonitor={hasExternalMonitor && viewerListenersReady}
              isPresentingExternally={isPresentingExternally}
              onStartPresenting={handleStartPresenting}
              onStopPresenting={handleStopPresenting}
              isPresenterStarting={isPresenterStarting}
              presenterDuration={presenterDuration}
            />
          </div>
          {/* Slideshow Tab Container */}
          <div className={`w-full h-full relative z-10 ${activeTab === 'slideshow' && activeSlideshow ? '' : 'hidden'}`}>
            <SlideshowPlayer
              activeSlideshow={activeSlideshow}
              activeSlide={activeSlide}
              activeSlideIndex={activeSlideIndex}
              setActiveSlideshowIndex={setActiveSlideshowIndex}
              isUiVisible={isUiVisible}
              slideshowContainerRef={slideshowContainerRef}
              slideVideoRef={slideVideoRef}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
              volume={volume}
              setVolume={setVolume}
              prevSlide={prevSlide}
              nextSlide={nextSlide}
              slideshowIsPlaying={slideshowIsPlaying}
              toggleSlideshowPlay={toggleSlideshowPlay}
              onSlideVideoEnded={() => setSlideshowIsPlaying(false)}
              m={m}
              fileStatuses={dlState.fileStatuses}
              isFullScreen={isFullScreen}
              onFullscreenToggle={handleFullscreenToggle}
              onFullscreenExit={handleFullscreenExit}
              hasExternalMonitor={hasExternalMonitor && viewerListenersReady}
              isPresentingExternally={isPresentingExternally}
              onStartPresenting={handleStartPresenting}
              onStopPresenting={handleStopPresenting}
              isPresenterStarting={isPresenterStarting}
            />
          </div>
        </div>
      </main>
      {/* How-To Guide Modal */}
      <Suspense fallback={null}>
      <HowToGuideModal
        showHowTo={showHowTo}
        setShowHowTo={setShowHowTo}
        activeGuidePath={activeGuidePath}
        setActiveGuidePath={setActiveGuidePath}
        portalStep={portalStep}
        setPortalStep={setPortalStep}
      />
      </Suspense>

      {/* First-Launch Download All Prompt */}
      <AnimatePresence>
        {showDownloadPrompt && !isPresentingExternally && !isUsbImportActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#131313] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl max-w-md w-full mx-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-eh-blue" />
              
              <div className="w-16 h-16 bg-eh-blue/10 rounded-full flex items-center justify-center mx-auto mb-5">
                <Download size={32} className="text-eh-blue" />
              </div>
              
              <h2 className="text-2xl font-bold text-eh-peach text-center mb-3 tracking-tight">
                Download Course Media
              </h2>
              <p className="text-sm text-eh-peach/70 text-center leading-relaxed mb-6">
                Would you like to download all course materials now? This includes videos, slideshows, and training manuals for offline use.
              </p>

              <div className="bg-black/40 border border-white/5 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between text-xs text-eh-peach/50 mb-2">
                  <span>Files available</span>
                  <span className="font-mono">{dlState.globalTotalCount} files</span>
                </div>
                <div className="flex items-center justify-between text-xs text-eh-peach/50">
                  <span>Already downloaded</span>
                  <span className="font-mono text-green-500">{dlState.globalDownloadedCount} files</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    localStorage.setItem('eh_download_prompted', 'true');
                    setShowDownloadPrompt(false);
                    downloadManager.startBulkDownload('everything');
                  }}
                  className="w-full py-3.5 bg-eh-blue hover:bg-eh-blue-light text-white font-bold rounded-xl text-sm shadow-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  Download Everything
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('eh_download_prompted', 'true');
                    setShowDownloadPrompt(false);
                  }}
                  className="w-full py-3 bg-white/5 hover:bg-white/10 text-eh-peach/60 font-bold rounded-xl text-sm transition-all cursor-pointer border border-white/5"
                >
                  Download Later
                </button>
              </div>
              
              <p className="text-[10px] text-eh-peach/30 text-center mt-4">
                You can download individual chapters anytime from the sidebar.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
