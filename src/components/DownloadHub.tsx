import React from 'react';
import { Download, CheckCircle2, Pause, Play, Clock } from 'lucide-react';
import { formatSpeed } from '../download-manager';

interface DownloadHubProps {
  dlState: any;
  downloadManager: any;
  isTauri: boolean;
}

const CATEGORIES = [
  {
    id: 'cpr-aed' as const,
    label: 'Download CPR & AED Courses',
    description: 'Includes all videos, presentations, and manuals needed to teach CPR & AED for all ages and pediatric-focused CPR & AED',
    estimatedSize: '~1.5 GB',
  },
  {
    id: 'first-aid' as const,
    label: 'Download First-Aid Courses',
    description: 'Includes all videos, presentations, and manuals needed to teach First-Aid and Pediatric-focused First-Aid',
    estimatedSize: '~2.5 GB',
  },
  {
    id: 'everything' as const,
    label: 'Download All Teaching Content',
    description: 'Downloads everything — all courses, presentations, and training manuals',
    estimatedSize: '~4 GB',
    isEverything: true,
  },
];

export const DownloadHub = React.memo(function DownloadHub({ dlState, downloadManager, isTauri }: DownloadHubProps) {
  if (!isTauri) return null;

  return (
    <div className="px-5 py-8 flex flex-col gap-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-eh-red text-center">
        For Offline Use
      </h3>
      
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const files = downloadManager.getFilesForCategory(cat.id);
          const totalFiles = files.length;
          const downloadedCount = files.filter((f: string) => dlState.fileStatuses[f]).length;
          const remainingFiles = totalFiles - downloadedCount;
          const isComplete = downloadedCount === totalFiles && totalFiles > 0;
          
          const isThisCategoryActive = dlState.activeCategory === cat.id;
          const isAnyDownloadActive = dlState.isDownloading;
          const isPaused = dlState.isPaused && isThisCategoryActive;

          return (
            <div 
              key={cat.id} 
              className={`p-4 rounded-xl border ${cat.isEverything ? 'border-eh-blue/20 bg-eh-blue/5' : 'border-eh-peach/10 bg-white/[0.02]'} transition-all`}
            >
              <h4 className={`text-[13px] font-bold ${cat.isEverything ? 'text-eh-blue' : 'text-eh-peach'} mb-1`}>
                {cat.label}
              </h4>
              <p className="text-[11px] text-eh-peach/60 italic leading-snug mb-3">
                {cat.description}
              </p>
              
              <div className="mt-2 pt-3 border-t border-white/5">
                {isComplete ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-xs font-bold text-green-500">All Downloaded</span>
                  </div>
                ) : isPaused ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <Pause size={16} className="text-amber-400" />
                      <span className="text-xs font-bold text-amber-400">
                        Downloads Paused ({Math.max(0, remainingFiles)} left)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => downloadManager.resumeDownload()}
                        className="flex items-center gap-1.5 text-xs font-bold text-[#4ae5bd] hover:text-white transition-colors cursor-pointer"
                      >
                        <Play size={12} fill="currentColor" />
                        Resume
                      </button>
                      <span className="text-white/15">|</span>
                      <button
                        onClick={() => downloadManager.cancelDownload()}
                        className="text-xs font-bold text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isThisCategoryActive && isAnyDownloadActive ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <video src="/CPR-Dummies.mp4" autoPlay loop muted playsInline className="w-5 h-5 rounded-sm object-cover shrink-0" />
                      <span className="text-xs font-bold text-[#ff4b4b]">
                        {dlState.isPausing 
                          ? 'Pausing after current file\u2026' 
                          : `Downloading\u2026 ${dlState.completedQueueCount} of ${dlState.totalQueueSize}`
                        }
                      </span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#ff4b4b] to-[#ff6b6b] rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${dlState.totalQueueSize > 0 ? Math.max(1, ((dlState.completedQueueCount + (dlState.currentFileTotalBytes > 0 ? dlState.currentFileBytesWritten / dlState.currentFileTotalBytes : 0)) / dlState.totalQueueSize) * 100) : 0}%` }}
                      />
                    </div>
                    
                    {/* Speed + Pause button */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/40 font-mono">
                        {formatSpeed(dlState.currentSpeed)}
                      </span>
                      <button
                        onClick={() => downloadManager.pauseDownload()}
                        disabled={dlState.isPausing}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/80 hover:text-amber-300 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
                      >
                        <Pause size={10} />
                        {dlState.isPausing ? 'Pausing\u2026' : 'Pause'}
                      </button>
                    </div>
                  </div>
                ) : isAnyDownloadActive ? (
                  <div className="flex items-center gap-2 opacity-50">
                    <Clock size={16} className="text-white/40" />
                    <span className="text-xs font-bold text-white/40">Download in progress...</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => downloadManager.startBulkDownload(cat.id)}
                        className="flex items-center gap-2 text-[#ff4b4b] hover:text-[#ff3333] transition-colors cursor-pointer"
                      >
                        <Download size={16} />
                        <span className="text-xs font-bold">Download ({remainingFiles} files)</span>
                      </button>
                      <span className="text-[10px] font-mono text-eh-peach/40">{cat.estimatedSize}</span>
                    </div>
                    {isThisCategoryActive && dlState.failedFiles && dlState.failedFiles.length > 0 && (
                      <p className="text-[10px] text-red-400/60 pl-[24px] leading-snug">
                        {dlState.failedFiles.length} file{dlState.failedFiles.length > 1 ? 's' : ''} failed
                        {dlState.failedFiles.length <= 2 && (
                          <span className="text-white/20"> — {dlState.failedFiles[0].split('-').pop()?.replace('.mp4','').replace('.png','').trim()}</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
