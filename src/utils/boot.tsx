import React, { StrictMode, useEffect } from 'react';
import { createRoot as defaultCreateRoot } from 'react-dom/client';
import { ErrorBoundary } from '../components/ErrorBoundary';

let rootOwned = false;
let appReady = false;

export function getRootOwned() {
  return rootOwned;
}

export type TauriLoader = () => Promise<{ invoke: (cmd: string, args?: any) => Promise<any> }>;

// Awaitable splash-close contract
export async function forceCloseSplash(platform: 'web' | 'tauri', loader: TauriLoader, storage: any): Promise<void> {
  if (platform !== 'tauri') return;
  try {
    storage.setItem('splash_status', 'ready');
  } catch (e) {
    console.error('[FATAL] Failed to set splash_status', e);
  }

  let loadPromise: ReturnType<TauriLoader>;
  try {
    loadPromise = loader();
  } catch (e) {
    console.error('[FATAL] Failed to invoke close_splashscreen', e);
    return;
  }

  let tauriModule: Awaited<ReturnType<TauriLoader>>;
  try {
    tauriModule = await loadPromise;
  } catch {
    return;
  }

  try {
    await tauriModule.invoke('close_splashscreen');
  } catch {
    // Historical behavior: asynchronous loader/invoke failures settle silently.
  }
}

// Sentinel component to detect successful mount
function Sentinel({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

// Production Fallback UI
function FallbackUI() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw', backgroundColor: '#000', color: 'white', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '64px', height: '64px', backgroundColor: 'rgba(255, 75, 75, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff4b4b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 style={{ color: '#fff', marginTop: 0, fontSize: '20px', fontWeight: 'bold', letterSpacing: '0.05em', textTransform: 'uppercase' }}>App Stopped</h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '32px', lineHeight: '1.5' }}>
          The Everyday Hero Academy app encountered an unexpected error.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '14px 32px', backgroundColor: '#ff4b4b', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', width: '100%', boxShadow: '0 4px 14px rgba(255, 75, 75, 0.4)' }}
        >
          Reload App
        </button>
      </div>
    </div>
  );
}

export type FatalVariant = 'missing-container' | 'Uncaught Error' | 'Unhandled Promise Rejection' | 'React Render Crash';

export interface RawFatalAdapter {
  renderFatal(variant: FatalVariant, message: string, container?: HTMLElement | null): void;
}

export const defaultRawFatalAdapter: RawFatalAdapter = {
  renderFatal: (variant, message, container) => {
    if (variant === 'missing-container') {
      const fatal = document.createElement('div');
      fatal.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-family:sans-serif';
      fatal.textContent = message;
      document.body.appendChild(fatal);
    } else {
      if (container) {
        container.textContent = '';
        const pre = document.createElement('pre');
        pre.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:90vh;overflow:auto';
        pre.textContent = `${variant}\n\n${message}`;
        container.appendChild(pre);
      }
    }
  }
};

export type GlobalHandlerInstaller = (
  type: 'error' | 'unhandledrejection',
  handler: (event: any) => void
) => void;

export const defaultGlobalHandlerInstaller: GlobalHandlerInstaller = (type, handler) => {
  window.addEventListener(type, handler);
};

export type RootFactory = (container: HTMLElement | DocumentFragment, options?: any) => any;

export async function handleFatalError({
  variant,
  message,
  originalError,
  isRootOwned,
  platform,
  tauriLoader,
  storage,
  rawFatalAdapter,
  container
}: {
  variant: FatalVariant;
  message: string;
  originalError: any;
  isRootOwned: boolean;
  platform: 'web' | 'tauri';
  tauriLoader: TauriLoader;
  storage: any;
  rawFatalAdapter: RawFatalAdapter;
  container?: HTMLElement | null;
}) {
  if (variant !== 'missing-container') {
    console.error(`[FATAL] ${variant}:`, originalError);
  }

  const splashPromise = forceCloseSplash(platform, tauriLoader, storage);

  if (!isRootOwned) {
    rawFatalAdapter.renderFatal(variant, message, container);
  }

  await splashPromise;
}

export async function mountApp({
  container,
  AppComponent,
  platform,
  tauriLoader,
  storage,
  globalHandlerInstaller = defaultGlobalHandlerInstaller,
  rootFactory = defaultCreateRoot,
  rawFatalAdapter = defaultRawFatalAdapter
}: {
  container: HTMLElement | null,
  AppComponent: React.ComponentType,
  platform: 'web' | 'tauri',
  tauriLoader: TauriLoader,
  storage: any,
  globalHandlerInstaller?: GlobalHandlerInstaller,
  rootFactory?: RootFactory,
  rawFatalAdapter?: RawFatalAdapter
}) {
  if (!container) {
    await handleFatalError({
      variant: 'missing-container',
      message: 'FATAL: Application container (#root) not found.',
      originalError: new Error('Container not found'),
      isRootOwned: false,
      platform,
      tauriLoader,
      storage,
      rawFatalAdapter,
      container
    });
    return;
  }

  globalHandlerInstaller('error', (event: any) => {
    void handleFatalError({
      variant: 'Uncaught Error',
      message: event.error?.stack || event.error?.message || String(event.error),
      originalError: event.error,
      isRootOwned: rootOwned,
      platform,
      tauriLoader,
      storage,
      rawFatalAdapter,
      container
    });
  });

  globalHandlerInstaller('unhandledrejection', (event: any) => {
    void handleFatalError({
      variant: 'Unhandled Promise Rejection',
      message: event.reason?.stack || event.reason?.message || String(event.reason),
      originalError: event.reason,
      isRootOwned: rootOwned,
      platform,
      tauriLoader,
      storage,
      rawFatalAdapter,
      container
    });
  });

  try {
    const root = rootFactory(container, {
      onUncaughtError: (error: any, errorInfo: any) => {
        console.error('React Uncaught Error:', error, errorInfo);
        void forceCloseSplash(platform, tauriLoader, storage);
      },
      onCaughtError: (error: any, errorInfo: any) => {
        console.error('React Caught Error (Boundary):', error, errorInfo);
      }
    });

    root.render(
      <StrictMode>
        <ErrorBoundary fallback={<FallbackUI />}>
          <AppComponent />
          <Sentinel onReady={() => {
            appReady = true;
            container.setAttribute('data-app-ready', 'true');
          }} />
        </ErrorBoundary>
      </StrictMode>
    );

    rootOwned = true;
  } catch (e: any) {
    await handleFatalError({
      variant: 'React Render Crash',
      message: e?.stack || e?.message || String(e),
      originalError: e,
      isRootOwned: false,
      platform,
      tauriLoader,
      storage,
      rawFatalAdapter,
      container
    });
  }
}
