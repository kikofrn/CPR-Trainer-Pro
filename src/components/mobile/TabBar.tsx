import React from 'react';
import { PlaySquare, BookOpen, Settings } from 'lucide-react';
import { MobileTab } from './MobileApp';

interface TabBarProps {
  currentTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
}

export const TabBar: React.FC<TabBarProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'teach', label: 'Teach', icon: PlaySquare },
    { id: 'manuals', label: 'Manuals', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <div className="h-[calc(5rem+env(safe-area-inset-bottom))] bg-black/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 z-[100] shrink-0">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
              isActive ? 'text-eh-red' : 'text-eh-peach/40 hover:text-eh-peach/70'
            }`}
          >
            <Icon size={24} className={isActive ? 'animate-pulse-slow' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
