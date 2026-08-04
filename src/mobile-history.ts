export type EhContent =
  | { kind: 'video'; targetId: string; itemId: string }
  | { kind: 'slideshow'; targetId: string; itemId: string }
  | { kind: 'manual'; targetId: string }
  | { kind: 'certs' };

export type EhView = 'cpr' | 'first-aid' | 'manuals' | 'settings';
export type EhKind = 'player' | 'nav' | 'download' | 'guide';
export type CoordinatorPhase = 'desktop-inactive' | 'boot-normalizing' | 'mobile-active' | 'mobile-exiting' | 'stale-return';

export type EhHistoryState = {
  ehOverlay?: 'sheet' | 'player';
  ehSession: string;
  ehEntry: number;
  ehRoot: number;
  ehParent?: number;
  ehDepth: 0 | 1 | 2 | 3;
  ehKind?: EhKind;
  ehView?: EhView;
  ehContent?: EhContent;
  ehRetired?: true;
};

export interface HistoryPort {
  readonly state: unknown;
  pushState(state: unknown, unused: string): void;
  replaceState(state: unknown, unused: string): void;
  go(delta: number): void;
}

export interface CoordinatorSnapshot {
  state: EhHistoryState | null;
  stack: EhHistoryState[];
  phase: CoordinatorPhase;
  busy: boolean;
}

export interface NavigationEvent {
  state: EhHistoryState | null;
  source: 'history' | 'selection' | 'close' | 'normalization';
  teardown: boolean;
  playbackIntent: false;
}

type TimerApi = Pick<typeof globalThis, 'setTimeout' | 'clearTimeout'>;

const EH_KEYS = new Set([
  'ehOverlay', 'ehSession', 'ehEntry', 'ehRoot', 'ehParent', 'ehDepth',
  'ehKind', 'ehView', 'ehContent', 'ehRetired',
]);
const VIEWS = new Set<EhView>(['cpr', 'first-aid', 'manuals', 'settings']);
const KINDS = new Set<EhKind>(['player', 'nav', 'download', 'guide']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function isDepth(value: unknown): value is 0 | 1 | 2 | 3 {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0 && value <= 3;
}

export function isEhContent(value: unknown): value is EhContent {
  if (!isPlainRecord(value) || typeof value.kind !== 'string') return false;
  if (value.kind === 'certs') return Object.keys(value).every(key => key === 'kind');
  if (value.kind === 'manual') return typeof value.targetId === 'string' && value.targetId.length > 0;
  return (value.kind === 'video' || value.kind === 'slideshow')
    && typeof value.targetId === 'string' && value.targetId.length > 0
    && typeof value.itemId === 'string' && value.itemId.length > 0;
}

export function parseEhHistoryState(value: unknown): EhHistoryState | null {
  if (!isPlainRecord(value)) return null;
  const { ehSession, ehEntry, ehRoot, ehParent, ehDepth, ehKind, ehView, ehContent, ehOverlay, ehRetired } = value;
  if (typeof ehSession !== 'string' || !ehSession || !isPositiveInteger(ehEntry) || !isPositiveInteger(ehRoot) || !isDepth(ehDepth)) return null;
  if (ehParent !== undefined && !isPositiveInteger(ehParent)) return null;

  if (ehRetired === true) {
    if (ehKind !== undefined || ehView !== undefined || ehContent !== undefined || ehOverlay !== undefined) return null;
    return { ehSession, ehEntry, ehRoot, ...(ehParent !== undefined ? { ehParent: ehParent as number } : {}), ehDepth, ehRetired: true };
  }

  if (ehDepth === 0) {
    if (ehEntry !== ehRoot || ehParent !== undefined || ehKind !== undefined || ehView !== undefined || ehContent !== undefined || ehOverlay !== undefined) return null;
    return { ehSession, ehEntry, ehRoot, ehDepth };
  }

  if (typeof ehKind !== 'string' || !KINDS.has(ehKind as EhKind) || !isPositiveInteger(ehParent)) return null;
  if (ehKind === 'player') {
    if (ehOverlay !== 'player' || !isEhContent(ehContent) || ehView !== undefined) return null;
  } else if (ehKind === 'nav') {
    if (ehOverlay !== 'sheet' || typeof ehView !== 'string' || !VIEWS.has(ehView as EhView) || ehContent !== undefined) return null;
  } else if (ehOverlay !== 'sheet' || ehView !== undefined || ehContent !== undefined) {
    return null;
  }
  return {
    ehSession,
    ehEntry,
    ehRoot,
    ehParent,
    ehDepth,
    ehKind: ehKind as EhKind,
    ...(ehView ? { ehView: ehView as EhView } : {}),
    ...(ehContent ? { ehContent: ehContent as EhContent } : {}),
    ehOverlay: ehOverlay as 'sheet' | 'player',
  };
}

export function preserveUnrelatedState(value: unknown): Record<string, unknown> {
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => !EH_KEYS.has(key)));
}

export function mergeHistoryState(existing: unknown, state: EhHistoryState): Record<string, unknown> {
  return { ...preserveUnrelatedState(existing), ...state };
}

export function neutralHistoryState(existing: unknown): Record<string, unknown> {
  return preserveUnrelatedState(existing);
}

export function createRetiredTombstone(state: EhHistoryState): EhHistoryState {
  return {
    ehSession: state.ehSession,
    ehEntry: state.ehEntry,
    ehRoot: state.ehRoot,
    ...(state.ehParent ? { ehParent: state.ehParent } : {}),
    ehDepth: state.ehDepth,
    ehRetired: true,
  };
}

export class MobileHistoryLedger {
  private entries = new Map<number, EhHistoryState>();
  private counter: number;

  constructor(readonly session: string, readonly root: number) {
    const base: EhHistoryState = { ehSession: session, ehEntry: root, ehRoot: root, ehDepth: 0 };
    this.entries.set(root, base);
    this.counter = root;
  }

  get(entry: number): EhHistoryState | null {
    return this.entries.get(entry) ?? null;
  }

  create(parent: EhHistoryState, kind: EhKind, options: { view?: EhView; content?: EhContent } = {}): EhHistoryState {
    const depth = parent.ehDepth + 1;
    if (depth > 3) throw new Error('Managed mobile history depth exceeds 3');
    const state: EhHistoryState = {
      ehSession: this.session,
      ehEntry: ++this.counter,
      ehRoot: this.root,
      ehParent: parent.ehEntry,
      ehDepth: depth as 1 | 2 | 3,
      ehKind: kind,
      ehOverlay: kind === 'player' ? 'player' : 'sheet',
      ...(kind === 'nav' && options.view ? { ehView: options.view } : {}),
      ...(kind === 'player' && options.content ? { ehContent: options.content } : {}),
    };
    const parsed = parseEhHistoryState(state);
    if (!parsed) throw new Error('Invalid managed history entry');
    this.pruneDescendants(parent.ehEntry);
    this.entries.set(state.ehEntry, state);
    return state;
  }

  replace(state: EhHistoryState, patch: { view?: EhView; content?: EhContent }): EhHistoryState {
    const next: EhHistoryState = state.ehKind === 'nav' && patch.view
      ? { ...state, ehView: patch.view }
      : state.ehKind === 'player' && patch.content
        ? { ...state, ehContent: patch.content }
        : state;
    if (!parseEhHistoryState(next)) throw new Error('Invalid managed history replacement');
    this.entries.set(next.ehEntry, next);
    return next;
  }

  validate(state: EhHistoryState): boolean {
    const expected = this.entries.get(state.ehEntry);
    if (!expected || expected.ehSession !== this.session || expected.ehRoot !== this.root) return false;
    return expected.ehParent === state.ehParent
      && expected.ehDepth === state.ehDepth
      && expected.ehKind === state.ehKind
      && expected.ehView === state.ehView
      && JSON.stringify(expected.ehContent) === JSON.stringify(state.ehContent);
  }

  chain(entry: number): EhHistoryState[] | null {
    const chain: EhHistoryState[] = [];
    const seen = new Set<number>();
    let current = this.entries.get(entry);
    while (current) {
      if (seen.has(current.ehEntry)) return null;
      seen.add(current.ehEntry);
      chain.unshift(current);
      if (current.ehDepth === 0) break;
      current = current.ehParent ? this.entries.get(current.ehParent) : undefined;
    }
    if (!chain.length || chain[0].ehEntry !== this.root || chain.length - 1 !== chain.at(-1)?.ehDepth) return null;
    return chain;
  }

  private pruneDescendants(parentEntry: number) {
    const keep = new Set(this.chain(parentEntry)?.map(state => state.ehEntry) ?? [this.root, parentEntry]);
    for (const entry of this.entries.keys()) {
      if (!keep.has(entry)) this.entries.delete(entry);
    }
  }
}

interface PendingTransaction {
  source: number;
  expected: number;
  replacement?: EhContent;
  teardown: boolean;
  reason: NavigationEvent['source'];
  generation: number;
  timer: ReturnType<typeof setTimeout>;
  finishDesktop?: true;
}

export class MobileHistoryCoordinator {
  private ledger: MobileHistoryLedger | null = null;
  private current: EhHistoryState | null = null;
  private phase: CoordinatorPhase = 'desktop-inactive';
  private desiredMobile = false;
  private bootstrapped = false;
  private generation = 0;
  private pending: PendingTransaction | null = null;
  private staleReturn = false;
  private subscribers = new Set<(snapshot: CoordinatorSnapshot) => void>();

  constructor(
    private readonly history: HistoryPort,
    private readonly navigate: (event: NavigationEvent) => void,
    private readonly makeSession: () => string = () => crypto.randomUUID(),
    private readonly timers: TimerApi = globalThis,
  ) {}

  setup(): number {
    return ++this.generation;
  }

  cleanup(generation: number) {
    if (generation !== this.generation) return;
    this.generation++;
    if (this.pending) {
      this.timers.clearTimeout(this.pending.timer);
      this.pending = null;
    }
    this.emit();
  }

  subscribe(listener: (snapshot: CoordinatorSnapshot) => void): () => void {
    this.subscribers.add(listener);
    listener(this.snapshot());
    return () => this.subscribers.delete(listener);
  }

  snapshot(): CoordinatorSnapshot {
    return {
      state: this.current,
      stack: this.current && this.ledger ? (this.ledger.chain(this.current.ehEntry) ?? []) : [],
      phase: this.phase,
      busy: Boolean(this.pending) || this.phase === 'boot-normalizing' || this.phase === 'stale-return',
    };
  }

  bootstrap(mobile: boolean) {
    this.desiredMobile = mobile;
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    const previous = parseEhHistoryState(this.history.state);
    if (previous) {
      this.normalizeStale(previous, 'boot-normalizing');
      return;
    }
    if (mobile) this.startSession();
  }

  setDesiredMobile(mobile: boolean, activeContent: EhContent | null) {
    this.desiredMobile = mobile;
    if (this.pending || this.phase === 'boot-normalizing' || this.phase === 'stale-return') return;
    if (mobile && this.phase === 'desktop-inactive') {
      this.startSession(activeContent);
    } else if (!mobile && this.phase === 'mobile-active') {
      this.exitMobile();
    }
  }

  openNavigation(view: EhView) {
    if (!this.canMutate()) return;
    if (this.current?.ehKind === 'nav') {
      if (this.current.ehView === view) return;
      this.current = this.ledger!.replace(this.current, { view });
      this.history.replaceState(mergeHistoryState(this.history.state, this.current), '');
      this.emit();
      return;
    }
    this.push('nav', { view });
  }

  openDownload() {
    if (!this.canMutate()) return;
    this.push('download');
  }

  openGuide() {
    if (!this.canMutate()) return;
    this.push('guide');
  }

  startContent(content: EhContent) {
    if (!this.canMutate() || !this.current) return;
    if (this.current.ehKind === 'player') {
      this.replaceContent(content);
      return;
    }
    if (this.current.ehKind === 'nav') {
      const parent = this.current.ehParent ? this.ledger!.get(this.current.ehParent) : null;
      if (parent?.ehKind === 'player') {
        this.transact(parent, { replacement: content, teardown: false, reason: 'selection' });
      } else {
        this.current = {
          ...this.current,
          ehOverlay: 'player',
          ehKind: 'player',
          ehContent: content,
        };
        delete this.current.ehView;
        this.current = this.ledger!.replace(this.current, { content });
        this.history.replaceState(mergeHistoryState(this.history.state, this.current), '');
        this.emit();
        this.navigate({ state: this.current, source: 'selection', teardown: false, playbackIntent: false });
      }
      return;
    }
    if (this.current.ehDepth === 0) {
      this.push('player', { content });
      this.navigate({ state: this.current, source: 'selection', teardown: false, playbackIntent: false });
    }
  }

  replaceContent(content: EhContent) {
    if (!this.canMutate() || this.current?.ehKind !== 'player') return;
    this.current = this.ledger!.replace(this.current, { content });
    this.history.replaceState(mergeHistoryState(this.history.state, this.current), '');
    this.emit();
  }

  closeTop(teardownPlayer = false) {
    if (!this.canMutate() || !this.current || this.current.ehDepth === 0) return;
    const parent = this.current.ehParent ? this.ledger!.get(this.current.ehParent) : null;
    if (!parent) return this.normalizeCurrent();
    this.transact(parent, { teardown: teardownPlayer || this.current.ehKind === 'player', reason: 'close' });
  }

  home() {
    if (!this.canMutate() || !this.current || this.current.ehDepth === 0) return;
    const root = this.ledger!.get(this.current.ehRoot);
    if (root) this.transact(root, { teardown: true, reason: 'close' });
  }

  handlePop(value: unknown) {
    const state = parseEhHistoryState(value);
    if (this.pending) {
      const pending = this.pending;
      this.timers.clearTimeout(pending.timer);
      this.pending = null;
      if (state && state.ehEntry === pending.expected && pending.generation === this.generation) {
        this.current = state;
        if (pending.finishDesktop) {
          this.finishDesktop();
          return;
        }
        if (pending.replacement && state.ehKind === 'player') {
          this.current = this.ledger!.replace(state, { content: pending.replacement });
          this.history.replaceState(mergeHistoryState(this.history.state, this.current), '');
        }
        this.emit();
        this.navigate({ state: this.current, source: pending.reason, teardown: pending.teardown, playbackIntent: false });
        this.reconcileDesiredMode();
        return;
      }
    }

    if (state && this.ledger?.validate(state)) {
      const previous = this.current;
      const previousHasPlayer = this.chainHasPlayer(previous);
      this.current = state;
      this.phase = 'mobile-active';
      this.emit();
      this.navigate({
        state,
        source: 'history',
        teardown: previousHasPlayer && !this.chainHasPlayer(state),
        playbackIntent: false,
      });
      return;
    }

    if (state) {
      this.normalizeStale(state, 'stale-return');
      return;
    }

    this.current = null;
    if (this.desiredMobile) this.startSession();
    else {
      this.phase = 'desktop-inactive';
      this.emit();
    }
  }

  private canMutate(): boolean {
    return this.phase === 'mobile-active' && Boolean(this.ledger && this.current) && !this.pending;
  }

  private chainHasPlayer(state: EhHistoryState | null): boolean {
    if (!state || !this.ledger) return false;
    return Boolean(this.ledger.chain(state.ehEntry)?.some(entry => entry.ehKind === 'player'));
  }

  private push(kind: EhKind, options: { view?: EhView; content?: EhContent } = {}) {
    if (!this.current || !this.ledger) return;
    const next = this.ledger.create(this.current, kind, options);
    this.history.pushState(mergeHistoryState(this.history.state, next), '');
    this.current = next;
    this.emit();
  }

  private startSession(activeContent: EhContent | null = null) {
    const session = this.makeSession();
    this.ledger = new MobileHistoryLedger(session, 1);
    this.current = this.ledger.get(1);
    this.phase = 'mobile-active';
    this.history.replaceState(mergeHistoryState(this.history.state, this.current!), '');
    if (activeContent) this.push('player', { content: activeContent });
    this.emit();
  }

  private exitMobile() {
    if (!this.current || !this.ledger) return this.finishDesktop();
    this.phase = 'mobile-exiting';
    if (this.current.ehDepth === 0) return this.finishDesktop();
    const root = this.ledger.get(this.current.ehRoot);
    if (!root) return this.finishDesktop();
    this.transact(root, { teardown: false, reason: 'normalization', finishDesktop: true });
  }

  private finishDesktop() {
    this.history.replaceState(neutralHistoryState(this.history.state), '');
    this.current = null;
    this.ledger = null;
    this.phase = 'desktop-inactive';
    this.emit();
    this.reconcileDesiredMode();
  }

  private transact(target: EhHistoryState, options: { replacement?: EhContent; teardown: boolean; reason: NavigationEvent['source']; finishDesktop?: true }) {
    if (!this.current || this.pending) return;
    const delta = target.ehDepth - this.current.ehDepth;
    if (delta === 0) return;
    const generation = this.generation;
    const source = this.current.ehEntry;
    const timer = this.timers.setTimeout(() => {
      if (!this.pending || this.pending.generation !== generation || this.pending.source !== source) return;
      const observed = parseEhHistoryState(this.history.state);
      if (observed && observed.ehEntry !== source) {
        this.handlePop(this.history.state);
        return;
      }
      this.pending = null;
      this.emit();
      this.reconcileDesiredMode();
    }, 2000);
    this.pending = { source, expected: target.ehEntry, replacement: options.replacement, teardown: options.teardown, reason: options.reason, generation, timer, finishDesktop: options.finishDesktop };
    this.emit();
    this.history.go(delta);
  }

  private normalizeStale(state: EhHistoryState, phase: 'boot-normalizing' | 'stale-return') {
    this.phase = phase;
    this.current = null;
    this.navigate({ state: null, source: 'normalization', teardown: false, playbackIntent: false });
    this.history.replaceState(mergeHistoryState(this.history.state, createRetiredTombstone(state)), '');
    if (state.ehDepth > 0 && state.ehEntry >= state.ehRoot && !this.staleReturn) {
      this.staleReturn = true;
      this.emit();
      this.history.go(-state.ehDepth);
      return;
    }
    this.history.replaceState(neutralHistoryState(this.history.state), '');
    this.staleReturn = false;
    if (this.desiredMobile) this.startSession();
    else {
      this.phase = 'desktop-inactive';
      this.emit();
    }
  }

  private normalizeCurrent() {
    this.history.replaceState(neutralHistoryState(this.history.state), '');
    this.current = null;
    this.ledger = null;
    this.navigate({ state: null, source: 'normalization', teardown: false, playbackIntent: false });
    if (this.desiredMobile) this.startSession();
    else {
      this.phase = 'desktop-inactive';
      this.emit();
    }
  }

  private reconcileDesiredMode() {
    if (this.pending) return;
    if (this.desiredMobile && this.phase === 'desktop-inactive') this.startSession();
    else if (!this.desiredMobile && this.phase === 'mobile-active') this.exitMobile();
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const subscriber of this.subscribers) subscriber(snapshot);
  }
}
