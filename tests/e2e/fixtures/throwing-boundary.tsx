import React from 'react';
import { mountApp } from '../../../src/utils/boot';

function ChildThatThrows() {
  // Throw synchronously during FIRST render
  throw new Error('Simulated runtime error inside boundary');
  
  return <div data-testid="safe-child">Waiting to throw...</div>;
}

mountApp({
  container: document.getElementById('root'),
  AppComponent: ChildThatThrows,
  platform: 'web',
  tauriLoader: async () => ({ invoke: async () => {} }),
  storage: { setItem: () => {} }
});
