import React, { useEffect, useState } from 'react';
import { mountApp } from '../../../src/utils/boot';

function ChildThatThrows() {
  const [shouldThrow, setShouldThrow] = useState(false);
  
  useEffect(() => {
    // Throw after mount to trigger ErrorBoundary, not a root render crash
    setTimeout(() => setShouldThrow(true), 100);
  }, []);

  if (shouldThrow) {
    throw new Error('Simulated runtime error inside boundary');
  }

  return <div data-testid="safe-child">Waiting to throw...</div>;
}

mountApp({
  container: document.getElementById('root'),
  AppComponent: ChildThatThrows,
  platform: 'web'
});
