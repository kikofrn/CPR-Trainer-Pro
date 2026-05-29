import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { MANUALS } from '../../chapters';
import { BookOpen, ChevronLeft } from 'lucide-react';
import ManualFlipbook from '../ManualFlipbook';

interface Props {
  state: AppState;
  actions: AppActions;
}

export const ManualsScreen: React.FC<Props> = ({ state, actions }) => {
  return (
    <div className="w-full h-full relative bg-black">
      <AnimatePresence mode="wait">
        {!state.selectedManual ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full h-full overflow-y-auto pb-24 px-4 pt-[calc(env(safe-area-inset-top)+2rem)]"
          >
            <div className="max-w-md mx-auto space-y-8">
              <div className="text-center mb-10">
                <h1 className="font-serif text-3xl font-black text-eh-peach tracking-tight mb-2">Training Manuals</h1>
                <p className="text-eh-peach/60 text-sm">Select a manual to read or present.</p>
              </div>

              <div className="space-y-4">
                {MANUALS.map((manual) => (
                  <button 
                    key={manual.id}
                    onClick={() => actions.setSelectedManual(manual)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 flex items-center justify-between hover:bg-white/5 hover:border-eh-red/40 transition-all group text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-eh-red/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-eh-red transition-all shrink-0">
                        <BookOpen size={20} className="text-eh-red group-hover:text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-eh-peach text-lg mb-1 leading-tight">{manual.title}</h3>
                        <p className="text-xs text-eh-peach/50 font-medium">PDF Document</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="reader"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 z-50 bg-black flex flex-col"
          >
            <div className="h-[calc(4rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-black border-b border-white/10 flex items-center px-4 shrink-0 justify-between">
              <button 
                onClick={() => actions.setSelectedManual(null)}
                className="p-2 text-eh-peach/60 hover:text-white transition-colors flex items-center gap-1"
              >
                <ChevronLeft size={20} />
                <span className="text-sm font-bold uppercase tracking-widest">Back</span>
              </button>
              <h2 className="text-sm font-bold text-eh-peach truncate px-4">
                {state.selectedManual.title}
              </h2>
              <div className="w-16" /> {/* Spacer for centering */}
            </div>
            
            <div className="flex-1 relative">
              {/* Note: The ManualFlipbook component needs to be responsive. */}
              <ManualFlipbook 
                manual={state.selectedManual} 
                onClose={() => actions.setSelectedManual(null)}
                onOutlineLoaded={() => {}}
                showEasterEgg={false}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
