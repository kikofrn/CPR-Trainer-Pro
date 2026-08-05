import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Page, pdfjs } from 'react-pdf';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Search,
  Loader2,
  AlertTriangle,
  WifiOff,
  RotateCcw
} from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { isTauri } from '../media-resolver';

// Set up worker for react-pdf to work offline in both dev and prod
// @ts-ignore: Vite syntax for importing worker URL
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let managedPdfWorker: Worker | null = null;

const resetWebPdfWorker = () => {
  if (isTauri || typeof Worker === 'undefined') return;
  managedPdfWorker?.terminate();
  managedPdfWorker = new Worker(pdfWorkerUrl, { type: 'module' });
  pdfjs.GlobalWorkerOptions.workerPort = managedPdfWorker;
};

resetWebPdfWorker();

export interface ManualFlipbookRef {
  resolveDestination: (dest: any) => Promise<void>;
  goToPage: (pageIndex: number) => void;
  flipNext: () => void;
  flipPrev: () => void;
}

interface ManualFlipbookProps {
  pdfUrl: string;
  onClose: () => void;
  title: string;
  onOutlineLoaded?: (outline: any[]) => void;
  showEasterEgg?: boolean;
  isOnline?: boolean;
}

interface PageRenderBoundaryProps {
  children: React.ReactNode;
  pageNumber: number;
  onError: (pageNumber: number, error: unknown) => void;
  onRetry: () => void;
}

class PageRenderBoundary extends React.Component<PageRenderBoundaryProps, { error: Error | null }> {
  declare readonly props: Readonly<PageRenderBoundaryProps>;
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    this.props.onError(this.props.pageNumber, error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
        <AlertTriangle className="text-eh-red" size={24} />
        <p className="text-xs font-bold text-gray-700">Page {this.props.pageNumber} could not be rendered.</p>
        <button
          type="button"
          onClick={this.props.onRetry}
          className="rounded-full bg-eh-red px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white"
        >
          Retry Page
        </button>
      </div>
    );
  }
}

const PageContent = React.forwardRef<HTMLDivElement, {
  pageNumber: number;
  width: number;
  height: number;
  scale: number;
  showEasterEgg?: boolean;
  renderPDF?: boolean;
  pdfDocument: PDFDocumentProxy;
  onPageError: (pageNumber: number, error: unknown) => void;
  onRetryPage: () => void;
}>((props, ref) => {
  return (
    <div className="bg-white shadow-2xl relative overflow-hidden w-full h-full flex items-center justify-center" ref={ref} data-density="hard">
      {props.renderPDF !== false ? (
        <PageRenderBoundary
          pageNumber={props.pageNumber}
          onError={props.onPageError}
          onRetry={props.onRetryPage}
        >
          <Page
            pdf={props.pdfDocument}
            pageNumber={props.pageNumber}
            width={props.width}
            scale={props.scale}
            className="w-full h-full flex items-center justify-center [&>.react-pdf__Page__canvas]:!w-full [&>.react-pdf__Page__canvas]:!h-full [&>.react-pdf__Page__canvas]:!object-fill"
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onLoadError={(error) => props.onPageError(props.pageNumber, error)}
            onRenderError={(error) => props.onPageError(props.pageNumber, error)}
            error={
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center" role="alert">
                <AlertTriangle className="text-eh-red" size={24} />
                <p className="text-xs font-bold text-gray-700">Page {props.pageNumber} could not be rendered.</p>
                <button
                  type="button"
                  onClick={props.onRetryPage}
                  className="rounded-full bg-eh-red px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white"
                >
                  Retry Page
                </button>
              </div>
            }
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-eh-red/30" />
              </div>
            }
          />
        </PageRenderBoundary>
      ) : (
        <div className="flex items-center justify-center h-full text-eh-red/30 font-mono text-sm opacity-50">
          Loading Page {props.pageNumber}...
        </div>
      )}
      <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 font-mono bg-white/80 px-1 rounded z-10">
        Page {props.pageNumber}
      </div>
    </div>
  );
});

PageContent.displayName = 'PageContent';

const ManualFlipbook = React.forwardRef<ManualFlipbookRef, ManualFlipbookProps>(({ pdfUrl, onClose, title, onOutlineLoaded, showEasterEgg, isOnline = navigator.onLine }, ref) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [outline, setOutline] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [jumpPage, setJumpPage] = useState('');
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [searchResults, setSearchResults] = useState<{page: number, text: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [documentRetryToken, setDocumentRetryToken] = useState(0);
  const [pageRetryToken, setPageRetryToken] = useState(0);
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const documentSource = documentRetryToken === 0
    ? pdfUrl
    : `${pdfUrl}${pdfUrl.includes('?') ? '&' : '?'}retry=${documentRetryToken}`;
  
  const flipbookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [hoverPage, setHoverPage] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerWidth(Math.round(width));
        setContainerHeight(Math.round(height));
      }
    });

    ro.observe(el);
    // Also set initial size
    setContainerWidth(el.clientWidth);
    setContainerHeight(el.clientHeight);

    return () => ro.disconnect();
  }, []);

  React.useImperativeHandle(ref, () => ({
    resolveDestination,
    goToPage,
    flipNext: () => {
      const pageFlip = flipbookRef.current?.pageFlip();
      if (pageFlip) pageFlip.flipNext();
    },
    flipPrev: () => {
      const pageFlip = flipbookRef.current?.pageFlip();
      if (pageFlip) pageFlip.flipPrev();
    }
  }));

  const onDocumentLoadError = () => {
    setDocumentError(isOnline
      ? 'The training manual could not be loaded. Your previous view has been kept where the browser allows it.'
      : 'You are offline. Reconnect, then retry the training manual.');
  };

  useEffect(() => {
    let teardownRequested = false;
    const loadingTask: PDFDocumentLoadingTask = pdfjs.getDocument(documentSource);
    loadingTaskRef.current = loadingTask;
    pdfRef.current = null;
    setPdfDocument(null);
    setNumPages(0);
    setOutline([]);
    setDocumentError(null);

    const ownedLoadPromise = (async () => {
      try {
        const pdf = await loadingTask.promise;
        if (teardownRequested) return;

        pdfRef.current = pdf;
        setPdfDocument(pdf);
        setNumPages(pdf.numPages);
        setDocumentError(null);

        try {
          const outlineData = await pdf.getOutline();
          if (teardownRequested) return;
          setOutline(outlineData || []);
          onOutlineLoaded?.(outlineData || []);
        } catch (error) {
          if (!teardownRequested) console.error('Error loading outline:', error);
        }
      } catch {
        if (!teardownRequested) onDocumentLoadError();
      }
    })();

    return () => {
      teardownRequested = true;
      if (loadingTaskRef.current === loadingTask) loadingTaskRef.current = null;
      pdfRef.current = null;

      // React cancels child page/render effects after this parent cleanup. Give
      // those cancellations the rest of this turn, let PDF.js settle its owned
      // load path, and only then terminate the document worker. Calling destroy
      // while PDF.js is still establishing the document causes a separate
      // internal worker promise to reject outside destroy()'s returned promise.
      queueMicrotask(async () => {
        await ownedLoadPromise;
        await loadingTask.destroy().catch(() => undefined);
      });
    };
    // The document source is the lifecycle identity; callback changes must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentSource]);

  const retryDocument = () => {
    resetWebPdfWorker();
    setDocumentError(null);
    setDocumentRetryToken(token => token + 1);
  };

  const onPageError = (pageNumber: number) => {
    setFailedPage(pageNumber);
  };

  const retryPage = () => {
    setFailedPage(null);
    setPageRetryToken(token => token + 1);
  };

  const resolveDestination = async (dest: any) => {
    if (!pdfRef.current || !dest) return;
    
    try {
      let explicitDest = dest;
      if (typeof dest === 'string') {
        explicitDest = await pdfRef.current.getDestination(dest);
      }
      
      if (Array.isArray(explicitDest)) {
        const pageRef = explicitDest[0];
        const pageIndex = await pdfRef.current.getPageIndex(pageRef);
        goToPage(pageIndex);
      }
    } catch (err) {
      console.error("Error resolving destination:", err);
    }
  };

  const goToPage = (pageIndex: number) => {
    if (flipbookRef.current) {
      const safeIndex = Math.max(0, Math.min(pageIndex, numPages - 1));
      // Use turnToPage instead of flip to avoid multi-page animation glitches
      // And rely on onFlip to sync currentPage to avoid race conditions.
      const pageFlip = flipbookRef.current.pageFlip();
      if (pageFlip) {
        pageFlip.turnToPage(safeIndex);
      }
    }
  };

  const handlePageJump = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage);
    if (!isNaN(pageNum) && pageNum > 0 && pageNum <= numPages) {
      goToPage(pageNum - 1);
      setJumpPage('');
    }
  };

  const handleKeywordSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim() || !pdfRef.current) return;

    setIsSearching(true);
    setSearchResults([]);
    const results: {page: number, text: string}[] = [];

    try {
      for (let i = 1; i <= numPages; i++) {
        // Yield to the browser's event loop every 2 pages to keep UI animations butter-smooth
        if (i % 2 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        const page = await pdfRef.current.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item: any) => item.str).join(' ');
        
        if (text.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push({ page: i, text: text.substring(0, 100) + '...' });
        }
        
        // Cap results for performance
        if (results.length >= 20) break;
      }
      setSearchResults(results);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || zoomScale > 1) {
      e.preventDefault();
      // Adjust zoom speed to be pleasant
      const zoomFactor = e.deltaY > 0 ? -0.15 : 0.15;
      setZoomScale(prev => {
        const newScale = Math.max(1, Math.min(prev + zoomFactor, 4));
        if (newScale === 1) setMousePos({ x: 50, y: 50 });
        return newScale;
      });
    }
  };
  
  const toggleFullScreen = async () => {
    if (isTauri) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const win = getCurrentWindow();
      const isFs = await win.isFullscreen();
      await win.setFullscreen(!isFs);
      setIsFullScreen(!isFs);
    } else {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(console.error);
      } else {
        document.exitFullscreen().catch(console.error);
      }
    }
  };

  // Sync isFullScreen state with actual fullscreen changes (handles Escape, F11, App.tsx global hotkeys)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullScreen(false);
      }
    };

    // For Tauri native fullscreen, listen to window resize as a proxy
    const handleTauriFullscreenSync = async () => {
      if (isTauri) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const isFs = await getCurrentWindow().isFullscreen();
          setIsFullScreen(isFs);
        } catch { /* ignore */ }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('resize', handleTauriFullscreenSync);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('resize', handleTauriFullscreenSync);
    };
  }, []);

  const isMobile = containerWidth < 768;
  
  const headerHeight = 56; // h-14
  const footerHeight = 80; // h-20
  const availableHeight = containerHeight - headerHeight - footerHeight - 32; // 32px extra safety buffer
  const availableWidth = containerWidth - 32; // 32px padding

  const pdfAspectRatio = 0.7727; // Standard 8.5x11 is ~0.77, A4 is ~0.7
  
  let pageWidth, pageHeight;
  
  if (isMobile) {
    pageWidth = Math.min(availableWidth * 0.9, availableHeight * pdfAspectRatio);
    pageHeight = pageWidth / pdfAspectRatio;
  } else {
    // Two pages view
    const halfWidth = availableWidth / 2;
    pageHeight = Math.min(availableHeight, halfWidth / pdfAspectRatio);
    pageWidth = pageHeight * pdfAspectRatio;
  }

  // Guard: clamp dimensions to prevent react-pageflip crash when container is hidden (0 dimensions)
  pageWidth = Math.max(1, pageWidth || 1);
  pageHeight = Math.max(1, pageHeight || 1);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full bg-black flex flex-col ${isFullScreen ? 'fixed inset-0 z-[9999]' : ''}`}
    >
      {/* Toolbar */}
      <div className="h-14 bg-black/50 border-b border-white/10 flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <h2 className="text-eh-peach font-bold text-sm tracking-tight">{title}</h2>
            <p className="text-eh-peach/40 text-[10px] uppercase font-mono">Manual Flipbook Reader</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Keyword Search */}
          <div className="relative z-50">
            <form onSubmit={handleKeywordSearch} className="relative hidden md:flex items-center">
              <input 
                type="text"
                placeholder="Search manual..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-full py-1.5 pl-4 pr-10 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-eh-red/50 transition-colors w-40"
              />
              {searchTerm && (
                <button type="button" onClick={() => { setSearchTerm(''); setSearchResults([]); }} className="absolute right-8 text-white/40 hover:text-white">
                  <X size={12} />
                </button>
              )}
              <button type="submit" disabled={isSearching} className="absolute right-3 text-white/40 hover:text-white transition-colors">
                {isSearching ? (
                  showEasterEgg ? <video src="/CPR-Dummies.mp4" autoPlay loop muted playsInline className="w-4 h-4 object-cover" /> : <Loader2 size={14} className="animate-spin" />
                ) : <Search size={14} />}
              </button>
            </form>
            
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full right-0 mt-2 w-64 bg-black/95 border border-white/10 rounded-lg shadow-2xl max-h-80 overflow-y-auto z-50 backdrop-blur-xl"
                >
                  <div className="p-2 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <span className="text-[10px] font-bold text-eh-peach uppercase tracking-widest">{searchResults.length} Results</span>
                    <button onClick={() => setSearchResults([])} className="text-white/40 hover:text-white"><X size={14}/></button>
                  </div>
                  {searchResults.map((res, i) => (
                    <button 
                      key={i}
                      onClick={() => {
                        goToPage(res.page - 1);
                        setSearchResults([]);
                      }}
                      className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors group"
                    >
                      <div className="text-[10px] text-eh-red font-mono mb-1 group-hover:text-eh-red-light">Page {res.page}</div>
                      <div className="text-xs text-white/70 line-clamp-2 leading-tight">{res.text}</div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-full border border-white/5">
            <button 
              onClick={() => setZoomScale(prev => prev > 1 ? 1 : 2.2)} 
              className={`px-4 py-2 rounded-full transition-colors flex items-center gap-2 ${zoomScale > 1 ? 'bg-eh-red text-white shadow-[0_0_15px_rgba(255,75,75,0.4)]' : 'hover:bg-white/10 text-white/60 hover:text-white'}`}
            >
              <Search size={16} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Magnify</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleFullScreen} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white">
            <Maximize2 size={20} />
          </button>
          <button 
            onClick={onClose}
            title="Close Manual"
            aria-label="Close Manual"
            className="p-2 bg-eh-red/20 hover:bg-eh-red/30 rounded-full transition-colors text-eh-red"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Flipbook Container */}
        <div 
          className="flex-1 flex items-center justify-center p-4 relative bg-eh-peach/5 overflow-hidden"
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
          style={{ cursor: zoomScale > 1 ? 'zoom-in' : 'default' }}
        >
          <div
            className="transition-transform duration-75 ease-out flex items-center justify-center w-full h-full"
            style={{ 
              transform: `scale(${zoomScale})`,
              transformOrigin: zoomScale > 1 ? `${mousePos.x}% ${mousePos.y}%` : 'center center'
            }}
          >
          {!pdfDocument && !documentError && (
            <div className="flex flex-col items-center gap-4">
              <video src="/CPR-Dummies.mp4" autoPlay loop muted playsInline className="w-32 h-32 object-cover rounded-2xl shadow-2xl" />
              <p className="text-white/40 text-xs font-mono uppercase tracking-[0.2em] font-bold">Loading Training Manual...</p>
            </div>
          )}
          {pdfDocument && numPages > 0 && (
            <HTMLFlipBook
              key={`${pageWidth}x${pageHeight}-${pageRetryToken}`}
              width={pageWidth}
              height={pageHeight}
              size="fixed"
              minWidth={315}
              maxWidth={1000}
              minHeight={400}
              maxHeight={1533}
              maxShadowOpacity={0.5}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={(e) => {
                setCurrentPage(e.data);
              }}
              className="flipbook-canvas"
              ref={flipbookRef}
              startPage={currentPage}
              drawShadow={true}
              flippingTime={1000}
              usePortrait={isMobile}
              startZIndex={0}
              autoSize={true}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
              showPageCorners={true}
              disableFlipByClick={false}
            >
              {Array.from(new Array(numPages), (el, index) => {
                const isClose = Math.abs(index - currentPage) <= 4;
                return (
                  <PageContent 
                    key={`page_${index + 1}`}
                    pdfDocument={pdfDocument}
                    pageNumber={index + 1} 
                    width={pageWidth}
                    height={pageHeight}
                    scale={1}
                    showEasterEgg={showEasterEgg}
                    renderPDF={isClose}
                    onPageError={onPageError}
                    onRetryPage={retryPage}
                  />
                );
              })}
            </HTMLFlipBook>
          )}
          </div>

          {documentError && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 p-8 backdrop-blur-sm" role="alert">
              <div className="max-w-md rounded-2xl border border-eh-red/30 bg-black/95 p-7 text-center shadow-2xl">
                {isOnline ? (
                  <AlertTriangle className="mx-auto text-eh-red" size={32} />
                ) : (
                  <WifiOff className="mx-auto text-eh-blue" size={32} />
                )}
                <h3 className="mt-4 text-lg font-bold text-eh-peach">Manual unavailable</h3>
                <p className="mt-2 text-sm leading-relaxed text-eh-peach/60">{documentError}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={retryDocument}
                    className="flex items-center gap-2 rounded-full bg-eh-red px-5 py-2 text-xs font-black uppercase tracking-wider text-white cursor-pointer"
                  >
                    <RotateCcw size={14} /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-full border border-eh-peach/20 px-5 py-2 text-xs font-black uppercase tracking-wider text-eh-peach cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {failedPage !== null && !documentError && (
            <div className="absolute left-6 top-6 z-30 rounded-xl border border-eh-red/30 bg-black/90 px-4 py-3 shadow-xl" role="status">
              <p className="text-xs font-bold text-eh-peach">Page {failedPage} needs to be retried.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer / Progress */}
      <div className="h-20 flex items-center justify-center px-12 z-50 bg-black/80 backdrop-blur-md border-t border-white/5">
        <div className="w-full max-w-2xl px-8 flex items-center gap-4">
          <button 
            disabled={currentPage === 0}
            onClick={() => flipbookRef.current?.pageFlip()?.flipPrev()}
            className="text-white/40 hover:text-white disabled:opacity-20 transition-colors p-2"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-[9px] font-mono text-eh-red w-8 text-center">
            {Math.min(currentPage + 1, numPages).toString().padStart(2, '0')}
          </span>
          
          <div 
            ref={progressBarRef}
            className="flex-1 h-8 -my-3 py-3 bg-transparent flex items-center relative cursor-pointer group"
            onMouseMove={(e) => {
              if (!progressBarRef.current || numPages === 0) return;
              const rect = progressBarRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              setHoverPage(Math.max(0, Math.min(numPages - 1, Math.floor(percentage * numPages))));
              setHoverX(percentage * 100);
            }}
            onMouseLeave={() => setHoverPage(null)}
            onClick={(e) => {
              if (!progressBarRef.current || numPages === 0 || !flipbookRef.current) return;
              const rect = progressBarRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = Math.max(0, Math.min(1, x / rect.width));
              const targetPage = Math.floor(percentage * numPages);
              // Ensure we flip to an even page if in double page mode so it aligns correctly
              const adjustedPage = (!isMobile && targetPage % 2 !== 0) ? targetPage - 1 : targetPage;
              flipbookRef.current.pageFlip().flip(Math.max(0, adjustedPage));
            }}
          >
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-eh-red transition-all duration-300"
                style={{ width: `${((currentPage + (isMobile ? 1 : 2)) / numPages) * 100}%` }}
              />
            </div>
            {/* Hover Indicator */}
            {hoverPage !== null && (
              <div 
                className="absolute top-0 bottom-0 w-1 bg-white transition-opacity z-10" 
                style={{ left: `${hoverX}%`, transform: 'translateX(-50%)' }} 
              >
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-mono px-2 py-1 rounded border border-white/20 whitespace-nowrap">
                  Page {hoverPage + 1}
                </div>
              </div>
            )}
          </div>
          
          <span className="text-[9px] font-mono text-white/40 w-8 text-center">
            {numPages.toString().padStart(2, '0')}
          </span>
          
          <button 
            disabled={currentPage >= numPages - (isMobile ? 1 : 2)}
            onClick={() => flipbookRef.current?.pageFlip()?.flipNext()}
            className="text-white/40 hover:text-white disabled:opacity-20 transition-colors p-2"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <style>{`
        .flipbook-canvas {
          box-shadow: 0 0 100px rgba(0,0,0,0.5);
        }
        .flipbook-canvas .stf__block {
          background-color: transparent !important;
        }
      `}</style>
    </div>
  );
});

ManualFlipbook.displayName = 'ManualFlipbook';

export default ManualFlipbook;
