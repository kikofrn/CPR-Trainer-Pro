import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Force close splash screen — called on any fatal error
function forceCloseSplash() {
  localStorage.setItem('splash_status', 'ready');
  // Try to invoke the Rust close_splashscreen command
  import('@tauri-apps/api/core').then(({ invoke }) => {
    invoke('close_splashscreen').catch(() => {});
  }).catch(() => {});
}

// Show error visually in the main window
function showError(label: string, err: any) {
  const msg = err?.stack || err?.message || String(err);
  console.error(`[FATAL] ${label}:`, err);
  forceCloseSplash();
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<pre style="color:#ff4b4b;background:#111;padding:32px;margin:32px;border-radius:12px;font-size:13px;white-space:pre-wrap;word-break:break-word;max-height:90vh;overflow:auto"><strong>${label}</strong>\n\n${msg}</pre>`;
  }
}

window.addEventListener('error', (event) => showError('Uncaught Error', event.error));
window.addEventListener('unhandledrejection', (event) => showError('Unhandled Promise Rejection', event.reason));

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} catch (e) {
  showError('React Render Crash', e);
}
