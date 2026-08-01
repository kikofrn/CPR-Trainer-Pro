import App from './App.tsx';
import './index.css';
import { mountApp } from './utils/boot';
import { isTauri } from './media-resolver';

import { safeStorage } from './utils/safe-storage';

mountApp({
  container: document.getElementById('root'),
  AppComponent: App,
  platform: isTauri ? 'tauri' : 'web',
  tauriLoader: () => import('@tauri-apps/api/core'),
  storage: safeStorage
});
