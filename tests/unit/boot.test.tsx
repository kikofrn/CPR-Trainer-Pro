import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('boot splash logic', () => {
  let forceCloseSplash: any;
  let mountApp: any;
  let handleFatalError: any;

  beforeEach(async () => {
    vi.resetModules();
    const bootModule = await import('../../src/utils/boot');
    forceCloseSplash = bootModule.forceCloseSplash;
    mountApp = bootModule.mountApp;
    handleFatalError = bootModule.handleFatalError;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const DummyApp = () => null;

  it('1. mountApp() with container: null, Tauri platform: missing-container raw-fatal variant recorded; loader called; await completion; invoke called exactly with close_splashscreen', async () => {
    const invokeMock = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: invokeMock });
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await mountApp({
      container: null,
      AppComponent: DummyApp,
      platform: 'tauri',
      tauriLoader,
      storage,
      rawFatalAdapter
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith(
      'missing-container',
      'FATAL: Application container (#root) not found.',
      null
    );
    expect(tauriLoader).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('close_splashscreen');
  });

  it('2. The same missing-container branch on web: raw-fatal variant still recorded; loader never called; splash storage not written.', async () => {
    const tauriLoader = vi.fn();
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await mountApp({
      container: null,
      AppComponent: DummyApp,
      platform: 'web',
      tauriLoader,
      storage,
      rawFatalAdapter
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith(
      'missing-container',
      expect.any(String),
      null
    );
    expect(tauriLoader).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('3. mountApp() with fake container/handler/root that throws synchronously, on Tauri: React Render Crash recorded; loader and exact invoke observed.', async () => {
    const invokeMock = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: invokeMock });
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };
    const container = {} as HTMLElement;
    const rootFactory = vi.fn().mockImplementation(() => {
      throw new Error('Sync crash');
    });

    await mountApp({
      container,
      AppComponent: DummyApp,
      platform: 'tauri',
      tauriLoader,
      storage,
      rawFatalAdapter,
      globalHandlerInstaller: vi.fn(),
      rootFactory
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith(
      'React Render Crash',
      expect.stringContaining('Sync crash'),
      container
    );
    expect(tauriLoader).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('close_splashscreen');
  });

  it('4. The same synchronous failure on web: raw-fatal recorded; loader never called.', async () => {
    const tauriLoader = vi.fn();
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };
    const container = {} as HTMLElement;
    const rootFactory = vi.fn().mockImplementation(() => {
      throw new Error('Sync crash');
    });

    await mountApp({
      container,
      AppComponent: DummyApp,
      platform: 'web',
      tauriLoader,
      storage,
      rawFatalAdapter,
      globalHandlerInstaller: vi.fn(),
      rootFactory
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith(
      'React Render Crash',
      expect.stringContaining('Sync crash'),
      container
    );
    expect(tauriLoader).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('5. Extracted global-error orchestration while rootOwned === false on Tauri: correct Uncaught Error structured variant; await exact invoke.', async () => {
    const invokeMock = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: invokeMock });
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await handleFatalError({
      variant: 'Uncaught Error',
      message: 'Some error message',
      originalError: new Error('Some error'),
      isRootOwned: false,
      platform: 'tauri',
      tauriLoader,
      storage,
      rawFatalAdapter,
      container: null
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith('Uncaught Error', 'Some error message', null);
    expect(tauriLoader).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('close_splashscreen');
  });

  it('6. Extracted unhandled-rejection orchestration while rootOwned === false on Tauri: correct Unhandled Promise Rejection structured variant; await exact invoke.', async () => {
    const invokeMock = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: invokeMock });
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await handleFatalError({
      variant: 'Unhandled Promise Rejection',
      message: 'Promise rejected',
      originalError: 'Promise rejected',
      isRootOwned: false,
      platform: 'tauri',
      tauriLoader,
      storage,
      rawFatalAdapter,
      container: null
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith('Unhandled Promise Rejection', 'Promise rejected', null);
    expect(tauriLoader).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('close_splashscreen');
  });

  it('7. Web mirrors of both global branches: correct raw-fatal variant; loader never called.', async () => {
    const tauriLoader = vi.fn();
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await handleFatalError({
      variant: 'Uncaught Error',
      message: 'Web uncaught',
      originalError: new Error('Web uncaught'),
      isRootOwned: false,
      platform: 'web',
      tauriLoader,
      storage,
      rawFatalAdapter,
      container: null
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith('Uncaught Error', 'Web uncaught', null);
    expect(tauriLoader).not.toHaveBeenCalled();

    await handleFatalError({
      variant: 'Unhandled Promise Rejection',
      message: 'Web promise',
      originalError: 'Web promise',
      isRootOwned: false,
      platform: 'web',
      tauriLoader,
      storage,
      rawFatalAdapter,
      container: null
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith('Unhandled Promise Rejection', 'Web promise', null);
    expect(tauriLoader).not.toHaveBeenCalled();
  });

  it('8. Handler-installation proof: injected installer records both global handlers; no real window access occurs in node tests.', async () => {
    const globalHandlerInstaller = vi.fn();
    const container = {} as HTMLElement;
    const rootFactory = vi.fn().mockReturnValue({ render: vi.fn() });

    await mountApp({
      container,
      AppComponent: DummyApp,
      platform: 'web',
      tauriLoader: vi.fn(),
      storage: {},
      globalHandlerInstaller,
      rootFactory
    });

    expect(globalHandlerInstaller).toHaveBeenCalledWith('error', expect.any(Function));
    expect(globalHandlerInstaller).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
  });

  it('9. Post-root behavior: fatal orchestration closes the splash in Tauri mode but does not invoke the raw-fatal adapter once rootOwned is true.', async () => {
    const invokeMock = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke: invokeMock });
    const storage = { setItem: vi.fn() };
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await handleFatalError({
      variant: 'Uncaught Error',
      message: 'After root owned',
      originalError: new Error('After root owned'),
      isRootOwned: true,
      platform: 'tauri',
      tauriLoader,
      storage,
      rawFatalAdapter,
      container: null
    });

    // Should NOT call raw-fatal adapter
    expect(rawFatalAdapter.renderFatal).not.toHaveBeenCalled();
    // But SHOULD close splash
    expect(tauriLoader).toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith('close_splashscreen');
  });

  it('10. Missing-container keeps the historical silent console contract.', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rawFatalAdapter = { renderFatal: vi.fn() };

    await mountApp({
      container: null,
      AppComponent: DummyApp,
      platform: 'web',
      tauriLoader: vi.fn(),
      storage: { setItem: vi.fn() },
      rawFatalAdapter
    });

    expect(rawFatalAdapter.renderFatal).toHaveBeenCalledWith(
      'missing-container',
      'FATAL: Application container (#root) not found.',
      null
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['Uncaught Error', '[FATAL] Uncaught Error:'],
    ['Unhandled Promise Rejection', '[FATAL] Unhandled Promise Rejection:'],
    ['React Render Crash', '[FATAL] React Render Crash:']
  ] as const)('11. %s keeps its exact historical console prefix.', async (variant, prefix) => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalError = new Error(`test ${variant}`);

    await handleFatalError({
      variant,
      message: originalError.message,
      originalError,
      isRootOwned: true,
      platform: 'web',
      tauriLoader: vi.fn(),
      storage: {},
      rawFatalAdapter: { renderFatal: vi.fn() },
      container: null
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(prefix, originalError);
  });

  it('12. A synchronous Tauri loader throw logs the historical splash-invoke failure.', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaderError = new Error('sync loader failure');
    const tauriLoader = vi.fn(() => { throw loaderError; });

    await expect(forceCloseSplash('tauri', tauriLoader, { setItem: vi.fn() })).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[FATAL] Failed to invoke close_splashscreen', loaderError);
  });

  it('13. An asynchronously rejected Tauri loader settles silently.', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const tauriLoader = vi.fn().mockRejectedValue(new Error('async loader failure'));

    await expect(forceCloseSplash('tauri', tauriLoader, { setItem: vi.fn() })).resolves.toBeUndefined();

    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('14. An asynchronously rejected splash invoke settles silently.', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const invoke = vi.fn().mockRejectedValue(new Error('async invoke failure'));
    const tauriLoader = vi.fn().mockResolvedValue({ invoke });

    await expect(forceCloseSplash('tauri', tauriLoader, { setItem: vi.fn() })).resolves.toBeUndefined();

    expect(invoke).toHaveBeenCalledWith('close_splashscreen');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('15. A splash-status storage failure logs once and still invokes splash closure.', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const storageError = new Error('storage failure');
    const storage = { setItem: vi.fn(() => { throw storageError; }) };
    const invoke = vi.fn().mockResolvedValue(undefined);
    const tauriLoader = vi.fn().mockResolvedValue({ invoke });

    await expect(forceCloseSplash('tauri', tauriLoader, storage)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[FATAL] Failed to set splash_status', storageError);
    expect(invoke).toHaveBeenCalledWith('close_splashscreen');
  });
});
