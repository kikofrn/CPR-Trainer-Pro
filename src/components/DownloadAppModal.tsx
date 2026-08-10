import { useEffect, useMemo, useRef } from 'react';
import { Download, Laptop, MonitorDown, Smartphone, X } from 'lucide-react';
import { motion } from 'framer-motion';

import { APP_DOWNLOADS, type DownloadPlatform } from '../config/downloads';
import { detectDownloadPlatform } from '../utils/platform-detect';

interface DownloadAppModalProps {
  onClose: () => void;
}

const platformIcons: Record<DownloadPlatform, typeof Laptop> = {
  windows: MonitorDown,
  macos: Laptop,
  ios: Smartphone,
};

export function DownloadAppModal({ onClose }: DownloadAppModalProps) {
  const detectedPlatform = useMemo(() => detectDownloadPlatform(), []);
  const primaryPlatform = useMemo(
    () => APP_DOWNLOADS.find(option => option.platform === detectedPlatform && option.url)?.platform
      ?? APP_DOWNLOADS.find(option => option.url)?.platform
      ?? null,
    [detectedPlatform],
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const primaryActionRef = useRef<HTMLElement | null>(null);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (primaryActionRef.current ?? closeButtonRef.current)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      priorFocusRef.current?.focus();
    };
  }, []);

  return (
    <motion.div
      data-testid="download-app-backdrop"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-app-title"
        data-testid="download-app-dialog"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border border-eh-peach/20 bg-[#0a0a0a]/95 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
      >
        <div className="relative border-b border-white/10 p-8 pb-6 text-center">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close download dialog"
            className="absolute right-5 top-5 rounded-full p-2 text-white/45 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-eh-red/20 bg-eh-red/10 shadow-[0_0_20px_rgba(245,57,78,0.2)]">
            <Download size={30} className="text-eh-red" />
          </div>
          <h2 id="download-app-title" className="text-2xl font-black tracking-tight text-white">
            Download the app for offline use
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Keep your training materials ready when an internet connection is not available.
          </p>
        </div>

        <div className="space-y-3 p-6">
          {APP_DOWNLOADS.map(option => {
            const Icon = platformIcons[option.platform];
            const isDetected = option.platform === detectedPlatform;
            const isPrimary = option.platform === primaryPlatform;

            return (
              <div
                key={option.platform}
                data-download-platform={option.platform}
                className={`flex min-h-[72px] items-center gap-4 rounded-2xl border px-4 py-3 transition-colors ${
                  isDetected ? 'border-eh-red/35 bg-eh-red/5' : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  option.url ? 'bg-white/10 text-eh-peach' : 'bg-white/5 text-white/25'
                }`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${option.url ? 'text-white' : 'text-white/35'}`}>{option.label}</span>
                    {isDetected && (
                      <span className="rounded-full bg-eh-red/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-eh-red">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">
                    {option.subtitle}
                  </p>
                </div>

                {option.url === null ? (
                  <button
                    type="button"
                    disabled
                    className="shrink-0 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-white/25 cursor-not-allowed"
                  >
                    Coming soon
                  </button>
                ) : (
                  <a
                    ref={isPrimary ? element => { primaryActionRef.current = element; } : undefined}
                    href={option.url}
                    target={option.openInNewTab ? '_blank' : undefined}
                    rel={option.openInNewTab ? 'noopener noreferrer' : undefined}
                    className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                      isPrimary ? 'bg-eh-red text-white hover:bg-eh-red-dark' : 'border border-white/15 text-white hover:bg-white/10'
                    }`}
                  >
                    {option.actionLabel}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
