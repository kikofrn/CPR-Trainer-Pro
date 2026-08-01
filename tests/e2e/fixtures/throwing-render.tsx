import { mountApp } from '../../../src/utils/boot';

function ThrowingApp() {
  throw new Error("Simulated first-render error");
  return <div>Will not render</div>;
}

mountApp({
  container: document.getElementById('root'),
  AppComponent: ThrowingApp,
  platform: 'web'
});
