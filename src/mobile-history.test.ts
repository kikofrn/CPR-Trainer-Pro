import { describe, expect, it, vi } from 'vitest';
import {
  MobileHistoryCoordinator,
  MobileHistoryLedger,
  createRetiredTombstone,
  mergeHistoryState,
  neutralHistoryState,
  parseEhHistoryState,
  type EhContent,
  type HistoryPort,
} from './mobile-history';

class FakeHistory implements HistoryPort {
  entries: unknown[] = [{}];
  index = 0;
  goCalls: number[] = [];
  get state() { return this.entries[this.index]; }
  pushState(state: unknown) { this.entries.splice(++this.index); this.entries[this.index] = state; }
  replaceState(state: unknown) { this.entries[this.index] = state; }
  go(delta: number) { this.goCalls.push(delta); this.index = Math.max(0, Math.min(this.entries.length - 1, this.index + delta)); }
}

const video: EhContent = { kind: 'video', targetId: 'cpr-aed', itemId: 'cpr-1' };
const slideshow: EhContent = { kind: 'slideshow', targetId: 'cpr-aed-course', itemId: 'slide-1' };

describe('mobile history state', () => {
  it('parses all four content descriptors and rejects malformed state', () => {
    const ledger = new MobileHistoryLedger('s', 1);
    const base = ledger.get(1)!;
    for (const content of [video, slideshow, { kind: 'manual', targetId: 'instructor' } as const, { kind: 'certs' } as const]) {
      expect(parseEhHistoryState(ledger.create(base, 'player', { content }))).not.toBeNull();
    }
    expect(parseEhHistoryState({ ehSession: 's', ehEntry: 2, ehRoot: 1, ehDepth: 4 })).toBeNull();
    expect(parseEhHistoryState([])).toBeNull();
  });

  it('creates content-free retired tombstones', () => {
    const state = new MobileHistoryLedger('s', 1).create({ ehSession: 's', ehEntry: 1, ehRoot: 1, ehDepth: 0 }, 'player', { content: video });
    expect(createRetiredTombstone(state)).toEqual({ ehSession: 's', ehEntry: 2, ehRoot: 1, ehParent: 1, ehDepth: 1, ehRetired: true });
  });

  it('preserves unrelated plain-record state without spreading primitives or arrays', () => {
    const state = { ehSession: 's', ehEntry: 1, ehRoot: 1, ehDepth: 0 as const };
    expect(mergeHistoryState({ router: 4, ehDepth: 99 }, state)).toEqual({ router: 4, ...state });
    expect(neutralHistoryState(['unsafe'])).toEqual({});
    expect(neutralHistoryState('unsafe')).toEqual({});
  });
});

describe('MobileHistoryLedger', () => {
  it('uses unique monotonic IDs, validates chains, replaces descriptors, and prunes abandoned descendants', () => {
    const ledger = new MobileHistoryLedger('s', 1);
    const base = ledger.get(1)!;
    const player = ledger.create(base, 'player', { content: video });
    const sheet = ledger.create(player, 'nav', { view: 'cpr' });
    expect([base.ehEntry, player.ehEntry, sheet.ehEntry]).toEqual([1, 2, 3]);
    expect(ledger.chain(sheet.ehEntry)?.map(entry => entry.ehKind ?? 'base')).toEqual(['base', 'player', 'nav']);
    const replaced = ledger.replace(player, { content: slideshow });
    expect(replaced.ehEntry).toBe(player.ehEntry);
    expect(replaced.ehContent).toEqual(slideshow);
    const branched = ledger.create(player, 'nav', { view: 'settings' });
    expect(branched.ehEntry).toBe(4);
    expect(ledger.get(sheet.ehEntry)).toBeNull();
    expect(ledger.validate({ ...branched, ehParent: 99 })).toBe(false);
  });
});

describe('MobileHistoryCoordinator', () => {
  it('bootstraps once under duplicate StrictMode setup and keeps direct entry at one base', () => {
    const history = new FakeHistory();
    const coordinator = new MobileHistoryCoordinator(history, vi.fn(), () => 'session');
    const first = coordinator.setup();
    coordinator.bootstrap(true);
    coordinator.cleanup(first);
    coordinator.setup();
    coordinator.bootstrap(true);
    expect(history.entries).toHaveLength(1);
    expect(parseEhHistoryState(history.state)?.ehDepth).toBe(0);
  });

  it('supports base-sheet-player, replacement without growth, and full-chain Back/Forward restoration', () => {
    const history = new FakeHistory();
    const navigate = vi.fn();
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => 'session');
    coordinator.setup(); coordinator.bootstrap(true);
    coordinator.openNavigation('cpr');
    coordinator.startContent(video);
    expect(history.entries).toHaveLength(2);
    expect(parseEhHistoryState(history.state)?.ehKind).toBe('player');
    coordinator.replaceContent(slideshow);
    expect(history.entries).toHaveLength(2);
    coordinator.openNavigation('settings');
    expect(parseEhHistoryState(history.state)?.ehDepth).toBe(2);
    history.go(-1); coordinator.handlePop(history.state);
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'history', playbackIntent: false }));
    history.go(1); coordinator.handlePop(history.state);
    expect(parseEhHistoryState(history.state)?.ehView).toBe('settings');
  });

  it('treats an exact navigation re-tap as a history no-op', () => {
    const history = new FakeHistory();
    const coordinator = new MobileHistoryCoordinator(history, vi.fn(), () => 'session');
    coordinator.setup(); coordinator.bootstrap(true); coordinator.openNavigation('cpr');
    const before = history.state;
    coordinator.openNavigation('cpr');
    expect(history.entries).toHaveLength(2);
    expect(history.state).toBe(before);
  });

  it('coalesces transactions and commits sheet-over-player selection only at its parent', () => {
    vi.useFakeTimers();
    const history = new FakeHistory();
    const navigate = vi.fn();
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => 'session');
    coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video); coordinator.openNavigation('cpr');
    coordinator.startContent(slideshow);
    coordinator.closeTop();
    expect(history.goCalls.at(-1)).toBe(-1);
    coordinator.handlePop(history.state);
    expect(parseEhHistoryState(history.state)?.ehContent).toEqual(slideshow);
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'selection', teardown: false }));
    vi.useRealTimers();
  });

  it('reconciles a rapid repeated Back to the actual root and tears down the underlying player once', () => {
    const history = new FakeHistory();
    const navigate = vi.fn();
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => 'session');
    coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video); coordinator.openNavigation('settings'); coordinator.openGuide();
    coordinator.closeTop();
    history.go(-2);
    coordinator.handlePop(history.state);
    expect(coordinator.snapshot().state?.ehDepth).toBe(0);
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'history', teardown: true }));
  });

  it('retains the source UI on transaction timeout and rejects stale lifecycle completion', () => {
    vi.useFakeTimers();
    const history = new FakeHistory();
    const coordinator = new MobileHistoryCoordinator(history, vi.fn(), () => 'session');
    const generation = coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video); coordinator.openNavigation('cpr');
    const before = coordinator.snapshot().state;
    coordinator.closeTop();
    history.index = history.entries.findIndex(entry => parseEhHistoryState(entry)?.ehEntry === before?.ehEntry);
    coordinator.cleanup(generation);
    vi.advanceTimersByTime(2500);
    expect(coordinator.snapshot().state).toEqual(before);
    vi.useRealTimers();
  });

  it('reconciles changed history state when a matching pop event is lost at timeout', () => {
    vi.useFakeTimers();
    const history = new FakeHistory();
    const navigate = vi.fn();
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => 'session');
    coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video); coordinator.openNavigation('settings');
    coordinator.closeTop();
    vi.advanceTimersByTime(2500);
    expect(coordinator.snapshot().state).toMatchObject({ ehKind: 'player', ehDepth: 1 });
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'close', teardown: false }));
    vi.useRealTimers();
  });

  it('retains the source when history has not moved at transaction timeout', () => {
    vi.useFakeTimers();
    const history = new FakeHistory();
    const coordinator = new MobileHistoryCoordinator(history, vi.fn(), () => 'session');
    coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video); coordinator.openNavigation('settings');
    const source = coordinator.snapshot().state;
    coordinator.closeTop();
    history.index = history.entries.findIndex(entry => parseEhHistoryState(entry)?.ehEntry === source?.ehEntry);
    vi.advanceTimersByTime(2500);
    expect(coordinator.snapshot().state).toEqual(source);
    expect(coordinator.snapshot().busy).toBe(false);
    vi.useRealTimers();
  });

  it('normalizes refresh and retired old-session Forward with one guarded return to the real root', () => {
    const history = new FakeHistory();
    const seed = new MobileHistoryLedger('old', 1);
    history.entries = [seed.get(1)!, seed.create(seed.get(1)!, 'player', { content: video })];
    history.index = 1;
    const navigate = vi.fn();
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => 'fresh');
    coordinator.setup(); coordinator.bootstrap(true);
    expect(history.goCalls).toEqual([-1]);
    expect(parseEhHistoryState(history.entries[1])?.ehRetired).toBe(true);
    coordinator.handlePop(history.state);
    expect(coordinator.snapshot().state?.ehSession).toBe('fresh');
    expect(coordinator.snapshot().state?.ehDepth).toBe(0);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ state: null, teardown: false }));
  });

  it('serializes rapid breakpoint changes and preserves active content without teardown', () => {
    const history = new FakeHistory();
    const navigate = vi.fn();
    let session = 0;
    const coordinator = new MobileHistoryCoordinator(history, navigate, () => `s${++session}`);
    coordinator.setup(); coordinator.bootstrap(true); coordinator.startContent(video);
    coordinator.setDesiredMobile(false, video);
    coordinator.setDesiredMobile(true, video);
    coordinator.handlePop(history.state);
    expect(coordinator.snapshot().phase).toBe('mobile-active');
    expect(navigate).not.toHaveBeenCalledWith(expect.objectContaining({ teardown: true }));
  });
});
