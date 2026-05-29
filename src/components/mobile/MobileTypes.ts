import { RefObject } from 'react';
import { Course, Chapter, Slideshow, Slide, Manual } from '../../chapters';
import { SubtitleCue } from '../../utils/vtt-parser';

export interface AppState {
  activeCourseIndex: number | null;
  activeChapterIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  isContinuousPlay: boolean;
  progress: number;
  showNextOverlay: boolean;
  selectedManual: Manual | null;
  activeTab: 'video' | 'manual' | 'slideshow' | 'send-certs';
  isOnline: boolean;
  
  // Elite Toggles
  cprVaEnabled: boolean;
  faVaEnabled: boolean;
  faPediatric: boolean;
  
  activeSlideshowIndex: number | null;
  activeSlideIndex: number;
  slideshowIsPlaying: boolean;
  
  activePlayer: 'A' | 'B';
  showSubtitles: boolean;
  activeCue: SubtitleCue | null;
  
  dlState: any;
}

export interface AppActions {
  setActiveCourseIndex: (idx: number | null) => void;
  setActiveChapterIndex: (idx: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setIsContinuousPlay: (continuous: boolean) => void;
  setProgress: (progress: number) => void;
  setShowNextOverlay: (show: boolean) => void;
  setSelectedManual: (manual: Manual | null) => void;
  setActiveTab: (tab: 'video' | 'manual' | 'slideshow' | 'send-certs') => void;
  
  setCprVaEnabled: (enabled: boolean) => void;
  setFaVaEnabled: (enabled: boolean) => void;
  setFaPediatric: (enabled: boolean) => void;
  
  setActiveSlideshowIndex: (idx: number | null) => void;
  setActiveSlideIndex: (idx: number) => void;
  setSlideshowIsPlaying: (playing: boolean) => void;
  
  setShowSubtitles: (show: boolean) => void;
  
  // Handlers
  handlePrev: () => void;
  handleNext: () => void;
  togglePlay: () => void;
  selectChapter: (index: number) => void;
  handleOpenPortal: () => void;
  
  // Video Refs
  videoRefA: RefObject<HTMLVideoElement>;
  videoRefB: RefObject<HTMLVideoElement>;
  slideVideoRef: RefObject<HTMLVideoElement>;
  
  // Video Handlers (for A/B players)
  handleEnded: () => void;
  handleTimeUpdate: (video: HTMLVideoElement) => void;
}
