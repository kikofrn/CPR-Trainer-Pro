import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
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
import { safeStorage } from './utils/safe-storage';
import { parseVTT, type SubtitleCue } from './utils/vtt-parser';
import { getRelevantKeys, checkUpdates, ChangedFile, ManifestFile } from './update-checker';
import { snapshotStore } from './snapshot-store';
import { THUMBNAIL_KEYS } from './thumbnails';
import { UpdatePrompt } from './components/UpdatePrompt';
const SendCertsPage = lazy(() => import('./components/SendCertsPage').then(m => ({ default: m.SendCertsPage })));
const HowToGuideModal = lazy(() => import('./components/HowToGuideModal').then(m => ({ default: m.HowToGuideModal })));
const MobileShell = lazy(() => import('./components/mobile/MobileShell'));
import { HeaderNav } from './components/HeaderNav';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { SlideshowPlayer } from './components/SlideshowPlayer';
import type { WebSlideshowControls } from './components/WebSlideshowMedia';
import { DownloadAppModal } from './components/DownloadAppModal';
import { findSelectionIndex, resolveCourseSelection, type CourseSelection } from './course-selection-model';
import {
  MobileHistoryCoordinator,
  type CoordinatorSnapshot,
  type EhContent,
  type NavigationEvent,
} from './mobile-history';
import { openExternalUrl } from './utils/browser';
import {
  MediaSelectionController,
  type MediaControllerState,
  type MediaSelection,
} from './media-selection-controller';

const EMPTY_WEB_MEDIA_STATE: MediaControllerState = {
  committedSelection: null,
  pendingSelection: null,
  failedRequest: null,
  playbackIntent: false,
  playbackState: 'idle',
  resumeRequired: false,
  generation: 0,
  activeSlot: 'A',
};

type ActivationOrigin = 'desktop' | 'mobile';

const EMPTY_MOBILE_HISTORY: CoordinatorSnapshot = {
  state: null,
  stack: [],
  phase: 'desktop-inactive',
  busy: false,
};

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
  const [isMobileWeb, setIsMobileWeb] = useState(() => !isTauri && window.matchMedia('(max-width: 1023px)').matches);
  const mobileNavigationRef = useRef<(event: NavigationEvent) => void>(() => undefined);
  const mobileCoordinatorRef = useRef<MobileHistoryCoordinator | null>(null);
  if (!isTauri && !mobileCoordinatorRef.current) {
    mobileCoordinatorRef.current = new MobileHistoryCoordinator(
      window.history,
      event => mobileNavigationRef.current(event),
    );
  }
  const [mobileHistory, setMobileHistory] = useState<CoordinatorSnapshot>(EMPTY_MOBILE_HISTORY);
  const [mobileOverlayExitBarrier, setMobileOverlayExitBarrier] = useState(false);

  useEffect(() => {
    if (isTauri) return;
    const query = window.matchMedia('(max-width: 1023px)');
    const onChange = (event: MediaQueryListEvent) => setIsMobileWeb(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (isTauri || !mobileCoordinatorRef.current) return;
    const coordinator = mobileCoordinatorRef.current;
    const generation = coordinator.setup();
    const unsubscribe = coordinator.subscribe(setMobileHistory);
    const onPopState = (event: PopStateEvent) => coordinator.handlePop(event.state);
    window.addEventListener('popstate', onPopState);
    coordinator.bootstrap(isMobileWeb);
    return () => {
      window.removeEventListener('popstate', onPopState);
      unsubscribe();
      coordinator.cleanup(generation);
    };
  }, []);
  
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

  const [contentUpdateFiles, setContentUpdateFiles] = useState<ChangedFile[]>([]);
  const [showContentUpdatePrompt, setShowContentUpdatePrompt] = useState(false);
  const [contentUpdateAvgSpeed, setContentUpdateAvgSpeed] = useState(0);
  const manifestStashRef = useRef<Record<string, { etag: string; uploaded: string; size: number }>>({});
  const pendingUpdatesRef = useRef<Record<string, { originalKey: string; etag: string; uploaded: string; size: number }>>({});

  useEffect(() => {
    if (!isTauri || !navigator.onLine) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    async function checkContentUpdates() {
      try {
        const res = await fetch('https://media.ehacademy.com/api/manifest', { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const data = await res.json();
        const manifestFiles: ManifestFile[] = data.files;

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
            return m ? { key: k, version: m.etag, isSilent: true } : null;
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
            downloadManager.queueSpecificFiles(silentFiles.map(f => ({ filename: f.key, version: f.version })));
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
  }, [isTauri]);



  useEffect(() => {
    async function checkForUpdates() {
      if (!isTauri) return;
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
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
    let resolved = false;
    waitForMediaResolver()
      .then(() => {
        resolved = true;
        setMediaReady(true);
      })
      .catch((err) => {
        console.error("Media resolver failed:", err);
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
      const delayToReady = Math.max(0, 3200 - elapsed);

      const outerTimer = setTimeout(() => {
        safeStorage.setItem('splash_status', 'ready');
        
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSidebar, setShowSidebar] = useState(isTauri);
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
  const [showDownloadApp, setShowDownloadApp] = useState(false);
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
  const [webMediaState, setWebMediaState] = useState<MediaControllerState>(EMPTY_WEB_MEDIA_STATE);
  const [webMediaRequest, setWebMediaRequest] = useState<{
    requestId: number;
    selection: MediaSelection;
    playbackIntent: boolean;
    replay: boolean;
  } | null>(null);
  const webMediaRequestIdRef = useRef(0);
  const webMediaControllerRef = useRef<MediaSelectionController | null>(null);
  
  // Real-time volume updates for active players
  useEffect(() => {
    const active = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
    if (active) active.volume = isMuted ? 0 : volume;
    if (slideVideoRef.current) slideVideoRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, activePlayer]);

  const [showSubtitles, setShowSubtitles] = useState(() => {
    const saved = safeStorage.getItem('eh_show_subtitles');
    return saved === null ? true : saved === 'true';
  });
  const [isUiVisible, setIsUiVisible] = useState(true);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [lastCprView, setLastCprView] = useState<'video' | 'slideshow' | null>(null);
  const [lastFaView, setLastFaView] = useState<'video' | 'slideshow' | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const slideVideoRef = useRef<HTMLVideoElement>(null);
  const webSlideshowControlsRef = useRef<WebSlideshowControls | null>(null);
  const slideshowContainerRef = useRef<HTMLDivElement>(null);
  const flipbookRef = useRef<ManualFlipbookRef>(null);
  const lastTouchActivityRef = useRef(0);

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
          const targetIndex = downloadingChapterIndex;
          setDownloadingChapterIndex(null);
          
          setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
          setActiveChapterIndex(targetIndex);
          if (activeCourseIndex !== null) saveProgress(activeCourseIndex, targetIndex);
          
          setShowNextOverlay(false);
          setIsPlaying(true);
          setActiveTab('video');
          if (isTauri && window.innerWidth < 1024) setShowSidebar(false);
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
  const selectManual = (manual: any, origin: ActivationOrigin = 'desktop') => {
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
    if (manual && origin === 'desktop') setShowSidebar(true);
  };

  // First-launch download prompt
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  useEffect(() => {
    if (isTauri && !safeStorage.getItem('eh_download_prompted')) {
      const timer = setTimeout(() => setShowDownloadPrompt(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);
  const activeCourse = activeCourseIndex !== null ? COURSES[activeCourseIndex] : null;
  const activeChapter = activeCourse ? activeCourse.chapters[activeChapterIndex] : null;
  const webDisplaySelection = !isTauri
    ? webMediaState.pendingSelection ?? webMediaState.failedRequest?.selection ?? webMediaRequest?.selection ?? null
    : null;
  const webDisplayCourse = webDisplaySelection ? COURSES[webDisplaySelection.courseIndex] : null;
  const webDisplayChapter = webDisplayCourse?.chapters[webDisplaySelection?.chapterIndex ?? -1] ?? null;
  const videoDisplayCourse = activeCourse ?? webDisplayCourse;
  const videoDisplayChapter = activeChapter ?? webDisplayChapter;
  const videoDisplayChapterIndex = activeCourse ? activeChapterIndex : (webDisplaySelection?.chapterIndex ?? 0);
  const webPendingSelection = webMediaState.pendingSelection ?? webMediaRequest?.selection ?? null;
  const webPendingChapter = webPendingSelection
    ? {
        courseId: webPendingSelection.courseId,
        chapterId: webPendingSelection.chapterId,
        title: COURSES[webPendingSelection.courseIndex]?.chapters[webPendingSelection.chapterIndex]?.title ?? 'Requested chapter',
      }
    : null;
  const webFailedChapter = webMediaState.failedRequest
    ? {
        courseId: webMediaState.failedRequest.selection.courseId,
        chapterId: webMediaState.failedRequest.selection.chapterId,
        title: COURSES[webMediaState.failedRequest.selection.courseIndex]?.chapters[webMediaState.failedRequest.selection.chapterIndex]?.title ?? 'Requested chapter',
        offline: webMediaState.failedRequest.failure.kind === 'offline',
      }
    : null;
  
  
  
  const activeSlideshow = activeSlideshowIndex !== null ? SLIDESHOWS[activeSlideshowIndex] : null;
  const showDownloadAffordance = !isTauri
    && videoDisplayCourse === null
    && activeSlideshow === null
    && selectedManual === null
    && activeTab !== 'send-certs'
    && !showHowTo;
  const activeSlide = activeSlideshow ? activeSlideshow.slides[activeSlideIndex] : null;

  const handleItemClick = (type: 'video' | 'slideshow', index: number, origin: ActivationOrigin = 'desktop') => {
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
      switchCourse(index, { origin });
      setActiveTab('video');
    } else {
      switchSlideshow(index, origin);
      setActiveTab('slideshow');
    }
    if (origin === 'desktop') {
      setShowSidebar(true);
      setShowCprSelector(false);
      setShowFaSelector(false);
      setShowManualSelector(false);
    }
  };

  const activeVideoId = videoDisplayCourse?.id ?? null;
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
    if (!isTauri || !activeChapter) return;

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

    if (!isTauri) return;

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
      safeStorage.setItem(`course_progress_${COURSES[courseIndex].id}`, chapterIndex.toString());
    }
  };

  const resetWebChapterPlayback = () => {
    if (isTauri) return;
    webMediaControllerRef.current?.dispose();
    webMediaControllerRef.current = null;
    setWebMediaState(EMPTY_WEB_MEDIA_STATE);
    setWebMediaRequest(null);
    setActivePlayer('A');
    setIsPlaying(false);
    videoRef.current = null;
  };

  const setActiveCourseWithCleanup = (index: number | null) => {
    if (index === null) resetWebChapterPlayback();
    setActiveCourseIndex(index);
  };

  const getWebChapterSelection = (courseIndex: number, chapterIndex: number): MediaSelection | null => {
    const course = COURSES[courseIndex];
    const chapter = course?.chapters[chapterIndex];
    if (!course || !chapter?.filename) return null;
    return {
      key: `${course.id}:${chapter.id}`,
      url: m(chapter.filename),
      courseId: course.id,
      chapterId: chapter.id,
      courseIndex,
      chapterIndex,
    };
  };

  useEffect(() => {
    if (isTauri || !videoDisplayCourse) return;
    const selector = 'link[rel="preconnect"][href="https://media.ehacademy.com"]';
    const existing = document.head.querySelector<HTMLLinkElement>(selector);
    const link = existing ?? document.createElement('link');
    link.rel = 'preconnect';
    link.href = 'https://media.ehacademy.com';
    if (existing) existing.remove();
    document.head.appendChild(link);
    return () => {
      if (!existing) link.remove();
    };
  }, [videoDisplayCourse?.id]);

  const requestWebChapter = (
    courseIndex: number,
    chapterIndex: number,
    options: { playbackIntent?: boolean; replay?: boolean } = {},
  ) => {
    const selection = getWebChapterSelection(courseIndex, chapterIndex);
    if (!selection) return;
    const requestId = ++webMediaRequestIdRef.current;
    setWebMediaRequest({
      requestId,
      selection,
      playbackIntent: options.playbackIntent ?? isPlaying,
      replay: options.replay ?? false,
    });
  };

  const prefetchWebChapter = (chapterIndex: number) => {
    if (isTauri || activeCourseIndex === null) return;
    const selection = getWebChapterSelection(activeCourseIndex, chapterIndex);
    if (selection) webMediaControllerRef.current?.prefetch(selection);
  };

  useEffect(() => {
    if (isTauri || !webMediaRequest || !videoRefA.current || !videoRefB.current) return;
    if (!webMediaControllerRef.current) {
      webMediaControllerRef.current = new MediaSelectionController({
        elements: { A: videoRefA.current, B: videoRefB.current },
        targetVolume: volume,
        muted: isMuted,
        playbackRate,
        isOnline: () => navigator.onLine,
        onStateChange: state => {
          setWebMediaState(state);
          setIsPlaying(state.playbackIntent && state.committedSelection !== null);
        },
        onCommit: (selection, slot) => {
          videoRef.current = slot === 'A' ? videoRefA.current : videoRefB.current;
          setActivePlayer(slot);
          setActiveCourseIndex(selection.courseIndex);
          setActiveChapterIndex(selection.chapterIndex);
          saveProgress(selection.courseIndex, selection.chapterIndex);
          setProgress(0);
          setActiveCue(null);
          setWebMediaRequest(null);
        },
      });
    }
    const result = webMediaControllerRef.current.request(webMediaRequest.selection, {
      playbackIntent: webMediaRequest.playbackIntent,
      replay: webMediaRequest.replay,
    });
    if (result !== 'started') setWebMediaRequest(null);
  }, [webMediaRequest]);

  useEffect(() => {
    if (isTauri) return;
    webMediaControllerRef.current?.updatePlaybackSettings({ volume, muted: isMuted, playbackRate });
  }, [volume, isMuted, playbackRate]);

  useEffect(() => {
    if (isTauri) return;
    webMediaControllerRef.current?.setOnline(isOnline);
  }, [isOnline]);

  useEffect(() => () => {
    webMediaControllerRef.current?.dispose();
    webMediaControllerRef.current = null;
  }, []);

  const selectChapter = (
    index: number,
    options: { playbackIntent?: boolean; replay?: boolean; origin?: ActivationOrigin; source?: 'ui' | 'history' } = {},
  ) => {
    if (activeCourseIndex === null || !COURSES[activeCourseIndex]) return;
    const chapter = COURSES[activeCourseIndex].chapters[index];
    if (!chapter) return;

    if (!isTauri) {
      requestWebChapter(activeCourseIndex, index, options);
      setShowNextOverlay(false);
      setActiveTab('video');
      setShowCprSelector(false);
      setShowFaSelector(false);
      if ((options.origin ?? 'desktop') === 'desktop' && isMobileWeb) setShowSidebar(false);
      if (isMobileWeb && options.source !== 'history') {
        mobileCoordinatorRef.current?.replaceContent({ kind: 'video', targetId: COURSES[activeCourseIndex].id, itemId: chapter.id });
      }
      return;
    }

    if (chapter.filename) {
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
    setIsPlaying(true);
    setActiveTab('video'); // Switch view tab to show the playing video
    if (isTauri && window.innerWidth < 1024) setShowSidebar(false);
  };

  const switchCourse = (
    index: number,
    options: { origin?: ActivationOrigin; chapterIndex?: number; playbackIntent?: boolean; source?: 'ui' | 'history' } = {},
  ) => {
    let savedChapter = options.chapterIndex ?? 0;
    if (COURSES[index]) {
      const saved = safeStorage.getItem(`course_progress_${COURSES[index].id}`);
      if (options.chapterIndex === undefined && saved) savedChapter = parseInt(saved, 10) || 0;
      if (!COURSES[index].chapters[savedChapter]) savedChapter = 0;
    }
    if (!isTauri) {
      setActiveSlideshowIndex(null);
      requestWebChapter(index, savedChapter, { playbackIntent: options.playbackIntent ?? isPlaying });
      setActiveTab('video');
      setShowCprSelector(false);
      setShowFaSelector(false);
      setShowNextOverlay(false);
      if ((options.origin ?? 'desktop') === 'desktop') setShowSidebar(true);
      return;
    }
    setActivePlayer('A');
    setActiveCourseIndex(index);
    setActiveChapterIndex(savedChapter);
    setIsPlaying(false);
    setShowCprSelector(false);
    setShowFaSelector(false);
    setShowNextOverlay(false);
    if ((options.origin ?? 'desktop') === 'desktop') setShowSidebar(true);
    // Auto-download course media
    if (isTauri && COURSES[index]) {
      const courseId = COURSES[index].id;
      const category = courseId === 'cpr-aed' ? 'cpr-aed' : 'first-aid';
      downloadManager.startBulkDownload(category as any);
    }
  };

  const handleEnded = () => {
    if (!isTauri) webMediaControllerRef.current?.pause();
    setIsPlaying(false);
    if (isContinuousPlay && activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      handleNext(true);
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
    if (!isTauri) {
      const controller = webMediaControllerRef.current;
      if (!controller) return;
      if (isPlaying) controller.pause();
      else void controller.resume().then(started => {
        if (started) setActiveTab('video');
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

  const handleNext = (playbackIntent = isPlaying) => {
    if (activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      selectChapter(activeChapterIndex + 1, { playbackIntent, origin: isMobileWeb ? 'mobile' : 'desktop' });
    }
  };

  const handlePrev = () => {
    if (activeChapterIndex > 0) {
      selectChapter(activeChapterIndex - 1, { origin: isMobileWeb ? 'mobile' : 'desktop' });
    }
  };

  const switchSlideshow = (index: number, origin: ActivationOrigin = 'desktop') => {
    resetWebChapterPlayback();
    setActiveCourseIndex(null);
    setIsPlaying(false);
    setActiveSlideshowIndex(index);
    setActiveSlideIndex(0);
    setSlideshowIsPlaying(isTauri);
    setShowCprSelector(false);
    setShowFaSelector(false);
    if (origin === 'desktop') setShowSidebar(true);
  };

  const selectSlide = (index: number, options: { source?: 'ui' | 'history' } = {}) => {
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

    // For IMAGE slides (or already-downloaded videos): navigate immediately
    // Images load from CDN online or from local cache if already downloaded
    // Use the sidebar download button to explicitly download individual slides
    if (isTauri && slideVideoRef.current) slideVideoRef.current.pause();
    setActiveSlideIndex(index);
    setSlideshowIsPlaying(isTauri);
    setActiveTab('slideshow');
    if (isMobileWeb && options.source !== 'history') {
      mobileCoordinatorRef.current?.replaceContent({ kind: 'slideshow', targetId: activeSlideshow.id, itemId: slide.id });
    }
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
    if (!isTauri) {
      webSlideshowControlsRef.current?.toggle();
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

  const currentMobileContent: EhContent | null = activeTab === 'video' && videoDisplayCourse && videoDisplayChapter
    ? { kind: 'video', targetId: videoDisplayCourse.id, itemId: videoDisplayChapter.id }
    : activeTab === 'slideshow' && activeSlideshow && activeSlide
      ? { kind: 'slideshow', targetId: activeSlideshow.id, itemId: activeSlide.id }
      : activeTab === 'manual' && selectedManual
        ? { kind: 'manual', targetId: selectedManual.id }
        : activeTab === 'send-certs'
          ? { kind: 'certs' }
          : null;

  const teardownMobileContent = () => {
    if (slideVideoRef.current) slideVideoRef.current.pause();
    resetWebChapterPlayback();
    setActiveCourseIndex(null);
    setActiveSlideshowIndex(null);
    setSelectedManual(null);
    setActiveTab('video');
    setShowNextOverlay(false);
  };

  const restoreMobileContent = (event: NavigationEvent) => {
    if (event.teardown && !event.state?.ehContent) {
      teardownMobileContent();
      return;
    }
    const chain = mobileCoordinatorRef.current?.snapshot().stack ?? [];
    const content = event.state?.ehContent
      ?? [...chain].reverse().find(state => state.ehKind === 'player')?.ehContent
      ?? null;
    if (!content) return;

    if (content.kind === 'video') {
      const courseIndex = COURSES.findIndex(course => course.id === content.targetId);
      const chapterIndex = courseIndex >= 0
        ? COURSES[courseIndex].chapters.findIndex(chapter => chapter.id === content.itemId)
        : -1;
      if (courseIndex < 0 || chapterIndex < 0) {
        mobileCoordinatorRef.current?.home();
        return;
      }
      if (activeTab === 'video' && videoDisplayCourse?.id === content.targetId && videoDisplayChapter?.id === content.itemId) return;
      switchCourse(courseIndex, { origin: 'mobile', chapterIndex, playbackIntent: false, source: 'history' });
      return;
    }
    if (content.kind === 'slideshow') {
      const slideshowIndex = SLIDESHOWS.findIndex(slideshow => slideshow.id === content.targetId);
      const slideIndex = slideshowIndex >= 0
        ? SLIDESHOWS[slideshowIndex].slides.findIndex(slide => slide.id === content.itemId)
        : -1;
      if (slideshowIndex < 0 || slideIndex < 0) {
        mobileCoordinatorRef.current?.home();
        return;
      }
      if (activeTab === 'slideshow' && activeSlideshow?.id === content.targetId && activeSlide?.id === content.itemId) return;
      switchSlideshow(slideshowIndex, 'mobile');
      setActiveSlideIndex(slideIndex);
      setSlideshowIsPlaying(false);
      setActiveTab('slideshow');
      return;
    }
    if (content.kind === 'manual') {
      const manual = MANUALS.find(item => item.id === content.targetId);
      if (!manual) {
        mobileCoordinatorRef.current?.home();
        return;
      }
      if (activeTab === 'manual' && selectedManual?.id === content.targetId) return;
      selectManual(manual, 'mobile');
      setActiveTab('manual');
      return;
    }
    if (activeTab !== 'send-certs') setActiveTab('send-certs');
  };
  mobileNavigationRef.current = restoreMobileContent;

  useEffect(() => {
    if (isTauri || !mobileCoordinatorRef.current) return;
    mobileCoordinatorRef.current.setDesiredMobile(isMobileWeb, currentMobileContent);
  }, [isMobileWeb]);

  const mobileTopKind = mobileHistory.state?.ehKind;
  const mobileSheetClassOpen = isMobileWeb && (mobileTopKind === 'nav' || mobileTopKind === 'download' || mobileTopKind === 'guide');
  const mobileOverlayBlocking = isMobileWeb && (mobileSheetClassOpen || mobileOverlayExitBarrier);
  const mobileTopKindRef = useRef(mobileTopKind);
  const mobileModalTriggerRef = useRef<HTMLElement | null>(null);
  mobileTopKindRef.current = mobileTopKind;
  useEffect(() => {
    if (mobileSheetClassOpen) setMobileOverlayExitBarrier(true);
    else if (!isMobileWeb) setMobileOverlayExitBarrier(false);
  }, [isMobileWeb, mobileSheetClassOpen]);
  const releaseMobileOverlayBarrier = useCallback(() => {
    const kind = mobileTopKindRef.current;
    if (kind !== 'nav' && kind !== 'download' && kind !== 'guide') setMobileOverlayExitBarrier(false);
    const trigger = mobileModalTriggerRef.current;
    if (!trigger) return;
    mobileModalTriggerRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const active = document.activeElement;
      const valid = active instanceof HTMLElement
        && active !== document.body
        && active.isConnected
        && !active.closest('[inert], [aria-hidden="true"]');
      if (!valid && trigger.isConnected && !trigger.closest('[inert], [aria-hidden="true"]')) trigger.focus();
    }));
  }, []);
  useEffect(() => {
    if (!isMobileWeb) {
      setShowDownloadApp(false);
      setShowHowTo(false);
      return;
    }
    setShowDownloadApp(mobileTopKind === 'download');
    setShowHowTo(mobileTopKind === 'guide');
  }, [isMobileWeb, mobileTopKind]);

  const openDownloadApp = useCallback(() => {
    if (isMobileWeb) {
      mobileModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      mobileCoordinatorRef.current?.openDownload();
    }
    else setShowDownloadApp(true);
  }, [isMobileWeb]);

  const openGuide = useCallback(() => {
    setActiveGuidePath('menu');
    setPortalStep(1);
    if (isMobileWeb) {
      mobileModalTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      mobileCoordinatorRef.current?.openGuide();
    }
    else setShowHowTo(true);
  }, [isMobileWeb]);

  const closeTopMobileLayer = useCallback(() => {
    mobileCoordinatorRef.current?.closeTop();
  }, []);

  const exitStandardFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) return false;
    try {
      await document.exitFullscreen();
      return true;
    } catch {
      return false;
    }
  }, []);

  const closeActiveContent = useCallback(() => {
    if (document.fullscreenElement) {
      void exitStandardFullscreen();
      return;
    }
    if (isMobileWeb) mobileCoordinatorRef.current?.closeTop(true);
    else teardownMobileContent();
  }, [exitStandardFullscreen, isMobileWeb]);

  useEffect(() => {
    if (isTauri && slideshowIsPlaying && slideVideoRef.current && activeSlide?.type === 'video') {
      slideVideoRef.current.play().catch(e => console.error("Play failed", e));
    }
  }, [activeSlideIndex, activeSlideshowIndex, activeSlide, slideshowIsPlaying]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept keyboard shortcuts when user is typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (mobileOverlayBlocking) {
        if (e.key === 'Escape' && !isNativeFullscreen) {
          e.preventDefault();
          mobileCoordinatorRef.current?.closeTop();
        }
        return;
      }

      // Spacebar to play/pause video
      if (e.key === ' ') {
        if (activeTab === 'video' && activeCourse && videoRef.current) {
          e.preventDefault();
          togglePlay();
        } else if (activeTab === 'slideshow' && activeSlideshow && slideVideoRef.current && activeSlide?.type === 'video') {
          e.preventDefault();
          toggleSlideshowPlay();
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
          void exitStandardFullscreen();
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
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) {
        setIsUiVisible(true);
      }
    };
    const handleLegacyFullscreenBegin = () => {
      setIsNativeFullscreen(true);
    };
    const handleLegacyFullscreenEnd = () => {
      setIsNativeFullscreen(false);
      setIsUiVisible(true);
    };
    const courseVideos = [videoRefA.current, videoRefB.current].filter((video): video is HTMLVideoElement => video !== null);

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    courseVideos.forEach(video => {
      video.addEventListener('webkitbeginfullscreen', handleLegacyFullscreenBegin);
      video.addEventListener('webkitendfullscreen', handleLegacyFullscreenEnd);
    });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      courseVideos.forEach(video => {
        video.removeEventListener('webkitbeginfullscreen', handleLegacyFullscreenBegin);
        video.removeEventListener('webkitendfullscreen', handleLegacyFullscreenEnd);
      });
    };
  }, [activeTab, activeSlideshow, activeSlideIndex, activeCourse, activeSlide, isPlaying, slideshowIsPlaying, activeChapterIndex, activePlayer, exitStandardFullscreen, isNativeFullscreen, mobileOverlayBlocking]);

  // UI Fade effect
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    const handleActivity = (event?: Event) => {
      if (event?.type === 'mousemove' && Date.now() - lastTouchActivityRef.current < 800) return;
      setIsUiVisible(true);
      clearTimeout(timer);
      if (isPlaying || slideshowIsPlaying) {
        timer = setTimeout(() => {
          setIsUiVisible(false);
        }, 3000);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!isMobileWeb || (event.pointerType !== 'touch' && event.pointerType !== 'pen')) return;
      if ((event.target as HTMLElement).closest('button, input, a, [role="button"]')) return;
      lastTouchActivityRef.current = Date.now();
      clearTimeout(timer);
      setIsUiVisible(visible => !visible);
    };

    if (mobileOverlayBlocking) {
      setIsUiVisible(true);
      return;
    }

    if ((activeTab === 'video' && (!isPlaying || webMediaState.pendingSelection || webMediaState.failedRequest || webMediaState.resumeRequired || showNextOverlay)) || (activeTab === 'slideshow' && !slideshowIsPlaying)) {
      setIsUiVisible(true);
      return;
    }

    handleActivity();
    
    const container1 = videoContainerRef.current;
    const container2 = slideshowContainerRef.current;
    
    if (container1) {
      container1.addEventListener('mousemove', handleActivity);
      container1.addEventListener('pointerup', handlePointerUp);
      if (!isMobileWeb) container1.addEventListener('click', handleActivity);
    }
    if (container2) {
      container2.addEventListener('mousemove', handleActivity);
      container2.addEventListener('pointerup', handlePointerUp);
      if (!isMobileWeb) container2.addEventListener('click', handleActivity);
    }
    window.addEventListener('mousemove', handleActivity);

    return () => {
      if (container1) {
        container1.removeEventListener('mousemove', handleActivity);
        container1.removeEventListener('pointerup', handlePointerUp);
        if (!isMobileWeb) container1.removeEventListener('click', handleActivity);
      }
      if (container2) {
        container2.removeEventListener('mousemove', handleActivity);
        container2.removeEventListener('pointerup', handlePointerUp);
        if (!isMobileWeb) container2.removeEventListener('click', handleActivity);
      }
      window.removeEventListener('mousemove', handleActivity);
      clearTimeout(timer);
    };
  }, [isPlaying, slideshowIsPlaying, activeTab, isMobileWeb, mobileOverlayBlocking, webMediaState.pendingSelection, webMediaState.failedRequest, webMediaState.resumeRequired, showNextOverlay]);

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
      if (isTauri) {
        if (videoRefA.current) videoRefA.current.pause();
        if (videoRefB.current) videoRefB.current.pause();
      } else {
        webMediaControllerRef.current?.pause();
      }
      setIsPlaying(false);
    }
    if (activeTab !== 'slideshow') {
      if (isTauri) {
        if (slideVideoRef.current) slideVideoRef.current.pause();
      } else if (slideshowIsPlaying) {
        webSlideshowControlsRef.current?.toggle();
      }
      setSlideshowIsPlaying(false);
    }
  }, [activeTab]);

  const cprSelection = resolveCourseSelection({
    family: 'cpr',
    pediatric: cprPediatric,
    virtualAssistant: cprVaEnabled,
    courses: COURSES,
    slideshows: SLIDESHOWS,
  });
  const faSelection = resolveCourseSelection({
    family: 'first-aid',
    pediatric: faPediatric,
    virtualAssistant: faVaEnabled,
    courses: COURSES,
    slideshows: SLIDESHOWS,
  });
  const activeMobileFamily = activeTab === 'manual' && selectedManual
    ? 'manuals'
    : activeTab === 'send-certs'
      ? 'certs'
      : isCprActive
        ? 'cpr'
        : isFaActive
          ? 'first-aid'
          : null;
  const mobileSectionTitle = activeTab === 'video'
    ? videoDisplayCourse?.title ?? 'CPR Trainer Pro'
    : activeTab === 'slideshow'
      ? activeSlideshow?.title ?? 'CPR Trainer Pro'
      : activeTab === 'manual'
        ? selectedManual?.title ?? 'Training Manuals'
        : 'Send Certs';
  const mobileHasContent = Boolean(currentMobileContent);
  const mobileImmersive = isNativeFullscreen
    || (!isUiVisible && ((activeTab === 'video' && isPlaying) || (activeTab === 'slideshow' && slideshowIsPlaying)));

  const startMobileCourse = (selection: CourseSelection) => {
    if (!selection.available) return;
    const index = findSelectionIndex(selection, COURSES, SLIDESHOWS);
    if (index === null) return;
    if (selection.kind === 'video') {
      const course = COURSES[index];
      const saved = Number.parseInt(safeStorage.getItem(`course_progress_${course.id}`) ?? '0', 10);
      const chapter = course.chapters[Number.isInteger(saved) && course.chapters[saved] ? saved : 0];
      if (chapter) mobileCoordinatorRef.current?.startContent({ kind: 'video', targetId: course.id, itemId: chapter.id });
    } else {
      const slideshow = SLIDESHOWS[index];
      const slide = slideshow?.slides[0];
      if (slide) mobileCoordinatorRef.current?.startContent({ kind: 'slideshow', targetId: slideshow.id, itemId: slide.id });
    }
  };

  const requestMobileHome = () => {
    if (document.fullscreenElement) void exitStandardFullscreen();
    else mobileCoordinatorRef.current?.home();
  };
  const mobileShellMounted = !isTauri && (isMobileWeb || mobileHistory.phase !== 'desktop-inactive');

  return (
    <div className={`flex bg-black text-eh-peach overflow-hidden medical-gradient relative ${isTauri ? 'h-screen' : 'web-app-shell'}`} data-mobile-web={isMobileWeb ? 'true' : undefined}>
      <AnimatePresence onExitComplete={releaseMobileOverlayBarrier}>
        {!isTauri && showDownloadApp && (
          <DownloadAppModal onClose={() => isMobileWeb ? closeTopMobileLayer() : setShowDownloadApp(false)} />
        )}
      </AnimatePresence>
      {showContentUpdatePrompt && (
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
              contentUpdateFiles.map(f => ({ filename: f.key, version: f.version }))
            );
          }}
          onDismiss={() => {
            setShowContentUpdatePrompt(false);
          }}
        />
      )}
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
                  if (isTauri) {
                    const { relaunch } = await import('@tauri-apps/plugin-process');
                    await relaunch();
                  }
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
        {!isMobileWeb && showSidebar && (
          <Sidebar
            showSidebar={showSidebar}
            setShowSidebar={setShowSidebar}
            setActiveCourseIndex={setActiveCourseWithCleanup}
            setActiveSlideshowIndex={setActiveSlideshowIndex}
            setSelectedManual={selectManual}
            setActiveTab={setActiveTab}
            activeTab={activeTab}
            activeCourse={activeCourse ?? webDisplayCourse}
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
            activeChapterIndex={activeCourse ? activeChapterIndex : -1}
            selectChapter={selectChapter}
            prefetchChapter={prefetchWebChapter}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            pendingChapter={webPendingChapter}
            failedChapter={webFailedChapter}
            retryFailedChapter={() => webMediaControllerRef.current?.retry()}
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
            onOpenDownloadApp={openDownloadApp}
            EHLogo={EHLogo}
          />
        )}
      </AnimatePresence>
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full" inert={mobileOverlayBlocking ? true : undefined} aria-hidden={mobileOverlayBlocking ? true : undefined}>
        {/* Top Header */}
        {!isMobileWeb && <HeaderNav
          dlState={dlState}
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          setActiveCourseIndex={setActiveCourseWithCleanup}
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
          updateAvailable={updateAvailable}
          isUpdateMinimized={isUpdateMinimized}
          setIsUpdateMinimized={setIsUpdateMinimized}
          showDownloadAffordance={showDownloadAffordance}
          onOpenDownloadApp={openDownloadApp}
          handleItemClick={handleItemClick}
          MANUALS={MANUALS}
          EHLogo={EHLogo}
          CprIcon={CprIcon}
          FirstAidIcon={FirstAidIcon}
        />}
        {/* Player Section */}
        <div className="flex-1 relative bg-black overflow-hidden h-full flex items-center justify-center">
          
          {/* Default Background Logo and Copyright */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center p-8 transition-opacity duration-1000 pointer-events-none ${
            (((!activeCourse && activeTab === 'video') || (!selectedManual && activeTab === 'manual') || (!activeSlideshow && activeTab === 'slideshow')) && activeTab !== 'send-certs') ? 'opacity-100' : 'opacity-0'
          }`}>
             <img
               src="/eha-idle-screen.png"
               alt="EH Academy"
               width={1024}
               height={691}
               fetchPriority="high"
               className="w-full max-w-3xl object-contain mb-auto mt-auto"
             />
             
             {/* Copyright Banner on Idle Screen */}
             <div className="mt-auto pt-8 w-full max-w-4xl text-center">
                <p className="text-[10px] md:text-xs leading-relaxed text-white/40 hover:text-white/60 transition-colors duration-500 select-none font-medium tracking-wide">
                  © 2025 Everyday Hero Academy Inc. All rights reserved. This software and all course materials are proprietary and protected by copyright law. Unauthorized reproduction, distribution, or use outside of EHA‑approved training is strictly prohibited.
                </p>
             </div>
          </div>


          {/* Send Certs Tab Container */}
          <div className={`w-full h-full relative z-10 bg-black ${isMobileWeb ? 'mobile-certs-host' : ''} ${activeTab === 'send-certs' ? '' : 'hidden'}`}>
            {activeTab === 'send-certs' && (
              <Suspense fallback={<div className="flex w-full h-full items-center justify-center text-white/50"><Loader2 className="animate-spin w-8 h-8" /></div>}>
                <SendCertsPage 
                isOnline={isOnline}
                setIsOnline={setIsOnline}
                onReturnToMenu={() => isMobileWeb ? closeActiveContent() : setActiveTab('video')}
                onOpenGuide={openGuide}
              />
              </Suspense>
            )}
          </div>
          {/* Manual Tab Container */}
          <div className={`w-full h-full relative z-10 ${isMobileWeb ? 'mobile-manual-host' : ''} ${activeTab === 'manual' && selectedManual ? 'block' : 'hidden'}`}>
            {selectedManual && (
              <ErrorBoundary
                onReset={() => {
                  if (isMobileWeb) closeActiveContent();
                  else {
                    setSelectedManual(null);
                    setActiveTab('video');
                  }
                }}
              >
                <ManualFlipbook 
                  key={selectedManual.id}
                  ref={flipbookRef}
                  pdfUrl={m(`/${selectedManual.filename}`)}
                  title={selectedManual.title}
                  onClose={() => {
                    if (isMobileWeb) closeActiveContent();
                    else {
                      setSelectedManual(null);
                      setActiveTab('video');
                    }
                  }}
                  onOutlineLoaded={(outline) => setManualOutline(outline.filter((item: any) => item.title !== 'Untitled'))}
                  showEasterEgg={easterEggLevel > 0}
                  isOnline={isOnline}
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
          <div className={`w-full h-full relative z-10 flex items-center justify-center ${activeTab === 'video' && videoDisplayCourse ? '' : 'hidden'}`}>
            <VideoPlayer
              activeCourse={videoDisplayCourse}
              activeChapter={videoDisplayChapter}
              activeChapterIndex={videoDisplayChapterIndex}
              onClose={closeActiveContent}
              isMobileWeb={isMobileWeb}
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
              mediaState={isTauri ? undefined : webMediaState}
              pendingChapterTitle={webPendingChapter?.title}
              failedChapterTitle={webFailedChapter?.title}
              retryFailedChapter={() => webMediaControllerRef.current?.retry()}
              resumeChapter={() => { void webMediaControllerRef.current?.resume(); }}
              replayChapter={() => {
                if (activeCourseIndex !== null) {
                  selectChapter(activeChapterIndex, { playbackIntent: true, replay: true });
                }
              }}
            />
          </div>
          {/* Slideshow Tab Container */}
          <div className={`w-full h-full relative z-10 ${isMobileWeb ? 'mobile-slideshow-host' : ''} ${activeTab === 'slideshow' && activeSlideshow ? '' : 'hidden'}`}>
            <SlideshowPlayer
              activeSlideshow={activeSlideshow}
              activeSlide={activeSlide}
              activeSlideIndex={activeSlideIndex}
              isMobileWeb={isMobileWeb}
              setActiveSlideshowIndex={(index) => {
                if (index === null && isMobileWeb) closeActiveContent();
                else setActiveSlideshowIndex(index);
              }}
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
              setSlideshowIsPlaying={setSlideshowIsPlaying}
              toggleSlideshowPlay={toggleSlideshowPlay}
              onSlideVideoEnded={() => setSlideshowIsPlaying(false)}
              isOnline={isOnline}
              webControlsRef={webSlideshowControlsRef}
              m={m}
              fileStatuses={dlState.fileStatuses}
            />
          </div>
        </div>
      </main>
      {mobileShellMounted && (
        <div hidden={!isMobileWeb} inert={!isMobileWeb ? true : undefined}>
        <Suspense fallback={<div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] h-16 border-t border-white/10 bg-black/95" aria-busy="true" data-testid="mobile-shell-loading" />}>
          <MobileShell
            history={mobileHistory}
            immersive={mobileImmersive}
            hasContent={mobileHasContent}
            sectionTitle={mobileSectionTitle}
            activeFamily={activeMobileFamily}
            showDownloadAffordance={showDownloadAffordance}
            cprSelection={cprSelection}
            faSelection={faSelection}
            cprPediatric={cprPediatric}
            cprVaEnabled={cprVaEnabled}
            faPediatric={faPediatric}
            faVaEnabled={faVaEnabled}
            setCprPediatric={setCprPediatric}
            setCprVaEnabled={setCprVaEnabled}
            setFaPediatric={setFaPediatric}
            setFaVaEnabled={setFaVaEnabled}
            courses={COURSES}
            slideshows={SLIDESHOWS}
            manuals={MANUALS}
            activeTab={activeTab}
            displayCourse={videoDisplayCourse}
            activeSlideshow={activeSlideshow}
            selectedManual={selectedManual}
            activeChapterIndex={videoDisplayChapterIndex}
            activeSlideIndex={activeSlideIndex}
            previewManualIndex={previewManualIndex}
            setPreviewManualIndex={setPreviewManualIndex}
            manualOutline={manualOutline}
            pendingChapter={webPendingChapter}
            failedChapter={webFailedChapter}
            onRetryChapter={() => webMediaControllerRef.current?.retry()}
            onPrefetchChapter={prefetchWebChapter}
            onOpenView={view => mobileCoordinatorRef.current?.openNavigation(view)}
            onStartCourse={startMobileCourse}
            onSelectItem={content => mobileCoordinatorRef.current?.startContent(content)}
            onOpenManual={manualId => {
              if (MANUALS.some(manual => manual.id === manualId)) {
                mobileCoordinatorRef.current?.startContent({ kind: 'manual', targetId: manualId });
              }
            }}
            onManualDestination={destination => flipbookRef.current?.resolveDestination(destination)}
            onOpenCerts={() => mobileCoordinatorRef.current?.startContent({ kind: 'certs' })}
            onOpenDownload={openDownloadApp}
            onOpenGuide={openGuide}
            onOpenOnboarding={family => void openExternalUrl(family === 'cpr'
              ? 'https://ehacademy.hflip.co/InstructorOnboardingCPRAED'
              : 'https://ehacademy.hflip.co/InstructorOnboardingFirstAid')}
            onHome={requestMobileHome}
            onCloseTop={closeTopMobileLayer}
            continuousPlay={isContinuousPlay}
            setContinuousPlay={setIsContinuousPlay}
            overlayExitBarrier={mobileOverlayExitBarrier}
            onNavigationExitComplete={releaseMobileOverlayBarrier}
          />
        </Suspense>
        </div>
      )}
      {/* How-To Guide Modal */}
      <Suspense fallback={null}>
      <HowToGuideModal
        showHowTo={showHowTo}
        setShowHowTo={show => {
          if (!show && isMobileWeb) closeTopMobileLayer();
          else setShowHowTo(show);
        }}
        activeGuidePath={activeGuidePath}
        setActiveGuidePath={setActiveGuidePath}
        portalStep={portalStep}
        setPortalStep={setPortalStep}
        isMobileWeb={isMobileWeb}
        onExitComplete={releaseMobileOverlayBarrier}
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
                    safeStorage.setItem('eh_download_prompted', 'true');
                    setShowDownloadPrompt(false);
                    downloadManager.startBulkDownload('everything');
                  }}
                  className="w-full py-3.5 bg-eh-blue hover:bg-eh-blue-light text-white font-bold rounded-xl text-sm shadow-xl transition-all active:scale-[0.98] cursor-pointer"
                >
                  Download Everything
                </button>
                <button
                  onClick={() => {
                    safeStorage.setItem('eh_download_prompted', 'true');
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
