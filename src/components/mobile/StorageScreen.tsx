import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { courseDownloadManager, PackageDownloadState } from '../../course-download-manager';
import { Trash2, HardDrive, AlertTriangle } from 'lucide-react';

interface Props {
  state: AppState;
  actions: AppActions;
  onBack: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const StorageScreen: React.FC<Props> = ({ state, actions, onBack }) => {
  const [dlStates, setDlStates] = useState<Record<string, PackageDownloadState>>({});
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  useEffect(() => {
    const unsub = courseDownloadManager.subscribe(setDlStates);
    return () => unsub();
  }, []);

  const downloadedPackages = Object.values(dlStates).filter(s => s.status === 'complete');
  
  // We can only estimate total used bytes from the downloaded ones, 
  // since true bytes depends on OS storage info which we don't have via Tauri plugin yet.
  // Wait, if it's downloaded, we should fetch actual bytes on disk? 
  // In `course-download-manager` we have `bytesTotal` which was fetched.
  const totalUsedBytes = downloadedPackages.reduce((sum, pkg) => sum + (pkg.bytesTotal || 0), 0);

  const handleDelete = async (pkgId: string) => {
    setShowConfirm(null);
    await courseDownloadManager.deletePackage(pkgId);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-0 bg-black z-40 overflow-y-auto pb-24 px-4 pt-[calc(env(safe-area-inset-top)+1rem)]"
    >
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-eh-peach/60 hover:text-eh-peach font-medium text-sm px-2 py-1">
            Back
          </button>
          <h1 className="font-serif text-2xl font-black text-eh-peach flex-1">Storage</h1>
        </div>

        {/* Overall Storage Widget */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-eh-peach/10 flex items-center justify-center shrink-0">
              <HardDrive size={24} className="text-eh-peach" />
            </div>
            <div>
              <p className="text-sm text-eh-peach/60 font-medium">App Storage Used</p>
              <h2 className="text-3xl font-black text-eh-peach">{formatBytes(totalUsedBytes)}</h2>
            </div>
          </div>
          
          <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden mt-6">
            {/* Visual breakdown bar. Let's just make it a static percentage for now or dynamic based on total device space if we had it */}
            <div className="h-full bg-eh-peach w-1/4 rounded-full" />
          </div>
        </div>

        {/* List of Downloaded Packages */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-eh-peach/60 uppercase tracking-wider ml-2 mt-8 mb-4">Downloaded Content</h3>
          
          {downloadedPackages.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-eh-peach/40 text-sm">No courses downloaded yet.</p>
            </div>
          ) : (
            downloadedPackages.map(pkgState => {
              const pkgDef = courseDownloadManager.getPackage(pkgState.packageId);
              if (!pkgDef) return null;

              return (
                <div key={pkgState.packageId} className="bg-black/40 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-eh-peach">{pkgDef.displayName}</h4>
                    <p className="text-xs text-eh-peach/50 mt-1">{formatBytes(pkgState.bytesTotal || 0)}</p>
                  </div>
                  <button 
                    onClick={() => setShowConfirm(pkgState.packageId)}
                    className="w-10 h-10 rounded-xl bg-eh-red/10 text-eh-red hover:bg-eh-red hover:text-white transition-all flex items-center justify-center"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
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
              <div className="w-12 h-12 rounded-full bg-eh-red/10 flex items-center justify-center mb-4">
                <AlertTriangle size={24} className="text-eh-red" />
              </div>
              <h3 className="text-xl font-bold text-eh-peach mb-2">Delete Course?</h3>
              <p className="text-eh-peach/60 text-sm mb-6">
                Are you sure you want to delete {courseDownloadManager.getPackage(showConfirm)?.displayName}? 
                This will free up {formatBytes(dlStates[showConfirm]?.bytesTotal || 0)}. You can re-download it later.
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDelete(showConfirm)}
                  className="w-full bg-eh-red text-white font-bold py-4 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all flex justify-center items-center gap-2"
                >
                  <Trash2 size={20} />
                  Yes, Delete
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
