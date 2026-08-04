import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle2, SkipForward, SkipBack, Play, Pause, VolumeX, Volume2, Maximize2, Loader2, AlertTriangle, WifiOff } from 'lucide-react';
import type { MediaControllerState } from '../media-selection-controller';
import { safeStorage } from '../utils/safe-storage';

interface VideoPlayerProps {
  activeCourse: any;
  activeChapter: any;
  activeChapterIndex: number;
  onClose: () => void;
  isMobileWeb: boolean;
  selectChapter: (i: number) => void;
  
  isUiVisible: boolean;
  videoContainerRef: React.RefObject<any>;
  
  videoRefA: React.RefObject<any>;
  videoRefB: React.RefObject<any>;
  activePlayer: 'A' | 'B';
  videoRef: React.RefObject<any>; // Current active video ref
  
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  
  handleEnded: () => void;
  handleTimeUpdate: (target: any) => void;
  
  showSubtitles: boolean;
  setShowSubtitles: (v: boolean) => void;
  activeCue: any;
  
  showNextOverlay: boolean;
  handleNext: () => void;
  handlePrev: () => void;
  
  progress: number;
  setProgress: (v: number) => void;
  
  isPlaying: boolean;
  togglePlay: () => void;
  
  playbackRate: number;
  setPlaybackRate: (v: number) => void;
  mediaState?: MediaControllerState;
  pendingChapterTitle?: string;
  failedChapterTitle?: string;
  retryFailedChapter?: () => void;
  resumeChapter?: () => void;
  replayChapter?: () => void;
}

export const VideoPlayer = React.memo(function VideoPlayer({
  activeCourse, activeChapter, activeChapterIndex, onClose, isMobileWeb, selectChapter,
  isUiVisible, videoContainerRef, videoRefA, videoRefB, activePlayer, videoRef,
  isMuted, setIsMuted, volume, setVolume,
  handleEnded, handleTimeUpdate,
  showSubtitles, setShowSubtitles, activeCue,
  showNextOverlay, handleNext, handlePrev,
  progress, setProgress, isPlaying, togglePlay,
  playbackRate, setPlaybackRate,
  mediaState, pendingChapterTitle, failedChapterTitle,
  retryFailedChapter, resumeChapter, replayChapter,
}: VideoPlayerProps) {
  if (!activeCourse) return null;

  if (activeCourse.isComingSoon) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 w-full h-full bg-black/80">
        <button 
          onClick={onClose}
          aria-label="Close course"
          className={`absolute top-6 right-6 p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red z-50 cursor-pointer ${isMobileWeb ? 'mobile-coarse-target' : ''}`}
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
    );
  }

  return (
    <div ref={videoContainerRef} className={`w-full h-full relative bg-black ${isMobileWeb ? 'mobile-video-stage' : ''} ${!isUiVisible ? 'cursor-none' : ''}`}>
      {/* Close Video Button */}
      <div className={`absolute top-6 right-6 z-50 flex items-center gap-4 transition-opacity duration-500 ${!isUiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(console.error);
            } else {
              onClose();
            }
          }}
          aria-label="Close course"
          className={`p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red shadow-lg backdrop-blur-md cursor-pointer ${isMobileWeb ? 'mobile-coarse-target' : ''}`}
        >
          <X size={24} />
        </button>
      </div>

      {activeChapter && (
        <div className="w-full h-full relative">
          {/* Video Player A */}
          <video
            ref={videoRefA}
            data-media-slot="A"
            data-media-active={activePlayer === 'A'}
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
            onError={(e) => {
              console.warn('[VideoPlayer] Video A load/playback error:', e);
            }}
          />
          {/* Video Player B */}
          <video
            ref={videoRefB}
            data-media-slot="B"
            data-media-active={activePlayer === 'B'}
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
            onError={(e) => {
              console.warn('[VideoPlayer] Video B load/playback error:', e);
            }}
          />
        </div>
      )}

      {mediaState?.pendingSelection && (
        <div
          className={`absolute z-40 flex items-center gap-3 rounded-xl border border-eh-blue/30 bg-black/85 px-5 py-4 shadow-2xl backdrop-blur-md ${
            mediaState.committedSelection ? 'left-6 top-6 max-w-sm' : 'inset-0 justify-center rounded-none border-0'
          }`}
          role="status"
          aria-live="polite"
          data-media-state={mediaState.playbackState}
        >
          <Loader2 className="h-6 w-6 shrink-0 animate-spin text-eh-blue" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-blue-light">
              {mediaState.playbackState === 'retrying' ? 'Retrying media' : 'Loading chapter'}
            </p>
            <p className="mt-1 text-sm font-bold text-eh-peach">{pendingChapterTitle ?? 'Requested chapter'}</p>
          </div>
        </div>
      )}

      {mediaState?.failedRequest && (
        <div
          className={`absolute z-40 rounded-xl border border-eh-red/30 bg-black/90 p-5 shadow-2xl backdrop-blur-md ${
            mediaState.committedSelection ? 'left-6 top-6 max-w-md' : 'inset-0 flex items-center justify-center rounded-none border-0'
          }`}
          role="alert"
          data-media-state={mediaState.playbackState}
        >
          <div className="flex max-w-md items-start gap-4">
            {mediaState.failedRequest.failure.kind === 'offline'
              ? <WifiOff className="mt-0.5 h-6 w-6 shrink-0 text-eh-blue" />
              : <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-eh-red" />}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-red">
                {mediaState.failedRequest.failure.kind === 'offline' ? 'You are offline' : 'Chapter unavailable'}
              </p>
              <p className="mt-1 text-sm font-bold text-eh-peach">{failedChapterTitle ?? 'Requested chapter'}</p>
              <p className="mt-2 text-xs leading-relaxed text-eh-peach/60">{mediaState.failedRequest.failure.message}</p>
              <button
                onClick={retryFailedChapter}
                className="mt-4 rounded-full bg-eh-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-eh-red-dark cursor-pointer"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaState?.resumeRequired && !mediaState.pendingSelection && !mediaState.failedRequest && (
        <div className="absolute left-6 top-6 z-40 rounded-xl border border-eh-blue/30 bg-black/85 p-4 shadow-2xl backdrop-blur-md" role="status">
          <p className="text-xs font-bold text-eh-peach">Playback is ready and paused.</p>
          <button
            onClick={resumeChapter}
            className="mt-3 rounded-full bg-eh-blue px-5 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-eh-blue-light cursor-pointer"
          >
            Resume
          </button>
        </div>
      )}

      {/* Premium High-Contrast Subtitle Overlay */}
      {showSubtitles && activeCue && (
        <div className={`absolute left-1/2 transform -translate-x-1/2 z-30 w-full max-w-2xl px-4 pointer-events-none flex justify-center ${isMobileWeb ? 'mobile-subtitles' : 'bottom-28'}`}>
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
                  onClick={() => replayChapter ? replayChapter() : selectChapter(activeChapterIndex)}
                  className="px-8 py-3 bg-eh-peach/5 hover:bg-eh-peach/10 border border-eh-peach/10 rounded-full text-sm font-semibold transition-all text-eh-peach cursor-pointer"
                >
                  Replay Section
                </button>
                {activeChapterIndex < activeCourse.chapters.length - 1 && (
                  <button 
                    onClick={handleNext}
                    className="px-10 py-4 bg-eh-red hover:bg-eh-red-dark text-eh-peach rounded-full text-sm font-black shadow-2xl shadow-eh-red/40 transition-all flex items-center justify-center gap-3 group active:scale-95 cursor-pointer"
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
      {isMobileWeb ? (
        <div
          className={`mobile-video-controls absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pt-16 transition-opacity duration-200 ${!isUiVisible ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
          onPointerDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
          data-testid="mobile-video-controls"
        >
          <label className="block min-h-11 w-full py-4">
            <span className="sr-only">Video progress</span>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              disabled={!Number.isFinite(videoRef.current?.duration) || videoRef.current.duration <= 0}
              aria-label="Video progress"
              onChange={event => {
                const value = Number(event.currentTarget.value);
                const duration = videoRef.current?.duration;
                if (videoRef.current && Number.isFinite(duration) && duration > 0) {
                  videoRef.current.currentTime = (value / 100) * duration;
                  setProgress(value);
                }
              }}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-eh-red disabled:cursor-not-allowed disabled:opacity-40"
            />
          </label>
          <div className="grid grid-cols-3 items-center justify-items-center gap-4">
            <button type="button" onClick={handlePrev} disabled={activeChapterIndex === 0} aria-label="Previous section" className="mobile-coarse-target rounded-full text-eh-peach/80 disabled:opacity-20 focus-visible:outline-2 focus-visible:outline-eh-blue">
              <SkipBack size={28} />
            </button>
            <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Pause narration' : 'Play narration'} className="flex h-16 w-16 items-center justify-center rounded-full bg-eh-peach text-black shadow-2xl focus-visible:outline-2 focus-visible:outline-eh-blue">
              {isPlaying ? <Pause size={31} fill="currentColor" /> : <Play size={31} fill="currentColor" className="ml-1" />}
            </button>
            <button type="button" onClick={handleNext} disabled={activeChapterIndex === activeCourse.chapters.length - 1} aria-label="Next section" className="mobile-coarse-target rounded-full text-eh-peach/80 disabled:opacity-20 focus-visible:outline-2 focus-visible:outline-eh-blue">
              <SkipForward size={28} />
            </button>
          </div>
          <div className="mt-2 grid grid-cols-4 items-center justify-items-center border-t border-white/10 pt-1">
            <button
              type="button"
              onClick={() => {
                if (volume === 0 || isMuted) {
                  setIsMuted(false);
                  if (volume === 0) setVolume(1);
                } else setIsMuted(true);
              }}
              aria-label={isMuted || volume === 0 ? 'Unmute sound' : 'Mute sound'}
              className="mobile-coarse-target rounded-full text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue"
            >
              {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            <button type="button" onClick={() => {
              const rates = [1, 1.25, 1.5, 2];
              setPlaybackRate(rates[(rates.indexOf(playbackRate) + 1) % rates.length]);
            }} aria-label={`Playback speed ${playbackRate} times`} className="mobile-coarse-target rounded-full font-mono text-xs font-black text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue">{playbackRate}x</button>
            <button type="button" onClick={() => {
              const next = !showSubtitles;
              setShowSubtitles(next);
              safeStorage.setItem('eh_show_subtitles', String(next));
            }} aria-label={showSubtitles ? 'Disable subtitles' : 'Enable subtitles'} aria-pressed={showSubtitles} className={`mobile-coarse-target rounded-full focus-visible:outline-2 focus-visible:outline-eh-blue ${showSubtitles ? 'text-eh-red' : 'text-eh-peach/80'}`}>
              <span className="rounded border-2 px-1.5 py-0.5 text-[10px] font-black">CC</span>
            </button>
            <button type="button" onClick={() => {
              if (!document.fullscreenElement && videoContainerRef.current) void videoContainerRef.current.requestFullscreen().catch(console.error);
              else if (document.fullscreenElement) void document.exitFullscreen().catch(console.error);
            }} aria-label="Toggle fullscreen view" className="mobile-coarse-target rounded-full text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue">
              <Maximize2 size={22} />
            </button>
          </div>
        </div>
      ) : (
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
                className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90 cursor-pointer disabled:cursor-default"
                title="Previous Section"
              >
                <SkipBack size={28} />
              </button>
              
              <button 
                onClick={togglePlay}
                className="w-16 h-16 bg-eh-peach text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5 cursor-pointer"
                title={isPlaying ? "Pause Narration" : "Play Narration"}
              >
                {isPlaying ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />}
              </button>

              <button 
                onClick={handleNext}
                disabled={activeChapterIndex === activeCourse.chapters.length - 1}
                className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90 cursor-pointer disabled:cursor-default"
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
                  className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all z-10 cursor-pointer"
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
                className="p-2 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all font-mono font-bold text-xs w-10 h-10 flex items-center justify-center border border-transparent hover:border-eh-peach/20 cursor-pointer"
                title="Playback Speed"
              >
                {playbackRate}x
              </button>

              <button 
                onClick={() => {
                  const nextVal = !showSubtitles;
                  setShowSubtitles(nextVal);
                  safeStorage.setItem('eh_show_subtitles', String(nextVal));
                }}
                className={`p-3 hover:bg-eh-peach/10 rounded-full transition-all flex items-center justify-center cursor-pointer ${showSubtitles ? 'text-eh-red' : 'text-eh-peach/80'}`}
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
                  if (!document.fullscreenElement && videoContainerRef.current) {
                    videoContainerRef.current.requestFullscreen()
                      .catch((err: any) => console.error(err));
                  } else if (document.fullscreenElement) {
                    document.exitFullscreen().catch(console.error);
                  }
                }}
                className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 transition-all cursor-pointer"
                title="Toggle Fullscreen View"
              >
                <Maximize2 size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
});
