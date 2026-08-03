import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Loader2, Play, RotateCcw, SkipForward, WifiOff } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export type WebSlideshowMediaStatus =
  | 'image-loading'
  | 'image-ready'
  | 'video-loading'
  | 'video-playing'
  | 'video-paused'
  | 'autoplay-denied'
  | 'retrying'
  | 'failed'
  | 'offline';

export interface WebSlideshowControls {
  toggle(): void;
  retry(): void;
}

interface WebSlideshowMediaProps {
  slideshowId: string;
  slide: any;
  slideIndex: number;
  url: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  controlsRef: React.MutableRefObject<WebSlideshowControls | null>;
  muted: boolean;
  volume: number;
  isOnline: boolean;
  onPlayingChange: (playing: boolean) => void;
  onEnded: () => void;
  onSkip: () => void;
}

type Cleanup = () => void;

const retryDelays = [2_000, 4_000, 8_000] as const;

function mediaFailure(video: HTMLVideoElement): string {
  if (video.error?.code === MediaError.MEDIA_ERR_ABORTED) return 'Media loading was aborted.';
  if (video.error?.code === MediaError.MEDIA_ERR_NETWORK) return 'The browser reported a media network failure.';
  if (video.error?.code === MediaError.MEDIA_ERR_DECODE) return 'The browser could not decode this video.';
  if (video.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) return 'The browser does not support this video source.';
  return 'The video could not be loaded.';
}

function autoplayDenied(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError';
}

export function WebSlideshowMedia({
  slideshowId,
  slide,
  slideIndex,
  url,
  videoRef,
  controlsRef,
  muted,
  volume,
  isOnline,
  onPlayingChange,
  onEnded,
  onSkip,
}: WebSlideshowMediaProps) {
  const permanentVideoRef = useRef<HTMLVideoElement | null>(null);
  const generationRef = useRef(0);
  const ownershipRef = useRef(0);
  const cleanupRef = useRef<Cleanup>(() => undefined);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentRetryRef = useRef<() => void>(() => undefined);
  const statusRef = useRef<WebSlideshowMediaStatus>(slide.type === 'image' ? 'image-loading' : 'video-loading');
  const [status, setStatusValue] = useState<WebSlideshowMediaStatus>(statusRef.current);
  const [failure, setFailure] = useState('');
  const [resumeRequired, setResumeRequired] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [image, setImage] = useState<{ url: string; title: string; ready: boolean; token: number }>({
    url: slide.type === 'image' ? url : '',
    title: slide.type === 'image' ? slide.title : '',
    ready: false,
    token: 0,
  });

  const setStatus = (next: WebSlideshowMediaStatus) => {
    statusRef.current = next;
    setStatusValue(next);
  };

  const clearTransitionTimer = () => {
    if (transitionTimerRef.current !== null) clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
  };

  const detachCurrent = () => {
    cleanupRef.current();
    cleanupRef.current = () => undefined;
    clearTransitionTimer();
  };

  const clearVideo = (expectedOwnership?: number) => {
    const video = permanentVideoRef.current;
    if (!video || (expectedOwnership !== undefined && ownershipRef.current !== expectedOwnership)) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
  };

  const beginImage = (generation: number, nextUrl: string, title: string) => {
    detachCurrent();
    const video = permanentVideoRef.current;
    video?.pause();
    onPlayingChange(false);
    setResumeRequired(false);
    setFailure('');
    setStatus('image-loading');
    setImage(previous => ({ url: nextUrl, title, ready: false, token: previous.token + 1 }));
    currentRetryRef.current = () => {
      const nextGeneration = ++generationRef.current;
      beginImage(nextGeneration, nextUrl, title);
    };
    cleanupRef.current = () => {
      if (generationRef.current === generation) onPlayingChange(false);
    };
  };

  const beginVideo = (
    generation: number,
    nextUrl: string,
    attempt: number,
    shouldAutoplay: boolean,
    forceResume: boolean,
  ) => {
    detachCurrent();
    const video = permanentVideoRef.current;
    if (!video || generation !== generationRef.current) return;
    const ownership = ++ownershipRef.current;
    let disposed = false;
    let ready = false;
    let playResolved = false;
    let playDenied = false;
    let readinessTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const listeners: Array<[string, EventListener]> = [];
    const owns = () => !disposed
      && generationRef.current === generation
      && ownershipRef.current === ownership
      && permanentVideoRef.current === video
      && video.src === nextUrl;
    const listen = (type: string, listener: EventListener) => {
      video.addEventListener(type, listener);
      listeners.push([type, listener]);
    };
    const removeListeners = () => {
      for (const [type, listener] of listeners) video.removeEventListener(type, listener);
      listeners.length = 0;
      if (readinessTimer !== null) clearTimeout(readinessTimer);
      if (retryTimer !== null) clearTimeout(retryTimer);
      if (stallTimer !== null) clearTimeout(stallTimer);
      readinessTimer = null;
      retryTimer = null;
      stallTimer = null;
    };
    const resetOwnedVideo = () => {
      if (ownershipRef.current !== ownership) return;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
    const finishFailure = (message: string, offline: boolean) => {
      if (!owns()) return;
      removeListeners();
      resetOwnedVideo();
      setVideoVisible(false);
      onPlayingChange(false);
      setResumeRequired(false);
      setFailure(message);
      setStatus(offline ? 'offline' : 'failed');
    };
    const scheduleRetry = (message: string) => {
      if (!owns()) return;
      if (!isOnline) {
        finishFailure('You are offline. Reconnect to reload this video.', true);
        return;
      }
      removeListeners();
      resetOwnedVideo();
      onPlayingChange(false);
      if (attempt >= retryDelays.length) {
        setVideoVisible(false);
        setFailure(message);
        setStatus('failed');
        return;
      }
      setStatus('retrying');
      const delay = retryDelays[attempt];
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (generationRef.current !== generation || ownershipRef.current !== ownership) return;
        beginVideo(generation, nextUrl, attempt + 1, shouldAutoplay, forceResume);
      }, delay);
    };
    const installStallMonitoring = () => {
      const recover = () => {
        if (!owns() || video.paused) return;
        if (stallTimer !== null) clearTimeout(stallTimer);
        stallTimer = null;
        setStatus('video-playing');
      };
      const stall = () => {
        if (!owns() || video.paused) return;
        if (stallTimer !== null) clearTimeout(stallTimer);
        stallTimer = setTimeout(() => {
          stallTimer = null;
          if (owns()) beginVideo(generation, nextUrl, 0, true, false);
        }, 10_000);
      };
      for (const type of ['progress', 'timeupdate', 'playing']) listen(type, recover);
      for (const type of ['waiting', 'stalled']) listen(type, stall);
      listen('error', () => scheduleRetry(mediaFailure(video)));
    };
    const commitIfReady = () => {
      if (!owns() || !ready) return;
      if (shouldAutoplay && !forceResume && !playResolved && !playDenied) return;
      removeListeners();
      setVideoVisible(true);
      setFailure('');
      if (playResolved && !playDenied && !forceResume) {
        video.muted = muted;
        video.volume = muted ? 0 : volume;
        setStatus('video-playing');
        setResumeRequired(false);
        onPlayingChange(true);
        installStallMonitoring();
      } else {
        video.pause();
        setStatus(playDenied ? 'autoplay-denied' : 'video-paused');
        setResumeRequired(playDenied || forceResume);
        onPlayingChange(false);
      }
      transitionTimerRef.current = setTimeout(() => {
        transitionTimerRef.current = null;
        if (generationRef.current === generation && ownershipRef.current === ownership) {
          setImage(previous => ({ ...previous, ready: false }));
        }
      }, 400);
    };
    const markReady = () => {
      if (!owns()) return;
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) ready = true;
      commitIfReady();
    };
    listen('canplay', () => {
      if (!owns()) return;
      ready = true;
      commitIfReady();
    });
    listen('loadeddata', markReady);
    listen('playing', () => {
      if (!owns()) return;
      ready = true;
      playResolved = true;
      commitIfReady();
    });
    listen('error', () => scheduleRetry(mediaFailure(video)));
    listen('abort', () => scheduleRetry('Video loading was aborted.'));

    video.muted = muted;
    video.volume = 0;
    video.playsInline = true;
    video.src = nextUrl;
    video.load();
    setVideoVisible(false);
    setFailure('');
    setResumeRequired(false);
    setStatus(attempt === 0 ? 'video-loading' : 'retrying');
    onPlayingChange(false);
    readinessTimer = setTimeout(() => scheduleRetry('Video readiness timed out.'), 15_000);
    if (shouldAutoplay && !forceResume) {
      void video.play().then(() => {
        if (!owns()) return;
        playResolved = true;
        commitIfReady();
      }).catch(error => {
        if (!owns()) return;
        if (autoplayDenied(error)) {
          playDenied = true;
          commitIfReady();
        } else {
          scheduleRetry(mediaFailure(video));
        }
      });
    }
    markReady();
    currentRetryRef.current = () => {
      const nextGeneration = ++generationRef.current;
      beginVideo(nextGeneration, nextUrl, 0, true, false);
    };
    cleanupRef.current = () => {
      disposed = true;
      removeListeners();
      video.pause();
      onPlayingChange(false);
    };
  };

  useEffect(() => {
    const generation = ++generationRef.current;
    if (slide.type === 'image') beginImage(generation, url, slide.title);
    else beginVideo(generation, url, 0, true, false);
    return () => detachCurrent();
  }, [slideshowId, slide.id, slide.type, slideIndex, url]);

  useEffect(() => {
    const video = permanentVideoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = muted ? 0 : volume;
  }, [muted, volume]);

  useEffect(() => {
    if (!isOnline && slide.type === 'video' && ['video-loading', 'retrying'].includes(statusRef.current)) {
      const generation = ++generationRef.current;
      detachCurrent();
      clearVideo();
      setVideoVisible(false);
      onPlayingChange(false);
      setFailure('You are offline. Reconnect to reload this video.');
      setStatus('offline');
      currentRetryRef.current = () => beginVideo(generation, url, 0, false, true);
    } else if (isOnline && statusRef.current === 'offline' && slide.type === 'video') {
      const generation = ++generationRef.current;
      beginVideo(generation, url, 0, false, true);
    }
  }, [isOnline]);

  useEffect(() => () => {
    ++generationRef.current;
    detachCurrent();
    clearVideo();
    controlsRef.current = null;
  }, []);

  const retry = () => currentRetryRef.current();
  const toggle = () => {
    const video = permanentVideoRef.current;
    if (!video || slide.type !== 'video') return;
    if (statusRef.current === 'failed' || statusRef.current === 'offline') {
      retry();
      return;
    }
    if (!video.paused) {
      video.pause();
      onPlayingChange(false);
      setResumeRequired(false);
      setStatus('video-paused');
      return;
    }
    video.muted = muted;
    video.volume = muted ? 0 : volume;
    void video.play().then(() => {
      if (slide.type !== 'video') return;
      onPlayingChange(true);
      setResumeRequired(false);
      setStatus('video-playing');
    }).catch(error => {
      onPlayingChange(false);
      if (autoplayDenied(error)) {
        setResumeRequired(true);
        setStatus('autoplay-denied');
      } else {
        setFailure(mediaFailure(video));
        setStatus('failed');
      }
    });
  };
  controlsRef.current = { toggle, retry };

  const imageOnLoad = () => {
    if (slide.type !== 'image' || image.url !== url) return;
    const generation = generationRef.current;
    setImage(previous => ({ ...previous, ready: true }));
    setFailure('');
    setStatus('image-ready');
    transitionTimerRef.current = setTimeout(() => {
      transitionTimerRef.current = null;
      if (generationRef.current !== generation || slide.type !== 'image') return;
      setVideoVisible(false);
      clearVideo();
    }, 400);
  };

  const imageOnError = () => {
    if (slide.type !== 'image' || image.url !== url) return;
    setFailure(isOnline ? 'This slide image could not be loaded.' : 'You are offline. Reconnect to reload this slide.');
    setStatus(isOnline ? 'failed' : 'offline');
    onPlayingChange(false);
  };

  const loading = ['video-loading', 'image-loading', 'retrying'].includes(status);
  const failed = status === 'failed' || status === 'offline';

  return (
    <div className="absolute inset-0 z-10 overflow-hidden bg-black" data-slideshow-media-state={status}>
      <video
        ref={element => {
          permanentVideoRef.current = element;
          videoRef.current = element;
        }}
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-400 ${videoVisible ? 'z-20 opacity-100' : 'z-0 opacity-0'}`}
        muted={muted}
        playsInline
        onEnded={() => {
          onPlayingChange(false);
          setStatus('video-paused');
          onEnded();
        }}
      />

      <AnimatePresence mode="wait">
        {image.url && image.ready && (
          <motion.img
            key={`${image.url}-${image.token}`}
            src={image.url}
            alt={image.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="absolute inset-0 z-10 h-full w-full object-contain"
          />
        )}
      </AnimatePresence>
      {slide.type === 'image' && (
        <img
          key={`${image.url}-${image.token}-loader`}
          src={image.url}
          alt=""
          aria-hidden="true"
          onLoad={imageOnLoad}
          onError={imageOnError}
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      )}

      {loading && (
        <div className={`absolute z-30 flex items-center gap-3 rounded-xl border border-eh-blue/30 bg-black/85 px-5 py-4 shadow-2xl backdrop-blur-md ${videoVisible || image.ready ? 'left-6 top-6' : 'inset-0 justify-center rounded-none border-0'}`} role="status">
          <Loader2 className="h-6 w-6 animate-spin text-eh-blue" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-blue-light">
              {status === 'retrying' ? 'Retrying media' : 'Loading slide'}
            </p>
            <p className="mt-1 text-sm font-bold text-eh-peach">{slide.title}</p>
          </div>
        </div>
      )}

      {failed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-8 backdrop-blur-sm" role="alert">
          <div className="max-w-md rounded-2xl border border-eh-red/30 bg-black/90 p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              {status === 'offline' ? <WifiOff className="h-7 w-7 shrink-0 text-eh-blue" /> : <AlertTriangle className="h-7 w-7 shrink-0 text-eh-red" />}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-red">{status === 'offline' ? 'You are offline' : 'Slide unavailable'}</p>
                <p className="mt-2 text-sm leading-relaxed text-eh-peach/70">{failure}</p>
                <div className="mt-5 flex gap-3">
                  <button onClick={retry} className="flex items-center gap-2 rounded-full bg-eh-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white cursor-pointer">
                    <RotateCcw size={14} /> Retry
                  </button>
                  <button onClick={onSkip} className="flex items-center gap-2 rounded-full border border-eh-peach/20 px-5 py-2 text-xs font-black uppercase tracking-wider text-eh-peach cursor-pointer">
                    Skip <SkipForward size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {resumeRequired && !failed && !loading && (
        <div className="absolute left-6 top-6 z-30 rounded-xl border border-eh-blue/30 bg-black/85 p-4 shadow-2xl backdrop-blur-md" role="status">
          <p className="text-xs font-bold text-eh-peach">This video is ready and paused.</p>
          <button onClick={toggle} className="mt-3 flex items-center gap-2 rounded-full bg-eh-blue px-5 py-2 text-xs font-black uppercase tracking-wider text-white cursor-pointer">
            <Play size={14} fill="currentColor" /> Play
          </button>
        </div>
      )}
    </div>
  );
}
