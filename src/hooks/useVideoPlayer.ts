import React, { useState, useRef, useEffect, useCallback } from 'react';
import { mediaUrl as m, isTauri } from '../media-resolver';

interface Chapter {
  id: string;
  title: string;
  duration: string;
  filename: string;
  parentSectionId?: string;
  isSubtitle?: boolean;
}

interface Course {
  id: string;
  title: string;
  chapters: Chapter[];
}

interface UseVideoPlayerProps {
  activeCourse: Course | null;
  activeChapter: Chapter | null;
  nextChapter: Chapter | null;
  activeCourseIndex: number | null;
  activeChapterIndex: number;
  setActiveChapterIndex: React.Dispatch<React.SetStateAction<number>>;
  isTargetDownloaded: boolean;
  isNextDownloaded: boolean;
  setActiveTab: (tab: 'video' | 'manual' | 'slideshow' | 'send-certs') => void;
  setShowSidebar: (show: boolean) => void;
  saveProgress: (courseIndex: number, chapterIndex: number) => void;
}

export function useVideoPlayer({
  activeCourse,
  activeChapter,
  nextChapter,
  activeCourseIndex,
  activeChapterIndex,
  setActiveChapterIndex,
  isTargetDownloaded,
  isNextDownloaded,
  setActiveTab,
  setShowSidebar,
  saveProgress
}: UseVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const volumeRef = useRef(volume);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isContinuousPlay, setIsContinuousPlay] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefA = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  // Real-time volume updates for active players
  useEffect(() => {
    const active = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
    if (active) active.volume = isMuted ? 0 : volume;
  }, [volume, isMuted, activePlayer]);

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

  // Manage double-buffered preloading for Video Players A & B
  useEffect(() => {
    if (!activeChapter) return;

    const getUrl = (chapter: Chapter, downloaded: boolean) => {
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
  }, [activeChapterIndex, activeCourseIndex, activePlayer, isTargetDownloaded, isNextDownloaded, activeChapter, nextChapter]);

  // Synchronize playing state, volume cross-fading, and legacy ref when active player swaps
  useEffect(() => {
    const active = activePlayer === 'A' ? videoRefA.current : videoRefB.current;
    const inactive = activePlayer === 'A' ? videoRefB.current : videoRefA.current;

    videoRef.current = active;

    let activeInterval: any = null;
    let inactiveInterval: any = null;

    if (isPlaying) {
      if (active) {
        active.muted = isMuted;
        if (!isMuted) {
          active.volume = 0.0;
          active.play()
            .then(() => {
              const duration = 500;
              const step = 50;
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

      if (inactive) {
        inactive.muted = isMuted;
        if (!isMuted && !inactive.paused) {
          const duration = 500;
          const step = 50;
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

  const handleNext = useCallback(() => {
    if (activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      const nextIndex = activeChapterIndex + 1;
      setActiveChapterIndex(nextIndex);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, nextIndex);
      setShowNextOverlay(false);
      setIsPlaying(true);
    }
  }, [activeCourse, activeChapterIndex, activeCourseIndex, saveProgress, setActiveChapterIndex]);

  const handlePrev = useCallback(() => {
    if (activeChapterIndex > 0) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      const prevIndex = activeChapterIndex - 1;
      setActiveChapterIndex(prevIndex);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, prevIndex);
      setShowNextOverlay(false);
      setIsPlaying(true);
    }
  }, [activeChapterIndex, activeCourseIndex, saveProgress, setActiveChapterIndex]);

  const togglePlay = useCallback(() => {
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
  }, [isPlaying, setActiveTab]);

  const selectChapter = useCallback((index: number) => {
    if (index !== activeChapterIndex) {
      setActivePlayer(prev => prev === 'A' ? 'B' : 'A');
      setActiveChapterIndex(index);
      if (activeCourseIndex !== null) saveProgress(activeCourseIndex, index);
    }
    setShowNextOverlay(false);
    setIsPlaying(true);
    setActiveTab('video');
    if (window.innerWidth < 1024) setShowSidebar(false);
  }, [activeChapterIndex, activeCourseIndex, saveProgress, setActiveChapterIndex, setActiveTab, setShowSidebar]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    if (isContinuousPlay && activeCourse && activeChapterIndex < activeCourse.chapters.length - 1) {
      handleNext();
    } else {
      setShowNextOverlay(true);
    }
  }, [isContinuousPlay, activeCourse, activeChapterIndex, handleNext]);

  // Expose an update handler that calls setProgress, which App.tsx can wrap to also check subtitles
  const handleTimeUpdate = useCallback((currentTime: number, duration: number) => {
    const p = (currentTime / (duration || 1)) * 100;
    setProgress(isNaN(p) ? 0 : p);
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    isContinuousPlay,
    setIsContinuousPlay,
    progress,
    setProgress,
    showNextOverlay,
    setShowNextOverlay,
    activePlayer,
    videoRef,
    videoRefA,
    videoRefB,
    videoContainerRef,
    handleNext,
    handlePrev,
    togglePlay,
    selectChapter,
    handleEnded,
    handleTimeUpdate,
  };
}
