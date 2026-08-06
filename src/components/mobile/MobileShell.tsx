import { useEffect, useRef, useState } from 'react';
import { Award, BookOpen, ChevronRight, Download, HeartPulse, HelpCircle, Home, Loader2, Menu, Play, RotateCcw, Settings, ShieldCheck, X } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { CourseSelection } from '../../course-selection-model';
import type { CoordinatorSnapshot, EhContent, EhView } from '../../mobile-history';
import { THUMBNAILS } from '../../thumbnails';

interface MobileShellProps {
  history: CoordinatorSnapshot;
  immersive: boolean;
  hasContent: boolean;
  sectionTitle: string;
  activeFamily: 'cpr' | 'first-aid' | 'manuals' | 'certs' | null;
  showDownloadAffordance: boolean;
  cprSelection: CourseSelection;
  faSelection: CourseSelection;
  cprPediatric: boolean;
  cprVaEnabled: boolean;
  faPediatric: boolean;
  faVaEnabled: boolean;
  setCprPediatric: (value: boolean) => void;
  setCprVaEnabled: (value: boolean) => void;
  setFaPediatric: (value: boolean) => void;
  setFaVaEnabled: (value: boolean) => void;
  courses: readonly any[];
  slideshows: readonly any[];
  manuals: readonly any[];
  activeTab: 'video' | 'manual' | 'slideshow' | 'send-certs';
  displayCourse: any;
  activeSlideshow: any;
  selectedManual: any;
  activeChapterIndex: number;
  activeSlideIndex: number;
  previewManualIndex: number;
  setPreviewManualIndex: (index: number) => void;
  manualOutline: any[];
  pendingChapter: { courseId: string; chapterId: string; title: string } | null;
  failedChapter: { courseId: string; chapterId: string; title: string; offline: boolean } | null;
  onRetryChapter: () => void;
  onPrefetchChapter: (index: number) => void;
  onOpenView: (view: EhView) => void;
  onStartCourse: (selection: CourseSelection) => void;
  onSelectItem: (content: EhContent) => void;
  onOpenManual: (manualId: string) => void;
  onManualDestination: (destination: unknown) => void;
  onOpenCerts: () => void;
  onOpenDownload: () => void;
  onOpenGuide: () => void;
  onOpenOnboarding: (family: 'cpr' | 'first-aid') => void;
  onHome: () => void;
  onCloseTop: () => void;
  continuousPlay: boolean;
  setContinuousPlay: (value: boolean) => void;
  overlayExitBarrier: boolean;
  onNavigationExitComplete: () => void;
}

const NAV_ITEMS: Array<{ view?: EhView; family: MobileShellProps['activeFamily']; label: string; icon: typeof HeartPulse }> = [
  { view: 'cpr', family: 'cpr', label: 'CPR & AED', icon: HeartPulse },
  { view: 'first-aid', family: 'first-aid', label: 'First Aid', icon: ShieldCheck },
  { view: 'manuals', family: 'manuals', label: 'Manuals', icon: BookOpen },
  { family: 'certs', label: 'Certs', icon: Award },
];

export default function MobileShell(props: MobileShellProps) {
  const reducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const navigationLayerRef = useRef<HTMLDivElement>(null);
  const neutralFocusRef = useRef<HTMLSpanElement>(null);
  const closeTopRef = useRef(props.onCloseTop);
  const priorFocusRef = useRef<HTMLElement | null>(null);
  const priorFocusNameRef = useRef<string | null>(null);
  const restoreFocusPendingRef = useRef(false);
  const bodyStateRef = useRef<{ scrollY: number; cssText: string } | null>(null);
  const [navigationExitComplete, setNavigationExitComplete] = useState(true);
  const navState = [...props.history.stack].reverse().find(state => state.ehKind === 'nav') ?? null;
  const top = props.history.state;
  const navOpen = Boolean(navState);
  const navTopmost = top?.ehKind === 'nav';
  const sheetClassOpen = top?.ehKind === 'nav' || top?.ehKind === 'download' || top?.ehKind === 'guide';
  const sheetBlocking = sheetClassOpen || props.overlayExitBarrier || !navigationExitComplete;
  const modalAboveNavigation = navOpen && !navTopmost;
  closeTopRef.current = props.onCloseTop;

  useEffect(() => {
    if (navOpen) setNavigationExitComplete(false);
  }, [navOpen]);

  useEffect(() => {
    if (!sheetBlocking) return;
    if (!bodyStateRef.current) {
      bodyStateRef.current = { scrollY: window.scrollY, cssText: document.body.style.cssText };
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.inset = `-${window.scrollY}px 0 0`;
      document.body.style.width = '100%';
    }
    return () => {
      const previous = bodyStateRef.current;
      if (!previous) return;
      document.body.style.cssText = previous.cssText;
      window.scrollTo(0, previous.scrollY);
      bodyStateRef.current = null;
    };
  }, [sheetBlocking]);

  useEffect(() => {
    if (!navTopmost || !dialogRef.current) return;
    if (!priorFocusRef.current) {
      priorFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      priorFocusNameRef.current = priorFocusRef.current?.getAttribute('aria-label') ?? null;
    }
    const dialog = dialogRef.current;
    const focusables = (): HTMLElement[] => Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
    (focusables()[0] ?? dialog)?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeTopRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', onKeyDown);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      if (dialog.contains(document.activeElement)) neutralFocusRef.current?.focus();
    };
  }, [navTopmost]);

  useEffect(() => {
    if (top?.ehKind !== 'download' && top?.ehKind !== 'guide') return;
    const selector = top.ehKind === 'download'
      ? '[data-testid="download-app-dialog"]'
      : '[role="dialog"][aria-labelledby="how-to-guide-title"]';
    let dialog: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let disposed = false;
    const focusables = () => dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [role="button"][tabindex]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'))
      : [];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const attach = () => {
      if (disposed || dialog) return;
      dialog = document.querySelector<HTMLElement>(selector);
      if (!dialog) return;
      observer?.disconnect();
      dialog.addEventListener('keydown', onKeyDown);
      if (!dialog.contains(document.activeElement)) requestAnimationFrame(() => (focusables()[0] ?? dialog)?.focus());
    };
    attach();
    if (!dialog) {
      observer = new MutationObserver(attach);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => {
      disposed = true;
      observer?.disconnect();
      dialog?.removeEventListener('keydown', onKeyDown);
      const backdrop = dialog?.parentElement;
      if (backdrop) {
        backdrop.setAttribute('aria-hidden', 'true');
        backdrop.setAttribute('inert', '');
        backdrop.style.pointerEvents = 'none';
      }
      if (dialog?.contains(document.activeElement)) neutralFocusRef.current?.focus();
    };
  }, [top?.ehEntry, top?.ehKind]);

  const handleNavigationExitComplete = () => {
    restoreFocusPendingRef.current = true;
    setNavigationExitComplete(true);
    props.onNavigationExitComplete();
  };

  useEffect(() => {
    if (sheetBlocking || !restoreFocusPendingRef.current) return;
    restoreFocusPendingRef.current = false;
    requestAnimationFrame(() => {
      const target = priorFocusRef.current;
      if (target?.isConnected && !target.closest('[inert]')) {
        target.focus();
        return;
      }
      const name = priorFocusNameRef.current;
      const replacement = name
        ? Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find(element => element.getAttribute('aria-label') === name && !element.closest('[inert]'))
        : null;
      replacement?.focus();
      priorFocusRef.current = null;
      priorFocusNameRef.current = null;
    });
  }, [sheetBlocking]);

  const hideChrome = props.immersive && !navOpen;
  const rail = (
    <nav
      aria-label="Course navigation"
      className={`mobile-bottom-rail grid grid-cols-4 border-t border-white/10 bg-black/95 backdrop-blur-xl ${hideChrome ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}
      data-testid="mobile-bottom-nav"
    >
      {NAV_ITEMS.map(item => {
        const Icon = item.icon;
        const expanded = Boolean(item.view && navTopmost && navState?.ehView === item.view);
        const current = props.activeFamily === item.family;
        return (
          <button
            key={item.label}
            type="button"
            disabled={props.history.busy || modalAboveNavigation}
            aria-label={item.label}
            aria-controls={item.view ? 'mobile-navigation-sheet' : undefined}
            aria-expanded={item.view ? expanded : undefined}
            aria-current={current ? 'page' : undefined}
            onClick={() => item.view ? props.onOpenView(item.view) : props.onOpenCerts()}
            className={`mobile-coarse-target flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wide transition-colors ${expanded || current ? 'text-eh-red' : 'text-eh-peach/55'} disabled:opacity-40`}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <span ref={neutralFocusRef} tabIndex={-1} className="fixed h-px w-px overflow-hidden opacity-0" aria-hidden="true" />
      <header
        className={`mobile-header fixed inset-x-0 top-0 z-[70] flex min-h-16 items-end justify-between gap-3 border-b border-white/10 bg-black/95 px-3 pb-2 backdrop-blur-xl transition-[transform,opacity] duration-200 ${hideChrome || sheetBlocking ? '-translate-y-full opacity-0 pointer-events-none' : ''}`}
        data-testid="mobile-header"
        inert={sheetBlocking ? true : undefined}
      >
        {props.hasContent ? (
          <button type="button" onClick={props.onHome} aria-label="Return to menu" className="mobile-coarse-target flex items-center gap-2 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-eh-blue">
            <Home size={21} className="text-eh-red" />
            <span className="max-w-[42vw] truncate text-sm font-black text-eh-peach">{props.sectionTitle}</span>
          </button>
        ) : (
          <div className="flex items-center gap-2" aria-label="Everyday Hero Academy">
            <img src="/eha-icon.png" alt="" className="h-9 w-9 object-contain" />
            <span className="text-sm font-black tracking-tight text-eh-peach">CPR Trainer Pro</span>
          </div>
        )}
        <div className="mobile-header-actions flex items-center gap-1">
          {props.showDownloadAffordance && (
            <button type="button" onClick={props.onOpenDownload} aria-label="Download app for offline use" className="mobile-coarse-target rounded-full text-eh-peach/70 focus-visible:outline-2 focus-visible:outline-eh-blue">
              <Download size={21} />
            </button>
          )}
          <button type="button" onClick={() => props.onOpenView('settings')} aria-label="Open settings" aria-controls="mobile-navigation-sheet" aria-expanded={navTopmost && navState?.ehView === 'settings'} className="mobile-coarse-target rounded-full text-eh-peach/70 focus-visible:outline-2 focus-visible:outline-eh-blue">
            <Settings size={21} />
          </button>
        </div>
      </header>

      <AnimatePresence initial={false} onExitComplete={handleNavigationExitComplete}>
        {navOpen && (
          <motion.div
            ref={navigationLayerRef}
            key="mobile-navigation-layer"
            className="fixed inset-0 z-[80] flex items-end bg-black/65 backdrop-blur-sm"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onAnimationStart={definition => {
              if (typeof definition === 'object' && definition !== null && 'opacity' in definition && definition.opacity === 0) {
                navigationLayerRef.current?.setAttribute('aria-hidden', 'true');
                navigationLayerRef.current?.setAttribute('inert', '');
                neutralFocusRef.current?.focus();
              }
            }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            onPointerDown={event => {
              if (event.target === event.currentTarget && navTopmost) props.onCloseTop();
            }}
            aria-hidden={modalAboveNavigation ? true : undefined}
          >
            <motion.div
              ref={dialogRef}
              id="mobile-navigation-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-sheet-title"
              tabIndex={-1}
              inert={modalAboveNavigation ? true : undefined}
              data-testid="mobile-navigation-sheet"
              className="mx-auto flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[28px] border border-b-0 border-white/10 bg-[#0b0b0b] shadow-2xl focus:outline-none"
              initial={reducedMotion ? false : { y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: reducedMotion ? 0 : 40, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.22, ease: 'easeOut' }}
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-red">Course menu</p>
                  <h2 id="mobile-sheet-title" className="mt-1 text-xl font-black text-eh-peach">{viewTitle(navState?.ehView)}</h2>
                </div>
                <button type="button" onClick={props.onCloseTop} aria-label="Close course menu" className="mobile-coarse-target rounded-full text-eh-peach/65 focus-visible:outline-2 focus-visible:outline-eh-blue">
                  <X size={22} />
                </button>
              </div>
              <div className="mobile-sheet-scroll flex-1 overflow-y-auto px-4 py-5">
                {navState?.ehView === 'cpr' && <CoursePanel family="cpr" selection={props.cprSelection} {...props} />}
                {navState?.ehView === 'first-aid' && <CoursePanel family="first-aid" selection={props.faSelection} {...props} />}
                {navState?.ehView === 'manuals' && <ManualPanel {...props} />}
                {navState?.ehView === 'settings' && <SettingsPanel {...props} />}
              </div>
              {rail}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!navOpen && navigationExitComplete && (
        <div className={`fixed inset-x-0 bottom-0 z-[70] transition-[transform,opacity] duration-200 ${sheetBlocking ? 'pointer-events-none opacity-0' : ''}`} inert={sheetBlocking ? true : undefined}>
          {rail}
        </div>
      )}
    </>
  );
}

function CoursePanel({ family, selection, ...props }: { family: 'cpr' | 'first-aid'; selection: CourseSelection } & MobileShellProps) {
  const isCpr = family === 'cpr';
  const pediatric = isCpr ? props.cprPediatric : props.faPediatric;
  const va = isCpr ? props.cprVaEnabled : props.faVaEnabled;
  const setPediatric = isCpr ? props.setCprPediatric : props.setFaPediatric;
  const setVa = isCpr ? props.setCprVaEnabled : props.setFaVaEnabled;
  const target = selection.kind === 'video'
    ? props.courses.find(item => item.id === selection.targetId)
    : props.slideshows.find(item => item.id === selection.targetId);
  const activeMatches = selection.kind === 'video'
    ? props.activeTab === 'video' && props.displayCourse?.id === selection.targetId
    : props.activeTab === 'slideshow' && props.activeSlideshow?.id === selection.targetId;
  const thumbnail = THUMBNAILS[selection.thumbnailVariant]?.fallback;

  if (activeMatches && target) {
    const items = selection.kind === 'video' ? target.chapters : target.slides;
    const activeIndex = selection.kind === 'video' ? props.activeChapterIndex : props.activeSlideIndex;
    return (
      <div className="space-y-3" data-testid={`${family}-active-list`}>
        <p className="px-1 text-xs font-bold text-eh-peach/55">{target.title}</p>
        <Toggle label="Continuous Play" checked={props.continuousPlay} onChange={props.setContinuousPlay} />
        {items.map((item: any, index: number) => {
          const pending = selection.kind === 'video' && props.pendingChapter?.courseId === target.id && props.pendingChapter.chapterId === item.id;
          const failed = selection.kind === 'video' && props.failedChapter?.courseId === target.id && props.failedChapter.chapterId === item.id;
          return (
            <div
              key={item.id}
              data-media-row={selection.kind === 'video' ? 'chapter' : 'slide'}
              data-course-id={target.id}
              data-item-id={item.id}
              data-media-row-state={failed ? 'failed' : pending ? 'loading' : index === activeIndex ? 'active' : 'idle'}
              onPointerEnter={() => selection.kind === 'video' && props.onPrefetchChapter(index)}
              onTouchStart={() => selection.kind === 'video' && props.onPrefetchChapter(index)}
              className={`flex min-h-14 items-center gap-3 rounded-2xl border px-3 ${failed ? 'border-eh-red/35 bg-eh-red/10' : pending ? 'border-eh-blue/35 bg-eh-blue/10' : index === activeIndex ? 'border-eh-red/35 bg-eh-red/10' : 'border-white/10 bg-white/[0.03]'}`}
            >
              <button
                type="button"
                onFocus={() => selection.kind === 'video' && props.onPrefetchChapter(index)}
                onClick={() => props.onSelectItem(selection.kind === 'video'
                  ? { kind: 'video', targetId: target.id, itemId: item.id }
                  : { kind: 'slideshow', targetId: target.id, itemId: item.id })}
                className="mobile-coarse-target flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-eh-blue"
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${index === activeIndex ? 'bg-eh-red text-white' : 'border border-white/20 text-eh-peach/60'}`}>
                  {pending ? <Loader2 size={15} className="animate-spin" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-eh-peach">{item.title}</span>
                {pending && <span className="text-[9px] font-black uppercase text-eh-blue">Loading</span>}
                {failed && <span className="text-[9px] font-black uppercase text-eh-red">Failed</span>}
                <ChevronRight size={16} className="shrink-0 text-white/25" />
              </button>
              {failed && (
                <button type="button" onClick={props.onRetryChapter} className="mobile-coarse-target rounded-xl text-[10px] font-black uppercase text-eh-red focus-visible:outline-2 focus-visible:outline-eh-blue">
                  <RotateCcw size={15} /> Retry
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid={`${family}-course-preview`}>
      {thumbnail && <img src={thumbnail} alt="" className="aspect-video w-full rounded-2xl border border-white/10 object-cover" />}
      <div className="grid grid-cols-2 gap-3">
        <Toggle label="Pediatric Focused" checked={pediatric} onChange={setPediatric} />
        <Toggle label="Virtual Assistant" checked={va} onChange={setVa} />
      </div>
      <Toggle label="Continuous Play" checked={props.continuousPlay} onChange={props.setContinuousPlay} />
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-lg font-black text-eh-peach">{target?.title ?? (isCpr ? 'CPR & AED' : 'First Aid')}</h3>
        {!selection.available && <p className="mt-2 text-sm text-eh-red/80">{selection.unavailableReason}</p>}
        <button
          type="button"
          disabled={!selection.available || props.history.busy}
          onClick={() => props.onStartCourse(selection)}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-eh-red px-5 text-sm font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30 focus-visible:outline-2 focus-visible:outline-eh-blue"
        >
          <Play size={17} fill="currentColor" /> {selection.available ? 'Start course' : 'Coming soon'}
        </button>
      </div>
    </div>
  );
}

function ManualPanel(props: MobileShellProps) {
  const manual = props.manuals[props.previewManualIndex] ?? props.manuals[0];
  const activeMatches = props.activeTab === 'manual' && props.selectedManual?.id === manual?.id;
  if (!manual) return null;
  return (
    <div className="space-y-4" data-testid="manuals-panel">
      <div className="grid grid-cols-1 gap-2">
        {props.manuals.map((item, index) => (
          <button key={item.id} type="button" onClick={() => props.setPreviewManualIndex(index)} aria-pressed={index === props.previewManualIndex} className={`mobile-coarse-target flex min-h-14 items-center gap-3 rounded-xl border px-3 text-left ${index === props.previewManualIndex ? 'border-eh-red/40 bg-eh-red/10' : 'border-white/10 bg-white/[0.03]'}`}>
            <BookOpen size={19} className="text-eh-red" />
            <span className="flex-1 text-sm font-bold text-eh-peach">{item.title}</span>
            <ChevronRight size={16} className="text-white/25" />
          </button>
        ))}
      </div>
      {activeMatches ? (
        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="px-2 text-xs font-black uppercase tracking-wider text-eh-red">Table of Contents</p>
          {props.manualOutline.length ? props.manualOutline.map((item, index) => (
            <div key={`${item.title}-${index}`}>
              <button type="button" onClick={() => props.onManualDestination(item.dest)} className="mobile-coarse-target min-h-12 w-full rounded-xl px-2 text-left text-sm font-bold text-eh-peach/75 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-eh-blue">{item.title}</button>
              {item.items?.map((child: any, childIndex: number) => (
                <button key={`${child.title}-${childIndex}`} type="button" onClick={() => props.onManualDestination(child.dest)} className="mobile-coarse-target min-h-12 w-full rounded-xl pl-7 pr-2 text-left text-sm text-eh-peach/60 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-eh-blue">{child.title}</button>
              ))}
            </div>
          )) : <p className="p-4 text-sm text-eh-peach/45">Loading bookmarks…</p>}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <img src={manual.thumbnail} alt="" className="mx-auto max-h-52 rounded-xl border border-white/10 object-contain" />
          <h3 className="mt-4 text-lg font-black text-eh-peach">{manual.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-eh-peach/55">{manual.description}</p>
          <button type="button" onClick={() => props.onOpenManual(manual.id)} disabled={props.history.busy} className="mt-4 min-h-12 w-full rounded-xl bg-eh-red px-5 text-sm font-black uppercase text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-eh-blue">Open manual</button>
        </div>
      )}
    </div>
  );
}

function SettingsPanel(props: MobileShellProps) {
  return (
    <div className="space-y-3" data-testid="mobile-settings-panel">
      <Toggle label="Continuous Play" checked={props.continuousPlay} onChange={props.setContinuousPlay} />
      {props.showDownloadAffordance && <Action icon={Download} label="Offline Training?" onClick={props.onOpenDownload} />}
      <Action icon={HelpCircle} label="Guide" onClick={props.onOpenGuide} />
      <Action icon={HeartPulse} label="CPR & AED Onboarding Course" onClick={() => props.onOpenOnboarding('cpr')} />
      <Action icon={ShieldCheck} label="First Aid Onboarding Course" onClick={() => props.onOpenOnboarding('first-aid')} />
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4">
      <span className="text-sm font-bold text-eh-peach">{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`mobile-coarse-target relative h-6 w-12 shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-eh-blue ${checked ? 'bg-eh-red' : 'bg-white/15'}`}>
        <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: typeof Menu; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mobile-coarse-target flex min-h-14 w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-left focus-visible:outline-2 focus-visible:outline-eh-blue">
      <Icon size={19} className="text-eh-red" />
      <span className="flex-1 text-sm font-bold text-eh-peach">{label}</span>
      <ChevronRight size={16} className="text-white/25" />
    </button>
  );
}

function viewTitle(view: EhView | undefined) {
  if (view === 'cpr') return 'CPR & AED';
  if (view === 'first-aid') return 'First Aid';
  if (view === 'manuals') return 'Training Manuals';
  return 'Settings';
}
