import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, Download, Play, Pause, MonitorPlay, Settings, Info, HelpCircle, Clock } from 'lucide-react';
import { mediaUrl as m } from '../media-resolver';

interface SidebarProps {
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
  setActiveCourseIndex: (i: number | null) => void;
  setActiveSlideshowIndex: (i: number | null) => void;
  setSelectedManual: (m: any) => void;
  setActiveTab: (t: 'video'|'manual'|'slideshow'|'send-certs') => void;
  
  activeTab: 'video'|'manual'|'slideshow'|'send-certs';
  activeCourse: any;
  activeSlideshow: any;
  selectedManual: any;
  manualOutline: any[];
  expandedManualSections: Record<number, boolean>;
  setExpandedManualSections: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  flipbookRef: React.RefObject<any>;
  MANUALS: any[];
  
  activeSlideIndex: number;
  expandedSections: Record<string, boolean>;
  setExpandedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setActiveSlideIndex: (i: number) => void;
  slideshowIsPlaying: boolean;
  setSlideshowIsPlaying: (v: boolean) => void;
  toggleSlideshowPlay: () => void;
  
  activeChapterIndex: number;
  selectChapter: (i: number) => void;
  isPlaying: boolean;
  togglePlay: () => void;
  
  isTauri: boolean;
  dlState: any;
  easterEggLevel: number;
  downloadManager: any;
  
  isSettingsExpanded: boolean;
  setIsSettingsExpanded: (v: boolean) => void;
  isContinuousPlay: boolean;
  setIsContinuousPlay: (v: boolean) => void;
  
  handleInfoClick: () => void;
  handleInfoPointerDown: (e: any) => void;
  handleInfoPointerUp: () => void;
  
  showHowTo: boolean;
  setShowHowTo: (v: boolean) => void;
  setActiveGuidePath: (path: 'menu' | 'app' | 'teaching' | 'portal') => void;
  setPortalStep: (step: number) => void;
  
  updateAvailable: any;
  setUpdateAvailable: (v: any) => void;
  
  EHLogo: any;
}

export const Sidebar = React.memo(function Sidebar({
  showSidebar, setShowSidebar, setActiveCourseIndex, setActiveSlideshowIndex, setSelectedManual, setActiveTab,
  activeTab, activeCourse, activeSlideshow, selectedManual, manualOutline, expandedManualSections, setExpandedManualSections, flipbookRef, MANUALS,
  activeSlideIndex, expandedSections, setExpandedSections, setActiveSlideIndex, slideshowIsPlaying, setSlideshowIsPlaying, toggleSlideshowPlay,
  activeChapterIndex, selectChapter, isPlaying, togglePlay,
  isTauri, dlState, easterEggLevel, downloadManager,
  isSettingsExpanded, setIsSettingsExpanded, isContinuousPlay, setIsContinuousPlay,
  handleInfoClick, handleInfoPointerDown, handleInfoPointerUp,
  showHowTo, setShowHowTo, setActiveGuidePath, setPortalStep,
  updateAvailable, setUpdateAvailable,
  EHLogo
}: SidebarProps) {
  return (
    <AnimatePresence mode="wait">
      {showSidebar && (
        <motion.aside
          key="sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: "tween", ease: "easeInOut", duration: 0.4 }}
          className="h-full bg-black border-r border-eh-peach/10 flex flex-col z-50 shrink-0 overflow-hidden relative"
        >
          <div className="w-80 h-full flex flex-col shrink-0">
            <div className="p-8 border-b border-eh-peach/10">
              <div className="flex items-center justify-between gap-2 w-full">
                <div 
                  className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    setActiveCourseIndex(null);
                    setActiveSlideshowIndex(null);
                    setSelectedManual(null);
                    setActiveTab('video');
                  }}
                  title="Return to Main Menu"
                >
                  <EHLogo className="h-16 w-16" />
                  <div className="flex flex-col">
                    <span className="text-[14px] font-bold tracking-[0.3em] text-eh-red leading-none mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>EVERYDAY</span>
                    <div className="flex flex-col">
                      <span className="text-3xl font-black leading-none tracking-tighter text-eh-peach" style={{ fontFamily: "'Inter', sans-serif" }}>HERO</span>
                      <span className="text-xs font-bold tracking-[0.25em] text-eh-blue leading-none mt-1 opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>ACADEMY</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-1.5 rounded-lg border border-eh-peach/10 bg-transparent text-eh-peach/40 hover:text-eh-red hover:border-eh-red/30 transition-all duration-200 cursor-pointer hover:bg-eh-red/5 flex items-center justify-center self-center shrink-0"
                  title="Collapse Sidebar Menu"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>

            {/* Course Title Indicator */}
            {((activeTab === 'video' && activeCourse) || (activeTab === 'slideshow' && activeSlideshow) || (activeTab === 'manual')) && (
              <div className="px-6 py-3.5 border-b border-eh-peach/10 bg-eh-red/5">
                {activeTab === 'manual' ? (
                  selectedManual ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1">Active Manual</p>
                        <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug truncate" title={selectedManual.title}>
                          {selectedManual.title}
                        </h2>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedManual(null);
                          // It normally sets manual outline to [], let parent handle it or ignore it here.
                        }}
                        className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-eh-blue hover:text-eh-blue-light hover:bg-eh-blue/10 rounded border border-eh-blue/20 transition-all shrink-0 cursor-pointer"
                        title="Back to Manuals List"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1">Navigation</p>
                      <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug">
                        Choose Training Manual
                      </h2>
                    </div>
                  )
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-1.5">Active Course</p>
                    <h2 className="text-[13px] font-bold text-eh-peach tracking-wide leading-snug">
                      {activeTab === 'video' ? activeCourse?.title : activeSlideshow?.title}
                    </h2>
                  </div>
                )}
              </div>
            )}

          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {activeTab === 'manual' ? (
              selectedManual ? (
                // Render Manual TOC
                manualOutline.length > 0 ? (
                  <div className="space-y-1 px-1">
                    <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-4 px-2">Table of Contents</p>
                    {manualOutline.map((item, idx) => {
                      const hasSubItems = item.items && item.items.length > 0;
                      const isExpanded = expandedManualSections[idx];
                      return (
                      <div key={idx} className="group">
                        <div className="w-full text-left p-3 hover:bg-eh-peach/5 rounded-lg transition-colors flex items-center gap-4">
                          <button
                            onClick={() => flipbookRef.current?.resolveDestination(item.dest)}
                            className="flex-1 min-w-0 text-left cursor-pointer"
                          >
                            <h3 className="text-base font-bold truncate text-eh-peach/60 group-hover:text-eh-peach/80">
                              {item.title}
                            </h3>
                          </button>
                          
                          {hasSubItems ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedManualSections(prev => ({
                                  ...prev,
                                  [idx]: !prev[idx]
                                }));
                              }}
                              className="p-1 hover:bg-eh-peach/10 rounded transition-colors cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} className="text-eh-peach/60" />
                              ) : (
                                <ChevronRight size={14} className="text-eh-peach/60" />
                              )}
                            </button>
                          ) : (
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity text-eh-peach" />
                          )}
                        </div>
                        {hasSubItems && isExpanded && (
                          <div className="pl-4 mt-1 space-y-1">
                            {item.items.map((subItem: any, subIdx: number) => (
                              <div key={subIdx} className="w-full text-left p-3 rounded-lg hover:bg-eh-peach/5 transition-colors flex items-center gap-4 group/sub">
                                <button
                                  onClick={() => flipbookRef.current?.resolveDestination(subItem.dest)}
                                  className="flex-1 min-w-0 text-left cursor-pointer"
                                >
                                  <h3 className="text-base font-bold truncate text-eh-peach/60 group-hover/sub:text-eh-peach/80">
                                    {subItem.title}
                                 </h3>
                                </button>
                                <ChevronRight size={14} className="opacity-0 group-hover/sub:opacity-40 transition-opacity text-eh-peach" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center p-6 opacity-20">
                    <p className="text-xs font-mono uppercase tracking-widest text-eh-peach">Loading Bookmarks...</p>
                  </div>
                )
              ) : (
                // Render Manual selection list
                <div className="space-y-3 px-1">
                  <p className="text-xs uppercase tracking-[0.15em] text-eh-red font-black mb-3 px-2">Available Handbooks</p>
                  <div className="space-y-2.5">
                    {MANUALS.map((manual) => {
                      const details = {
                        instructor: {
                          description: "Comprehensive guide for instructors covering core curriculums, lesson plans, and testing guidelines.",
                          pages: "113 Pages",
                          thumb: "/manual-instructor-thumb.webp"
                        },
                        student: {
                          description: "Complete training handbook for students covering CPR, AED usage, and basic first aid for all ages.",
                          pages: "156 Pages",
                          thumb: "/manual-student-thumb.webp"
                        },
                        pediatric: {
                          description: "Specialized student guide focused on infant, child, and pediatric emergency response.",
                          pages: "170 Pages",
                          thumb: "/manual-pediatric-thumb.webp"
                        }
                      }[manual.id as 'instructor' | 'student' | 'pediatric'] || { description: '', pages: '', thumb: '' };

                      return (
                        <button
                          key={manual.id}
                          onClick={() => {
                            setSelectedManual(manual);
                            setShowSidebar(true);
                          }}
                          className="w-full text-left p-3 rounded-xl border border-transparent hover:border-eh-peach/10 bg-white/[0.02] hover:bg-eh-peach/[0.04] transition-all duration-300 flex items-start gap-3 group relative cursor-pointer"
                        >
                          <div className="w-14 h-18 rounded-lg overflow-hidden border border-white/10 shrink-0 shadow-lg relative group-hover:scale-[1.03] transition-transform duration-300">
                            <img 
                              src={details.thumb} 
                              alt={manual.title} 
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                          <div className="flex-1 min-w-0 pr-1">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-eh-peach group-hover:text-eh-red transition-colors duration-300 leading-snug line-clamp-1">
                                {manual.title.replace("EHA ", "")}
                              </h4>
                              <span className="text-xs text-eh-blue/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
                                {details.pages}
                              </span>
                            </div>
                            <p className="text-eh-peach/40 text-[9px] uppercase font-bold tracking-wider mt-0.5">
                              {manual.id} manual
                            </p>
                            <p className="text-eh-peach/50 text-[11px] leading-snug mt-1.5 line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                              {details.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            ) : activeTab === 'slideshow' && activeSlideshow ? (
              // Render Slideshow TOC
              activeSlideshow.slides.map((slide: any, index: number) => {
                const isActiveSlide = activeSlideIndex === index;
                const isExpanded = expandedSections[slide.id];

                if (slide.parentSectionId && !expandedSections[slide.parentSectionId]) {
                  return null; // Hide children if parent is not expanded
                }

                return (
                  <div key={slide.id} className={`${slide.parentSectionId ? 'pl-4 pr-0' : ''}`}>
                    <div
                      className={`w-full text-left p-3 rounded-lg group transition-all duration-300 flex items-center gap-4 ${
                        isActiveSlide
                          ? 'bg-eh-red/10 border border-eh-red/30 shadow-inner' 
                          : 'hover:bg-eh-peach/5 border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setActiveSlideIndex(index);
                          setSlideshowIsPlaying(true);
                          setActiveTab('slideshow');
                        }}
                        className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                          isActiveSlide 
                            ? 'bg-eh-red border-eh-red text-eh-peach' 
                            : 'border-eh-blue text-eh-blue group-hover:border-eh-blue-light group-hover:text-eh-blue-light'
                        }`}
                      >
                        {index + 1}
                      </button>
                      
                      <button 
                        onClick={() => {
                          setActiveSlideIndex(index);
                          if (slide.type === 'video') setSlideshowIsPlaying(true);
                          setActiveTab('slideshow');
                        }}
                        className="flex-1 min-w-0 text-left cursor-pointer"
                      >
                        <h3 className={`text-base font-bold truncate ${isActiveSlide ? 'text-eh-peach' : 'text-eh-peach/60 group-hover:text-eh-peach/80'}`}>
                          {slide.title}
                        </h3>
                      </button>
                      
                      {slide.isSectionHeader ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSections(prev => ({
                              ...prev,
                              [slide.id]: !prev[slide.id]
                            }));
                          }}
                          className="p-1 hover:bg-eh-peach/10 rounded transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-eh-peach/60" />
                          ) : (
                            <ChevronRight size={14} className="text-eh-peach/60" />
                          )}
                        </button>
                      ) : isActiveSlide && slide.type === 'video' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSlideshowPlay();
                          }}
                          className="p-1.5 bg-eh-red/10 hover:bg-eh-red/20 rounded-full transition-colors self-center flex items-center justify-center cursor-pointer"
                        >
                          {slideshowIsPlaying ? (
                            <Pause size={14} className="text-eh-red" fill="currentColor" />
                          ) : (
                            <Play size={14} className="text-eh-red ml-0.5" fill="currentColor" />
                          )}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            ) : (
              // Render Video Chapters
              activeCourse ? (
                activeCourse.chapters.map((chapter: any, index: number) => {
                  const isActiveChapter = activeChapterIndex === index;
                  const isExpanded = expandedSections[chapter.id];

                  if (chapter.parentSectionId && !expandedSections[chapter.parentSectionId]) {
                    return null; // Hide children if parent is not expanded
                  }

                  return (
                    <div key={chapter.id} className={`${chapter.parentSectionId ? 'pl-4 pr-0' : ''}`}>
                      <div
                        className={`w-full text-left p-3 rounded-lg group transition-all duration-300 flex items-center gap-4 ${
                          isActiveChapter
                            ? 'bg-eh-red/10 border border-eh-red/30 shadow-inner' 
                            : 'hover:bg-eh-peach/5 border border-transparent'
                        }`}
                      >
                        <button
                          onClick={() => selectChapter(index)}
                          className={`shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-mono transition-colors cursor-pointer ${
                            isActiveChapter 
                              ? 'bg-eh-red border-eh-red text-eh-peach' 
                              : 'border-eh-blue text-eh-blue group-hover:border-eh-blue-light group-hover:text-eh-blue-light'
                          }`}
                        >
                          {index + 1}
                        </button>
                        
                        <button 
                          onClick={() => selectChapter(index)}
                          className="flex-1 min-w-0 text-left flex items-center justify-between cursor-pointer"
                        >
                          <h3 className={`text-base font-bold truncate ${isActiveChapter ? 'text-eh-peach' : 'text-eh-peach/60 group-hover:text-eh-peach/80'}`}>
                            {chapter.title}
                          </h3>
                          <span className="text-xs text-eh-blue/60 font-mono ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shrink-0">
                            {chapter.duration}
                          </span>
                        </button>
                        
                        {/* If this is a header, show expand/collapse chevron instead of playing indicator, unless it IS playing */}
                        {chapter.isSectionHeader ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedSections(prev => ({
                                ...prev,
                                [chapter.id]: !prev[chapter.id]
                              }));
                            }}
                            className="p-1 hover:bg-eh-peach/10 rounded transition-colors cursor-pointer"
                            title={isExpanded ? "Collapse Section" : "Expand Section"}
                          >
                            {isExpanded ? (
                              <ChevronDown size={14} className="text-eh-peach/60" />
                            ) : (
                              <ChevronRight size={14} className="text-eh-peach/60" />
                            )}
                          </button>
                        ) : isActiveChapter ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePlay();
                            }}
                            className="p-1.5 bg-eh-red/10 hover:bg-eh-red/20 rounded-full transition-colors self-center flex items-center justify-center cursor-pointer"
                            title={isPlaying ? "Pause Chapter" : "Play Chapter"}
                          >
                            {isPlaying ? (
                              <Pause size={14} className="text-eh-red" fill="currentColor" />
                            ) : (
                              <Play size={14} className="text-eh-red ml-0.5" fill="currentColor" />
                            )}
                          </button>
                        ) : (
                          /* Download status / button for non-active, non-header chapters */
                          isTauri ? (
                            dlState.fileStatuses[chapter.filename?.trim().replace(/^\//, '') || ''] ? (
                              <CheckCircle2 size={16} className="text-green-500 shrink-0" title="Downloaded" />
                            ) : dlState.isDownloading && dlState.currentFile === chapter.filename?.trim().replace(/^\//, '') ? (
                              <video src={m("/CPR-Dummies.mp4")} autoPlay loop muted playsInline className="w-6 h-6 shrink-0 rounded-md object-cover" title="Downloading..." />
                            ) : dlState.queue.includes(chapter.filename?.trim().replace(/^\//, '') || '') ? (
                              <Clock size={16} className="text-eh-blue shrink-0" title="Queued for download" />
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (chapter.filename) {
                                    downloadManager.startSingleDownload(chapter.filename);
                                  }
                                }}
                                className="p-1 hover:bg-eh-blue/10 rounded-full transition-colors cursor-pointer"
                                title="Download this chapter"
                              >
                                <Download size={14} className="text-eh-blue/50 hover:text-eh-blue" />
                              </button>
                            )
                          ) : null
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="w-full text-center py-10 opacity-30 flex flex-col items-center">
                  <MonitorPlay size={48} className="mb-4" />
                  <p className="text-eh-peach/60 text-xs font-bold uppercase tracking-widest">No Course Selected</p>
                </div>
              )
            )}
          </div>

          {/* Settings Collapsible Section */}
          <div className="bg-black border-t border-eh-peach/10 pt-4 pb-2">
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className="w-[calc(100%-32px)] mx-4 flex items-center justify-between px-5 py-3 border border-white/20 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-white group-hover:rotate-90 transition-transform duration-500" />
                <span className="text-sm font-bold uppercase tracking-widest text-white">Settings</span>
              </div>
              <ChevronDown size={20} className={`text-white transition-transform duration-300 ${isSettingsExpanded ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isSettingsExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 py-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${isContinuousPlay ? 'bg-white' : 'bg-white/30'}`} />
                        <span className="text-sm font-bold uppercase tracking-widest text-white">Continuous Play</span>
                      </div>
                      <button 
                        onClick={() => setIsContinuousPlay(!isContinuousPlay)}
                        className={`w-12 h-6 rounded-full relative transition-colors duration-300 cursor-pointer ${isContinuousPlay ? 'bg-white/30' : 'bg-white/10'}`}
                      >
                        <motion.div 
                          animate={{ x: isContinuousPlay ? 26 : 2 }}
                          className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white select-none">
                        <button 
                          type="button" 
                          onClick={handleInfoClick} 
                          onPointerDown={handleInfoPointerDown}
                          onPointerUp={handleInfoPointerUp}
                          onPointerLeave={handleInfoPointerUp}
                          className="cursor-pointer hover:scale-110 transition-transform focus:outline-none"
                        >
                          <Info size={18} />
                        </button>
                        <span className="text-sm font-bold">Offline Training Mode</span>
                      </div>
                      <button
                        onClick={() => {
                          if (showHowTo) {
                            setShowHowTo(false);
                          } else {
                            setActiveGuidePath('menu');
                            setPortalStep(1);
                            setShowHowTo(true);
                          }
                        }}
                        className="flex items-center gap-2 text-[#4ae5bd] font-bold uppercase tracking-widest hover:text-white transition-colors cursor-pointer"
                      >
                        <HelpCircle size={18} />
                        Guide
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2">
                      {dlState.globalTotalCount === dlState.globalDownloadedCount && dlState.globalTotalCount > 0 ? (
                        <>
                          <CheckCircle2 size={18} className="text-green-500" />
                          <span className="text-sm font-bold text-green-500">All Offline Media Downloaded</span>
                        </>
                      ) : (
                        <button
                          onClick={() => downloadManager.startBulkDownload('everything')}
                          className="flex items-center gap-2 text-[#ff4b4b] hover:text-[#ff3333] transition-colors cursor-pointer"
                        >
                          <Download size={18} />
                          <span className="text-sm font-bold">Download All Offline Media ({Math.max(0, dlState.globalTotalCount - dlState.globalDownloadedCount)} left)</span>
                        </button>
                      )}
                    </div>

                    {/* Developer Tools for Testing UI */}
                    {(import.meta as any).env.DEV && (
                      <div className="border-t border-eh-peach/10 pt-4 flex flex-col gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-eh-peach/40">Developer tools</span>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${updateAvailable ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
                            <span className="text-xs font-bold uppercase tracking-widest text-eh-peach/80">Mock Updater UI</span>
                          </div>
                          <button 
                            onClick={() => {
                              if (updateAvailable) {
                                setUpdateAvailable(null);
                              } else {
                                setUpdateAvailable({
                                  version: '2.0.0-mock',
                                  downloadAndInstall: async () => {
                                    await new Promise(resolve => setTimeout(resolve, 3000));
                                    window.alert("Mock update complete! The app would now restart.");
                                    setUpdateAvailable(null);
                                  }
                                });
                              }
                            }}
                            className={`px-3 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                              updateAvailable 
                                ? 'bg-red-500/20 border-red-500 text-red-400 hover:bg-red-500/30' 
                                : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            {updateAvailable ? 'Hide Banner' : 'Show Banner'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
});
