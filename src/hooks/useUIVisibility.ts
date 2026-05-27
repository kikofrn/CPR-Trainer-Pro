import React, { useState, useEffect } from 'react';

interface UseUIVisibilityProps {
  isPlaying: boolean;
  slideshowIsPlaying: boolean;
  activeTab: 'video' | 'manual' | 'slideshow' | 'send-certs';
  videoContainerRef: React.RefObject<HTMLDivElement>;
  slideshowContainerRef: React.RefObject<HTMLDivElement>;
}

export function useUIVisibility({
  isPlaying,
  slideshowIsPlaying,
  activeTab,
  videoContainerRef,
  slideshowContainerRef
}: UseUIVisibilityProps) {
  const [isUiVisible, setIsUiVisible] = useState(true);

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
      clearTimeout(timer);
      if (container1) {
        container1.removeEventListener('mousemove', handleActivity);
        container1.removeEventListener('click', handleActivity);
      }
      if (container2) {
        container2.removeEventListener('mousemove', handleActivity);
        container2.removeEventListener('click', handleActivity);
      }
      window.removeEventListener('mousemove', handleActivity);
    };
  }, [activeTab, isPlaying, slideshowIsPlaying, videoContainerRef, slideshowContainerRef]);

  return { isUiVisible, setIsUiVisible };
}
