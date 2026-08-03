export type MediaSlot = 'A' | 'B';

export type MediaPlaybackState =
  | 'idle'
  | 'loading'
  | 'retrying'
  | 'ready-paused'
  | 'playing'
  | 'autoplay-denied'
  | 'stalled'
  | 'failed'
  | 'offline';

export interface MediaSelection {
  key: string;
  url: string;
  courseId: string;
  chapterId: string;
  courseIndex: number;
  chapterIndex: number;
}

export interface MediaFailure {
  kind: 'aborted' | 'network' | 'decode' | 'source-not-supported' | 'playback' | 'timeout' | 'offline';
  message: string;
  mediaErrorCode?: number;
}

export interface FailedMediaRequest {
  selection: MediaSelection;
  failure: MediaFailure;
  automaticRetries: number;
  playbackIntent: boolean;
}

export interface MediaControllerState {
  committedSelection: MediaSelection | null;
  pendingSelection: MediaSelection | null;
  failedRequest: FailedMediaRequest | null;
  playbackIntent: boolean;
  playbackState: MediaPlaybackState;
  resumeRequired: boolean;
  generation: number;
  activeSlot: MediaSlot;
}

export interface MediaElementPort {
  src: string;
  readyState: number;
  paused: boolean;
  muted: boolean;
  volume: number;
  playbackRate: number;
  currentTime: number;
  error: { code: number; message?: string } | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

export interface MediaControllerOptions {
  elements: Record<MediaSlot, MediaElementPort>;
  onStateChange?: (state: MediaControllerState) => void;
  onCommit?: (selection: MediaSelection, slot: MediaSlot, state: MediaControllerState) => void;
  isOnline?: () => boolean;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  readinessTimeoutMs?: number;
  stallTimeoutMs?: number;
  crossfadeMs?: number;
  retryDelaysMs?: readonly number[];
  targetVolume?: number;
  muted?: boolean;
  playbackRate?: number;
}

type Ownership = {
  generation: number;
  epoch: number;
  slot: MediaSlot;
  source: string;
};

type ListenerRecord = { type: string; listener: () => void };

type PendingRequest = {
  generation: number;
  selection: MediaSelection;
  slot: MediaSlot;
  owner: Ownership;
  playbackIntent: boolean;
  forceResume: boolean;
  automaticRetries: number;
  ready: boolean;
  playResolved: boolean;
  playDenied: boolean;
  listeners: ListenerRecord[];
  readinessTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
};

const HAVE_FUTURE_DATA = 3;

function copySelection(selection: MediaSelection | null): MediaSelection | null {
  return selection ? { ...selection } : null;
}

function copyState(state: MediaControllerState): MediaControllerState {
  return {
    ...state,
    committedSelection: copySelection(state.committedSelection),
    pendingSelection: copySelection(state.pendingSelection),
    failedRequest: state.failedRequest
      ? {
          ...state.failedRequest,
          selection: { ...state.failedRequest.selection },
          failure: { ...state.failedRequest.failure },
        }
      : null,
  };
}

export function classifyMediaFailure(element: MediaElementPort, error?: unknown): MediaFailure {
  const mediaCode = element.error?.code;
  if (mediaCode === 1) return { kind: 'aborted', message: 'Media loading was aborted.', mediaErrorCode: mediaCode };
  if (mediaCode === 2) return { kind: 'network', message: 'The browser reported a media network failure.', mediaErrorCode: mediaCode };
  if (mediaCode === 3) return { kind: 'decode', message: 'The browser could not decode this media.', mediaErrorCode: mediaCode };
  if (mediaCode === 4) return { kind: 'source-not-supported', message: 'The browser does not support this media source.', mediaErrorCode: mediaCode };
  const message = error instanceof Error && error.message ? error.message : 'Media playback failed.';
  return { kind: 'playback', message };
}

function isAutoplayDenial(error: unknown): boolean {
  return error instanceof Error && error.name === 'NotAllowedError';
}

export class MediaSelectionController {
  private readonly elements: Record<MediaSlot, MediaElementPort>;
  private readonly onStateChange?: MediaControllerOptions['onStateChange'];
  private readonly onCommit?: MediaControllerOptions['onCommit'];
  private readonly isOnline: () => boolean;
  private readonly setTimer: NonNullable<MediaControllerOptions['setTimer']>;
  private readonly clearTimer: NonNullable<MediaControllerOptions['clearTimer']>;
  private readonly readinessTimeoutMs: number;
  private readonly stallTimeoutMs: number;
  private readonly crossfadeMs: number;
  private readonly retryDelaysMs: readonly number[];
  private targetVolume: number;
  private muted: boolean;
  private playbackRate: number;
  private ownershipEpoch = 0;
  private pending: PendingRequest | null = null;
  private owners: Partial<Record<MediaSlot, Ownership>> = {};
  private cleanupTimers = new Set<ReturnType<typeof setTimeout>>();
  private activeListeners: ListenerRecord[] = [];
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private state: MediaControllerState = {
    committedSelection: null,
    pendingSelection: null,
    failedRequest: null,
    playbackIntent: false,
    playbackState: 'idle',
    resumeRequired: false,
    generation: 0,
    activeSlot: 'A',
  };

  constructor(options: MediaControllerOptions) {
    this.elements = options.elements;
    this.onStateChange = options.onStateChange;
    this.onCommit = options.onCommit;
    this.isOnline = options.isOnline ?? (() => true);
    this.setTimer = options.setTimer ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearTimer = options.clearTimer ?? (timer => clearTimeout(timer));
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 15_000;
    this.stallTimeoutMs = options.stallTimeoutMs ?? 10_000;
    this.crossfadeMs = options.crossfadeMs ?? 500;
    this.retryDelaysMs = options.retryDelaysMs ?? [2_000, 4_000, 8_000];
    this.targetVolume = options.targetVolume ?? 1;
    this.muted = options.muted ?? false;
    this.playbackRate = options.playbackRate ?? 1;
  }

  getState(): MediaControllerState {
    return copyState(this.state);
  }

  updatePlaybackSettings(settings: { volume?: number; muted?: boolean; playbackRate?: number }): void {
    if (settings.volume !== undefined) this.targetVolume = settings.volume;
    if (settings.muted !== undefined) this.muted = settings.muted;
    if (settings.playbackRate !== undefined) this.playbackRate = settings.playbackRate;
    const active = this.elements[this.state.activeSlot];
    active.muted = this.muted;
    active.volume = this.muted ? 0 : this.targetVolume;
    active.playbackRate = this.playbackRate;
    if (this.pending) this.prepareElement(this.elements[this.pending.slot]);
  }

  request(
    selection: MediaSelection,
    options: { playbackIntent: boolean; replay?: boolean; forceResume?: boolean } = { playbackIntent: false },
  ): 'started' | 'committed-noop' | 'pending-noop' {
    if (this.disposed) throw new Error('MediaSelectionController is disposed.');
    if (!options.replay && this.pending?.selection.key === selection.key) return 'pending-noop';
    if (!options.replay && this.state.committedSelection?.key === selection.key) return 'committed-noop';

    this.cancelPending(false);
    const generation = this.state.generation + 1;
    const slot: MediaSlot = this.state.activeSlot === 'A' ? 'B' : 'A';
    const pending: PendingRequest = {
      generation,
      selection: { ...selection },
      slot,
      owner: this.createOwner(generation, slot, selection.url),
      playbackIntent: options.playbackIntent,
      forceResume: options.forceResume ?? false,
      automaticRetries: 0,
      ready: false,
      playResolved: false,
      playDenied: false,
      listeners: [],
      readinessTimer: null,
      retryTimer: null,
    };
    this.pending = pending;
    this.patchState({
      generation,
      pendingSelection: { ...selection },
      failedRequest: null,
      playbackIntent: options.playbackIntent,
      playbackState: 'loading',
      resumeRequired: false,
    });
    this.startAttempt(pending);
    return 'started';
  }

  retry(): boolean {
    const failed = this.state.failedRequest;
    if (!failed) return false;
    this.request(failed.selection, { playbackIntent: failed.playbackIntent, replay: true });
    return true;
  }

  replay(): boolean {
    const committed = this.state.committedSelection;
    if (!committed) return false;
    this.request(committed, { playbackIntent: true, replay: true });
    return true;
  }

  pause(): void {
    if (this.pending) {
      this.pending.playbackIntent = false;
      this.elements[this.state.activeSlot].pause();
      this.patchState({ playbackIntent: false, resumeRequired: false });
      return;
    }
    this.elements[this.state.activeSlot].pause();
    this.clearStallTimer();
    this.patchState({ playbackIntent: false, playbackState: 'ready-paused', resumeRequired: false });
  }

  async resume(): Promise<boolean> {
    const element = this.elements[this.state.activeSlot];
    this.prepareElement(element);
    try {
      await element.play();
      if (this.disposed) return false;
      this.patchState({ playbackIntent: true, playbackState: 'playing', resumeRequired: false });
      this.installActiveMonitoring(this.state.activeSlot);
      return true;
    } catch (error) {
      if (isAutoplayDenial(error)) {
        this.patchState({ playbackIntent: false, playbackState: 'autoplay-denied', resumeRequired: true });
      } else {
        const selection = this.state.committedSelection;
        this.patchState({
          playbackIntent: false,
          playbackState: 'failed',
          failedRequest: selection
            ? { selection, failure: classifyMediaFailure(element, error), automaticRetries: 0, playbackIntent: true }
            : null,
        });
      }
      return false;
    }
  }

  setOnline(online: boolean): void {
    if (!online) {
      if (this.pending) this.terminalFailure(this.pending, { kind: 'offline', message: 'The browser is offline.' });
      return;
    }
    const failed = this.state.failedRequest;
    if (failed?.failure.kind === 'offline') {
      this.request(failed.selection, { playbackIntent: false, replay: true, forceResume: true });
    }
  }

  cancel(): void {
    this.cancelPending(true);
    this.removeActiveMonitoring();
    this.elements.A.pause();
    this.elements.B.pause();
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    for (const timer of this.cleanupTimers) this.clearTimer(timer);
    this.cleanupTimers.clear();
    this.resetSlot('A');
    this.resetSlot('B');
    this.disposed = true;
  }

  private startAttempt(request: PendingRequest): void {
    if (!this.isCurrent(request)) return;
    const element = this.elements[request.slot];
    request.owner = this.createOwner(request.generation, request.slot, request.selection.url);
    request.ready = false;
    request.playResolved = false;
    request.playDenied = false;
    request.listeners = [];
    this.owners[request.slot] = request.owner;
    this.prepareElement(element);

    const onReady = () => {
      if (!this.owns(request)) return;
      if (element.readyState >= HAVE_FUTURE_DATA) request.ready = true;
      this.maybeCommit(request);
    };
    const onCanPlay = () => {
      if (!this.owns(request)) return;
      request.ready = true;
      this.maybeCommit(request);
    };
    const onPlaying = () => {
      if (!this.owns(request)) return;
      request.ready = true;
      request.playResolved = true;
      this.maybeCommit(request);
    };
    const onError = () => {
      if (!this.owns(request)) return;
      this.handleAttemptFailure(request, classifyMediaFailure(element));
    };
    this.listen(request, 'canplay', onCanPlay);
    this.listen(request, 'loadeddata', onReady);
    this.listen(request, 'playing', onPlaying);
    this.listen(request, 'error', onError);
    this.listen(request, 'abort', onError);

    element.src = request.selection.url;
    element.load();
    request.readinessTimer = this.setTimer(() => {
      if (this.owns(request)) {
        this.handleAttemptFailure(request, { kind: 'timeout', message: 'Media readiness timed out.' });
      }
    }, this.readinessTimeoutMs);

    if (request.playbackIntent && !request.forceResume) {
      Promise.resolve(element.play()).then(() => {
        if (!this.owns(request)) return;
        request.playResolved = true;
        this.maybeCommit(request);
      }).catch(error => {
        if (!this.owns(request)) return;
        if (isAutoplayDenial(error)) {
          request.playDenied = true;
          this.maybeCommit(request);
        } else {
          this.handleAttemptFailure(request, classifyMediaFailure(element, error));
        }
      });
    }
    onReady();
  }

  private maybeCommit(request: PendingRequest): void {
    if (!this.owns(request) || !request.ready) return;
    if (request.playbackIntent && !request.forceResume && !request.playResolved && !request.playDenied) return;
    this.clearAttemptResources(request, false);
    const newElement = this.elements[request.slot];
    const oldSlot = this.state.activeSlot;
    const oldElement = this.elements[oldSlot];
    const oldOwner = this.owners[oldSlot];
    const oldSource = oldElement.src;

    oldElement.pause();
    if (request.playResolved && !request.playDenied && !request.forceResume) {
      newElement.muted = this.muted;
      newElement.volume = this.muted ? 0 : this.targetVolume;
    } else {
      newElement.pause();
    }

    this.pending = null;
    const denied = request.playDenied;
    const playing = request.playResolved && !denied && !request.forceResume;
    this.state = {
      ...this.state,
      committedSelection: { ...request.selection },
      pendingSelection: null,
      failedRequest: null,
      playbackIntent: playing,
      playbackState: playing ? 'playing' : denied ? 'autoplay-denied' : 'ready-paused',
      resumeRequired: denied || request.forceResume,
      activeSlot: request.slot,
    };
    this.emit();
    this.onCommit?.({ ...request.selection }, request.slot, this.getState());
    if (playing) this.installActiveMonitoring(request.slot);
    else this.removeActiveMonitoring();

    if (oldOwner && oldSource) {
      const timer = this.setTimer(() => {
        this.cleanupTimers.delete(timer);
        if (this.owners[oldSlot] === oldOwner && oldElement.src === oldSource) this.resetSlot(oldSlot, oldOwner);
      }, this.crossfadeMs);
      this.cleanupTimers.add(timer);
    }
  }

  private handleAttemptFailure(request: PendingRequest, failure: MediaFailure): void {
    if (!this.isCurrent(request)) return;
    if (!this.isOnline()) {
      this.terminalFailure(request, { kind: 'offline', message: 'The browser is offline.' });
      return;
    }
    this.clearAttemptResources(request, true);
    if (request.automaticRetries < this.retryDelaysMs.length) {
      const delay = this.retryDelaysMs[request.automaticRetries];
      request.automaticRetries += 1;
      const owner = request.owner;
      this.patchState({ playbackState: 'retrying' });
      request.retryTimer = this.setTimer(() => {
        request.retryTimer = null;
        const element = this.elements[request.slot];
        if (!this.isCurrent(request) || this.owners[request.slot] !== owner || element.src === owner.source) return;
        this.patchState({ playbackState: 'loading' });
        this.startAttempt(request);
      }, delay);
      return;
    }
    this.terminalFailure(request, failure);
  }

  private terminalFailure(request: PendingRequest, failure: MediaFailure): void {
    if (!this.isCurrent(request)) return;
    this.clearAttemptResources(request, true);
    this.pending = null;
    this.patchState({
      pendingSelection: null,
      failedRequest: {
        selection: { ...request.selection },
        failure,
        automaticRetries: request.automaticRetries,
        playbackIntent: request.playbackIntent,
      },
      playbackState: failure.kind === 'offline' ? 'offline' : 'failed',
      playbackIntent: this.state.committedSelection ? this.state.playbackIntent : false,
      resumeRequired: false,
    });
  }

  private installActiveMonitoring(slot: MediaSlot): void {
    this.removeActiveMonitoring();
    const element = this.elements[slot];
    const owner = this.owners[slot];
    if (!owner) return;
    const stalled = () => {
      if (this.pending || this.state.failedRequest || this.owners[slot] !== owner || this.state.activeSlot !== slot || !this.state.playbackIntent) return;
      this.patchState({ playbackState: 'stalled' });
      this.clearStallTimer();
      this.stallTimer = this.setTimer(() => {
        this.stallTimer = null;
        if (this.owners[slot] !== owner || this.state.activeSlot !== slot || !this.state.committedSelection) return;
        this.request(this.state.committedSelection, { playbackIntent: true, replay: true });
      }, this.stallTimeoutMs);
    };
    const recovered = () => {
      if (this.pending || this.state.failedRequest || this.owners[slot] !== owner || this.state.activeSlot !== slot) return;
      this.clearStallTimer();
      if (!element.paused && this.state.playbackIntent) this.patchState({ playbackState: 'playing' });
    };
    const failed = () => {
      if (this.owners[slot] !== owner || this.state.activeSlot !== slot || !this.state.committedSelection) return;
      this.request(this.state.committedSelection, { playbackIntent: this.state.playbackIntent, replay: true });
    };
    for (const type of ['waiting', 'stalled']) this.listenActive(element, type, stalled);
    for (const type of ['progress', 'timeupdate', 'playing']) this.listenActive(element, type, recovered);
    this.listenActive(element, 'error', failed);
  }

  private removeActiveMonitoring(): void {
    this.clearStallTimer();
    for (const { type, listener } of this.activeListeners) {
      this.elements.A.removeEventListener(type, listener);
      this.elements.B.removeEventListener(type, listener);
    }
    this.activeListeners = [];
  }

  private listenActive(element: MediaElementPort, type: string, listener: () => void): void {
    element.addEventListener(type, listener);
    this.activeListeners.push({ type, listener });
  }

  private clearStallTimer(): void {
    if (this.stallTimer !== null) this.clearTimer(this.stallTimer);
    this.stallTimer = null;
  }

  private cancelPending(resetState: boolean): void {
    const request = this.pending;
    if (!request) return;
    this.clearAttemptResources(request, true);
    this.pending = null;
    if (resetState) {
      this.patchState({
        pendingSelection: null,
        failedRequest: null,
        playbackIntent: false,
        playbackState: this.state.committedSelection ? 'ready-paused' : 'idle',
        resumeRequired: false,
      });
    }
  }

  private clearAttemptResources(request: PendingRequest, resetElement: boolean): void {
    if (request.readinessTimer !== null) this.clearTimer(request.readinessTimer);
    if (request.retryTimer !== null) this.clearTimer(request.retryTimer);
    request.readinessTimer = null;
    request.retryTimer = null;
    const element = this.elements[request.slot];
    for (const { type, listener } of request.listeners) element.removeEventListener(type, listener);
    request.listeners = [];
    if (resetElement && this.owners[request.slot] === request.owner) {
      element.pause();
      element.src = '';
      element.load();
    }
  }

  private resetSlot(slot: MediaSlot, expectedOwner?: Ownership): void {
    if (expectedOwner && this.owners[slot] !== expectedOwner) return;
    const element = this.elements[slot];
    element.pause();
    element.src = '';
    element.load();
    delete this.owners[slot];
  }

  private prepareElement(element: MediaElementPort): void {
    element.muted = this.muted;
    element.volume = 0;
    element.playbackRate = this.playbackRate;
  }

  private createOwner(generation: number, slot: MediaSlot, source: string): Ownership {
    return { generation, epoch: ++this.ownershipEpoch, slot, source };
  }

  private owns(request: PendingRequest): boolean {
    const element = this.elements[request.slot];
    return this.isCurrent(request) && this.owners[request.slot] === request.owner && element.src === request.owner.source;
  }

  private isCurrent(request: PendingRequest): boolean {
    return !this.disposed && this.pending === request && this.state.generation === request.generation;
  }

  private listen(request: PendingRequest, type: string, listener: () => void): void {
    this.elements[request.slot].addEventListener(type, listener);
    request.listeners.push({ type, listener });
  }

  private patchState(patch: Partial<MediaControllerState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private emit(): void {
    this.onStateChange?.(this.getState());
  }
}
