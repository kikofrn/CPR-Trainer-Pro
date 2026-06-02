import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SkipBack, SkipForward, Play, Pause, Projector, VolumeX, Volume2, Maximize2, Lightbulb } from 'lucide-react';
import { cdnUrl } from '../media-resolver';
import { INSTRUCTOR_TIPS } from '../instructor-tips';

interface SlideshowPlayerProps {
  activeSlideshow: any;
  activeSlide: any;
  activeSlideIndex: number;
  setActiveSlideshowIndex: (i: number | null) => void;
  
  isUiVisible: boolean;
  slideshowContainerRef: React.RefObject<any>;
  slideVideoRef: React.RefObject<any>;
  
  isMuted: boolean;
  setIsMuted: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  
  prevSlide: () => void;
  nextSlide: () => void;
  
  slideshowIsPlaying: boolean;
  toggleSlideshowPlay: () => void;
  
  m: (path: string) => string;
  fileStatuses: Record<string, boolean>;
}

/**
 * Resolve the display URL for a slide.
 * - If the file is downloaded locally, use the local media:// protocol URL (works offline).
 * - If NOT downloaded and it's an image, use the CDN URL (loads instantly from Cloudflare).
 * - Videos always use local URL (they must be downloaded first to stream).
 */
function resolveSlideUrl(slide: any, m: (path: string) => string, fileStatuses: Record<string, boolean>): string {
  const clean = slide.filename?.trim().replace(/^\//, '') || '';
  const isDownloaded = !!fileStatuses[clean];
  
  if (slide.type === 'image' && !isDownloaded) {
    return cdnUrl(slide.filename);
  }
  return m(slide.filename);
}

export function SlideshowPlayer({
  activeSlideshow, activeSlide, activeSlideIndex, setActiveSlideshowIndex,
  isUiVisible, slideshowContainerRef, slideVideoRef,
  isMuted, setIsMuted, volume, setVolume,
  prevSlide, nextSlide,
  slideshowIsPlaying, toggleSlideshowPlay,
  m, fileStatuses
}: SlideshowPlayerProps) {
  const [showTips, setShowTips] = useState(false);

  if (!activeSlideshow || !activeSlide) return null;

  return (
    <div ref={slideshowContainerRef} className="w-full h-full relative z-10">
      <div className={`w-full h-full relative bg-black flex flex-col items-center justify-center ${!isUiVisible ? 'cursor-none' : ''}`}>
        <div className={`absolute top-6 right-6 z-50 flex items-center gap-4 transition-opacity duration-500 ${!isUiVisible || showTips ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <button 
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(console.error);
              } else {
                if (slideVideoRef.current) slideVideoRef.current.pause();
                setActiveSlideshowIndex(null);
              }
            }}
            className="p-3 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red shadow-lg backdrop-blur-md cursor-pointer"
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
                src={resolveSlideUrl(activeSlide, m, fileStatuses)} 
                alt={activeSlide.title} 
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                ref={slideVideoRef}
                src={resolveSlideUrl(activeSlide, m, fileStatuses)}
                className="w-full h-full object-contain"
                muted={isMuted}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Preload adjacent slideshow assets in the background */}
        <div className="hidden" aria-hidden="true">
          {activeSlideshow.slides.map((s: any, idx: number) => {
            if (Math.abs(idx - activeSlideIndex) <= 1 && idx !== activeSlideIndex) {
              return s.type === 'image' ? (
                <img key={s.id} src={resolveSlideUrl(s, m, fileStatuses)} loading="eager" alt="preload" />
              ) : (
                <video key={s.id} src={resolveSlideUrl(s, m, fileStatuses)} preload="auto" muted />
              );
            }
            return null;
          })}
        </div>

        {/* Instructor Tips Overlay */}
        <AnimatePresence>
          {showTips && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className={`absolute top-0 right-0 w-full md:w-1/3 max-w-md h-full bg-black/70 backdrop-blur-xl border-l border-white/10 p-8 pt-24 overflow-y-auto z-40 transition-opacity duration-500 ${!isUiVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Lightbulb className="text-eh-peach" size={24} />
                  <h2 className="text-xl font-semibold text-white tracking-wide">Instructor Tips</h2>
                </div>
                <button
                  onClick={() => setShowTips(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white cursor-pointer"
                  title="Close Tips"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="space-y-4 text-eh-peach/90 text-sm leading-relaxed pb-32">
                {INSTRUCTOR_TIPS[activeSlideshow.id]?.[activeSlide.id] ? (
                  INSTRUCTOR_TIPS[activeSlideshow.id][activeSlide.id].map((paragraph, idx) => {
                    const renderText = (text: string) => {
                      let parts = text.split(/(\*\*.*?\*\*)/g);
                      return parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
                        }
                        let italicParts = part.split(/(\*.*?\*)/g);
                        return italicParts.map((ip, j) => {
                          if (ip.startsWith('*') && ip.endsWith('*')) {
                            return <em key={`${i}-${j}`} className="text-eh-blue italic">{ip.slice(1, -1)}</em>;
                          }
                          return ip;
                        });
                      });
                    };
                    
                    return (
                      <p key={idx} className={paragraph.startsWith('-') ? 'pl-4 relative before:content-["•"] before:absolute before:left-0 before:text-eh-peach/50' : ''}>
                        {renderText(paragraph.startsWith('- ') ? paragraph.substring(2) : paragraph)}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-white/40 italic">No notes available for this slide.</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Controls Overlay */}
        <div className={`absolute bottom-0 left-0 right-0 p-8 pt-20 bg-gradient-to-t from-black via-black/60 to-transparent z-20 pointer-events-none transition-opacity duration-500 ${!isUiVisible ? 'opacity-0' : 'opacity-100'}`}>
          <div className="max-w-4xl mx-auto pointer-events-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-8">
                <button 
                  onClick={prevSlide} 
                  disabled={activeSlideIndex === 0}
                  className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90 cursor-pointer disabled:cursor-default"
                  title="Previous Slide"
                >
                  <SkipBack size={28} />
                </button>
                
                {activeSlide.type === 'video' ? (
                  <button 
                    onClick={toggleSlideshowPlay}
                    className="w-16 h-16 bg-eh-peach text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-white/5 cursor-pointer"
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
                  className="p-3 hover:bg-eh-peach/10 rounded-full text-eh-peach/80 disabled:opacity-10 transition-all active:scale-90 cursor-pointer disabled:cursor-default"
                  title="Next Slide"
                >
                  <SkipForward size={28} />
                </button>

                <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block"></div>

                <div className="hidden md:block">
                  <p className="text-eh-peach/40 text-[10px] uppercase tracking-widest font-bold mb-1">Slide {activeSlideIndex + 1} of {activeSlideshow.slides.length}</p>
                  <p className="text-sm font-medium text-eh-peach/80 line-clamp-1">
                    {activeSlide.title}
                  </p>
                </div>

                <button
                  onClick={() => setShowTips(!showTips)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all cursor-pointer ${showTips ? 'bg-green-500/5 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.15)]' : 'hover:bg-eh-peach/10 border border-transparent'}`}
                  title="Toggle Instructor Tips"
                >
                  <Lightbulb size={24} className={showTips ? 'text-green-500 fill-green-500/20 drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'text-eh-peach/80'} />
                  <span className="text-sm font-medium hidden lg:block text-eh-peach/80">Tips</span>
                </button>
              </div>

              <div className="flex-1"></div>

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
                )}
                <button 
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      slideshowContainerRef.current?.requestFullscreen().catch(console.error);
                    } else {
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
      </div>
    </div>
  );
}
