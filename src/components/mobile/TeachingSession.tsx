import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { COURSES, SLIDESHOWS } from '../../chapters';
import { Play, Pause, SkipBack, SkipForward, X, CheckCircle2, ChevronUp } from 'lucide-react';
import { ChapterDrawer } from './ChapterDrawer';

interface Props {
  state: AppState;
  actions: AppActions;
  onEndSession: () => void;
}

export const TeachingSession: React.FC<Props> = ({ state, actions, onEndSession }) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Auto-hide controls logic
  const handleInteraction = () => {
    setControlsVisible(true);
    // In a real implementation, you'd reset a 3-second timeout here
  };

  const isVideo = state.activeCourseIndex !== null;
  const activeCourse = isVideo ? COURSES[state.activeCourseIndex!] : null;
  const activeChapter = activeCourse ? activeCourse.chapters[state.activeChapterIndex] : null;

  const isSlideshow = state.activeSlideshowIndex !== null;
  const activeSlideshow = isSlideshow ? SLIDESHOWS[state.activeSlideshowIndex!] : null;
  const activeSlide = activeSlideshow ? activeSlideshow.slides[state.activeSlideIndex] : null;

  return (
    <div className="absolute inset-0 bg-black flex flex-col z-[200]" onClick={handleInteraction}>
      
      {/* Video / Slideshow Area */}
      {/* When drawer is open, video shrinks to top 40% (handled by framer-motion) */}
      <motion.div 
        animate={{ 
          height: isDrawerOpen ? '40%' : '100%',
          y: isDrawerOpen ? 0 : 0
        }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full relative bg-black flex-shrink-0 flex items-center justify-center overflow-hidden"
      >
        {isVideo && activeChapter && (
          <>
            <video
              ref={actions.videoRefA}
              className={`absolute inset-0 w-full h-full object-contain bg-black ${
                state.activePlayer === 'A' 
                  ? 'opacity-100 z-10' 
                  : 'opacity-0 z-20 pointer-events-none'
              }`}
              preload="auto"
              muted={state.isMuted}
              playsInline
              onEnded={() => {
                if (state.activePlayer === 'A') actions.handleEnded();
              }}
              onTimeUpdate={(e) => {
                if (state.activePlayer === 'A') actions.handleTimeUpdate(e.currentTarget);
              }}
            />
            <video
              ref={actions.videoRefB}
              className={`absolute inset-0 w-full h-full object-contain bg-black ${
                state.activePlayer === 'B' 
                  ? 'opacity-100 z-10' 
                  : 'opacity-0 z-20 pointer-events-none'
              }`}
              preload="auto"
              muted={state.isMuted}
              playsInline
              onEnded={() => {
                if (state.activePlayer === 'B') actions.handleEnded();
              }}
              onTimeUpdate={(e) => {
                if (state.activePlayer === 'B') actions.handleTimeUpdate(e.currentTarget);
              }}
            />
          </>
        )}

        {isSlideshow && activeSlide && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center z-10">
            {activeSlide.type === 'image' ? (
              <img 
                src={activeSlide.filename} 
                alt={activeSlide.title} 
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={actions.slideVideoRef}
                src={activeSlide.filename}
                className="w-full h-full object-contain"
                muted={state.isMuted}
                playsInline
                onEnded={() => actions.handleEnded()}
                onTimeUpdate={(e) => actions.handleTimeUpdate(e.currentTarget)}
              />
            )}
          </div>
        )}

        {/* Subtitles Overlay */}
        {state.showSubtitles && state.activeCue && !isDrawerOpen && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30 w-full px-4 pointer-events-none flex justify-center">
            <p 
              className="text-white text-sm font-bold tracking-wide select-none leading-snug text-center drop-shadow-lg"
              style={{
                textShadow: '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0px 2px 4px rgba(0, 0, 0, 0.8)'
              }}
            >
              {state.activeCue.text}
            </p>
          </div>
        )}

        {/* Top Controls (Close) */}
        <AnimatePresence>
          {controlsVisible && !isDrawerOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 left-0 right-0 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] z-40 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start"
            >
              <button 
                onClick={onEndSession}
                className="p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red backdrop-blur-md"
              >
                <X size={20} />
              </button>
              
              <button 
                onClick={() => actions.setShowSubtitles(!state.showSubtitles)}
                className={`px-2 py-1 rounded border-2 text-xs font-bold transition-colors ${
                  state.showSubtitles ? 'border-eh-red text-eh-red' : 'border-white/40 text-white/80'
                }`}
              >
                CC
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Player Controls (only when drawer is closed) */}
        <AnimatePresence>
          {controlsVisible && !isDrawerOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-0 left-0 right-0 px-6 pt-20 bg-gradient-to-t from-black via-black/80 to-transparent z-40 pb-[calc(env(safe-area-inset-bottom)+4rem)]"
            >
              {/* Progress Bar */}
              <div 
                className="w-full h-1.5 bg-white/20 rounded-full mb-6 relative overflow-hidden"
                onClick={(e) => {
                  const video = isVideo 
                    ? (state.activePlayer === 'A' ? actions.videoRefA.current : actions.videoRefB.current)
                    : actions.slideVideoRef.current;
                  if (video) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    video.currentTime = pos * (video.duration || 1);
                    actions.setProgress(pos * 100);
                  }
                }}
              >
                <div 
                  className="absolute h-full bg-eh-red transition-all duration-300" 
                  style={{ width: `${state.progress}%` }} 
                />
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-widest text-eh-peach/40 font-bold mb-0.5">
                    {isVideo ? 'Video Course' : 'Presentation'}
                  </span>
                  <span className="text-sm font-bold text-eh-peach line-clamp-1">
                    {isVideo ? activeChapter?.title : activeSlide?.title}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={actions.handlePrev} className="p-2 text-white/80 active:scale-90 transition-transform">
                    <SkipBack size={24} />
                  </button>
                  <button 
                    onClick={actions.togglePlay}
                    className="w-14 h-14 bg-eh-peach text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,202,176,0.3)] active:scale-90 transition-transform"
                  >
                    {state.isPlaying || (isSlideshow && state.slideshowIsPlaying) ? (
                      <Pause size={24} fill="currentColor" />
                    ) : (
                      <Play size={24} fill="currentColor" className="ml-1" />
                    )}
                  </button>
                  <button onClick={actions.handleNext} className="p-2 text-white/80 active:scale-90 transition-transform">
                    <SkipForward size={24} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Swipe Up Handle (Always visible when drawer closed) */}
        {!isDrawerOpen && (
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1 z-50 p-4 cursor-pointer opacity-70 pb-[calc(env(safe-area-inset-bottom)+1rem)] bottom-0"
            onClick={(e) => { e.stopPropagation(); setIsDrawerOpen(true); }}
          >
            <ChevronUp size={20} className="text-white animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white shadow-black drop-shadow-md">Chapters</span>
          </div>
        )}
      </motion.div>

      {/* Swipe-Up Chapter Drawer */}
      <ChapterDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        state={state} 
        actions={actions}
        onChangeCourse={onEndSession}
      />

    </div>
  );
};
