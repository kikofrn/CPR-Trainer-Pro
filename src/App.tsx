import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Menu, 
  X, 
  CheckCircle2, 
  Info,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  GraduationCap,
  Book,
  Baby,
  ChevronDown,
  Maximize2,
  MonitorPlay,
  Projector,
  Award,
  HelpCircle,
  Download,
  Loader2,
  Settings,
  Heart
} from 'lucide-react';
import { COURSES, MANUALS, Manual, SLIDESHOWS } from './chapters';
import type { ManualFlipbookRef } from './components/ManualFlipbook';
const ManualFlipbook = lazy(() => import('./components/ManualFlipbook'));
import { mediaUrl as m, waitForMediaResolver, isTauri } from './media-resolver';
import { CprIcon, FirstAidIcon } from './components/Icons';
import { downloadManager, DownloadState, formatSpeed, formatTimeRemaining } from './download-manager';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ErrorBoundary } from './components/ErrorBoundary';
import { parseVTT, type SubtitleCue } from './utils/vtt-parser';

export interface OutlineNode {
  title: string;
  dest?: string | any[];
  items?: OutlineNode[];
}

const SendCertsPage = lazy(() => import('./components/SendCertsPage').then(m => ({ default: m.SendCertsPage })));
const HowToGuideModal = lazy(() => import('./components/HowToGuideModal').then(m => ({ default: m.HowToGuideModal })));
import { HeaderNav } from './components/HeaderNav';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { SlideshowPlayer } from './components/SlideshowPlayer';

function EHLogo({ className }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center bg-transparent overflow-hidden ${className}`}>
      <img 
        src={m("/eha-icon.png")} 
        alt="EH Academy" 
        className="w-full h-full object-contain"
      />
    </div>
  );
}

// SubtitleCue type imported from utils/vtt-parser.ts

export default function App() {
  const [mediaReady, setMediaReady] = useState(false);
  
  // Updater State
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUpdateMinimized, setIsUpdateMinimized] = useState(false);

  // Un-minimize timer: 20 minutes for real update, 15 seconds for mock testing update
  useEffect(() => {
    if (isUpdateMinimized && updateAvailable) {
      const isMock = updateAvailable.version === '2.0.0-mock';
      const delay = isMock ? 15000 : 20 * 60 * 1000; // 15 seconds for mock testing, 20 mins for production
      
      console.log(`[Updater] Notification minimized. Will auto-restore in ${delay / 1000}s`);
      const timer = setTimeout(() => {
        setIsUpdateMinimized(false);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isUpdateMinimized, updateAvailable]);



  // Manifest: fetch remote manifest on mount
  useEffect(() => {
    let unsub: (() => void) | undefined;
    import('./chapters').then(({ fetchRemoteManifest, subscribeToManifest }) => {
      fetchRemoteManifest();
      unsub = subscribeToManifest(() => {
        // Force a re-render when manifest updates
        setMediaReady(prev => prev);
      });
    });
    return () => { unsub?.(); };
  }, []);

  useEffect(() => {
    async function checkForUpdates() {
      if (!isTauri) return;
      try {
        const update = await check();
        if (update) {
          console.log(`Update available: ${update.version}`);
          setUpdateAvailable(update);
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      }
    }
    checkForUpdates();
  }, []);



  // Initialize media resolver for Tauri desktop support
  useEffect(() => {
    waitForMediaResolver().then(() => setMediaReady(true));
  }, []);

  const appStartTime = useRef(Date.now());

  // Hide splashscreen and show main window when media is ready
  useEffect(() => {
    if (mediaReady && isTauri) {
      const elapsed = Date.now() - appStartTime.current;
      const delayToReady = Math.max(0, 3200 - elapsed);

      const outerTimer = setTimeout(() => {
        localStorage.setItem('splash_status', 'ready');
        
        innerTimerRef = setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('close_splashscreen').catch(e => 
              console.error('[Tauri] Splashscreen transition failed:', e)
            );
          });
        }, 300);
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
  const [downloadingChapterIndex, setDownloadingChapterIndex] = useState<number | null>(null);
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
  const [faVaEnabled, setFaVaEnabled] = useState(false);
  const [faPediatric, setFaPediatric] = useState(false);
  
  const [activeSlideshowIndex, setActiveSlideshowIndex] = useState<number | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideshowIsPlaying, setSlideshowIsPlaying] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedManualSections, setExpandedManualSections] = useState<Record<number, boolean>>({});
  const [manualOutline, setManualOutline] = useState<OutlineNode[]>([]);
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
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  useEffect(() => {
    const unsub = downloadManager.subscribe(setDlState);
    return unsub;
  }, []);

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
    const isCpr = (type === 'video' && index === 0) || (type === 'slideshow' && (index === 0 || index === 2));
    if (isCpr) setLastCprView(type as 'video' | 'slideshow');
    else setLastFaView(type as 'video' | 'slideshow');

    if (type === 'video') {
      console.log('[FS-DEBUG] Selected video course:', index);
      switchCourse(index);
      setActiveTab('video');
    } else {
      console.log('[FS-DEBUG] Selected manual/slideshow:', index);
      switchSlideshow(index);
      setActiveTab('slideshow');
    }
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowManualSelector(false);
  };

  const isCprActive = 
    (activeTab === 'video' && activeCourseIndex === 0) || 
    (activeTab === 'slideshow' && (activeSlideshowIndex === 0 || activeSlideshowIndex === 2));

  const isFaActive = 
    (activeTab === 'video' && (activeCourseIndex === 1 || activeCourseIndex === 2)) ||
    (activeTab === 'slideshow' && (activeSlideshowIndex === 1 || activeSlideshowIndex === 3 || activeSlideshowIndex === 4));



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

    let activeInterval: any = null;
    let inactiveInterval: any = null;

    if (isPlaying) {
      // Start the new active video playing
      if (active) {
        active.muted = isMuted;
        if (!isMuted) {
          active.volume = 0.0;
          active.play()
            .then(() => {
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
      if (activeInterval) clearInterval(activeInterval);
      if (inactiveInterval) clearInterval(inactiveInterval);
    };
  }, [activePlayer, isPlaying, isMuted, activeCourseIndex, activeChapterIndex]);

  const saveProgress = useCallback((courseIndex: number, chapterIndex: number) => {
    if (courseIndex !== null && COURSES[courseIndex]) {
      localStorage.setItem(`course_progress_${COURSES[courseIndex].id}`, chapterIndex.toString());
    }
  }, []);

  const selectChapter = useCallback((index: number) => {
    const chapter = activeCourse?.chapters[index];
    if (!chapter) return;

    // Check if file is downloaded (Tauri only)
    const cleanFilename = chapter.filename?.trim().replace(/^\//, '') || '';
    const isDownloaded = !isTauri || !!dlState.fileStatuses[cleanFilename];

    if (!isDownloaded && isTauri) {
      // Show "downloading" feedback and trigger download
      setDownloadingChapterIndex(index);
      if (chapter.filename) {
        downloadManager.startSingleDownload(chapter.filename);
      }
      return; // Don't try to play yet
    }

    if (index !== activeChapterIndex) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      setActiveChapterIndex(index);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, index);
    }
    setDownloadingChapterIndex(null);
    setShowNextOverlay(false);
    setIsPlaying(true);
    setActiveTab('video'); // Switch view tab to show the playing video
    if (window.innerWidth < 1024) setShowSidebar(false);
  }, [activeCourse, dlState.fileStatuses, activeChapterIndex, activeCourseIndex, saveProgress]);

  // Watch for download completion of the currently downloading chapter
  useEffect(() => {
    if (downloadingChapterIndex !== null && activeCourse) {
      const chapter = activeCourse.chapters[downloadingChapterIndex];
      const cleanFilename = chapter?.filename?.trim().replace(/^\//, '') || '';
      
      // If it became downloaded
      if (dlState.fileStatuses[cleanFilename]) {
        // Auto-play the chapter directly to avoid stale closures in selectChapter
        const idx = downloadingChapterIndex;
        setDownloadingChapterIndex(null);
        if (idx !== activeChapterIndex) {
          setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
          setActiveChapterIndex(idx);
          if (activeCourseIndex !== null) saveProgress(activeCourseIndex, idx);
        }
        setShowNextOverlay(false);
        setIsPlaying(true);
        setActiveTab('video');
        if (window.innerWidth < 1024) setShowSidebar(false);
      }
    }
  }, [dlState.fileStatuses, downloadingChapterIndex, activeCourse, activeChapterIndex, activeCourseIndex, saveProgress]);

  const switchCourse = (index: number) => {
    console.log('[FS-DEBUG] switchCourse called. index:', index, 'fullscreenElement:', document.fullscreenElement?.tagName || 'none', 'videoContainerRef:', videoContainerRef.current ? 'exists' : 'null');
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
      const category = courseId === 'cpr-aed' ? 'cpr-aed' : 'first-aid';
      downloadManager.startBulkDownload(category as any);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (isContinuousPlay && activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      handleNext();
    } else {
      setShowNextOverlay(true);
    }
  };

  const handleTimeUpdate = (video: HTMLVideoElement) => {
    const currentTime = video.currentTime;
    const p = (currentTime / (video.duration || 1)) * 100;
    setProgress(isNaN(p) ? 0 : p);

    // Only display subtitles if the video has actually started playing (currentTime > 0.01)
    if (subtitleCues.length > 0 && currentTime > 0.01) {
      const matchingCue = subtitleCues.find(
        cue => {
          // Delay any early cue (starting under 1.2s) until 1.2s to prevent showing during the initial cross-fade transition
          const effectiveStart = cue.start < 1.2 ? 1.2 : cue.start;
          return currentTime >= effectiveStart && currentTime <= cue.end;
        }
      );
      setActiveCue(matchingCue || null);
    } else {
      setActiveCue(null);
    }
  };

  const togglePlay = () => {
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

  const handleNext = useCallback(() => {
    if (activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      selectChapter(activeChapterIndex + 1);
    }
  }, [activeCourse, activeChapterIndex, selectChapter]);

  const handlePrev = useCallback(() => {
    if (activeChapterIndex > 0) {
      selectChapter(activeChapterIndex - 1);
    }
  }, [activeChapterIndex, selectChapter]);

  const switchSlideshow = (index: number) => {
    console.log('[FS-DEBUG] switchSlideshow called. index:', index);
    setIsPlaying(false);
    setActiveSlideshowIndex(index);
    setActiveSlideIndex(0);
    setSlideshowIsPlaying(true);
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowSidebar(true);
    // Auto-download slideshow media
    if (isTauri && SLIDESHOWS[index]) {
      downloadManager.startSlideshowDownload(SLIDESHOWS[index].id);
    }
  };

  const nextSlide = () => {
    if (activeSlideshow && activeSlideIndex < activeSlideshow.slides.length - 1) {
      if (slideVideoRef.current) {
        slideVideoRef.current.pause();
      }
      setActiveSlideIndex(prev => prev + 1);
      setSlideshowIsPlaying(true);
    }
  };

  const prevSlide = () => {
    if (activeSlideIndex > 0) {
      if (slideVideoRef.current) {
        slideVideoRef.current.pause();
      }
      setActiveSlideIndex(prev => prev - 1);
      setSlideshowIsPlaying(true);
    }
  };
  
  const toggleSlideshowPlay = () => {
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
    if (slideshowIsPlaying && slideVideoRef.current && activeSlide?.type === 'video') {
      slideVideoRef.current.play().catch(e => console.error("Play failed", e));
    }
  }, [activeSlideIndex, activeSlideshowIndex, activeSlide, slideshowIsPlaying]);

  useEffect(() => {
    const video = slideVideoRef.current;
    if (!video) return;

    const handleEnded = () => {
      setSlideshowIsPlaying(false);
    };

    video.addEventListener('ended', handleEnded);
    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [activeSlideshowIndex, activeSlideIndex, activeSlide]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
            if (slideVideoRef.current) slideVideoRef.current.pause();
            setActiveSlideIndex(prev => prev + 1);
            setSlideshowIsPlaying(true);
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
            if (slideVideoRef.current) slideVideoRef.current.pause();
            setActiveSlideIndex(prev => prev - 1);
            setSlideshowIsPlaying(true);
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
      }
    };

    // Track browser fullscreen state changes
    const handleFsChange = () => {};

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, [activeTab, activeSlideshow, activeSlideIndex, activeCourse, activeSlide, isPlaying, slideshowIsPlaying, activeChapterIndex, selectChapter]);

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

  // handleOpenExternalUrl and handleOpenPortal moved to browser.ts

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
      {/* Auto-Updater Banner */}
      <AnimatePresence>
        {updateAvailable && !isUpdateMinimized && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 right-4 z-[9999] bg-[#ff4b4b] text-white pl-12 pr-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(255,75,75,0.4)] flex items-center gap-6 border border-white/20"
          >
            {/* Close / Minimize Button */}
            <button
              onClick={() => setIsUpdateMinimized(true)}
              className="absolute top-3 left-3 text-white/70 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer flex items-center justify-center"
              title="Minimize Update Notification"
            >
              <X size={16} />
            </button>

            <div>
              <h3 className="font-bold text-lg leading-tight uppercase tracking-wide">Update Available!</h3>
              <p className="text-sm opacity-90">Version {updateAvailable.version} is ready to install.</p>
            </div>
            <button 
              onClick={async () => {
                setIsUpdating(true);
                try {
                  await updateAvailable.downloadAndInstall();
                  await relaunch();
                } catch (e) {
                  console.error("Failed to update", e);
                  setIsUpdating(false);
                }
              }}
              disabled={isUpdating}
              className="bg-white text-[#ff4b4b] px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm hover:scale-105 transition-transform flex items-center gap-2"
            >
              {isUpdating ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              {isUpdating ? 'Updating...' : 'Restart & Update'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <AnimatePresence>
        {showSidebar && (
          <Sidebar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            setActiveCourseIndex={setActiveCourseIndex}
            setActiveSlideshowIndex={setActiveSlideshowIndex}
            setSelectedManual={setSelectedManual}
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
            updateAvailable={updateAvailable}
            setUpdateAvailable={setUpdateAvailable}
            EHLogo={EHLogo}
          />
        )}
      </AnimatePresence>
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full">
        {/* Top Header */}
        <HeaderNav
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          setActiveCourseIndex={setActiveCourseIndex}
          setActiveSlideshowIndex={setActiveSlideshowIndex}
          setSelectedManual={setSelectedManual}
          setActiveTab={setActiveTab}
          lastCprView={lastCprView}
          showCprSelector={showCprSelector}
          setShowCprSelector={setShowCprSelector}
          isCprActive={isCprActive}
          cprVaEnabled={cprVaEnabled}
          setCprVaEnabled={setCprVaEnabled}
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
          updateAvailable={updateAvailable}
          isUpdateMinimized={isUpdateMinimized}
          setIsUpdateMinimized={setIsUpdateMinimized}
          handleItemClick={handleItemClick}
          MANUALS={MANUALS}
          EHLogo={EHLogo}
          CprIcon={CprIcon}
          FirstAidIcon={FirstAidIcon}
        />
        {/* Player Section */}
        <div className="flex-1 relative bg-black overflow-hidden h-full flex items-center justify-center">
          
          {/* Default Background Logo and Copyright */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-opacity duration-1000 pointer-events-none ${
            (((!activeCourse && activeTab === 'video') || (!selectedManual && activeTab === 'manual') || (!activeSlideshow && activeTab === 'slideshow')) && activeTab !== 'send-certs') ? 'opacity-100' : 'opacity-0'
          }`}>
             <img src={m("/eha-idle-screen.png")} alt="EH Academy" className="w-full max-w-3xl object-contain mb-auto mt-auto" />
             
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
                    console.log('[FS-DEBUG] Manual closed.');
                    setSelectedManual(null);
                    setActiveTab('video');
                  }}
                  onOutlineLoaded={(outline) => setManualOutline(outline)}
                  showEasterEgg={easterEggLevel > 0}
                />
              </ErrorBoundary>
            )}
          </div>

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
            />
            {downloadingChapterIndex !== null && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-5 p-8 rounded-2xl bg-[#222]/90 border border-white/10 shadow-2xl max-w-sm w-full">
                  <video src={m("/CPR-Dummies.mp4")} autoPlay loop muted playsInline className="w-32 h-32 rounded-xl object-cover shadow-lg" />
                  <div className="text-center w-full">
                    <h3 className="text-white text-xl font-bold mb-1">Downloading Chapter</h3>
                    <p className="text-white/60 text-sm mb-4 truncate" title={activeCourse?.chapters[downloadingChapterIndex]?.title}>
                      {activeCourse?.chapters[downloadingChapterIndex]?.title || 'Please wait...'}
                    </p>
                    
                    {dlState.currentFile === activeCourse?.chapters[downloadingChapterIndex]?.filename?.trim().replace(/^\//, '') && dlState.currentFileTotalBytes > 0 ? (
                      <div className="w-full">
                        <div className="flex justify-between text-xs text-white/50 mb-1.5 font-medium px-1">
                          <span>{(dlState.currentFileBytesWritten / 1024 / 1024).toFixed(1)} MB</span>
                          <span>{(dlState.currentFileTotalBytes / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                        <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden border border-white/5 shadow-inner relative">
                          <motion.div 
                            className="absolute top-0 left-0 h-full bg-gradient-to-r from-eh-red to-[#ff7b7b] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${(dlState.currentFileBytesWritten / dlState.currentFileTotalBytes) * 100}%` }}
                            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Loader2 size={24} className="text-eh-red animate-spin mb-2" />
                        <span className="text-white/50 text-xs uppercase tracking-widest font-bold">Waiting in queue...</span>
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => setDownloadingChapterIndex(null)}
                    className="mt-2 px-6 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-medium"
                  >
                    Cancel Playback
                  </button>
                </div>
              </div>
            )}
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
              m={m}
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
        {showDownloadPrompt && (
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
