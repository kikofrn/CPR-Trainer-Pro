import { CheckCircle2, FolderInput, HardDrive, Loader2, X } from 'lucide-react';

export interface UsbImportSummary {
  appVersion: string;
  generatedAt: string;
  fileCount: number;
  totalBytes: number;
}

export interface UsbImportProgress {
  filename: string;
  completedBytes: number;
  totalBytes: number;
}

interface UsbImportModalProps {
  summary: UsbImportSummary;
  progress: UsbImportProgress | null;
  status: 'ready' | 'importing' | 'cancelling' | 'complete' | 'error';
  error: string | null;
  onStart: () => void;
  onRetry: () => void;
  onCancel: () => void;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

export function UsbImportModal({
  summary, progress, status, error, onStart, onRetry, onCancel, onClose,
}: UsbImportModalProps) {
  const isActive = status === 'importing' || status === 'cancelling';
  const percent = progress && progress.totalBytes > 0
    ? Math.min(100, Math.round((progress.completedBytes / progress.totalBytes) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
      <section className="relative w-full max-w-lg border border-white/10 bg-[#141518] p-7 shadow-2xl">
        {!isActive && (
          <button onClick={onClose} className="absolute right-4 top-4 p-2 text-white/50 hover:text-white" title="Close">
            <X size={20} />
          </button>
        )}

        <div className="flex items-center gap-4 pr-10">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-eh-blue/15 text-eh-blue">
            {status === 'complete' ? <CheckCircle2 size={26} /> : <HardDrive size={26} />}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Import Course Media</h2>
            <p className="mt-1 text-sm text-white/55">Conference library for app {summary.appVersion}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px bg-white/10 text-sm">
          <div className="bg-[#141518] p-4"><span className="text-white/45">Files</span><strong className="mt-1 block text-white">{summary.fileCount}</strong></div>
          <div className="bg-[#141518] p-4"><span className="text-white/45">Library size</span><strong className="mt-1 block text-white">{formatBytes(summary.totalBytes)}</strong></div>
        </div>

        {isActive && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="max-w-[75%] truncate text-white/60">{progress?.filename || 'Preparing media library...'}</span>
              <span className="font-mono text-eh-blue">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden bg-white/10"><div className="h-full bg-eh-blue transition-[width] duration-200" style={{ width: `${percent}%` }} /></div>
          </div>
        )}

        {status === 'complete' && <p className="mt-6 text-sm leading-6 text-green-400">Course media is ready for offline training.</p>}
        {error && <p className="mt-6 text-sm leading-6 text-red-400">{error}</p>}

        <div className="mt-7 flex justify-end gap-3">
          {isActive ? (
            <button onClick={onCancel} disabled={status === 'cancelling'} className="flex items-center gap-2 border border-white/15 px-5 py-2.5 text-sm font-bold text-white/75 hover:bg-white/5 disabled:opacity-50">
              {status === 'cancelling' && <Loader2 size={16} className="animate-spin" />}
              {status === 'cancelling' ? 'Stopping...' : 'Cancel Import'}
            </button>
          ) : status === 'complete' ? (
            <button onClick={onClose} className="bg-eh-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-eh-blue-light">Done</button>
          ) : status === 'error' ? (
            <button onClick={onRetry} className="flex items-center gap-2 bg-eh-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-eh-blue-light">
              <FolderInput size={17} /> Try Again
            </button>
          ) : (
            <button onClick={onStart} className="flex items-center gap-2 bg-eh-blue px-6 py-2.5 text-sm font-bold text-white hover:bg-eh-blue-light">
              <FolderInput size={17} /> Import Media
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
