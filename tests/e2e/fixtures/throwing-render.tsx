import { mountApp } from '../../../src/utils/boot';

// The HTML fixture has no #root, so this returns null and triggers the missing container check.
mountApp({
  container: document.getElementById('root'),
  AppComponent: () => null,
  platform: 'web',
  tauriLoader: async () => ({ invoke: async () => {} }),
  storage: { setItem: () => {} }
});
