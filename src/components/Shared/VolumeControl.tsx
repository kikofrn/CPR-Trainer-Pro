import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VolumeControlProps {
  volume: number;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  className?: string;
}

export function VolumeControl({ volume, setVolume, isMuted, setIsMuted, className = "w-24 sm:w-32" }: VolumeControlProps) {
  return (
    <div className={`flex items-center gap-2 relative group ${className}`}>
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className="text-eh-peach hover:text-white transition-colors cursor-pointer"
      >
        {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          setVolume(val);
          if (val > 0) setIsMuted(false);
        }}
        className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer hover:bg-white/30 transition-colors
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 
                   [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full
                   [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:bg-white 
                   [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:rounded-full"
        style={{
          background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`
        }}
      />
    </div>
  );
}
