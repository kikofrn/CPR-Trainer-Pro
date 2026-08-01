import { isTauri } from '../media-resolver';
import type { WebviewWindow as TauriWebviewWindow } from '@tauri-apps/api/webviewWindow';

let presenterWindow: TauriWebviewWindow | null = null;
let isStarting = false;
let lifecycleToken = 0;
let activeStartToken = 0;
let unlistenPresenterClose: (() => void) | null = null;
let unlistenMainClose: (() => void) | null = null;

// --- Cached event API import ---
let eventApiPromise: Promise<typeof import('@tauri-apps/api/event')> | null = null;

function getEventApi() {
  eventApiPromise ??= import('@tauri-apps/api/event');
  return eventApiPromise;
}

function sameMonitor(a: any, b: any): boolean {
  if (!a || !b) return false;
  return (
    a.position?.x === b.position?.x &&
    a.position?.y === b.position?.y &&
    a.size?.width === b.size?.width &&
    a.size?.height === b.size?.height &&
    a.scaleFactor === b.scaleFactor
  );
}

function clearPresenterListeners() {
  unlistenPresenterClose?.();
  unlistenMainClose?.();
  unlistenPresenterClose = null;
  unlistenMainClose = null;
}

/**
 * Bounded label-release wait: polls until the 'presenter-viewer' label is
 * available or the timeout expires. More deterministic than a fixed sleep.
 */
async function waitForPresenterLabelRelease(timeoutMs = 1000): Promise<boolean> {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    const existing = await WebviewWindow.getByLabel('presenter-viewer');
    if (!existing) return true;
    await new Promise((r) => setTimeout(r, 50));
  }

  return false;
}

/**
 * Timeout-bounded wait for native window creation.
 * Prevents isStarting from getting stuck forever if neither
 * tauri://created nor tauri://error fires.
 */
async function waitForWindowCreated(
  win: TauriWebviewWindow,
  timeoutMs = 8000
): Promise<boolean> {
  return Promise.race([
    new Promise<boolean>((resolve) => {
      win.once('tauri://created', () => resolve(true));
      win.once('tauri://error', (e: unknown) => {
        console.error('[presenter] Window creation failed:', e);
        resolve(false);
      });
    }),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

/**
 * Two-phase readiness waiter:
 * Phase 1 (awaited): import event API AND register the listener.
 *   listen() is awaited, so the listener is FULLY registered before this function returns.
 * Phase 2 (returned promise): resolves when viewer emits viewer:ready with matching session.
 *
 * Returns { promise, cancel } for deterministic cleanup on early returns.
 *
 * finish is assigned before setTimeout is scheduled, and listen() is awaited
 * before returning, so there is no initialization ordering ambiguity.
 */
async function createViewerReadyWaiter(
  sessionId: string,
  timeoutMs = 8000
): Promise<{ promise: Promise<boolean>; cancel: () => void }> {
  const { listen } = await getEventApi();

  let done = false;
  let unlisten: (() => void) | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let resolvePromise!: (value: boolean) => void;

  const finish = (value: boolean) => {
    if (done) return;
    done = true;
    if (timeout) clearTimeout(timeout);
    unlisten?.();
    resolvePromise(value);
  };

  const promise = new Promise<boolean>((resolve) => {
    resolvePromise = resolve;
  });

  // Schedule timeout AFTER finish is assigned
  timeout = setTimeout(() => finish(false), timeoutMs);

  // Await listen — the listener is fully registered when this resolves
  try {
    unlisten = await listen<{ sessionId?: string }>('viewer:ready', (event) => {
      if (event.payload?.sessionId === sessionId) finish(true);
    });
    // If finish() was already called (e.g. timeout during slow listen), clean up
    if (done) unlisten();
  } catch {
    finish(false);
  }

  return {
    promise,
    cancel: () => finish(false),
  };
}

export async function canPresent(): Promise<boolean> {
  if (!isTauri) return false;
  try {
    const { availableMonitors } = await import('@tauri-apps/api/window');
    return (await availableMonitors()).length > 1;
  } catch (e) {
    console.error('[presenter] Monitor check failed:', e);
    return false;
  }
}

export async function startPresenting(
  onDisconnect?: () => void
): Promise<boolean> {
  if (!isTauri) return false;
  if (presenterWindow || isStarting) return presenterWindow !== null;

  const token = ++lifecycleToken;
  activeStartToken = token;
  isStarting = true;

  let readyWaiter: { promise: Promise<boolean>; cancel: () => void } | null = null;

  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const {
      availableMonitors, currentMonitor, getCurrentWindow,
      PhysicalPosition, PhysicalSize,
    } = await import('@tauri-apps/api/window');

    // Close any stale window from a previous session
    const existing = await WebviewWindow.getByLabel('presenter-viewer');
    if (existing) {
      await existing.close();
      const released = await waitForPresenterLabelRelease();
      if (!released) {
        console.error('[presenter] Presenter window label did not release in time');
        return false;
      }
    }

    if (token !== lifecycleToken) { await stopPresenting(); return false; }

    const monitors = await availableMonitors();
    if (monitors.length < 2) return false;

    const current = await currentMonitor();
    let external = current
      ? monitors.find((m) => !sameMonitor(m, current))
      : monitors[1];
    external = external ?? monitors[1] ?? monitors[0];

    console.info('[presenter] Selected external monitor:', {
      name: external.name,
      position: external.position,
      size: external.size,
      scaleFactor: external.scaleFactor,
    });

    const sessionId = crypto.randomUUID?.()
      ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Phase 1: attach listener — awaits listen() so registration is COMPLETE
    readyWaiter = await createViewerReadyWaiter(sessionId);

    if (token !== lifecycleToken) {
      readyWaiter.cancel();
      await stopPresenting();
      return false;
    }

    // Now create the window — the listener is guaranteed to exist
    presenterWindow = new WebviewWindow('presenter-viewer', {
      url: `/presenter-viewer.html?session=${encodeURIComponent(sessionId)}`,
      title: 'CPR Trainer Pro - Presenter Display',
      decorations: false,
      resizable: false,
      visible: false,
      fullscreen: false,
    });

    // Timeout-bounded native window creation wait
    const created = await waitForWindowCreated(presenterWindow);

    if (!created) {
      console.error('[presenter] Window creation timed out or failed');
      readyWaiter.cancel();
      await stopPresenting();
      return false;
    }

    if (token !== lifecycleToken) {
      readyWaiter.cancel();
      await stopPresenting();
      return false;
    }

    await presenterWindow.setPosition(
      new PhysicalPosition(external.position.x, external.position.y)
    );
    await presenterWindow.setSize(
      new PhysicalSize(external.size.width, external.size.height)
    );

    // Register cleanup BEFORE showing — external close invalidates lifecycle
    unlistenPresenterClose = await presenterWindow.onCloseRequested(() => {
      lifecycleToken++;
      readyWaiter?.cancel();
      presenterWindow = null;
      clearPresenterListeners();
      onDisconnect?.();
    });

    unlistenMainClose = await getCurrentWindow().onCloseRequested(async () => {
      await stopPresenting();
    });

    await presenterWindow.show();

    try {
      await (presenterWindow as any).setSimpleFullscreen(true);
    } catch {
      // Not available — borderless full-size window is fine for external monitor
    }

    if (token !== lifecycleToken) {
      readyWaiter.cancel();
      await stopPresenting();
      return false;
    }

    // Phase 2: wait for the viewer to signal readiness
    const ready = await readyWaiter.promise;

    if (token !== lifecycleToken) { await stopPresenting(); return false; }

    if (!ready) {
      console.error('[presenter] Viewer did not become ready in time');
      await stopPresenting();
      return false;
    }

    return true;
  } catch (e) {
    console.error('[presenter] Failed to start presenting:', e);
    readyWaiter?.cancel();
    await stopPresenting();
    return false;
  } finally {
    if (activeStartToken === token) {
      isStarting = false;
      activeStartToken = 0;
    }
  }
}

export async function stopPresenting(): Promise<void> {
  lifecycleToken++;
  const win = presenterWindow;
  presenterWindow = null;
  clearPresenterListeners();
  try {
    if (win) await win.close();
  } catch (e) {
    console.error('[presenter] Failed to close presenter window:', e);
  }
}

export async function sendToViewer(
  event: string,
  payload?: unknown
): Promise<boolean> {
  if (!isTauri || !presenterWindow) return false;
  try {
    const { emitTo } = await getEventApi();
    await emitTo('presenter-viewer', event, payload);
    return true;
  } catch (e) {
    console.error(`[presenter] Failed to send ${event}:`, e);
    return false;
  }
}

export function isPresenting(): boolean {
  return presenterWindow !== null;
}
