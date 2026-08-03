import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  classifyMediaFailure,
  MediaControllerOptions,
  MediaElementPort,
  MediaSelection,
  MediaSelectionController,
} from './media-selection-controller';

class FakeMedia implements MediaElementPort {
  private source = '';
  private listeners = new Map<string, Set<() => void>>();
  readyState = 0;
  paused = true;
  muted = false;
  private volumeValue = 1;
  playbackRate = 1;
  currentTime = 0;
  error: { code: number; message?: string } | null = null;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  assignments: string[] = [];
  log: string[];
  playImpl: () => Promise<void> = async () => {
    this.paused = false;
  };

  constructor(private readonly name: string, log: string[] = []) {
    this.log = log;
  }

  get src() {
    return this.source;
  }

  get volume() {
    return this.volumeValue;
  }

  set volume(value: number) {
    this.volumeValue = value;
    this.log.push(`${this.name}.volume:${value}`);
  }

  set src(value: string) {
    this.source = value;
    this.assignments.push(value);
    this.log.push(`${this.name}.src:${value}`);
  }

  async play(): Promise<void> {
    this.playCalls += 1;
    this.log.push(`${this.name}.play`);
    await this.playImpl();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
    this.log.push(`${this.name}.pause`);
  }

  load(): void {
    this.loadCalls += 1;
    this.log.push(`${this.name}.load`);
  }

  addEventListener(type: string, listener: () => void): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of Array.from(this.listeners.get(type) ?? [])) listener();
  }

  snapshot(type: string): Array<() => void> {
    return Array.from(this.listeners.get(type) ?? []);
  }

  listenerCount(): number {
    return Array.from(this.listeners.values()).reduce((total, listeners) => total + listeners.size, 0);
  }
}

const selection = (key: string, courseIndex = 0, chapterIndex = 0): MediaSelection => ({
  key,
  url: `https://media.example/${key}.mp4`,
  courseId: `course-${courseIndex}`,
  chapterId: key,
  courseIndex,
  chapterIndex,
});

const denied = () => {
  const error = new Error('User activation is required.');
  error.name = 'NotAllowedError';
  return error;
};

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHarness(overrides: Partial<Omit<MediaControllerOptions, 'elements'>> = {}) {
  const log: string[] = [];
  const A = new FakeMedia('A', log);
  const B = new FakeMedia('B', log);
  const commits: string[] = [];
  const controller = new MediaSelectionController({
    elements: { A, B },
    retryDelaysMs: [2_000, 4_000, 8_000],
    onCommit: item => commits.push(item.key),
    ...overrides,
  });
  return { controller, A, B, commits, log };
}

async function ready(media: FakeMedia, playing = false) {
  media.readyState = 3;
  media.emit(playing ? 'playing' : 'canplay');
  await flushPromises();
}

async function commitPaused(controller: MediaSelectionController, media: FakeMedia, item: MediaSelection) {
  controller.request(item, { playbackIntent: false });
  await ready(media);
}

describe('MediaSelectionController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('t1 commits A to B only after readiness and successful playback', async () => {
    const { controller, B, commits } = createHarness();
    controller.request(selection('b'), { playbackIntent: true });
    expect(controller.getState().committedSelection).toBeNull();
    await flushPromises();
    expect(controller.getState().committedSelection).toBeNull();
    await ready(B, true);
    expect(controller.getState()).toMatchObject({
      committedSelection: { key: 'b' },
      pendingSelection: null,
      playbackState: 'playing',
      activeSlot: 'B',
    });
    expect(commits).toEqual(['b']);
  });

  it('t2 exhausts automatic retries, preserves committed A, and exposes Retry for B', async () => {
    const { controller, A, B } = createHarness();
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b', 0, 1), { playbackIntent: false });
    for (const delay of [2_000, 4_000, 8_000]) {
      A.error = { code: 2 };
      A.emit('error');
      expect(controller.getState().playbackState).toBe('retrying');
      await vi.advanceTimersByTimeAsync(delay);
    }
    A.emit('error');
    expect(controller.getState()).toMatchObject({
      committedSelection: { key: 'a' },
      pendingSelection: null,
      failedRequest: { selection: { key: 'b' }, automaticRetries: 3 },
      playbackState: 'failed',
    });
    expect(controller.retry()).toBe(true);
    expect(controller.getState().pendingSelection?.key).toBe('b');
  });

  it('t3 ignores stale B events after a rapid B to C selection', async () => {
    const { controller, A, B, commits } = createHarness();
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b', 0, 1), { playbackIntent: false });
    const staleCanPlay = A.snapshot('canplay');
    controller.request(selection('c', 0, 2), { playbackIntent: false });
    staleCanPlay.forEach(listener => listener());
    expect(controller.getState().committedSelection?.key).toBe('a');
    await ready(A);
    expect(controller.getState().committedSelection?.key).toBe('c');
    expect(commits).toEqual(['a', 'c']);
  });

  it('t4 cancels pending work on close or unmount without committing', async () => {
    const { controller, A, B, commits } = createHarness();
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b'), { playbackIntent: false });
    const stale = A.snapshot('canplay');
    controller.dispose();
    stale.forEach(listener => listener());
    expect(commits).toEqual(['a']);
    expect(A.src).toBe('');
    expect(B.src).toBe('');
    expect(A.listenerCount() + B.listenerCount()).toBe(0);
  });

  it('t5 commits a paused destination without calling play', async () => {
    const { controller, B } = createHarness();
    controller.request(selection('a'), { playbackIntent: false });
    await ready(B);
    expect(B.playCalls).toBe(0);
    expect(controller.getState().playbackState).toBe('ready-paused');
  });

  it('t6 treats NotAllowedError as a ready paused commit with Resume', async () => {
    const { controller, B } = createHarness();
    B.playImpl = async () => { throw denied(); };
    controller.request(selection('a'), { playbackIntent: true });
    await ready(B);
    expect(controller.getState()).toMatchObject({
      committedSelection: { key: 'a' },
      playbackState: 'autoplay-denied',
      resumeRequired: true,
      failedRequest: null,
    });
  });

  it('t7 discards a pending chapter when a different course is selected', async () => {
    const { controller, A, B } = createHarness();
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b', 0, 1), { playbackIntent: false });
    controller.request(selection('x', 1, 0), { playbackIntent: false });
    await ready(A);
    expect(controller.getState().committedSelection).toMatchObject({ key: 'x', courseId: 'course-1' });
  });

  it('t8 clears the old element after the guarded visual crossfade window', async () => {
    const { controller, A, B } = createHarness({ crossfadeMs: 500 });
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b'), { playbackIntent: false });
    await ready(A);
    expect(B.src).toContain('/a.mp4');
    await vi.advanceTimersByTimeAsync(500);
    expect(B.src).toBe('');
  });

  it('t9 stale cleanup cannot clear an element reassigned to C', async () => {
    const { controller, A, B } = createHarness({ crossfadeMs: 500 });
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b'), { playbackIntent: false });
    await ready(A);
    controller.request(selection('c'), { playbackIntent: false });
    expect(B.src).toContain('/c.mp4');
    await vi.advanceTimersByTimeAsync(500);
    expect(B.src).toContain('/c.mp4');
    await ready(B);
    expect(controller.getState().committedSelection?.key).toBe('c');
  });

  it('t10 keeps one listener set and one retry timer through repeated failure and retry', async () => {
    const { controller, B } = createHarness();
    controller.request(selection('a'), { playbackIntent: false });
    expect(B.listenerCount()).toBe(5);
    B.emit('error');
    expect(B.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(B.listenerCount()).toBe(5);
    expect(vi.getTimerCount()).toBe(1);
    B.emit('error');
    expect(B.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('t11 makes ordinary same-selection requests no-ops but Replay is explicit', async () => {
    const { controller, A, B } = createHarness();
    const item = selection('a');
    await commitPaused(controller, B, item);
    const assignments = A.assignments.length + B.assignments.length;
    expect(controller.request(item, { playbackIntent: true })).toBe('committed-noop');
    expect(A.assignments.length + B.assignments.length).toBe(assignments);
    expect(controller.replay()).toBe(true);
    expect(controller.getState().pendingSelection?.key).toBe('a');
  });

  it('t12 does not commit an autoplay denial before readiness', async () => {
    const { controller, B } = createHarness();
    B.playImpl = async () => { throw denied(); };
    controller.request(selection('a'), { playbackIntent: true });
    await flushPromises();
    expect(controller.getState().committedSelection).toBeNull();
    await ready(B);
    expect(controller.getState().committedSelection?.key).toBe('a');
  });

  it('clears continuous-play intent when paused during a pending request', async () => {
    const { controller, A, B } = createHarness();
    await commitPaused(controller, B, selection('a'));
    controller.request(selection('b'), { playbackIntent: true });
    controller.pause();
    await ready(A);
    expect(A.playCalls).toBe(1);
    expect(controller.getState()).toMatchObject({ playbackIntent: false, playbackState: 'ready-paused' });
  });

  it('uses separate 15 second readiness and 10 second playback stall timers', async () => {
    const { controller, A, B } = createHarness();
    controller.request(selection('a'), { playbackIntent: false });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(controller.getState().playbackState).toBe('loading');
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getState().playbackState).toBe('retrying');

    controller.cancel();
    B.readyState = 3;
    controller.request(selection('b'), { playbackIntent: true, replay: true });
    await ready(B, true);
    await vi.advanceTimersByTimeAsync(500);
    B.emit('stalled');
    await vi.advanceTimersByTimeAsync(9_999);
    expect(controller.getState().playbackState).toBe('stalled');
    await vi.advanceTimersByTimeAsync(1);
    expect(controller.getState().pendingSelection?.key).toBe('b');
  });

  it('recovers from offline to ready-paused and requires explicit Resume', async () => {
    let online = false;
    const { controller, B } = createHarness({ isOnline: () => online });
    controller.request(selection('a'), { playbackIntent: true });
    B.emit('error');
    expect(controller.getState()).toMatchObject({ playbackState: 'offline', failedRequest: { failure: { kind: 'offline' } } });
    online = true;
    controller.setOnline(true);
    await ready(B);
    expect(controller.getState()).toMatchObject({
      committedSelection: { key: 'a' },
      playbackState: 'ready-paused',
      resumeRequired: true,
    });
    expect(B.playCalls).toBe(1);
  });

  it('keeps audio ownership singular during commit', async () => {
    const { controller, A, B, log } = createHarness();
    controller.request(selection('a'), { playbackIntent: true });
    await ready(B, true);
    log.length = 0;
    controller.request(selection('b'), { playbackIntent: true });
    await ready(A, true);
    expect(B.paused).toBe(true);
    expect(A.volume).toBe(1);
    expect(log.lastIndexOf('B.pause')).toBeLessThan(log.lastIndexOf('A.volume:1'));
  });

  it('classifies failures only from observable MediaError data', () => {
    const media = new FakeMedia('A');
    media.error = { code: 3 };
    expect(classifyMediaFailure(media)).toEqual({
      kind: 'decode',
      message: 'The browser could not decode this media.',
      mediaErrorCode: 3,
    });
    expect(JSON.stringify(classifyMediaFailure(media))).not.toMatch(/http|status/i);
  });
});
