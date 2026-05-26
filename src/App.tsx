import { useState, useRef, useEffect } from 'react';
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
  Settings
} from 'lucide-react';
import { COURSES, MANUALS, Manual, SLIDESHOWS } from './chapters';
import ManualFlipbook, { ManualFlipbookRef } from './components/ManualFlipbook';
import { mediaUrl as m, waitForMediaResolver, isTauri } from './media-resolver';
import { CprIcon, FirstAidIcon } from './components/Icons';
import { downloadManager, DownloadState, formatSpeed, formatTimeRemaining } from './download-manager';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

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

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

export default function App() {
  const [mediaReady, setMediaReady] = useState(false);
  const [showStartupBanner, setShowStartupBanner] = useState(true);
  
  // Updater State
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(false);



  // Manifest State
  const [manifestLoaded, setManifestLoaded] = useState(0);

  useEffect(() => {
    import('./chapters').then(({ fetchRemoteManifest, subscribeToManifest }) => {
      fetchRemoteManifest();
      const unsub = subscribeToManifest(() => {
        setManifestLoaded(prev => prev + 1);
      });
      return unsub;
    });
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

  // Hide startup banner after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowStartupBanner(false), 8000);
    return () => clearTimeout(timer);
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
      // We want the total minimum display time to be ~3.5s.
      // We wait `delayToReady` to hit ~3.2s, then show "READY" for 300ms.
      const delayToReady = Math.max(0, 3200 - elapsed);

      setTimeout(() => {
        // Signal splashscreen to jump to 100% READY
        localStorage.setItem('splash_status', 'ready');
        
        // Wait 300ms for the user to see "READY", then close it
        setTimeout(() => {
          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('close_splashscreen').catch(e => 
              console.error('[Tauri] Splashscreen transition failed:', e)
            );
          });
        }, 300);
      }, delayToReady);
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
  const [faDrilldown, setFaDrilldown] = useState(false);
  
  // Elite Toggles
  const [cprVaEnabled, setCprVaEnabled] = useState(false);
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
    setFaDrilldown(false);
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

  // Helper to parse WebVTT timestamp into seconds
  const parseTimestamp = (timeStr: string): number => {
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
  };

  // Helper to parse the VTT file content
  const parseVTT = (text: string): SubtitleCue[] => {
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
  };

  // Fetch and parse subtitles when the active chapter changes
  useEffect(() => {
    if (!activeChapter) {
      setSubtitleCues([]);
      setActiveCue(null);
      return;
    }

    const videoFilename = activeChapter.filename;
    const baseName = videoFilename.substring(0, videoFilename.lastIndexOf('.')) || videoFilename;
    const cleanBaseName = baseName.startsWith('/') ? baseName.slice(1) : baseName;
    const vttFilename = `${cleanBaseName}.vtt`;

    if (isTauri) {
      // Multi-tier robust subtitle loading:
      // Tier 1: Try native Rust command to read subtitles directly from disk (media/subtitles/)
      import('@tauri-apps/api/core')
        .then(({ invoke }) => invoke<string>('read_subtitle_file', { filename: vttFilename }))
        .then(text => {
          const parsed = parseVTT(text);
          setSubtitleCues(parsed);
          console.log(`[Subtitles] Loaded ${parsed.length} cues via native command for ${vttFilename}`);
        })
        .catch(err => {
          console.warn('[Subtitles] Native command failed, trying Tier 2 (embedded public relative fetch):', err);
          // Tier 2: Try relative fetch from standard public directory `/subtitles/` (built into WebView assets)
          fetch(`/subtitles/${vttFilename}`)
            .then(res => {
              if (!res.ok) throw new Error('Relative fetch failed');
              return res.text();
            })
            .then(text => {
              const parsed = parseVTT(text);
              setSubtitleCues(parsed);
              console.log(`[Subtitles] Loaded ${parsed.length} cues via relative fetch for ${vttFilename}`);
            })
            .catch(err2 => {
              console.warn('[Subtitles] Relative fetch failed, trying Tier 3 (custom scheme media protocol fetch):', err2);
              // Tier 3: Try custom media protocol fetch
              const subtitleUrl = m(`/subtitles/${vttFilename}`);
              fetch(subtitleUrl)
                .then(response => {
                  if (!response.ok) throw new Error('Custom scheme fetch failed');
                  return response.text();
                })
                .then(text => {
                  const parsed = parseVTT(text);
                  setSubtitleCues(parsed);
                  console.log(`[Subtitles] Loaded ${parsed.length} cues via custom scheme for ${vttFilename}`);
                })
                .catch(err3 => {
                  console.error('[Subtitles] All subtitle loading attempts failed:', err3);
                  setSubtitleCues([]);
                });
            });
        });
    } else {
      // In standard Web browser mode: Use standard relative fetch from public directory
      const subtitleUrl = `/subtitles/${vttFilename}`;
      fetch(subtitleUrl)
        .then(response => {
          if (!response.ok) throw new Error('No subtitles found');
          return response.text();
        })
        .then(text => {
          const parsed = parseVTT(text);
          setSubtitleCues(parsed);
        })
        .catch(() => {
          setSubtitleCues([]);
        });
    }

    setActiveCue(null);
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

  const saveProgress = (courseIndex: number, chapterIndex: number) => {
    if (courseIndex !== null && COURSES[courseIndex]) {
      localStorage.setItem(`course_progress_${COURSES[courseIndex].id}`, chapterIndex.toString());
    }
  };

  const selectChapter = (index: number) => {
    if (index !== activeChapterIndex) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      setActiveChapterIndex(index);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, index);
    }
    setShowNextOverlay(false);
    setIsPlaying(true);
    setActiveTab('video'); // Switch view tab to show the playing video
    if (window.innerWidth < 1024) setShowSidebar(false);
  };

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

  const handleNext = () => {
    if (activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      const nextIndex = activeChapterIndex + 1;
      setActiveChapterIndex(nextIndex);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, nextIndex);
      setShowNextOverlay(false);
      setIsPlaying(true);
    }
  };

  const handlePrev = () => {
    if (activeChapterIndex > 0) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      const prevIndex = activeChapterIndex - 1;
      setActiveChapterIndex(prevIndex);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, prevIndex);
      setShowNextOverlay(false);
      setIsPlaying(true);
    }
  };

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
            setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
            setActiveChapterIndex(prev => prev + 1);
            setShowNextOverlay(false);
            setIsPlaying(true);
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
            setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
            setActiveChapterIndex(prev => prev - 1);
            setShowNextOverlay(false);
            setIsPlaying(true);
          }
        } else if (activeTab === 'manual') {
          if (flipbookRef.current) flipbookRef.current.flipPrev();
        }
      } else if (e.key === 'Escape') {
        console.log('[FS-DEBUG] Escape pressed. fullscreenElement:', document.fullscreenElement?.tagName || 'none');
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(console.error);
        }
      }
    };

    // Track browser fullscreen state changes
    const handleFsChange = () => {
      console.log('[FS-DEBUG] fullscreenchange fired. fullscreenElement:', document.fullscreenElement?.tagName || 'EXITED', 'className:', document.fullscreenElement?.className?.substring(0, 80) || 'n/a');
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFsChange);
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

  const handleOpenExternalUrl = async (url: string) => {
    if (isTauri) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_browser', { url });
      } catch (e) {
        console.error("Failed to open browser via Tauri", e);
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const handleOpenPortal = async () => {
    await handleOpenExternalUrl("https://ehacademy.com/login");
  };

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
        {updateAvailable && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="absolute top-4 right-4 z-[9999] bg-[#ff4b4b] text-white px-6 py-4 rounded-2xl shadow-[0_10px_40px_rgba(255,75,75,0.4)] flex items-center gap-6 border border-white/20"
          >
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
          <motion.aside
            key="sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "tween", ease: "easeInOut", duration: 0.4 }}
            className="h-full bg-black border-r border-eh-peach/10 flex flex-col z-50 shrink-0 overflow-hidden relative"
          >
            <div className="w-80 h-full flex flex-col shrink-0">
              <div className="p-8 border-b border-eh-peach/10">
                <div className="flex items-center justify-between gap-2 w-full">
                  <div 
                    className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                      setActiveCourseIndex(null);
                      setActiveSlideshowIndex(null);
                      setSelectedManual(null);
                      setActiveTab('video');
                    }}
                    title="Return to Main Menu"
                  >
                    <EHLogo className="h-16 w-16" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-bold tracking-[0.3em] text-eh-red leading-none mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>EVERYDAY</span>
                      <div className="flex flex-col">
                        <span className="text-3xl font-black leading-none tracking-tighter text-eh-peach" style={{ fontFamily: "'Inter', sans-serif" }}>HERO</span>
                        <span className="text-xs font-bold tracking-[0.25em] text-eh-blue leading-none mt-1 opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>ACADEMY</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSidebar(false)}
                    className="p-1.5 rounded-lg border border-eh-peach/10 bg-transparent text-eh-peach/40 hover:text-eh-red hover:border-eh-red/30 transition-all duration-200 cursor-pointer hover:bg-eh-red/5 flex items-center justify-center self-center shrink-0"
                    title="Collapse Sidebar Menu"
                  >
                    <ChevronLeft size={18} />
                  </button>
                </div>
              </div>

              {/* Course Title Indicator */}
              {((activeTab === 'video' && activeCourse) || (activeTab === 'slideshow' && activeSlideshow) || (activeTab === 'manual')) && (
                <div className="px-6 py-3.5 border-b border-eh-peach/10 bg-eh-red/5">
                  {activeTab === 'manual' ? (
                    selectedManual ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1">Active Manual</p>
                          <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug truncate" title={selectedManual.title}>
                            {selectedManual.title}
                          </h2>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedManual(null);
                            setManualOutline([]);
                          }}
                          className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-eh-blue hover:text-eh-blue-light hover:bg-eh-blue/10 rounded border border-eh-blue/20 transition-all shrink-0 cursor-pointer"
                          title="Back to Manuals List"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1">Navigation</p>
                        <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug">
                          Choose Training Manual
                        </h2>
                      </div>
                    )
                  ) : (
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1.5">Active Course</p>
                      <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug">
                        {activeTab === 'video' ? activeCourse?.title : activeSlideshow?.title}
                      </h2>
                    </div>
                  )}
                </div>
              )}

            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {activeTab === 'manual' ? (
                selectedManual ? (
                  // Render Manual TOC
                  manualOutline.length > 0 ? (
                    <div className="space-y-1 px-1">
                      <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-4 px-2">Table of Contents</p>
                      {manualOutline.map((item, idx) => {
                        const hasSubItems = item.items && item.items.length > 0;
                        const isExpanded = expandedManualSections[idx];
                        return (
                        <div key={idx} className="group">
                          <div className="w-full text-left p-3 hover:bg-eh-peach/5 rounded-lg transition-colors flex items-center gap-4">
                            <button
                              onClick={() => flipbookRef.current?.resolveDestination(item.dest)}
                              className="flex-1 min-w-0 text-left"
                            >
                              <h3 className="text-base font-bold truncate text-eh-peach/60 group-hover:text-eh-peach/80">
                                {item.title}
                              </h3>
                            </button>
                            
                            {hasSubItems ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedManualSections(prev => ({
                                    ...prev,
                                    [idx]: !prev[idx]
                                  }));
                                }}
                                className="p-1 hover:bg-eh-peach/10 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown size={14} className="text-eh-peach/60" />
                                ) : (
                                  <ChevronRight size={14} className="text-eh-peach/60" />
                                )}
                              </button>
                            ) : (
                              <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity text-eh-peach" />
                            )}
                          </div>
                          {hasSubItems && isExpanded && (
                            <div className="pl-4 mt-1 space-y-1">
                              {item.items.map((subItem: any, subIdx: number) => (
                                <div key={subIdx} className="w-full text-left p-3 rounded-lg hover:bg-eh-peach/5 transition-colors flex items-center gap-4 group/sub">
                                  <button
                                    onClick={() => flipbookRef.current?.resolveDestination(subItem.dest)}
                                    className="flex-1 min-w-0 text-left"
                                  >
                                    <h3 className="text-base font-bold truncate text-eh-peach/60 group-hover/sub:text-eh-peach/80">
                                      {subItem.title}
                                    </h3>
                                  </button>
                                  <ChevronRight size={14} className="opacity-0 group-hover/sub:opacity-40 transition-opacity text-eh-peach" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )})}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-center p-6 opacity-20">
                      <p className="text-xs font-mono uppercase tracking-widest text-eh-peach">Loading Bookmarks...</p>
                    </div>
                  )
                ) : (
                  // Render Manual selection list
                  <div className="space-y-3 px-1">
                    <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-3 px-2">Available Handbooks</p>
                    <div className="space-y-2.5">
                      {MANUALS.map((manual) => {
                        const details = {
                          instructor: {
                            description: "Comprehensive guide for instructors covering core curriculums, lesson plans, and testing guidelines.",
                            pages: "113 Pages",
                            thumb: "/manual-instructor-thumb.png"
                          },
                          student: {
                            description: "Complete training handbook for students covering CPR, AED usage, and basic first aid for all ages.",
                            pages: "156 Pages",
                            thumb: "/manual-student-thumb.png"
                          },
                          pediatric: {
                            description: "Specialized student guide focused on infant, child, and pediatric emergency response.",
                            pages: "170 Pages",
                            thumb: "/manual-pediatric-thumb.png"
                          }
                        }[manual.id as 'instructor' | 'student' | 'pediatric'];

                        return (
                          <button
                            key={manual.id}
                            onClick={() => {
                              setSelectedManual(manual);
                              setShowSidebar(true);
                            }}
                            className="w-full text-left p-3 rounded-xl border border-transparent hover:border-eh-peach/10 bg-white/[0.02] hover:bg-eh-peach/[0.04] transition-all duration-300 flex items-start gap-3 group relative cursor-pointer"
                          >
                            <div className="w-14 h-18 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-lg relative group-hover:scale-[1.03] transition-transform duration-300">
                              <img 
                                src={details.thumb} 
                                alt={manual.title} 
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            </div>
                            <div className="flex-1 min-w-0 pr-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-bold text-eh-peach group-hover:text-eh-red transition-colors duration-300 leading-snug line-clamp-1">
                                  {manual.title.replace("EHA ", "")}
                                </h4>
                                <span className="text-xs text-eh-blue/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
                                  {details.pages}
                                </span>
                              </div>
                              <p className="text-eh-peach/40 text-[9px] uppercase font-bold tracking-wider mt-0.5">
                                {manual.id} manual
                              </p>
                              <p className="text-eh-peach/50 text-[11px] leading-snug mt-1.5 line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                                {details.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : activeTab === 'slideshow' && activeSlideshow ? (
                // Render Slideshow TOC
                activeSlideshow.slides.map((slide, index) => {
                  const isActiveSlide = activeSlideIndex === index;
                  const isExpanded = expandedSections[slide.id];

                  if (slide.parentSectionId && !expandedSections[slide.parentSectionId]) {
                    return null; // Hide children if parent is not expanded
                  }

                  return (
                    <div key={slide.id} className={`${slide.parentSectionId ? 'pl-4 pr-0' : ''}`}>
                      <div
                        className={`w-full text-left p-3 rounded-lg group transition-all duration-300 flex items-center gap-4 ${
                          isActiveSlide
                            ? 'bg-eh-red/10 border border-eh-red/30 shadow-inner' 
                            : 'hover:bg-eh-peach/5 border border-transparent'
                        }`}
                      >
                        <button
                          onClick={() => {
                            setActiveSlideIndex(index);
                            setSlideshowIsPlaying(true);
                            setActiveTab('slideshow');
                          }}
                          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono transition-colors ${
                            isActiveSlide 
                              ? 'bg-eh-red border-eh-red text-eh-peach' 
                              : 'border-eh-blue text-eh-blue group-hover:border-eh-blue-light group-hover:text-eh-blue-light'
                          }`}
                        >
                          {index + 1}
                        </button>
                        
                        <button 
                          onClick={() => {
                            setActiveSlideIndex(index);
                            if (slide.type === 'video') setSlideshowIsPlaying(true);
                            setActiveTab('slideshow');
                          }}
                          className="flex-1 min-w-0 text-left"
                        >
                          <h3 className={`text-base font-bold truncate ${isActiveSlide ? 'text-eh-peach' : 'text-eh-peach/60 group-hover:text-eh-peach/80'}`}>
                            {slide.title}
                          </h3>
                        </button>
                        
                        {slide.isSectionHeader ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSections(prev => ({
                                ...prev,
                                [slide.id]: !prev[slide.id]
                              }));
                            }}
                            className="p-1 hover:bg-eh-peach/10 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-eh-peach/60" />
                            ) : (
                              <ChevronRight size={14} className="text-eh-peach/60" />
                            )}
                          </button>
                        ) : isActiveSlide && slide.type === 'video' ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSlideshowPlay();
                            }}
                            className="p-1.5 bg-eh-red/10 hover:bg-eh-red/20 rounded-full transition-colors self-center flex items-center justify-center"
                          >
                            {slideshowIsPlaying ? (
                              <Pause size={14} className="text-eh-red" fill="currentColor" />
                            ) : (
                              <Play size={14} className="text-eh-red ml-0.5" fill="currentColor" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                // Render Video Chapters
                activeCourse ? (
                  activeCourse.chapters.map((chapter, index) => {
                    const isActiveChapter = activeChapterIndex === index;
                    const isExpanded = expandedSections[chapter.id];

                    if (chapter.parentSectionId && !expandedSections[chapter.parentSectionId]) {
                      return null; // Hide children if parent is not expanded
                    }

                    return (
                      <div key={chapter.id} className={`${chapter.parentSectionId ? 'pl-4 pr-0' : ''}`}>
                        <div
                          className={`w-full text-left p-3 rounded-lg group transition-all duration-300 flex items-center gap-4 ${
                            isActiveChapter
                              ? 'bg-eh-red/10 border border-eh-red/30 shadow-inner' 
                              : 'hover:bg-eh-peach/5 border border-transparent'
                          }`}
                        >
                          <button
                            onClick={() => selectChapter(index)}
                            className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono transition-colors ${
                              isActiveChapter 
                                ? 'bg-eh-red border-eh-red text-eh-peach' 
                                : 'border-eh-blue text-eh-blue group-hover:border-eh-blue-light group-hover:text-eh-blue-light'
                            }`}
                          >
                            {index + 1}
                          </button>
                          
                          <button 
                            onClick={() => selectChapter(index)}
                            className="flex-1 min-w-0 text-left flex items-center justify-between"
                          >
                            <h3 className={`text-base font-bold truncate ${isActiveChapter ? 'text-eh-peach' : 'text-eh-peach/60 group-hover:text-eh-peach/80'}`}>
                              {chapter.title}
                            </h3>
                            <span className="text-xs text-eh-blue/60 font-mono ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
                              {chapter.duration}
                            </span>
                          </button>
                          
                          {/* If this is a header, show expand/collapse chevron instead of playing indicator, unless it IS playing */}
                          {chapter.isSectionHeader ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedSections(prev => ({
                                  ...prev,
                                  [chapter.id]: !prev[chapter.id]
                                }));
                              }}
                              className="p-1 hover:bg-eh-peach/10 rounded transition-colors"
                              title={isExpanded ? "Collapse Section" : "Expand Section"}
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-eh-peach/60" />
                              ) : (
                                <ChevronRight size={14} className="text-eh-peach/60" />
                              )}
                            </button>
                          ) : isActiveChapter ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePlay();
                              }}
                              className="p-1.5 bg-eh-red/10 hover:bg-eh-red/20 rounded-full transition-colors self-center flex items-center justify-center"
                              title={isPlaying ? "Pause Chapter" : "Play Chapter"}
                            >
                              {isPlaying ? (
                                <Pause size={14} className="text-eh-red" fill="currentColor" />
                              ) : (
                                <Play size={14} className="text-eh-red ml-0.5" fill="currentColor" />
                              )}
                            </button>
                          ) : (
                            /* Download status / button for non-active, non-header chapters */
                            isTauri ? (
                              dlState.fileStatuses[chapter.filename?.trim().replace(/^\//, '') || ''] ? (
                                <CheckCircle2 size={16} className="text-green-500 shrink-0" title="Downloaded" />
                              ) : dlState.isDownloading && dlState.currentFile === chapter.filename?.trim().replace(/^\//, '') ? (
                                easterEggLevel > 0 ? (
                                  <video src="/CPR-Dummies.mp4" autoPlay loop muted playsInline className="w-6 h-6 shrink-0 rounded-md object-cover" title="Downloading..." />
                                ) : (
                                  <Loader2 size={16} className="text-eh-blue animate-spin shrink-0" title="Downloading..." />
                                )
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (chapter.filename) {
                                      downloadManager.startSingleDownload(chapter.filename);
                                    }
                                  }}
                                  className="p-1 hover:bg-eh-blue/10 rounded-full transition-colors cursor-pointer"
                                  title="Download this chapter"
                                >
                                  <Download size={14} className="text-eh-blue/50 hover:text-eh-blue" />
                                </button>
                              )
                            ) : null
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="w-full text-center py-10 opacity-30 flex flex-col items-center">
                    <MonitorPlay size={48} className="mb-4" />
                    <p className="text-eh-peach/60 text-xs font-bold uppercase tracking-widest">No Course Selected</p>
                  </div>
                )
              )}
            </div>

            {/* Settings Collapsible Section */}
            <div className="bg-black border-t border-eh-peach/10 pt-4 pb-2">
              <button
                onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
                className="w-[calc(100%-32px)] mx-4 flex items-center justify-between px-5 py-3 border border-white/20 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Settings size={20} className="text-white group-hover:rotate-90 transition-transform duration-500" />
                  <span className="text-sm font-bold uppercase tracking-widest text-white">Settings</span>
                </div>
                <ChevronDown size={20} className={`text-white transition-transform duration-300 ${isSettingsExpanded ? 'rotate-180' : ''}`} />
              </button>
              
              <AnimatePresence>
                {isSettingsExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 py-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${isContinuousPlay ? 'bg-white' : 'bg-white/30'}`} />
                          <span className="text-sm font-bold uppercase tracking-widest text-white">Continuous Play</span>
                        </div>
                        <button 
                          onClick={() => setIsContinuousPlay(!isContinuousPlay)}
                          className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isContinuousPlay ? 'bg-white/30' : 'bg-white/10'}`}
                        >
                          <motion.div 
                            animate={{ x: isContinuousPlay ? 26 : 2 }}
                            className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-white select-none">
                          <button 
                            type="button" 
                            onClick={handleInfoClick} 
                            onPointerDown={handleInfoPointerDown}
                            onPointerUp={handleInfoPointerUp}
                            onPointerLeave={handleInfoPointerUp}
                            className="cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                          >
                            <Info size={18} />
                          </button>
                          <span className="text-sm font-bold">Offline Training Mode</span>
                        </div>
                        <button
                          onClick={() => {
                            if (showHowTo) {
                              setShowHowTo(false);
                            } else {
                              setActiveGuidePath('menu');
                              setPortalStep(1);
                              setShowHowTo(true);
                            }
                          }}
                          className="flex items-center gap-2 text-[#4ae5bd] font-bold uppercase tracking-widest hover:text-white transition-colors"
                        >
                          <HelpCircle size={18} />
                          Guide
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2">
                        {dlState.globalTotalCount === dlState.globalDownloadedCount ? (
                          <>
                            <CheckCircle2 size={18} className="text-green-500" />
                            <span className="text-sm font-bold text-green-500">All Offline Media Downloaded</span>
                          </>
                        ) : (
                          <button
                            onClick={() => downloadManager.startBulkDownload('everything')}
                            className="flex items-center gap-2 text-[#ff4b4b] hover:text-[#ff3333] transition-colors"
                          >
                            <Download size={18} />
                            <span className="text-sm font-bold">Download All Offline Media ({dlState.globalTotalCount - dlState.globalDownloadedCount} left)</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full">
        {/* Top Header */}
        <header className={`h-20 pr-4 xl:pr-8 border-b border-eh-peach/10 flex items-center justify-between bg-black z-[60] shrink-0 transition-[padding-left] duration-[400ms] ease-in-out relative ${
          showSidebar ? "pl-8" : "pl-4"
        }`}>
          <div className="flex items-center gap-6 h-full">
            <motion.div
              animate={{ 
                width: showSidebar ? 0 : 215, 
                opacity: showSidebar ? 0 : 1,
                x: showSidebar ? -10 : 0
              }}
              transition={{ type: "tween", ease: "easeInOut", duration: 0.4 }}
              className="flex items-center gap-3 overflow-hidden shrink-0"
            >
              <button 
                onClick={() => setShowSidebar(true)}
                className="p-1.5 rounded-lg border border-eh-peach/10 bg-black/40 text-eh-peach/60 hover:text-eh-red hover:border-eh-red/30 hover:bg-eh-red/5 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                title="Expand Sidebar Menu"
              >
                <Menu size={18} />
              </button>
              
              <div 
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => {
                  setActiveCourseIndex(null);
                  setActiveSlideshowIndex(null);
                  setSelectedManual(null);
                  setActiveTab('video');
                }}
                title="Return to Main Menu"
              >
                <EHLogo className="h-11 w-11 shrink-0 ml-1" />
                <div className="flex flex-col shrink-0 select-none">
                  <span className="text-[9.5px] font-bold tracking-[0.3em] text-eh-red leading-none mb-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>EVERYDAY</span>
                  <div className="flex flex-col">
                    <span className="text-xl font-black leading-none tracking-tighter text-eh-peach" style={{ fontFamily: "'Inter', sans-serif" }}>HERO</span>
                    <span className="text-[8px] font-bold tracking-[0.25em] text-eh-blue leading-none mt-0.5 opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>ACADEMY</span>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <div className="flex items-end h-full gap-2 lg:gap-8 z-50 pt-4">
              <div className="relative h-full flex items-end">
                <button 
                  onClick={() => {
                    if (lastCprView && (activeTab === 'manual' || activeTab === 'send-certs')) {
                      // Return to the last loaded CPR course view
                      setActiveTab(lastCprView);
                      setShowSidebar(true);
                      setShowCprSelector(false);
                    } else {
                      setShowCprSelector(!showCprSelector);
                    }
                    setShowFaSelector(false);
                    setShowManualSelector(false);
                  }}
                  className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${isCprActive ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
                  title="Select CPR & AED Course Edition"
                >
                  <div className="flex items-center gap-2">
                    <CprIcon className={`w-7 h-7 ${isCprActive ? 'text-eh-red' : 'text-eh-peach'}`} />
                    <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">
                      CPR & AED
                    </h2>
                    <ChevronDown size={16} className={`text-eh-red transition-transform ${showCprSelector ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {showCprSelector && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 z-50 origin-top-left"
                      style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                    >
                      <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                        <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">CPR & AED FOR ALL AGES</h3>
                        <div className="flex gap-6">
                          {/* Left: Description */}
                          <div className="flex-1 flex flex-col justify-between">
                            <AnimatePresence mode="popLayout">
                              <motion.ul 
                                key={cprVaEnabled ? 'cpr-va-list' : 'cpr-std-list'}
                                initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="space-y-4 text-sm text-white font-bold w-full"
                              >
                                {cprVaEnabled ? (
                                  <>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Narrated Course</strong> — Virtual Assistant guides each section</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Hands-free automation for classroom delivery</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full AHA & OSHA compliant certification</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Adults, children & infants</span></li>
                                  </>
                                ) : (
                                  <>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full CPR & AED Certification Course</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Teach at your own pace</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Covers Adult, Child & Infant CPR</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Interactive slides with practice cues</span></li>
                                  </>
                                )}
                              </motion.ul>
                            </AnimatePresence>
                          </div>
                          {/* Right: Cover Image + Toggle */}
                          <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 relative bg-black/40">
                              <AnimatePresence mode="popLayout">
                                <motion.img 
                                  key={cprVaEnabled ? 'cpr-va' : 'cpr-std'}
                                  src={cprVaEnabled ? "/CPR AED for All Ages with VA.png" : "/CPR AED for All Ages Cover.png"} 
                                  alt="CPR AED Course Cover" 
                                  className="w-full h-full object-cover absolute inset-0"
                                  initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                  exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </AnimatePresence>
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[13px] text-white/90 font-bold tracking-wide">Enable Virtual Assistant?</span>
                              <button onClick={() => setCprVaEnabled(!cprVaEnabled)} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer ${cprVaEnabled ? 'bg-[#ff4b4b]' : 'bg-[#333]'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${cprVaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                            <div className="group relative w-full text-center">
                              <button className="text-xs font-bold tracking-wider text-white/70 hover:text-white transition-colors flex items-center gap-1 mx-auto cursor-pointer"><HelpCircle size={12} /><span>What is this?</span></button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">When enabled, a virtual assistant narrates each section of the course automatically, allowing hands-free teaching.</div>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => { if (cprVaEnabled) { handleItemClick('video', 0); } else { handleItemClick('slideshow', 0); } }} className="w-full mt-5 py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all duration-300 cursor-pointer active:scale-[0.98] shadow-[0_0_20px_rgba(255,75,75,0.3)]">
                          START COURSE
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative h-full flex items-end">
                <button 
                  onClick={() => {
                    if (lastFaView && (activeTab === 'manual' || activeTab === 'send-certs')) {
                      // Return to the last loaded FA course view
                      setActiveTab(lastFaView);
                      setShowSidebar(true);
                      setShowFaSelector(false);
                    } else {
                      setShowFaSelector(!showFaSelector);
                    }
                    setShowCprSelector(false);
                    setShowManualSelector(false);
                  }}
                  className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${isFaActive ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
                  title="Select First Aid Course Edition"
                >
                  <div className="flex items-center gap-2">
                    <FirstAidIcon className={`w-7 h-7 ${isFaActive ? 'text-eh-red' : 'text-eh-peach'}`} />
                    <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">
                      FIRST AID
                    </h2>
                    <ChevronDown size={16} className={`text-eh-red transition-transform ${showFaSelector ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {showFaSelector && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 mt-2 z-50 origin-top-left"
                      style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                    >
                      <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                        <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">{faPediatric ? 'PEDIATRIC FIRST AID' : 'FIRST AID FOR ALL AGES'}</h3>
                        <div className="flex gap-6">
                          <div className="flex-1 flex flex-col justify-between">
                            <AnimatePresence mode="popLayout">
                              <motion.ul 
                                key={faPediatric ? 'fa-pedi-list' : faVaEnabled ? 'fa-va-list' : 'fa-std-list'}
                                initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="space-y-4 text-sm text-white font-bold w-full"
                              >
                                {faPediatric ? (
                                  <>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Pediatric-Focused Course</strong></span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Ideal for childcare & school staff</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Children & infants focus</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Self-paced slideshow format</span></li>
                                  </>
                                ) : faVaEnabled ? (
                                  <>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Narrated Course</strong> — Virtual Assistant guides each section</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Hands-free automation for classroom delivery</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full AHA & OSHA compliant certification</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Adults, children & infants</span></li>
                                  </>
                                ) : (
                                  <>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full First Aid Certification Course</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Teach at your own pace</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Covers all age groups & scenarios</span></li>
                                    <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Interactive slides with practice cues</span></li>
                                  </>
                                )}
                              </motion.ul>
                            </AnimatePresence>
                          </div>
                          <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 relative bg-black/40">
                              <AnimatePresence mode="popLayout">
                                <motion.img 
                                  key={faPediatric ? 'fa-pedi' : faVaEnabled ? 'fa-va' : 'fa-std'}
                                  src={faPediatric ? "/Pediatric First Aid Cover.png" : faVaEnabled ? "/First Aid for All Ages with VA.png" : "/First Aid for All Ages Cover.png"} 
                                  alt="First Aid Course Cover" 
                                  className="w-full h-full object-cover absolute inset-0"
                                  initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                  exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </AnimatePresence>
                            </div>
                            <div className="flex items-center justify-between w-full group/va relative">
                              <span className={`text-[13px] font-bold tracking-wide ${faPediatric ? 'text-white/30' : 'text-white/90'}`}>Enable Virtual Assistant?</span>
                              <button onClick={() => { if (!faPediatric) setFaVaEnabled(!faVaEnabled); }} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 ${faPediatric ? 'bg-[#222] cursor-not-allowed' : faVaEnabled ? 'bg-[#ff4b4b] cursor-pointer' : 'bg-[#333] cursor-pointer'}`} disabled={faPediatric}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${faVaEnabled && !faPediatric ? 'translate-x-5' : 'translate-x-0.5'}`} />
                              </button>
                              {faPediatric && <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-56 opacity-0 group-hover/va:opacity-100 transition-opacity pointer-events-none z-50">Not available for Pediatric First Aid Course</div>}
                            </div>
                            <div className="flex items-center justify-between w-full">
                              <span className="text-[13px] text-white/90 font-bold tracking-wide">Pediatric Focused?</span>
                              <button onClick={() => { const next = !faPediatric; setFaPediatric(next); if (next) { setFaVaEnabled(false); } }} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer ${faPediatric ? 'bg-[#ff4b4b]' : 'bg-[#333]'}`}>
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${faPediatric ? 'translate-x-5' : 'translate-x-0.5'}`} />
                              </button>
                            </div>
                            <div className="group relative w-full text-center">
                              <button className="text-xs font-bold tracking-wider text-white/70 hover:text-white transition-colors flex items-center gap-1 mx-auto cursor-pointer"><HelpCircle size={12} /><span>What is this?</span></button>
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">When enabled, a virtual assistant narrates each section of the course automatically, allowing hands-free teaching.</div>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => { if (faPediatric) { handleItemClick('slideshow', 4); } else if (faVaEnabled) { handleItemClick('video', 1); } else { handleItemClick('slideshow', 1); } }} className="w-full mt-5 py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all duration-300 cursor-pointer active:scale-[0.98] shadow-[0_0_20px_rgba(255,75,75,0.3)]">
                          START COURSE
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative h-full flex items-end">
                <button 
                  onClick={() => {
                    if (selectedManual && activeTab !== 'manual') {
                      setActiveTab('manual');
                      setShowSidebar(true);
                      setShowManualSelector(false);
                    } else {
                      setShowManualSelector(!showManualSelector);
                    }
                    setShowCprSelector(false);
                    setShowFaSelector(false);
                  }}
                  className={`hidden sm:flex flex-col items-start px-4 ${selectedManual ? 'pb-2' : 'pb-4'} border-b-2 transition-colors ${activeTab === 'manual' ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
                  title="Browse Student and Instructor Handbooks"
                >
                  <div className="flex items-center gap-2">
                    <BookOpen size={20} className={activeTab === 'manual' ? 'text-eh-red' : 'text-eh-peach'} />
                    {selectedManual ? (
                      <>
                        <h2 className="font-serif text-xl font-bold leading-tight text-eh-peach tracking-tight">{selectedManual.title}</h2>
                        <ChevronDown size={16} className={`text-eh-red transition-transform ${showManualSelector ? 'rotate-180' : ''}`} />
                      </>
                    ) : (
                      <>
                        <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">TRAINING MANUALS</h2>
                        <ChevronDown size={16} className={`text-eh-red transition-transform ${showManualSelector ? 'rotate-180' : ''}`} />
                      </>
                    )}
                  </div>
                  {selectedManual && <p className="text-[10px] uppercase tracking-widest text-eh-red font-bold mt-0.5 ml-7">TRAINING MANUALS</p>}
                </button>

                <AnimatePresence>
                  {showManualSelector && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full right-0 mt-2 z-50 origin-top-right"
                      style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                    >
                      <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                        <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">CHOOSE TRAINING MANUAL</h3>
                        <div className="flex gap-6">
                          {/* Left: Manual List */}
                          <div className="flex-1 flex flex-col justify-start">
                            <div className="space-y-3">
                              {MANUALS.map((manual, index) => (
                                <button
                                  key={manual.id}
                                  onClick={() => setPreviewManualIndex(index)}
                                  className={`w-full text-left p-4 rounded-xl transition-all duration-500 border flex items-center justify-between group relative overflow-hidden ${previewManualIndex === index ? 'bg-gradient-to-r from-eh-red/20 to-transparent border-eh-red/50 shadow-[0_0_30px_rgba(255,75,75,0.2)] scale-[1.02]' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.01]'}`}
                                >
                                  {previewManualIndex === index && <div className="absolute left-0 top-0 bottom-0 w-1 bg-eh-red rounded-l-xl shadow-[0_0_10px_rgba(255,75,75,0.8)]" />}
                                  <div className="flex items-center gap-4 z-10 relative">
                                    <div className={`p-2 rounded-lg transition-colors duration-300 ${previewManualIndex === index ? 'bg-eh-red/20 text-eh-red shadow-[0_0_15px_rgba(255,75,75,0.3)]' : 'bg-black/40 text-white/50 group-hover:text-white/90 group-hover:bg-black/60'}`}>
                                      {manual.id === 'instructor' ? <GraduationCap size={20} /> : manual.id === 'pediatric' ? <Baby size={20} /> : <Book size={20} />}
                                    </div>
                                    <span className={`text-base font-black tracking-wide transition-colors duration-300 ${previewManualIndex === index ? 'text-white drop-shadow-[0_2px_4px_rgba(255,75,75,0.4)]' : 'text-white/70 group-hover:text-white'}`}>{manual.title}</span>
                                  </div>
                                  <div className={`transition-all duration-300 z-10 relative ${previewManualIndex === index ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0 group-hover:opacity-50 group-hover:translate-x-0'}`}>
                                    <ChevronRight size={20} className={previewManualIndex === index ? "text-eh-red" : "text-white"} />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Right: Cover Image + Description + Open Button */}
                          <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                            <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative bg-black/40 shadow-xl">
                              <AnimatePresence mode="popLayout">
                                <motion.img 
                                  key={previewManualIndex}
                                  src={MANUALS[previewManualIndex].thumbnail} 
                                  alt={MANUALS[previewManualIndex].title} 
                                  className="w-full h-full object-cover absolute inset-0"
                                  initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                  exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                                  transition={{ duration: 0.5, ease: "easeOut" }}
                                />
                              </AnimatePresence>
                            </div>
                            
                            <p className="text-xs text-white/70 text-center leading-relaxed font-medium min-h-[48px]">
                              {MANUALS[previewManualIndex].description}
                            </p>
                            
                            <button 
                              onClick={() => {
                                setSelectedManual(MANUALS[previewManualIndex]);
                                setShowManualSelector(false);
                                setShowSidebar(true);
                                setActiveTab('manual');
                              }}
                              className="w-full py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-bold rounded-xl transition-all duration-300 tracking-wide mt-auto hover:shadow-[0_0_20px_rgba(255,75,75,0.4)] hover:scale-[1.02] active:scale-95"
                            >
                              OPEN {MANUALS[previewManualIndex].title.toUpperCase()}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="relative h-full flex items-end">
                <button 
                  onClick={() => {
                    setActiveTab('send-certs');
                    setShowCprSelector(false);
                    setShowFaSelector(false);
                    setShowManualSelector(false);
                  }}
                  className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${activeTab === 'send-certs' ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
                  title="Done teaching? Ready to certify your students?"
                >
                  <div className="flex items-center gap-2">
                    <Award size={20} className={activeTab === 'send-certs' ? 'text-eh-red' : 'text-eh-peach'} />
                    <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">SEND CERTS</h2>
                  </div>
                </button>
              </div>
              {easterEggLevel > 0 && (
                <div className="hidden sm:flex relative items-center justify-center self-center ml-2 h-10 w-14">
                  <div 
                    className={`absolute h-8 w-auto rounded overflow-hidden transition-all duration-1000 ease-in-out ${easterEggLevel === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
                  >
                    <video src="/CPR-Dummies.mp4" autoPlay loop muted playsInline className="h-full w-auto object-cover" />
                  </div>
                  
                  <div 
                    className={`absolute h-10 w-10 overflow-hidden transition-all duration-1000 ease-in-out ${easterEggLevel === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
                    style={{ 
                      WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 70%)', 
                      maskImage: 'radial-gradient(circle, black 40%, transparent 70%)' 
                    }}
                  >
                    <video src="/WakeUp-Friends-SpaceStars.mp4" autoPlay loop muted playsInline className="h-full w-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            {activeCourse && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono">Current Progress</span>
                <span className="font-mono text-xs text-eh-peach/80">{Math.round(((activeChapterIndex + 1) / activeCourse.chapters.length) * 100)}% Complete</span>
              </div>
            )}
          </div>
        </header>

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
          <div className={`w-full h-full relative z-10 ${activeTab === 'send-certs' ? 'block' : 'hidden'}`}>
            {isOnline ? (
              <div className="w-full h-full bg-black/80 backdrop-blur-md overflow-y-auto pt-16 pb-16 px-4">
                <div className="max-w-2xl w-full mx-auto bg-[#131313]/90 border border-white/10 rounded-[32px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col items-center justify-start">
                  {/* Decorative glowing red accent top border */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-eh-red to-eh-red/40" />
                  
                  {/* Glowing background circles for visual depth */}
                  <div className="absolute -top-32 -left-32 w-64 h-64 bg-eh-red/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
                  
                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setActiveCourseIndex(null);
                      setActiveSlideshowIndex(null);
                      setSelectedManual(null);
                      setActiveTab('video');
                    }}
                    className="absolute top-6 right-6 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer z-50"
                    title="Return to Main Menu"
                  >
                    <X size={24} />
                  </button>
                  
                  {/* Icon / Brand badge */}
                  <div className="w-20 h-20 bg-eh-red/10 rounded-full flex items-center justify-center mb-8 relative border border-eh-red/20 shadow-[0_0_20px_rgba(245,57,78,0.15)]">
                    <Award size={40} className="text-eh-red animate-pulse" />
                  </div>
                  
                  {/* Header */}
                  <h2 className="font-serif text-3xl md:text-4xl font-black text-eh-peach mb-3 tracking-tight">
                    EH Academy Portal
                  </h2>
                  <p className="text-eh-peach/80 text-base max-w-lg leading-relaxed mb-8">
                    Done teaching? Ready to certify your students? Access the secure EH Academy Instructor Portal to issue training cards and finalize your class.
                  </p>
                  
                  {/* Sample Certification Card */}
                  <div className="mt-2 mb-10 flex flex-col items-center gap-2">
                    <span className="text-xs font-bold text-eh-peach/40 uppercase tracking-widest font-mono">Sample Student Certification Card</span>
                    <div 
                      className="relative group rounded-xl overflow-hidden border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-red/30 hover:shadow-[0_4px_30px_rgba(245,57,78,0.15)] max-w-md w-full cursor-pointer"
                      onClick={handleOpenPortal}
                      title="Open Instructor Portal"
                    >
                      <img 
                        src="/sample-cert.png" 
                        alt="Everyday Hero Academy Sample Certification Card" 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </div>
                  
                  {/* Process details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full text-left mb-10">
                    <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-2 hover:border-eh-red/20 transition-colors duration-300">
                      <div className="w-8 h-8 rounded-lg bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">
                        1
                      </div>
                      <h4 className="text-sm font-bold text-eh-peach">Secure Login</h4>
                      <p className="text-xs text-eh-peach/60 leading-relaxed">
                        Log in using your registered Everyday Hero Academy instructor credentials.
                      </p>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-2 hover:border-eh-red/20 transition-colors duration-300">
                      <div className="w-8 h-8 rounded-lg bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">
                        2
                      </div>
                      <h4 className="text-sm font-bold text-eh-peach">Manage Classes</h4>
                      <p className="text-xs text-eh-peach/60 leading-relaxed">
                        Select your active CPR AED or First Aid course rosters.
                      </p>
                    </div>

                    <div className="bg-black/30 border border-white/5 rounded-2xl p-5 space-y-2 hover:border-eh-red/20 transition-colors duration-300">
                      <div className="w-8 h-8 rounded-lg bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">
                        3
                      </div>
                      <h4 className="text-sm font-bold text-eh-peach">Issue Cards</h4>
                      <p className="text-xs text-eh-peach/60 leading-relaxed">
                        Instantly award and email digital certification cards to students.
                      </p>
                    </div>
                  </div>
                  
                  {/* CTA Launcher Button */}
                  <button 
                    onClick={handleOpenPortal}
                    className="px-10 py-4 bg-eh-red hover:bg-eh-red-dark text-eh-peach font-black rounded-full text-base shadow-2xl shadow-eh-red/30 transition-all flex items-center justify-center gap-3 group active:scale-95 cursor-pointer"
                  >
                    <span>Open Instructor Portal</span>
                    <ExternalLink size={18} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                  
                  {/* Secure browser notification */}
                  <div className="mt-6 flex items-center gap-2 text-xs text-eh-peach/40">
                    <Info size={14} className="text-eh-blue-light" />
                    <span>Opens securely in your system default web browser</span>
                  </div>

                  {/* Step-by-Step Portal Guide Launcher */}
                  <button
                    onClick={() => {
                      setActiveGuidePath('portal');
                      setPortalStep(1);
                      setShowHowTo(true);
                    }}
                    className="mt-6 text-xs text-eh-blue hover:text-eh-blue-light hover:underline font-bold transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center gap-1.5"
                  >
                    <BookOpen size={14} />
                    <span>View Step-by-Step Roster Guide</span>
                  </button>


                  {/* Compliance Disclaimer */}
                  <div className="mt-6 pt-6 border-t border-white/10 w-full text-center">
                    <p className="text-[11px] text-eh-peach/50 leading-relaxed max-w-xl mx-auto">
                      Everyday Hero Academy certification cards are nationally accepted. Training is consistent with the most current AHA ECC Guidelines and exceeds the requirements by federal OSHA for workplace responder. Full compliance packet is available for review at{" "}
                      <button 
                        onClick={() => handleOpenExternalUrl("https://www.EHAcademy.com")}
                        className="text-eh-blue hover:text-eh-blue-light hover:underline font-bold transition-colors cursor-pointer bg-transparent border-none p-0 inline font-mono"
                      >
                        www.EHAcademy.com
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-black/85 overflow-y-auto pt-16 pb-16 px-4">
                <div className="max-w-xl w-full mx-auto bg-[#131313] border border-white/10 rounded-[24px] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col items-center justify-start">
                  {/* Decorative top red bar */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-eh-red" />
                  
                  <div className="w-20 h-20 bg-eh-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Info size={36} className="text-eh-red" />
                  </div>
                  
                  <h2 className="font-serif text-3xl font-bold text-eh-peach mb-4 tracking-tight">Offline Mode</h2>
                  <p className="text-eh-peach/80 text-base leading-relaxed mb-6">
                    It looks like you are currently offline or have no internet access.
                  </p>
                  
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left space-y-4 mb-6 w-full">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-eh-blue-light">Instructions for Instructors</h3>
                    <p className="text-sm text-eh-peach/70 leading-relaxed">
                      Please connect to the internet, then open a web browser and go to <a href="https://ehacademy.com" target="_blank" rel="noopener noreferrer" className="text-eh-red hover:underline font-bold">ehacademy.com</a> to log into your account and assign certification cards to your students.
                    </p>
                    <div className="h-px bg-white/5 w-full" />
                    <p className="text-sm text-eh-peach/70 leading-relaxed">
                      If you need any immediate assistance, please feel free to email us at <a href="mailto:info@ehacademy.com" className="text-eh-red hover:underline font-bold">info@ehacademy.com</a>.
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => setIsOnline(navigator.onLine)}
                    className="px-8 py-3.5 bg-eh-peach hover:bg-white text-black font-bold rounded-full text-sm shadow-xl transition-all active:scale-95 cursor-pointer mb-6"
                  >
                    Retry Connection
                  </button>

                  {/* Sample Certification Card (Offline) */}
                  <div className="mt-4 mb-4 flex flex-col items-center gap-2 w-full">
                    <span className="text-[10px] font-bold text-eh-peach/40 uppercase tracking-widest font-mono">Sample Student Certification Card</span>
                    <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-red/30 hover:shadow-[0_4px_30px_rgba(245,57,78,0.15)] max-w-sm w-full mx-auto">
                      <img 
                        src="/sample-cert.png" 
                        alt="Everyday Hero Academy Sample Certification Card" 
                        className="w-full h-auto object-cover"
                      />
                    </div>
                  </div>

                  {/* Compliance Disclaimer (Offline) */}
                  <div className="mt-4 pt-6 border-t border-white/10 w-full text-center">
                    <p className="text-[11px] text-eh-peach/50 leading-relaxed max-w-md mx-auto">
                      Everyday Hero Academy certification cards are nationally accepted. Training is consistent with the most current AHA ECC Guidelines and exceeds the requirements by federal OSHA for workplace responder. Full compliance packet is available for review at{" "}
                      <button 
                        onClick={() => handleOpenExternalUrl("https://www.EHAcademy.com")}
                        className="text-eh-blue hover:text-eh-blue-light hover:underline font-bold transition-colors cursor-pointer bg-transparent border-none p-0 inline font-mono"
                      >
                        www.EHAcademy.com
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Manual Tab Container */}
          <div className={`w-full h-full relative z-10 ${activeTab === 'manual' && selectedManual ? 'block' : 'hidden'}`}>
            {selectedManual && (
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
            )}
          </div>

          {/* Video Tab Container */}
          <div className={`w-full h-full relative z-10 flex items-center justify-center ${activeTab === 'video' && activeCourse ? '' : 'hidden'}`}>
            {activeCourse && (
              activeCourse.isComingSoon ? (
                <div className="flex flex-col items-center justify-center text-center p-12 w-full h-full bg-black/80">
                  <button 
                    onClick={() => setActiveCourseIndex(null)}
                    className="absolute top-6 right-6 p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red z-50"
                  >
                    <X size={24} />
                  </button>
                  <div className="w-24 h-24 bg-eh-red/10 rounded-full flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 border-2 border-eh-red/20 rounded-full animate-ping" />
                    <Clock size={40} className="text-eh-red" />
                  </div>
                  <h2 className="font-serif text-4xl font-bold text-eh-peach mb-4 tracking-tight">Coming Soon</h2>
                  <p className="text-eh-peach/40 max-w-sm leading-relaxed mb-8">
                    The <span className="text-eh-red font-bold">{activeCourse.title}</span> module is currently in production. 
                    Check back soon for the full professional training curriculum.
                  </p>
                  <div className="flex items-center gap-4 py-2 px-6 bg-white/5 rounded-full border border-white/10">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-eh-blue">Status:</span>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-eh-peach/60">Finalizing Content</span>
                  </div>
                </div>
              ) : (
                <div ref={videoContainerRef} className={`w-full h-full relative bg-black ${!isUiVisible ? 'cursor-none' : ''}`}>
                  {/* Close Video Button */}
                  <div className={`absolute top-6 right-6 z-50 flex items-center gap-4 transition-opacity duration-500 ${!isUiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button 
                      onClick={() => { console.log('[FS-DEBUG] Close video clicked. fullscreenElement:', document.fullscreenElement?.tagName || 'none'); setActiveCourseIndex(null); }}
                      className="p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red shadow-lg backdrop-blur-md"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  {activeChapter && (
                    <div className="w-full h-full relative">
                      {/* Video Player A */}
                      <video
                        ref={videoRefA}
                        className={`absolute inset-0 w-full h-full object-contain bg-black ${
                          activePlayer === 'A' 
                            ? 'opacity-100 z-10 pointer-events-auto' 
                            : 'opacity-0 z-20 pointer-events-none transition-opacity duration-500 ease-in-out'
                        }`}
                        preload="auto"
                        muted={isMuted}
                        playsInline
                        onEnded={() => {
                          if (activePlayer === 'A') {
                            handleEnded();
                          }
                        }}
                        onTimeUpdate={(e) => {
                          if (activePlayer === 'A') {
                            handleTimeUpdate(e.currentTarget);
                          }
                        }}
                      />
                      {/* Video Player B */}
                      <video
                        ref={videoRefB}
                        className={`absolute inset-0 w-full h-full object-contain bg-black ${
                          activePlayer === 'B' 
                            ? 'opacity-100 z-10 pointer-events-auto' 
                            : 'opacity-0 z-20 pointer-events-none transition-opacity duration-500 ease-in-out'
                        }`}
                        preload="auto"
                        muted={isMuted}
                        playsInline
                        onEnded={() => {
                          if (activePlayer === 'B') {
                            handleEnded();
                          }
                        }}
                        onTimeUpdate={(e) => {
                          if (activePlayer === 'B') {
                            handleTimeUpdate(e.currentTarget);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Premium High-Contrast Subtitle Overlay */}
                  {showSubtitles && activeCue && (
                    <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-30 w-full max-w-2xl px-4 pointer-events-none flex justify-center">
                      <p 
                        className="text-white text-sm sm:text-base font-bold tracking-wide select-none leading-snug text-center drop-shadow-lg"
                        style={{
                          textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0px 2px 4px rgba(0, 0, 0, 0.8)'
                        }}
                      >
                        {activeCue.text}
                      </p>
                    </div>
                  )}

                  {/* End of Section Overlay */}
                  <AnimatePresence>
                    {showNextOverlay && activeChapter && (
                      <motion.div
                        key="overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
                      >
                        <motion.div
                          initial={{ scale: 0.8, y: 20 }}
                          animate={{ scale: 1, y: 0 }}
                          className="max-w-md w-full"
                        >
                          <div className="w-16 h-16 bg-eh-red/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle2 size={32} className="text-eh-red" />
                          </div>
                          <p className="text-eh-red text-xs font-bold uppercase tracking-widest mb-2">Section Complete</p>
                          <h3 className="font-serif text-3xl font-bold mb-4">{activeChapter.title}</h3>
                          <p className="text-eh-peach/60 text-sm mb-8 leading-relaxed">
                            Great work. Please pause for a moment to discuss these concepts or move forward to the next section when ready.
                          </p>
                          
                          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
                            <button 
                              onClick={() => selectChapter(activeChapterIndex)}
                              className="px-8 py-3 bg-eh-peach/5 hover:bg-eh-peach/10 border border-eh-peach/10 rounded-full text-sm font-semibold transition-all text-eh-peach"
                            >
                              Replay Section
                            </button>
                            {activeChapterIndex < activeCourse.chapters.length - 1 && (
                              <button 
                                onClick={handleNext}
                                className="px-10 py-4 bg-eh-red hover:bg-eh-red-dark text-eh-peach rounded-full text-sm font-black shadow-2xl shadow-eh-red/40 transition-all flex items-center justify-center gap-3 group active:scale-95"
                              >
                                Start Next Section
                                <SkipForward size={18} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Player Controls Bar */}
                  <div className={`absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent z-20 pointer-events-none transition-opacity duration-500 ${!isUiVisible ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                      {/* Progress Slider */}
                      <div 
                        className="group relative w-full h-1.5 bg-eh-peach/10 rounded-full mb-8 cursor-pointer overflow-hidden backdrop-blur-sm"
                        onClick={(e) => {
                          if (videoRef.current) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                            videoRef.current.currentTime = pos * (videoRef.current.duration || 1);
                            setProgress(pos * 100);
                          }
                        }}
                        title="Click to seek playback position"
                      >
                        <div 
                          className="absolute h-full bg-eh-red transition-all duration-300 shadow-[0_0_10px_rgba(245,57,78,0.5)]" 
                          style={{ width: `${progress}%` }} 
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-8">
                          <button 
                            onClick={handlePrev} 
                            disabled={activeChapterIndex === 0}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90"
                            title="Previous Section"
                          >
                            <SkipBack size={28} />
                          </button>
                          
                          <button 
                            onClick={togglePlay}
                            className="w-16 h-16 bg-eh-peach text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5"
                            title={isPlaying ? "Pause Narration" : "Play Narration"}
                          >
                            {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                          </button>

                          <button 
                            onClick={handleNext}
                            disabled={activeChapterIndex === activeCourse.chapters.length - 1}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90"
                            title="Next Section"
                          >
                            <SkipForward size={28} />
                          </button>
                        </div>

                        <div className="flex-1 px-8 hidden md:block">
                          <p className="text-eh-peach/40 text-[10px] uppercase tracking-widest font-bold mb-1">Coming up next</p>
                          <p className="text-sm font-medium text-eh-peach/80 line-clamp-1">
                            {activeCourse.chapters[activeChapterIndex + 1]?.title || "Course Finishes"}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="relative group flex items-center">
                            <button 
                              onClick={() => {
                                if (volume === 0 || isMuted) {
                                  setIsMuted(false);
                                  if (volume === 0) setVolume(1);
                                } else {
                                  setIsMuted(true);
                                }
                              }}
                              className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all z-10"
                              title={isMuted || volume === 0 ? "Unmute Sound" : "Mute Sound"}
                            >
                              {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                            </button>
                            
                            <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100 pl-2">
                              <input 
                                type="range" 
                                min="0" 
                                max="1" 
                                step="0.01" 
                                value={isMuted ? 0 : volume}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  setVolume(val);
                                  if (val > 0 && isMuted) setIsMuted(false);
                                  if (val === 0 && !isMuted) setIsMuted(true);
                                }}
                                className="w-20 h-1.5 bg-eh-peach/20 rounded-full appearance-none cursor-pointer accent-eh-red [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                              />
                            </div>
                          </div>

                          <button 
                            onClick={() => {
                              const rates = [1, 1.25, 1.5, 2];
                              const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                              setPlaybackRate(nextRate);
                            }}
                            className="p-2 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all font-mono font-bold text-xs w-10 h-10 flex items-center justify-center border border-transparent hover:border-eh-peach/20"
                            title="Playback Speed"
                          >
                            {playbackRate}x
                          </button>

                          <button 
                            onClick={() => {
                              const nextVal = !showSubtitles;
                              setShowSubtitles(nextVal);
                              localStorage.setItem('eh_show_subtitles', String(nextVal));
                            }}
                            className={`p-3 hover:bg-eh-peach/10 rounded-full transition-all flex items-center justify-center ${showSubtitles ? 'text-eh-red' : 'text-eh-peach/80'}`}
                            title={showSubtitles ? "Disable Subtitles" : "Enable Subtitles"}
                          >
                            <span className={`text-[11px] font-extrabold border-2 px-1.5 py-0.5 rounded tracking-wider leading-none transition-all ${
                              showSubtitles ? 'border-eh-red' : 'border-eh-peach/40 hover:border-eh-peach/80'
                            }`}>
                              CC
                            </span>
                          </button>
                          <button 
                            onClick={() => {
                              console.log('[FS-DEBUG] Video fullscreen clicked. fullscreenElement:', document.fullscreenElement?.tagName || 'none', 'videoContainerRef:', videoContainerRef.current ? 'exists' : 'null');
                              if (!document.fullscreenElement) {
                                videoContainerRef.current?.requestFullscreen()
                                  .then(() => console.log('[FS-DEBUG] requestFullscreen SUCCESS'))
                                  .catch((err) => console.error('[FS-DEBUG] requestFullscreen FAILED:', err));
                              } else {
                                document.exitFullscreen().catch(console.error);
                              }
                            }}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all"
                            title="Toggle Fullscreen View"
                          >
                            <Maximize2 size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Slideshow Tab Container */}
          <div ref={slideshowContainerRef} className={`w-full h-full relative z-10 ${activeTab === 'slideshow' && activeSlideshow ? '' : 'hidden'}`}>
            {activeSlideshow && (
              activeSlide && (
                <div className={`w-full h-full relative bg-black flex flex-col items-center justify-center ${!isUiVisible ? 'cursor-none' : ''}`}>
                  <div className={`absolute top-6 right-6 z-50 flex items-center gap-4 transition-opacity duration-500 ${!isUiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                    <button 
                      onClick={() => {
                        if (slideVideoRef.current) slideVideoRef.current.pause();
                        setActiveSlideshowIndex(null);
                      }}
                      className="p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red shadow-lg backdrop-blur-md"
                      title="Close Slideshow"
                    >
                      <X size={24} />
                    </button>
                  </div>

                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={`${activeSlideshow.id}-${activeSlide.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full flex items-center justify-center z-10"
                    >
                      {activeSlide.type === 'image' ? (
                        <img 
                          src={m(activeSlide.filename)} 
                          alt={activeSlide.title} 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <video
                          ref={slideVideoRef}
                          src={m(activeSlide.filename)}
                          className="w-full h-full object-contain"
                          muted={isMuted}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>

                  {/* Preload adjacent slideshow assets in the background */}
                  {activeSlideshow && (
                    <div className="hidden" aria-hidden="true">
                      {activeSlideshow.slides.map((s, idx) => {
                        if (Math.abs(idx - activeSlideIndex) <= 1 && idx !== activeSlideIndex) {
                          return s.type === 'image' ? (
                            <img key={s.id} src={m(s.filename)} loading="eager" />
                          ) : (
                            <video key={s.id} src={m(s.filename)} preload="auto" muted />
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}

                  {/* Controls Overlay */}
                  <div className={`absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent z-20 pointer-events-none transition-opacity duration-500 ${!isUiVisible ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 sm:gap-8">
                           <button 
                            onClick={prevSlide} 
                            disabled={activeSlideIndex === 0}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90"
                            title="Previous Slide"
                          >
                            <SkipBack size={28} />
                          </button>
                          
                          {activeSlide.type === 'video' ? (
                            <button 
                              onClick={toggleSlideshowPlay}
                              className="w-16 h-16 bg-eh-peach text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5"
                              title={slideshowIsPlaying ? "Pause Video Slide" : "Play Video Slide"}
                            >
                              {slideshowIsPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
                            </button>
                          ) : (
                            <div 
                              className="w-16 h-16 bg-eh-peach/5 border border-eh-peach/10 text-eh-peach rounded-full flex items-center justify-center shadow-2xl shadow-white/5"
                              title="Static Image Slide"
                            >
                              <Projector size={28} />
                            </div>
                          )}

                          <button 
                            onClick={nextSlide}
                            disabled={activeSlideIndex === activeSlideshow.slides.length - 1}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90"
                            title="Next Slide"
                          >
                            <SkipForward size={28} />
                          </button>
                        </div>

                        <div className="flex-1 px-8 hidden md:block">
                          <p className="text-eh-peach/40 text-[10px] uppercase tracking-widest font-bold mb-1">Slide {activeSlideIndex + 1} of {activeSlideshow.slides.length}</p>
                          <p className="text-sm font-medium text-eh-peach/80 line-clamp-1">
                            {activeSlide.title}
                          </p>
                        </div>

                        <div className="flex items-center gap-6">
                          {activeSlide.type === 'video' && (
                            <div className="relative group flex items-center">
                              <button 
                                onClick={() => {
                                  if (volume === 0 || isMuted) {
                                    setIsMuted(false);
                                    if (volume === 0) setVolume(1);
                                  } else {
                                    setIsMuted(true);
                                  }
                                }}
                                className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all z-10"
                                title={isMuted || volume === 0 ? "Unmute Sound" : "Mute Sound"}
                              >
                                {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                              </button>
                              
                              <div className="w-0 overflow-hidden group-hover:w-24 transition-all duration-300 ease-out flex items-center opacity-0 group-hover:opacity-100 pl-2">
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="1" 
                                  step="0.01" 
                                  value={isMuted ? 0 : volume}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value);
                                    setVolume(val);
                                    if (val > 0 && isMuted) setIsMuted(false);
                                    if (val === 0 && !isMuted) setIsMuted(true);
                                  }}
                                  className="w-20 h-1.5 bg-eh-peach/20 rounded-full appearance-none cursor-pointer accent-eh-red [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                                />
                              </div>
                            </div>
                          )}
                          <button 
                            onClick={() => {
                              if (!document.fullscreenElement) {
                                slideshowContainerRef.current?.requestFullscreen().catch(console.error);
                              } else {
                                document.exitFullscreen().catch(console.error);
                              }
                            }}
                            className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all"
                            title="Toggle Fullscreen View"
                          >
                            <Maximize2 size={24} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* How-To Guide Modal */}
        <AnimatePresence>
          {showHowTo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-6"
              onClick={() => setShowHowTo(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="max-w-5xl w-full max-h-[88vh] bg-[#111111] border border-white/10 rounded-[32px] overflow-hidden flex flex-col shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Red Ambient Line */}
                <div className="h-1.5 w-full bg-gradient-to-r from-eh-red via-eh-red/60 to-eh-blue/40 shrink-0" />
                
                {/* Header */}
                <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    {activeGuidePath !== 'menu' && (
                      <button
                        onClick={() => setActiveGuidePath('menu')}
                        className="mr-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-eh-peach/85 hover:text-eh-peach rounded-full transition-all duration-300 flex items-center gap-1 text-xs font-black tracking-wider border border-white/5 cursor-pointer active:scale-95"
                        title="Back to Main Menu"
                      >
                        <ChevronLeft size={16} />
                        <span className="hidden sm:inline">MENU</span>
                      </button>
                    )}
                    <div className="w-10 h-10 bg-eh-red/10 rounded-full flex items-center justify-center border border-eh-red/20 shadow-[0_0_15px_rgba(245,57,78,0.15)]">
                      <BookOpen size={20} className="text-eh-red" />
                    </div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black text-eh-peach tracking-tight leading-none mb-1">
                        {activeGuidePath === 'menu' && "EH Academy Training Guides"}
                        {activeGuidePath === 'app' && "Guide to Using the App"}
                        {activeGuidePath === 'teaching' && "Guide to Teaching a Course"}
                        {activeGuidePath === 'portal' && "Guide to Issuing Certifications"}
                      </h2>
                      <p className="text-xs text-eh-peach/40 uppercase tracking-widest font-mono">
                        {activeGuidePath === 'menu' && "Select Your Learning Path"}
                        {activeGuidePath === 'app' && "Master Your Training App in Minutes"}
                        {activeGuidePath === 'teaching' && "Instructor Guidelines & Curriculum Standards"}
                        {activeGuidePath === 'portal' && "Secure Instructor Portal Walkthrough"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowHowTo(false)}
                    className="p-2 bg-white/5 hover:bg-eh-red/20 hover:text-eh-red text-eh-peach/60 rounded-full transition-all duration-300 cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Guide Contents */}
                <div className="flex-1 overflow-y-auto p-8">
                  {activeGuidePath === 'menu' && (
                    <div className="space-y-8">
                      {/* Welcome banner */}
                      <div className="bg-black/35 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-eh-red/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="w-16 h-16 shrink-0 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center shadow-[0_0_20px_rgba(245,57,78,0.15)]">
                          <Award className="w-9 h-9 text-eh-red animate-pulse" />
                        </div>
                        <div className="space-y-1 text-center md:text-left">
                          <h3 className="text-xl font-bold text-eh-peach">Welcome to the Everyday Hero Academy Guides!</h3>
                          <p className="text-sm text-eh-peach/75 leading-relaxed">
                            Whether you need help navigating this offline presentation tool, want to check course guidelines and timings from the instructor manual, or need a visual walkthrough of the online certification portal, we have you covered. Select a guide path below to begin.
                          </p>
                        </div>
                      </div>

                      {/* Path Selection Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Option 1: App Guide */}
                        <div 
                          onClick={() => setActiveGuidePath('app')}
                          className="bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-red/35 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(245,57,78,0.1)] transition-all duration-300 group cursor-pointer active:scale-98"
                        >
                          <div className="w-14 h-14 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center text-eh-red group-hover:scale-105 group-hover:bg-eh-red/20 transition-all duration-300">
                            <HelpCircle size={28} />
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">App Navigation</span>
                            <h4 className="text-lg font-black text-eh-peach">Guide to Using the App</h4>
                            <p className="text-xs text-eh-peach/60 leading-relaxed">
                              Learn how to choose curriculums, toggle chapters, enable auto-advance (Continuous Play), and navigate digital manuals.
                            </p>
                          </div>
                          <div className="pt-2 w-full">
                            <span className="inline-flex items-center gap-1.5 text-xs text-eh-red font-bold group-hover:translate-x-1 transition-transform">
                              <span>Open App Guide</span>
                              <ChevronRight size={14} />
                            </span>
                          </div>
                        </div>

                        {/* Option 2: Teaching Guide */}
                        <div 
                          onClick={() => setActiveGuidePath('teaching')}
                          className="bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-peach/30 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(255,213,184,0.08)] transition-all duration-300 group cursor-pointer active:scale-98"
                        >
                          <div className="w-14 h-14 bg-eh-peach/10 rounded-2xl border border-eh-peach/20 flex items-center justify-center text-eh-peach group-hover:scale-105 group-hover:bg-eh-peach/20 transition-all duration-300">
                            <Projector size={28} />
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">Curriculum & Rules</span>
                            <h4 className="text-lg font-black text-eh-peach">Guide to Teaching</h4>
                            <p className="text-xs text-eh-peach/60 leading-relaxed">
                              Review course durations, class limits, required manikin ratios, feedback devices, and Slideshow vs. Video mode teaching.
                            </p>
                          </div>
                          <div className="pt-2 w-full">
                            <span className="inline-flex items-center gap-1.5 text-xs text-eh-peach font-bold group-hover:translate-x-1 transition-transform">
                              <span>Open Teaching Guide</span>
                              <ChevronRight size={14} />
                            </span>
                          </div>
                        </div>

                        {/* Option 3: Portal Guide */}
                        <div 
                          onClick={() => {
                            setActiveGuidePath('portal');
                            setPortalStep(1);
                          }}
                          className="bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-blue/35 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(62,184,255,0.08)] transition-all duration-300 group cursor-pointer active:scale-98"
                        >
                          <div className="w-14 h-14 bg-eh-blue/10 rounded-2xl border border-eh-blue/20 flex items-center justify-center text-eh-blue-light group-hover:scale-105 group-hover:bg-eh-blue/20 transition-all duration-300">
                            <Award size={28} />
                          </div>
                          <div className="space-y-2">
                            <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">Rosters & Portal</span>
                            <h4 className="text-lg font-black text-eh-peach">Guide to Issuing Certs</h4>
                            <p className="text-xs text-eh-peach/60 leading-relaxed">
                              Walk through scheduling classes, adding students individually or via CSV, marking attendance, and sending digital certification cards.
                            </p>
                          </div>
                          <div className="pt-2 w-full">
                            <span className="inline-flex items-center gap-1.5 text-xs text-eh-blue-light font-bold group-hover:translate-x-1 transition-transform">
                              <span>Open Portal Guide</span>
                              <ChevronRight size={14} />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeGuidePath === 'app' && (
                    <div className="space-y-8">
                      {/* Welcome banner */}
                      <div className="bg-black/30 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="w-16 h-16 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center shrink-0">
                          <HelpCircle size={32} className="text-eh-red" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-eh-peach">Welcome to CPR Trainer Pro!</h3>
                          <p className="text-sm text-eh-peach/70 leading-relaxed">
                            This application was custom-built by Everyday Hero Academy to provide instructors with a reliable, ultra-premium offline training platform. Follow this quick guide to master the user interface and deliver a seamless teaching experience.
                          </p>
                        </div>
                      </div>

                      {/* Grid of Sections */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Step 1 */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                              1
                            </div>
                            <h4 className="text-base font-black text-eh-peach">Selecting Course & Edition</h4>
                          </div>
                          <p className="text-sm text-eh-peach/60 leading-relaxed">
                            Use the large header tabs at the top of the screen to choose your main curriculum category:
                          </p>
                          <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span><strong className="text-eh-peach">CPR & AED:</strong> Choose between Adult, Pediatric, Spanish, or special editions.</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span><strong className="text-eh-peach">FIRST AID:</strong> Select First Aid Core, Pediatric First Aid, or Spanish modules.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                              2
                            </div>
                            <h4 className="text-base font-black text-eh-peach">Navigating Chapters & Slides</h4>
                          </div>
                          <p className="text-sm text-eh-peach/60 leading-relaxed">
                            Your class curriculum is structured into simple chapters in the Left Sidebar Menu:
                          </p>
                          <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>Click any chapter to jump directly to that video or topic.</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>Click the <span className="text-eh-red font-bold">Sidebar Toggle</span> button (<ChevronLeft size={14} className="inline-block align-middle" /> inside the sidebar, or <Menu size={14} className="inline-block align-middle text-eh-blue" /> in the top header) to collapse or expand the menu for a full-screen cinematic look.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                              3
                            </div>
                            <h4 className="text-base font-black text-eh-peach">Continuous Play (Auto-Advance)</h4>
                          </div>
                          <p className="text-sm text-eh-peach/60 leading-relaxed">
                            Teaching in front of a class and don't want to keep walking back to click the next chapter?
                          </p>
                          <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>Toggle <strong className="text-eh-peach">Continuous Play</strong> ON in the bottom left of the sidebar.</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>The player will automatically advance to the next video or presentation chapter once the current video finishes.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Step 4 */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                              4
                            </div>
                            <h4 className="text-base font-black text-eh-peach">Training Manuals & Handbooks</h4>
                          </div>
                          <p className="text-sm text-eh-peach/60 leading-relaxed">
                            Access official digital training manuals directly inside the app:
                          </p>
                          <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>Click <strong className="text-eh-peach">Training Manuals</strong> in the header and choose a handbook.</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span>Use the fully interactive Table of Contents in the sidebar to jump straight to specific chapters or bookmarks instantly.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Step 5 */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group md:col-span-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                              5
                            </div>
                            <h4 className="text-base font-black text-eh-peach">Ready to Certify? (Send Cards)</h4>
                          </div>
                          <p className="text-sm text-eh-peach/60 leading-relaxed">
                            When your class is complete, head to the <strong className="text-eh-peach">Send Certs</strong> tab in the header:
                          </p>
                          <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                            <li className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                              <span><strong className="text-eh-peach">Online:</strong> Click the secure launcher to open the secure Everyday Hero Academy instructor portal in your default browser to issue digital training cards.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0 mt-1.5" />
                              <span>If you are offline, you can still teach the course but you must keep your own accurate roster and upload it to your portal on <strong className="text-eh-peach">EHAcademy.com</strong> in order to assign official Everyday Hero Academy digital certifications.</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeGuidePath === 'teaching' && (
                    <div className="space-y-8">
                      {/* Top banner */}
                      <div className="bg-black/30 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-eh-peach/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="w-16 h-16 shrink-0 bg-eh-peach/10 rounded-2xl border border-eh-peach/20 flex items-center justify-center">
                          <Projector size={32} className="text-eh-peach" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-eh-peach">EH Academy Course Instruction Standards</h3>
                          <p className="text-sm text-eh-peach/70 leading-relaxed">
                            Review core guidelines, manikin requirements, timing information, and teaching modes from the official Everyday Hero Academy Instructor Manual. Designed for high quality, standardized outcomes.
                          </p>
                        </div>
                      </div>

                      {/* Classroom setup grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Box 1: Student Ratios & Manikins */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300">
                          <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-eh-peach" />
                            Instructor & Roster Limits
                          </h4>
                          <ul className="text-sm text-eh-peach/70 space-y-3">
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">1.</span>
                              <span><strong className="text-eh-peach">Instructor Limit:</strong> Standard ratio is <span className="text-eh-peach font-bold">12 students per instructor</span>. If your class exceeds 12 students, a co-instructor or second teacher is required.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">2.</span>
                              <span><strong className="text-eh-peach">Manikin Ratio:</strong> Maximum student-to-manikin ratio is <span className="text-eh-peach font-bold">3:1</span>. For optimal hands-on time and shorter class lengths, a <span className="text-eh-peach font-bold">1:1 ratio</span> is highly recommended.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">3.</span>
                              <span><strong className="text-eh-peach">No Student Minimum:</strong> Classes can be conducted for any number of students, even a single individual.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Box 2: Key Equipment & Manikins */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300">
                          <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-eh-peach" />
                            Manikins & Feedback Devices
                          </h4>
                          <ul className="text-sm text-eh-peach/70 space-y-3">
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">1.</span>
                              <span><strong className="text-eh-peach">Feedback Devices:</strong> Standard curriculums require compressions with instrumented feedback. E.g., Prestan manikins show <span className="text-eh-peach font-bold">two green lights</span> to indicate the perfect CPR compression rate (100–120 bpm).</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">2.</span>
                              <span><strong className="text-eh-peach">Floor Placement:</strong> For realistic mechanics, adult manikins must be placed on the floor during practice.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-eh-peach font-bold font-mono">3.</span>
                              <span><strong className="text-eh-peach">Accommodations:</strong> If a student cannot kneel, you can accommodate them by placing the manikin on a table or chair so they can practice comfortably.</span>
                            </li>
                          </ul>
                        </div>

                        {/* Box 3: Course Timings */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300 md:col-span-2">
                          <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-eh-peach" />
                            Official Course Teaching Times
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                            <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                              <div className="text-eh-peach/40 uppercase tracking-widest font-bold">Comprehensive Courses</div>
                              <div className="text-sm font-bold text-eh-peach">2.5 to 3 Hours</div>
                              <div className="text-[11px] text-eh-peach/60 font-sans mt-1">CPR AED & First Aid (All Ages or Pediatric Combined)</div>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                              <div className="text-eh-peach/40 uppercase tracking-widest font-bold">CPR AED Core Only</div>
                              <div className="text-sm font-bold text-eh-peach">1 hr 20m - 2 Hours</div>
                              <div className="text-[11px] text-eh-peach/60 font-sans mt-1">Adult, Child, & Infant (Adult Only: 1-1.5 hrs; Child/Infant: 1.5 hrs)</div>
                            </div>
                            <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                              <div className="text-eh-peach/40 uppercase tracking-widest font-bold">First Aid Core Only</div>
                              <div className="text-sm font-bold text-eh-peach">1 Hour 15 Mins</div>
                              <div className="text-[11px] text-eh-peach/60 font-sans mt-1">First Aid Only Course (Excludes CPR & AED segments)</div>
                            </div>
                          </div>
                        </div>

                        {/* Box 4: Video vs Slideshow */}
                        <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300 md:col-span-2">
                          <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-eh-peach" />
                            Teaching Mediums: Video vs Slideshow
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-eh-peach/70">
                            <div className="space-y-2">
                              <h5 className="font-bold text-eh-peach flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-eh-red" />
                                Video Mode (Continuous Play)
                              </h5>
                              <p className="leading-relaxed text-xs">
                                High-quality narrations, hands-free automation, and perfect pacing. Excellent for standard classes, allowing you as the instructor to walk around, correct compression postures, monitor feedback devices, and assist students directly while the video does the talking.
                              </p>
                            </div>
                            <div className="space-y-2">
                              <h5 className="font-bold text-eh-peach flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-eh-blue" />
                                Slideshow Mode (Self-Paced)
                              </h5>
                              <p className="leading-relaxed text-xs">
                                Fully manual, customized, and instructor-controlled. Excellent for adapting to class speeds, handling interactive Q&A sessions, diving into manual annotations, or customizing your presentation flow to suit special corporate or school audiences.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeGuidePath === 'portal' && (
                    <div className="space-y-6">
                      {/* Step Indicator dots & tabs */}
                      <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 gap-4">
                        <div className="flex flex-wrap gap-2">
                          {[
                            { step: 1, label: "1. Classes Page" },
                            { step: 2, label: "2. Create Class" },
                            { step: 3, label: "3. Build Roster" },
                            { step: 4, label: "4. Open Class" },
                            { step: 5, label: "5. Attendance" },
                            { step: 6, label: "6. Issue Certs" }
                          ].map((s) => (
                            <button
                              key={s.step}
                              onClick={() => setPortalStep(s.step)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all duration-300 cursor-pointer ${
                                portalStep === s.step
                                  ? 'bg-eh-blue text-white border border-eh-blue shadow-[0_0_10px_rgba(62,184,255,0.25)]'
                                  : 'bg-black/30 text-eh-peach/40 border border-white/5 hover:border-white/20'
                              }`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <div className="text-xs text-eh-peach/40 font-mono font-bold bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                          Step {portalStep} of 6
                        </div>
                      </div>

                      {/* Step Contents */}
                      {[
                        {
                          step: 1,
                          title: "1. Access your Dashboard",
                          subtitle: "Log in & navigate",
                          desc: "First, access your portal by logging into www.ehacademy.com using your registered instructor credentials. This brings you to your main Dashboard. From here, you can see your account stats, welcome banner, and general resources. To manage your courses, click 'Classes' in the left-hand navigation menu.",
                          image: "/guide/step1_dashboard.png"
                        },
                        {
                          step: 2,
                          title: "2. The Classes Page",
                          subtitle: "Your scheduling hub",
                          desc: "After clicking 'Classes', you will arrive at your class management hub. On the left, you'll see a list of all your upcoming classes. On the right, the monthly calendar highlights your active schedule. Click the dark blue 'Create a Class' button in the top-right corner to begin scheduling a new course.",
                          image: "/guide/step2_create_class.png"
                        },
                        {
                          step: 3,
                          title: "3. Fill Class Details",
                          subtitle: "Entering course info",
                          desc: "The 'Create a Class' form will replace the list. Fill in the required fields: select your name from the Instructor dropdown, enter the Date and Start Time, and select your Location and Client. If the location or client is new, click the 'Create New' quick links directly below each field to save them for future reuse.",
                          image: "/guide/step3_add_roster.png"
                        },
                        {
                          step: 4,
                          title: "4. Build the Roster & Submit",
                          subtitle: "Adding your students",
                          desc: "Click 'Add Roster' to expand the student section. You can enter students individually by typing their Name and Email and clicking 'Add Student', or upload a CSV in batch using our template. Once finished, choose the appropriate Certificate Type from the dropdown and click 'Create Class' at the bottom.",
                          image: "/guide/step4_detail_view.png"
                        },
                        {
                          step: 5,
                          title: "5. Mark Student Attendance",
                          subtitle: "Confirming participation",
                          desc: "From the Classes page, click on your created class in the list or calendar to open the Class Details page. Scroll down to the Roster section. Confirm each student's physical participation in the training session by clicking the green 'Mark as Attended' button next to their name.",
                          image: "/guide/step5_roster_list.png"
                        },
                        {
                          step: 6,
                          title: "6. Record Pass & Issue Certs",
                          subtitle: "Emailing digital cards",
                          desc: "After marking a student as attended, their status updates. Click 'Mark as Passed' for successful students. Once passed, click 'Send Certs To All Students' or 'Send Certificate' next to an individual student to instantly email their digital card. You can also click 'Download All Certs (ZIP)' to save a copy.",
                          image: "/guide/step6_mark_attendance.png"
                        }
                      ].map((s) => {
                        if (s.step !== portalStep) return null;
                        return (
                          <motion.div
                            key={s.step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
                          >
                            <div className="lg:col-span-2 space-y-4">
                              <div>
                                <span className="text-[10px] text-eh-blue-light uppercase tracking-widest font-mono font-bold">{s.subtitle}</span>
                                <h3 className="text-xl font-black text-eh-peach mt-0.5">{s.title}</h3>
                              </div>
                              <p className="text-sm text-eh-peach/70 leading-relaxed whitespace-pre-line">
                                {s.desc}
                              </p>
                              
                              {/* Quick advice box */}
                              <div className="bg-eh-blue/5 border border-eh-blue/15 rounded-2xl p-4 text-xs text-eh-blue-light flex gap-2">
                                <Info size={16} className="shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Pro Tip:</span> Everyday Hero Academy digital certifications are fully automated and emailed directly to your students' inboxes. <span className="text-eh-peach font-bold">Note:</span> Certifications can only be issued by accounts with an active paid subscription or a valid single class purchase.
                                </div>
                              </div>

                              {/* Navigation arrows inside details for convenience */}
                              <div className="flex items-center gap-3 pt-2">
                                <button
                                  onClick={() => setPortalStep(prev => Math.max(1, prev - 1))}
                                  disabled={portalStep === 1}
                                  className="px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold text-eh-peach flex items-center gap-1.5 transition-all border border-white/5 cursor-pointer"
                                >
                                  <ChevronLeft size={14} />
                                  <span>Previous</span>
                                </button>
                                <button
                                  onClick={() => setPortalStep(prev => Math.min(6, prev + 1))}
                                  disabled={portalStep === 6}
                                  className="px-4 py-2 bg-eh-blue hover:bg-eh-blue-light disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer"
                                >
                                  <span>Next Step</span>
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                            </div>
                            
                            {/* Screenshot view */}
                            <div className="lg:col-span-3 space-y-2">
                              <div className="bg-black/50 border border-white/10 rounded-2xl p-2 relative shadow-2xl overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300 flex items-end p-4">
                                  <span className="text-[10px] text-eh-peach/60 uppercase tracking-widest font-mono">Clean screenshot with Claude overlays neutralized</span>
                                </div>
                                <img
                                  src={s.image}
                                  alt={s.title}
                                  className="w-full h-auto rounded-xl object-contain border border-white/5 bg-[#151515]"
                                />
                              </div>
                              <div className="text-[10px] text-eh-peach/30 text-center font-mono uppercase tracking-widest">
                                Everyday Hero Academy Instructor Portal Interface
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-eh-peach/30 uppercase tracking-widest font-bold">CPR Trainer Pro v1.0.0</span>
                    {activeGuidePath !== 'menu' && (
                      <button
                        onClick={() => setActiveGuidePath('menu')}
                        className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-eh-peach/60 hover:text-eh-peach border border-white/5 hover:border-white/10 rounded-full text-[10px] uppercase font-mono font-bold tracking-wider transition-all cursor-pointer"
                      >
                        Main Menu
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowHowTo(false)}
                    className="px-6 py-2.5 bg-eh-red hover:bg-eh-red-dark text-eh-peach font-bold rounded-full text-xs shadow-xl active:scale-95 transition-all cursor-pointer"
                  >
                    Close Guide
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

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
