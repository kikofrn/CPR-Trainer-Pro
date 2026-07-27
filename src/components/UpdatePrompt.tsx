import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, ChevronDown, Clock, HardDrive, X } from 'lucide-react';
import { COURSES, SLIDESHOWS, MANUALS } from '../chapters';
import type { ChangedFile } from '../update-checker';

interface UpdatePromptProps {
  files: ChangedFile[];
  avgSpeedBps: number;
  onUpdateNow: () => void;
  onDismiss: () => void;
}

export function UpdatePrompt({ files, avgSpeedBps, onUpdateNow, onDismiss }: UpdatePromptProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const { groups, totalSize } = useMemo(() => {
    let size = 0;
    const groupMap = new Map<string, { title: string; size: number }[]>();

    const addFile = (groupName: string, title: string, fileSize: number) => {
      size += fileSize;
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, []);
      }
      groupMap.get(groupName)!.push({ title, size: fileSize });
    };

    for (const file of files) {
      if (file.isSilent) continue;

      let found = false;

      // Check Courses
      for (const c of COURSES) {
        for (const chap of c.chapters) {
          if (chap.filename === file.key) {
            addFile(c.title, chap.title, file.size);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) continue;

      // Check Slideshows
      for (const s of SLIDESHOWS) {
        for (const slide of s.slides) {
          if (slide.filename === file.key) {
            addFile(s.title, slide.title, file.size);
            found = true;
            break;
          }
        }
        if (found) break;
      }
      if (found) continue;

      // Check Manuals
      for (const m of MANUALS) {
        if (m.filename === file.key) {
          addFile('Manuals', m.title, file.size);
          found = true;
          break;
        }
      }
      
      // Note: If a file isn't found in any of these, we don't display it. 
      // (Thumbnails are marked isSilent so they are already skipped).
    }

    return {
      groups: Array.from(groupMap.entries()).map(([name, items]) => ({ name, items })),
      totalSize: size
    };
  }, [files]);

  // If there are no visible files to update (e.g., only thumbnails), we shouldn't render the prompt.
  // But the component is un-opinionated about hiding itself completely if rendered. 
  // We just return null if no groups to be safe and match "silent" requirements.
  if (groups.length === 0) {
    return null;
  }

  const speed = avgSpeedBps > 0 ? avgSpeedBps : 3125000; // 25 Mbps fallback
  const estimatedSeconds = totalSize / speed;

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `~${Math.ceil(seconds)}s`;
    return `~${Math.ceil(seconds / 60)}m`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-lg bg-[#0a0a0a]/95 border border-eh-peach/20 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        <div className="p-8 pb-6 text-center relative">
          <div className="w-16 h-16 bg-eh-red/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-eh-red/20 shadow-[0_0_20px_rgba(255,75,75,0.2)]">
            <Download size={32} className="text-eh-red" />
          </div>
          
          <h2 className="text-3xl font-black text-white tracking-tight leading-none mb-3">
            New course files just dropped
          </h2>
          
          <p className="text-white/70 text-sm font-medium">
            Update now to make sure you're using the latest materials.
          </p>

          <div className="flex items-center justify-center gap-6 mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-white/50 mb-1">
                <HardDrive size={14} />
                <span className="text-[10px] uppercase tracking-wider font-bold">Total Size</span>
              </div>
              <span className="text-lg font-bold text-eh-peach">{formatSize(totalSize)}</span>
            </div>
            
            <div className="w-px h-8 bg-white/10" />
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-white/50 mb-1">
                <Clock size={14} />
                <span className="text-[10px] uppercase tracking-wider font-bold">Estimated Time</span>
              </div>
              <span className="text-lg font-bold text-eh-peach">{formatTime(estimatedSeconds)}</span>
            </div>
          </div>
        </div>

        <div className="px-8 flex flex-col">
          <button 
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="flex items-center justify-between w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors group mb-6"
          >
            <span className="text-sm font-bold tracking-wide text-white/80 group-hover:text-white transition-colors">
              Update Details
            </span>
            <ChevronDown size={18} className={`text-eh-peach transition-transform duration-300 ${detailsExpanded ? 'rotate-180' : ''}`} />
          </button>
          
          <AnimatePresence initial={false}>
            {detailsExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="max-h-[220px] overflow-y-auto pr-2 pb-6 space-y-4 custom-scrollbar">
                  {groups.map((group, idx) => (
                    <div key={idx} className="space-y-2">
                      <h4 className="text-[11px] uppercase tracking-widest font-black text-eh-peach/70 mb-2">
                        {group.name}
                      </h4>
                      <ul className="space-y-1">
                        {group.items.map((item, i) => (
                          <li key={i} className="flex items-center justify-between text-sm py-1.5 px-3 bg-white/5 rounded-lg">
                            <span className="text-white/90 truncate mr-4 font-medium">{item.title}</span>
                            <span className="text-white/40 text-xs shrink-0 font-mono">{formatSize(item.size)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-8 pt-0 flex gap-4 mt-auto">
          <button 
            onClick={onDismiss}
            className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-colors border border-white/10 text-sm tracking-wide"
          >
            I'll do it later
          </button>
          
          <button 
            onClick={onUpdateNow}
            className="flex-1 py-3.5 bg-eh-red hover:bg-[#ff3333] text-white font-black rounded-2xl transition-all duration-300 shadow-[0_0_20px_rgba(255,75,75,0.3)] hover:shadow-[0_0_30px_rgba(255,75,75,0.5)] active:scale-[0.98] text-sm uppercase tracking-wider"
          >
            Update Now
          </button>
        </div>
      </motion.div>
    </div>
  );
}
