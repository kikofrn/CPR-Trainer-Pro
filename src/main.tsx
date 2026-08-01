import App from './App.tsx';
import './index.css';
import { mountApp } from './utils/boot';
import { isTauri } from './media-resolver';

mountApp({
  container: document.getElementById('root'),
  AppComponent: App,
  platform: isTauri ? 'tauri' : 'web'
});
