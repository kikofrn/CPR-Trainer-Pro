import { Lightbulb, Maximize2, Pause, Play, Projector, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

interface MobileSlideshowControlsProps {
  visible: boolean;
  title: string;
  index: number;
  count: number;
  isVideo: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  showTips: boolean;
  fullscreenAvailable: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onToggleTips: () => void;
  setIsMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  onToggleFullscreen: () => void;
}

export default function MobileSlideshowControls({
  visible,
  title,
  index,
  count,
  isVideo,
  isPlaying,
  isMuted,
  volume,
  showTips,
  fullscreenAvailable,
  onPrevious,
  onNext,
  onTogglePlay,
  onToggleTips,
  setIsMuted,
  setVolume,
  onToggleFullscreen,
}: MobileSlideshowControlsProps) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pt-16 transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-xl flex-col gap-2" data-swipe-exempt>
        <p data-testid="slideshow-counter" className="truncate text-center text-[10px] font-bold uppercase tracking-widest text-eh-peach/55"><span>Slide {index + 1} of {count}</span><span aria-hidden="true"> · {title}</span></p>
        <div className="flex items-center justify-center gap-8">
          <button type="button" onClick={onPrevious} disabled={index === 0} aria-label="Previous slide" title="Previous Slide" className="mobile-coarse-target rounded-full text-eh-peach/80 disabled:opacity-20 focus-visible:outline-2 focus-visible:outline-eh-blue"><SkipBack size={26} /></button>
          {isVideo ? (
            <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause slideshow video' : 'Play slideshow video'} title={isPlaying ? 'Pause Video Slide' : 'Play Video Slide'} className="mobile-coarse-target flex h-12 w-12 items-center justify-center rounded-full bg-eh-peach text-black focus-visible:outline-2 focus-visible:outline-eh-blue">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
          ) : (
            <div role="img" aria-label="Static image slide" title="Static Image Slide" className="flex h-12 w-12 items-center justify-center rounded-full border border-eh-peach/15 text-eh-peach/70"><Projector size={23} /></div>
          )}
          <button type="button" onClick={onNext} disabled={index === count - 1} aria-label="Next slide" title="Next Slide" className="mobile-coarse-target rounded-full text-eh-peach/80 disabled:opacity-20 focus-visible:outline-2 focus-visible:outline-eh-blue"><SkipForward size={26} /></button>
        </div>
        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={onToggleTips} aria-label={showTips ? 'Hide instructor tips' : 'Show instructor tips'} aria-pressed={showTips} className="mobile-coarse-target rounded-full text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue"><Lightbulb size={22} /></button>
          {isVideo && (
            <button type="button" onClick={() => {
              if (isMuted || volume === 0) {
                setIsMuted(false);
                if (volume === 0) setVolume(1);
              } else setIsMuted(true);
            }} aria-label={isMuted || volume === 0 ? 'Unmute slideshow sound' : 'Mute slideshow sound'} className="mobile-coarse-target rounded-full text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue">
              {isMuted || volume === 0 ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
          )}
          {fullscreenAvailable && (
            <button type="button" onClick={onToggleFullscreen} aria-label="Toggle slideshow fullscreen" className="mobile-coarse-target rounded-full text-eh-peach/80 focus-visible:outline-2 focus-visible:outline-eh-blue"><Maximize2 size={22} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
