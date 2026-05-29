import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { COURSES, SLIDESHOWS } from '../../chapters';
import { ChevronDown, PlayCircle, Image as ImageIcon } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  actions: AppActions;
  onChangeCourse: () => void;
}

export const ChapterDrawer: React.FC<Props> = ({ isOpen, onClose, state, actions, onChangeCourse }) => {
  const isVideo = state.activeCourseIndex !== null;
  const activeCourse = isVideo ? COURSES[state.activeCourseIndex!] : null;
  const chapters = activeCourse?.chapters || [];

  const isSlideshow = state.activeSlideshowIndex !== null;
  const activeSlideshow = isSlideshow ? SLIDESHOWS[state.activeSlideshowIndex!] : null;
  const slides = activeSlideshow?.slides || [];

  const items = isVideo ? chapters : slides;
  const currentIndex = isVideo ? state.activeChapterIndex : state.activeSlideIndex;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="absolute bottom-0 left-0 right-0 h-[60%] bg-[#111] rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 flex flex-col border-t border-white/10"
        >
          {/* Drag Handle & Header */}
          <div 
            className="w-full flex flex-col items-center pt-3 pb-4 cursor-pointer border-b border-white/5"
            onClick={onClose}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mb-4" />
            <div className="w-full px-6 flex items-center justify-between">
              <h3 className="font-bold text-eh-peach text-lg truncate pr-4">
                {isVideo ? activeCourse?.title : activeSlideshow?.title}
              </h3>
              <button 
                onClick={(e) => { e.stopPropagation(); onChangeCourse(); }}
                className="text-xs font-bold uppercase tracking-widest text-eh-blue hover:text-white transition-colors shrink-0"
              >
                Change ▼
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
            <div className="px-4 py-2 space-y-1">
              {items.map((item, idx) => {
                const isActive = idx === currentIndex;
                const isHeader = 'isSectionHeader' in item && item.isSectionHeader;

                if (isHeader) {
                  return (
                    <div key={idx} className="pt-6 pb-2 pl-4">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-eh-red/70">
                        {item.title}
                      </span>
                    </div>
                  );
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (isVideo) {
                        actions.selectChapter(idx);
                      } else {
                        actions.setActiveSlideIndex(idx);
                        actions.setSlideshowIsPlaying(true);
                      }
                      onClose(); // Auto-close drawer on selection
                    }}
                    className={`w-full text-left px-4 py-4 rounded-xl flex items-center gap-4 transition-colors ${
                      isActive 
                        ? 'bg-eh-red/10 border border-eh-red/20' 
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="w-8 shrink-0 flex items-center justify-center">
                      {isActive ? (
                        isVideo ? <PlayCircle size={20} className="text-eh-red animate-pulse" /> : <ImageIcon size={20} className="text-eh-red animate-pulse" />
                      ) : (
                        <span className="text-xs font-bold text-eh-peach/40">{idx + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? 'text-white font-bold' : 'text-eh-peach/80 font-medium'}`}>
                        {item.title}
                      </p>
                    </div>
                    {isVideo && 'duration' in item && (
                      <div className="shrink-0 text-xs text-eh-peach/40 font-mono">
                        {item.duration}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
