import { useState, useRef, useEffect, useCallback } from 'react';
import { SLIDESHOWS } from '../chapters';
import { downloadManager } from '../download-manager';
import { isTauri } from '../media-resolver';

interface UseSlideshowPlayerProps {
  setIsPlaying: (playing: boolean) => void;
  setShowCprSelector: (show: boolean) => void;
  setShowFaSelector: (show: boolean) => void;
  setShowSidebar: (show: boolean) => void;
}

export function useSlideshowPlayer({
  setIsPlaying,
  setShowCprSelector,
  setShowFaSelector,
  setShowSidebar
}: UseSlideshowPlayerProps) {
  const [activeSlideshowIndex, setActiveSlideshowIndex] = useState<number | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [slideshowIsPlaying, setSlideshowIsPlaying] = useState(true);

  const slideVideoRef = useRef<HTMLVideoElement>(null);
  const slideshowContainerRef = useRef<HTMLDivElement>(null);

  const activeSlideshow = activeSlideshowIndex !== null ? SLIDESHOWS[activeSlideshowIndex] : null;
  const activeSlide = activeSlideshow ? activeSlideshow.slides[activeSlideIndex] : null;

  const switchSlideshow = useCallback((index: number) => {
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
  }, [setIsPlaying, setShowCprSelector, setShowFaSelector, setShowSidebar]);

  const nextSlide = useCallback(() => {
    if (activeSlideshow && activeSlideIndex < activeSlideshow.slides.length - 1) {
      if (slideVideoRef.current) {
        slideVideoRef.current.pause();
      }
      setActiveSlideIndex(prev => prev + 1);
      setSlideshowIsPlaying(true);
    }
  }, [activeSlideshow, activeSlideIndex]);

  const prevSlide = useCallback(() => {
    if (activeSlideIndex > 0) {
      if (slideVideoRef.current) {
        slideVideoRef.current.pause();
      }
      setActiveSlideIndex(prev => prev - 1);
      setSlideshowIsPlaying(true);
    }
  }, [activeSlideIndex]);
  
  const toggleSlideshowPlay = useCallback(() => {
    if (slideVideoRef.current && activeSlide?.type === 'video') {
      if (slideshowIsPlaying) {
        slideVideoRef.current.pause();
      } else {
        slideVideoRef.current.play().catch(e => console.error("Play failed", e));
      }
      setSlideshowIsPlaying(!slideshowIsPlaying);
    }
  }, [activeSlide, slideshowIsPlaying]);

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

  return {
    activeSlideshowIndex,
    setActiveSlideshowIndex,
    activeSlideIndex,
    setActiveSlideIndex,
    slideshowIsPlaying,
    setSlideshowIsPlaying,
    activeSlideshow,
    activeSlide,
    slideVideoRef,
    slideshowContainerRef,
    switchSlideshow,
    nextSlide,
    prevSlide,
    toggleSlideshowPlay
  };
}
