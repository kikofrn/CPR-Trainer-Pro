import React, { useState } from 'react';
import { AppState, AppActions } from './MobileTypes';
import { TabBar } from './TabBar';
import { CourseSelectorScreen } from './CourseSelectorScreen';
import { TeachingSession } from './TeachingSession';
import { ManualsScreen } from './ManualsScreen';
import { SettingsScreen } from './SettingsScreen';
import { StorageScreen } from './StorageScreen';
import { AnimatePresence } from 'framer-motion';

interface MobileAppProps {
  state: AppState;
  actions: AppActions;
}

export type MobileTab = 'teach' | 'manuals' | 'settings';

export const MobileApp: React.FC<MobileAppProps> = ({ state, actions }) => {
  const [currentTab, setCurrentTab] = useState<MobileTab>('teach');
  const [isStorageOpen, setIsStorageOpen] = useState(false);

  // If a course is active, we are in a teaching session
  const isTeachingSession = state.activeCourseIndex !== null || state.activeSlideshowIndex !== null;

  return (
    <div 
      className="flex flex-col bg-black text-eh-peach overflow-hidden medical-gradient relative"
      style={{ width: '100vw', maxWidth: '100vw', height: '100dvh', overflowX: 'hidden' }}
    >
      
      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {currentTab === 'teach' && (
            isTeachingSession ? (
              <TeachingSession key="session" state={state} actions={actions} onEndSession={() => {
                actions.setActiveCourseIndex(null);
                actions.setActiveSlideshowIndex(null);
              }} />
            ) : (
              <CourseSelectorScreen key="selector" state={state} actions={actions} />
            )
          )}

          {currentTab === 'manuals' && (
            <ManualsScreen key="manuals" state={state} actions={actions} />
          )}

          {currentTab === 'settings' && (
            <SettingsScreen key="settings" state={state} actions={actions} onOpenStorage={() => setIsStorageOpen(true)} />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isStorageOpen && (
            <StorageScreen key="storage" state={state} actions={actions} onBack={() => setIsStorageOpen(false)} />
          )}
        </AnimatePresence>
      </div>

      {/* Tab Bar - Hidden during active teaching session to maximize space, 
          unless we want it always visible. Plan 3 hides it during session. */}
      {!isTeachingSession && (
        <TabBar currentTab={currentTab} onTabChange={setCurrentTab} />
      )}
    </div>
  );
};
