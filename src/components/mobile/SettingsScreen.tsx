import React from 'react';
import { motion } from 'framer-motion';
import { AppState, AppActions } from './MobileTypes';
import { ExternalLink, Download, CheckCircle2, Info, HelpCircle, HardDrive } from 'lucide-react';

interface Props {
  state: AppState;
  actions: AppActions;
  onOpenStorage?: () => void;
}

export const SettingsScreen: React.FC<Props> = ({ state, actions, onOpenStorage }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full h-full overflow-y-auto pb-24 px-4 pt-[calc(env(safe-area-inset-top)+2rem)] bg-black"
    >
      <div className="max-w-md mx-auto space-y-8">
        <div className="text-center mb-8">
          <h1 className="font-serif text-3xl font-black text-eh-peach tracking-tight mb-2">Settings & Tools</h1>
        </div>

        {/* Portal Access */}
        <div className="bg-gradient-to-br from-eh-red/20 to-black border border-eh-red/30 rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-lg font-bold text-eh-peach mb-2">EH Academy Portal</h2>
            <p className="text-sm text-eh-peach/70 mb-6 leading-relaxed">
              Issue certification cards, manage your class rosters, and access instructor resources.
            </p>
            <button 
              onClick={actions.handleOpenPortal}
              className="w-full py-4 bg-eh-red hover:bg-eh-red-dark text-eh-peach font-black rounded-xl text-sm shadow-xl shadow-eh-red/20 transition-all flex items-center justify-center gap-2"
            >
              <span>Open Instructor Portal</span>
              <ExternalLink size={16} />
            </button>
          </div>
        </div>

        {/* Playback Settings */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-eh-peach/50 mb-2">Playback Options</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Continuous Play</span>
              <span className="text-xs text-white/50 mt-1">Auto-play next chapter</span>
            </div>
            <button 
              onClick={() => actions.setIsContinuousPlay(!state.isContinuousPlay)}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${state.isContinuousPlay ? 'bg-eh-red' : 'bg-white/10'}`}
            >
              <motion.div 
                animate={{ x: state.isContinuousPlay ? 26 : 2 }}
                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white">Closed Captions</span>
              <span className="text-xs text-white/50 mt-1">Show subtitles on videos</span>
            </div>
            <button 
              onClick={() => actions.setShowSubtitles(!state.showSubtitles)}
              className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${state.showSubtitles ? 'bg-eh-red' : 'bg-white/10'}`}
            >
              <motion.div 
                animate={{ x: state.showSubtitles ? 26 : 2 }}
                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
              />
            </button>
          </div>
        </div>

        {/* Downloads */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-xs font-black uppercase tracking-widest text-eh-peach/50 mb-4">Storage Management</h2>
          <div className="flex flex-col items-center text-center">
            <button
              onClick={onOpenStorage}
              className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <HardDrive size={18} />
              <span>Manage Downloaded Content</span>
            </button>
            <p className="text-xs text-white/40 mt-3">Free up space by deleting courses you no longer need offline.</p>
          </div>
        </div>

        {/* Support */}
        <div className="flex justify-center pt-4 opacity-50">
          <div className="text-center">
             <p className="text-[10px] uppercase tracking-widest font-bold mb-1">CPR Trainer Pro Mobile</p>
             <p className="text-[9px]">© 2026 Everyday Hero Academy</p>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
