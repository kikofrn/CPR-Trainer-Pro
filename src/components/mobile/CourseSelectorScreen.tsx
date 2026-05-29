import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { Heart, Activity, Presentation, Video, Download, Pause, Play, Trash2, CheckCircle2 } from 'lucide-react';
import { courseDownloadManager, PackageDownloadState, CoursePackage } from '../../course-download-manager';

interface Props {
  state: AppState;
  actions: AppActions;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const CourseSelectorScreen: React.FC<Props> = ({ state, actions }) => {
  const [dlStates, setDlStates] = useState<Record<string, PackageDownloadState>>({});
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  
  useEffect(() => {
    const unsub = courseDownloadManager.subscribe(setDlStates);
    return () => unsub();
  }, []);

  const handleLaunch = (pkg: CoursePackage, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Check download gate
    const dlState = dlStates[pkg.id];
    if (dlState?.status !== 'complete') {
      // Could show a toast here instead of just an alert
      alert(`Please download ${pkg.displayName} first.`);
      return;
    }

    if (pkg.category === 'video') {
      // Find the index in COURSES
      const idx = pkg.id.includes('cpr') ? 0 : 1; // Simplification, ideally should match exact ID
      actions.setActiveCourseIndex(idx);
      actions.setActiveChapterIndex(0);
      actions.setIsPlaying(true);
    } else if (pkg.category === 'slideshow') {
      const idx = pkg.id.includes('cpr') ? 0 : 1; 
      actions.setActiveSlideshowIndex(idx);
      actions.setActiveSlideIndex(0);
    }
  };

  const handleDownloadToggle = async (pkg: CoursePackage, e: React.MouseEvent) => {
    e.stopPropagation();
    const state = dlStates[pkg.id];
    
    if (state?.status === 'downloading') {
      courseDownloadManager.pauseDownload(pkg.id);
    } else if (state?.status === 'paused') {
      courseDownloadManager.resumeDownload(pkg.id);
    } else if (!state || state.status === 'idle') {
      setShowConfirm(pkg.id);
      // Pre-fetch size if we don't have it
      if (!state?.bytesTotal) {
        courseDownloadManager.fetchPackageSize(pkg.id);
      }
    }
  };

  const confirmDownload = async (pkgId: string) => {
    setShowConfirm(null);
    courseDownloadManager.startDownload(pkgId);
  };

  const renderPackageCard = (pkg: CoursePackage, icon: React.ReactNode, accentColor: string) => {
    const dlState = dlStates[pkg.id];
    const isComplete = dlState?.status === 'complete';
    const isDownloading = dlState?.status === 'downloading';
    const isPaused = dlState?.status === 'paused';
    
    const progressPercent = dlState?.bytesTotal 
      ? Math.round((dlState.bytesDownloaded / dlState.bytesTotal) * 100) 
      : 0;

    return (
      <div 
        key={pkg.id}
        className={`w-full bg-black/40 border ${isComplete ? `border-${accentColor}/40` : 'border-white/10'} rounded-2xl overflow-hidden transition-all relative`}
      >
        {/* Progress Bar Background */}
        {(isDownloading || isPaused) && (
          <div 
            className={`absolute left-0 top-0 bottom-0 bg-${accentColor}/10 transition-all duration-300 ease-out`}
            style={{ width: `${progressPercent}%` }}
          />
        )}
        
        <div className="p-5 flex flex-col gap-4 relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-bold text-eh-peach text-lg mb-1">{pkg.displayName}</h3>
              <p className="text-xs text-eh-peach/50 font-medium">
                {pkg.files.length} {pkg.category === 'video' ? 'chapters' : 'slides'} 
                {dlState?.bytesTotal ? ` • ${formatBytes(dlState.bytesTotal)}` : ''}
              </p>
            </div>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isComplete ? `bg-${accentColor}` : `bg-${accentColor}/10 text-${accentColor}`}`}>
              {isComplete ? <CheckCircle2 size={18} className="text-white" /> : icon}
            </div>
          </div>

          {/* Action Row */}
          <div className="flex gap-2 mt-2">
            <button 
              onClick={(e) => handleLaunch(pkg, e)}
              disabled={!isComplete}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                isComplete 
                  ? `bg-${accentColor} text-white hover:brightness-110` 
                  : 'bg-white/5 text-eh-peach/30 cursor-not-allowed'
              }`}
            >
              <Play size={16} className={isComplete ? 'fill-current' : ''} />
              Launch
            </button>

            {!isComplete && (
              <button 
                onClick={(e) => handleDownloadToggle(pkg, e)}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  isDownloading 
                    ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30' 
                    : 'bg-white/10 text-eh-peach hover:bg-white/20'
                }`}
              >
                {isDownloading ? <Pause size={16} /> : <Download size={16} />}
                {isDownloading ? 'Pause' : isPaused ? 'Resume' : 'Download'}
              </button>
            )}
          </div>
          
          {/* Download Details */}
          {(isDownloading || isPaused) && (
            <div className="text-[10px] text-eh-peach/40 flex justify-between uppercase tracking-wider font-semibold">
              <span>{progressPercent}% • {formatBytes(dlState?.bytesDownloaded || 0)}</span>
              {isDownloading && state?.speed && state.speed > 0 && (
                <span>{formatBytes(state.speed)}/s</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const cprPackages = courseDownloadManager.getPackages().filter(p => p.id.includes('cpr-aed'));
  const faPackages = courseDownloadManager.getPackages().filter(p => p.id.includes('first-aid'));

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full h-full overflow-y-auto pb-24 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] relative"
    >
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl font-black text-eh-peach tracking-tight mb-2">Content Library</h1>
          <p className="text-eh-peach/60 text-sm">Download courses to your device for offline teaching.</p>
        </div>

        <div className="space-y-8">
          {/* CPR & AED Section */}
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-eh-red text-xs font-black uppercase tracking-widest pl-2 mb-4">
              <Heart size={14} className="animate-pulse-slow" />
              CPR & AED
            </h2>
            {cprPackages.map(pkg => renderPackageCard(
              pkg, 
              pkg.category === 'video' ? <Video size={18} /> : <Presentation size={18} />, 
              'eh-red'
            ))}
          </div>

          {/* First Aid Section */}
          <div className="space-y-3 pt-4">
            <h2 className="flex items-center gap-2 text-eh-blue text-xs font-black uppercase tracking-widest pl-2 mb-4">
              <Activity size={14} />
              First Aid
            </h2>
            {faPackages.map(pkg => renderPackageCard(
              pkg, 
              pkg.category === 'video' ? <Video size={18} /> : <Presentation size={18} />, 
              'eh-blue'
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 pb-12"
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl"
            >
              <h3 className="text-xl font-bold text-eh-peach mb-2">Download Course</h3>
              <p className="text-eh-peach/60 text-sm mb-6">
                This will download all files for {courseDownloadManager.getPackage(showConfirm)?.displayName}. 
                {dlStates[showConfirm]?.bytesTotal ? ` Expected size is ~${formatBytes(dlStates[showConfirm].bytesTotal)}.` : ''} 
                You can pause or delete this later.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => confirmDownload(showConfirm)}
                  className="w-full bg-eh-peach text-black font-bold py-4 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Download size={20} />
                  Start Download
                </button>
                <button 
                  onClick={() => setShowConfirm(null)}
                  className="w-full bg-white/5 text-eh-peach font-bold py-4 rounded-xl text-lg hover:bg-white/10 active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
