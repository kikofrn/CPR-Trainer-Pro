import React, { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { isTauri } from '../media-resolver';
import { safeStorage } from './safe-storage';

let rootOwned = false;
let appReady = false;

// Force close splash screen — called on any fatal error
export function forceCloseSplash() {
  if (!isTauri) return;
  try {
    safeStorage.setItem('splash_status', 'ready');
  } catch (e) {
    console.error('[FATAL] Failed to set splash_status', e);
  }
  try {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('close_splashscreen').catch(() => {});
    }).catch(() => {});
  } catch (e) {
    console.error('[FATAL] Failed to invoke close_splashscreen', e);
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

export function mountApp({ 
  container, 
  AppComponent, 
  platform 
}: { 
  container: HTMLElement | null, 
  AppComponent: React.ComponentType, 
  platform: 'web' | 'tauri' 
}) {
  if (!container) {
    // Missing #root container
    const fatal = document.createElement('div');
    fatal.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-family:sans-serif';
    fatal.textContent = 'FATAL: Application container (#root) not found.';
    document.body.appendChild(fatal);
    return;
  }

  // Set up global error handlers
  window.addEventListener('error', (event) => {
    console.error('[FATAL] Uncaught Error:', event.error);
    if (platform === 'tauri') forceCloseSplash();
    
    if (!rootOwned) {
      container.textContent = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:90vh;overflow:auto';
      pre.textContent = `Uncaught Error\n\n${event.error?.stack || event.error?.message || String(event.error)}`;
      container.appendChild(pre);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[FATAL] Unhandled Promise Rejection:', event.reason);
    if (platform === 'tauri') forceCloseSplash();
    
    if (!rootOwned) {
      container.textContent = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:90vh;overflow:auto';
      pre.textContent = `Unhandled Promise Rejection\n\n${event.reason?.stack || event.reason?.message || String(event.reason)}`;
      container.appendChild(pre);
    }
  });

  try {
    const root = createRoot(container, {
      onUncaughtError: (error, errorInfo) => {
        console.error('React Uncaught Error:', error, errorInfo);
        if (platform === 'tauri') forceCloseSplash();
      },
      onCaughtError: (error, errorInfo) => {
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

    // If render didn't throw synchronously, we own the root
    rootOwned = true;
  } catch (e) {
    console.error('[FATAL] React Render Crash:', e);
    if (platform === 'tauri') forceCloseSplash();
    if (!rootOwned) {
      container.textContent = '';
      const pre = document.createElement('pre');
      pre.style.cssText = 'color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:90vh;overflow:auto';
      pre.textContent = `React Render Crash\n\n${(e as Error)?.stack || (e as Error)?.message || String(e)}`;
      container.appendChild(pre);
    }
  }
}
