import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, BookOpen, Award, HelpCircle, Projector, Info } from 'lucide-react';

interface HowToGuideModalProps {
  showHowTo: boolean;
  setShowHowTo: (show: boolean) => void;
  activeGuidePath: 'menu' | 'app' | 'teaching' | 'portal';
  setActiveGuidePath: (path: 'menu' | 'app' | 'teaching' | 'portal') => void;
  portalStep: number;
  setPortalStep: React.Dispatch<React.SetStateAction<number>>;
  isMobileWeb: boolean;
  onExitComplete?: () => void;
}

export function HowToGuideModal({
  showHowTo,
  setShowHowTo,
  activeGuidePath,
  setActiveGuidePath,
  portalStep,
  setPortalStep,
  isMobileWeb,
  onExitComplete,
}: HowToGuideModalProps) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {showHowTo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`absolute inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center ${isMobileWeb ? 'p-2' : 'p-6'}`}
          onClick={() => setShowHowTo(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className={`max-w-5xl w-full bg-[#111111] border border-white/10 overflow-hidden flex flex-col shadow-2xl relative ${isMobileWeb ? 'max-h-[calc(100dvh-1rem)] rounded-2xl' : 'max-h-[88vh] rounded-[32px]'}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="how-to-guide-title"
          >
            {/* Top Red Ambient Line */}
            <div className="h-1.5 w-full bg-gradient-to-r from-eh-red via-eh-red/60 to-eh-blue/40 shrink-0" />
            
            {/* Header */}
            <div className={`${isMobileWeb ? 'p-4' : 'p-8'} border-b border-white/5 flex items-center justify-between gap-2 shrink-0`}>
              <div className="flex items-center gap-3">
                {activeGuidePath !== 'menu' && (
                  <button
                    onClick={() => setActiveGuidePath('menu')}
                    className={`${isMobileWeb ? 'mobile-coarse-target' : ''} mr-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-eh-peach/85 hover:text-eh-peach rounded-full transition-all duration-300 flex items-center gap-1 text-xs font-black tracking-wider border border-white/5 cursor-pointer active:scale-95 focus-visible:outline-2 focus-visible:outline-eh-blue`}
                    title="Back to Main Menu"
                  >
                    <ChevronLeft size={16} />
                    <span className="hidden sm:inline">MENU</span>
                  </button>
                )}
                <div className="w-10 h-10 bg-eh-red/10 rounded-full flex items-center justify-center border border-eh-red/20 shadow-[0_0_15px_rgba(245,57,78,0.15)]">
                  <BookOpen size={20} className="text-eh-red" />
                </div>
                <div>
                  <h2 id="how-to-guide-title" className="text-xl md:text-2xl font-black text-eh-peach tracking-tight leading-none mb-1">
                    {activeGuidePath === 'menu' && "EH Academy Training Guides"}
                    {activeGuidePath === 'app' && "Guide to Using the App"}
                    {activeGuidePath === 'teaching' && "Guide to Teaching a Course"}
                    {activeGuidePath === 'portal' && "Guide to Issuing Certifications"}
                  </h2>
                  <p className="text-xs text-eh-peach/40 uppercase tracking-widest font-mono">
                    {activeGuidePath === 'menu' && "Select Your Learning Path"}
                    {activeGuidePath === 'app' && "Master Your Training App in Minutes"}
                    {activeGuidePath === 'teaching' && "Instructor Guidelines & Curriculum Standards"}
                    {activeGuidePath === 'portal' && "Secure Instructor Portal Walkthrough"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHowTo(false)}
                aria-label="Close guide"
                className={`${isMobileWeb ? 'mobile-coarse-target' : ''} p-2 bg-white/5 hover:bg-eh-red/20 hover:text-eh-red text-eh-peach/60 rounded-full transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue`}
              >
                <X size={20} />
              </button>
            </div>

            {/* Guide Contents */}
            <div className={`flex-1 min-w-0 overflow-x-hidden overflow-y-auto ${isMobileWeb ? 'p-4' : 'p-8'}`} style={{ WebkitOverflowScrolling: 'touch' }}>
              {activeGuidePath === 'menu' && (
                <div className="space-y-8">
                  {/* Welcome banner */}
                  <div className="bg-black/35 border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-eh-red/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="w-16 h-16 shrink-0 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center shadow-[0_0_20px_rgba(245,57,78,0.15)]">
                      <Award className="w-9 h-9 text-eh-red animate-pulse" />
                    </div>
                    <div className="space-y-1 text-center md:text-left">
                      <h3 className="text-xl font-bold text-eh-peach">Welcome to the Everyday Hero Academy Guides!</h3>
                      <p className="text-sm text-eh-peach/75 leading-relaxed">
                        Whether you need help navigating this offline presentation tool, want to check course guidelines and timings from the instructor manual, or need a visual walkthrough of the online certification portal, we have you covered. Select a guide path below to begin.
                      </p>
                    </div>
                  </div>

                  {/* Path Selection Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Option 1: App Guide */}
                    <div 
                      role="button"
                      tabIndex={0}
                      aria-label="Open Guide to Using the App"
                      onClick={() => setActiveGuidePath('app')}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveGuidePath('app');
                        }
                      }}
                      className="phase4-coarse-target bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-red/35 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(245,57,78,0.1)] transition-all duration-300 group cursor-pointer active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eh-blue"
                    >
                      <div className="w-14 h-14 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center text-eh-red group-hover:scale-105 group-hover:bg-eh-red/20 transition-all duration-300">
                        <HelpCircle size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">App Navigation</span>
                        <h4 className="text-lg font-black text-eh-peach">Guide to Using the App</h4>
                        <p className="text-xs text-eh-peach/60 leading-relaxed">
                          Learn how to choose curriculums, toggle chapters, enable auto-advance (Continuous Play), and navigate digital manuals.
                        </p>
                      </div>
                      <div className="pt-2 w-full">
                        <span className="inline-flex items-center gap-1.5 text-xs text-eh-red font-bold group-hover:translate-x-1 transition-transform">
                          <span>Open App Guide</span>
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>

                    {/* Option 2: Teaching Guide */}
                    <div 
                      role="button"
                      tabIndex={0}
                      aria-label="Open Guide to Teaching"
                      onClick={() => setActiveGuidePath('teaching')}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveGuidePath('teaching');
                        }
                      }}
                      className="phase4-coarse-target bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-peach/30 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(255,213,184,0.08)] transition-all duration-300 group cursor-pointer active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eh-blue"
                    >
                      <div className="w-14 h-14 bg-eh-peach/10 rounded-2xl border border-eh-peach/20 flex items-center justify-center text-eh-peach group-hover:scale-105 group-hover:bg-eh-peach/20 transition-all duration-300">
                        <Projector size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">Curriculum & Rules</span>
                        <h4 className="text-lg font-black text-eh-peach">Guide to Teaching</h4>
                        <p className="text-xs text-eh-peach/60 leading-relaxed">
                          Review course durations, class limits, required manikin ratios, feedback devices, and Slideshow vs. Video mode teaching.
                        </p>
                      </div>
                      <div className="pt-2 w-full">
                        <span className="inline-flex items-center gap-1.5 text-xs text-eh-peach font-bold group-hover:translate-x-1 transition-transform">
                          <span>Open Teaching Guide</span>
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>

                    {/* Option 3: Portal Guide */}
                    <div 
                      role="button"
                      tabIndex={0}
                      aria-label="Open Guide to Issuing Certs"
                      onClick={() => {
                        setActiveGuidePath('portal');
                        setPortalStep(1);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setActiveGuidePath('portal');
                          setPortalStep(1);
                        }
                      }}
                      className="phase4-coarse-target bg-gradient-to-b from-[#181818] to-[#121212] border border-white/5 hover:border-eh-blue/35 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 hover:shadow-[0_0_30px_rgba(62,184,255,0.08)] transition-all duration-300 group cursor-pointer active:scale-98 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eh-blue"
                    >
                      <div className="w-14 h-14 bg-eh-blue/10 rounded-2xl border border-eh-blue/20 flex items-center justify-center text-eh-blue-light group-hover:scale-105 group-hover:bg-eh-blue/20 transition-all duration-300">
                        <Award size={28} />
                      </div>
                      <div className="space-y-2">
                        <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono font-bold">Rosters & Portal</span>
                        <h4 className="text-lg font-black text-eh-peach">Guide to Issuing Certs</h4>
                        <p className="text-xs text-eh-peach/60 leading-relaxed">
                          Walk through scheduling classes, adding students individually or via CSV, marking attendance, and sending digital certification cards.
                        </p>
                      </div>
                      <div className="pt-2 w-full">
                        <span className="inline-flex items-center gap-1.5 text-xs text-eh-blue-light font-bold group-hover:translate-x-1 transition-transform">
                          <span>Open Portal Guide</span>
                          <ChevronRight size={14} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeGuidePath === 'app' && (
                <div className="space-y-8">
                  {/* Welcome banner */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="w-16 h-16 bg-eh-red/10 rounded-2xl border border-eh-red/20 flex items-center justify-center shrink-0">
                      <HelpCircle size={32} className="text-eh-red" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-eh-peach">Welcome to CPR Trainer Pro!</h3>
                      <p className="text-sm text-eh-peach/70 leading-relaxed">
                        This application was custom-built by Everyday Hero Academy to provide instructors with a reliable, ultra-premium offline training platform. Follow this quick guide to master the user interface and deliver a seamless teaching experience.
                      </p>
                    </div>
                  </div>

                  {/* Grid of Sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Step 1 */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                          1
                        </div>
                        <h4 className="text-base font-black text-eh-peach">Selecting Course & Edition</h4>
                      </div>
                      <p className="text-sm text-eh-peach/60 leading-relaxed">
                        Use the large header tabs at the top of the screen to choose your main curriculum category:
                      </p>
                      <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span><strong className="text-eh-peach">CPR & AED:</strong> Choose between Adult, Pediatric, Spanish, or special editions.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span><strong className="text-eh-peach">FIRST AID:</strong> Select First Aid Core, Pediatric First Aid, or Spanish modules.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                          2
                        </div>
                        <h4 className="text-base font-black text-eh-peach">Navigating Chapters & Slides</h4>
                      </div>
                      <p className="text-sm text-eh-peach/60 leading-relaxed">
                        Your class curriculum is structured into simple chapters in the Left Sidebar Menu:
                      </p>
                      <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>Click any chapter to jump directly to that video or topic.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>Click the <span className="text-eh-red font-bold">Sidebar Toggle</span> button (<ChevronLeft size={14} className="inline-block align-middle" /> inside the sidebar, or click the Menu icon in the top header) to collapse or expand the menu for a full-screen cinematic look.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                          3
                        </div>
                        <h4 className="text-base font-black text-eh-peach">Continuous Play (Auto-Advance)</h4>
                      </div>
                      <p className="text-sm text-eh-peach/60 leading-relaxed">
                        Teaching in front of a class and don't want to keep walking back to click the next chapter?
                      </p>
                      <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>{isMobileWeb
                            ? 'Continuous Play can be turned on in the course menu or in Settings (the gear icon at the top of the screen).'
                            : <>Toggle <strong className="text-eh-peach">Continuous Play</strong> ON in the bottom left of the sidebar.</>}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>The player will automatically advance to the next video or presentation chapter once the current video finishes.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                          4
                        </div>
                        <h4 className="text-base font-black text-eh-peach">Training Manuals & Handbooks</h4>
                      </div>
                      <p className="text-sm text-eh-peach/60 leading-relaxed">
                        Access official digital training manuals directly inside the app:
                      </p>
                      <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>Click <strong className="text-eh-peach">Training Manuals</strong> in the header and choose a handbook.</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span>Use the fully interactive Table of Contents in the sidebar to jump straight to specific chapters or bookmarks instantly.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Step 5 */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-red/20 transition-all duration-300 group md:col-span-2">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-eh-red/10 border border-eh-red/20 flex items-center justify-center text-eh-red font-black text-sm group-hover:scale-105 transition-transform">
                          5
                        </div>
                        <h4 className="text-base font-black text-eh-peach">Ready to Certify? (Send Cards)</h4>
                      </div>
                      <p className="text-sm text-eh-peach/60 leading-relaxed">
                        When your class is complete, head to the <strong className="text-eh-peach">Send Certs</strong> tab in the header:
                      </p>
                      <ul className="text-sm text-eh-peach/75 space-y-2 pl-2">
                        <li className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0" />
                          <span><strong className="text-eh-peach">Online:</strong> Click the secure launcher to open the secure Everyday Hero Academy instructor portal in your default browser to issue digital training cards.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-eh-red shrink-0 mt-1.5" />
                          <span>If you are offline, you can still teach the course but you must keep your own accurate roster and upload it to your portal on <strong className="text-eh-peach">EHAcademy.com</strong> in order to assign official Everyday Hero Academy digital certifications.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {activeGuidePath === 'teaching' && (
                <div className="space-y-8">
                  {/* Top banner */}
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-eh-peach/5 rounded-full blur-3xl pointer-events-none" />
                    <div className="w-16 h-16 shrink-0 bg-eh-peach/10 rounded-2xl border border-eh-peach/20 flex items-center justify-center">
                      <Projector size={32} className="text-eh-peach" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-eh-peach">EH Academy Course Instruction Standards</h3>
                      <p className="text-sm text-eh-peach/70 leading-relaxed">
                        Review core guidelines, manikin requirements, timing information, and teaching modes from the official Everyday Hero Academy Instructor Manual. Designed for high quality, standardized outcomes.
                      </p>
                    </div>
                  </div>

                  {/* Classroom setup grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Box 1: Student Ratios & Manikins */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300">
                      <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-eh-peach" />
                        Instructor & Roster Limits
                      </h4>
                      <ul className="text-sm text-eh-peach/70 space-y-3">
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">1.</span>
                          <span><strong className="text-eh-peach">Instructor Limit:</strong> Standard ratio is <span className="text-eh-peach font-bold">12 students per instructor</span>. If your class exceeds 12 students, a co-instructor or second teacher is required.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">2.</span>
                          <span><strong className="text-eh-peach">Manikin Ratio:</strong> Maximum student-to-manikin ratio is <span className="text-eh-peach font-bold">3:1</span>. For optimal hands-on time and shorter class lengths, a <span className="text-eh-peach font-bold">1:1 ratio</span> is highly recommended.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">3.</span>
                          <span><strong className="text-eh-peach">No Student Minimum:</strong> Classes can be conducted for any number of students, even a single individual.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Box 2: Key Equipment & Manikins */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300">
                      <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-eh-peach" />
                        Manikins & Feedback Devices
                      </h4>
                      <ul className="text-sm text-eh-peach/70 space-y-3">
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">1.</span>
                          <span><strong className="text-eh-peach">Feedback Devices:</strong> Standard curriculums require compressions with instrumented feedback. E.g., Prestan manikins show <span className="text-eh-peach font-bold">two green lights</span> to indicate the perfect CPR compression rate (100–120 bpm).</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">2.</span>
                          <span><strong className="text-eh-peach">Floor Placement:</strong> For realistic mechanics, adult manikins must be placed on the floor during practice.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-eh-peach font-bold font-mono">3.</span>
                          <span><strong className="text-eh-peach">Accommodations:</strong> If a student cannot kneel, you can accommodate them by placing the manikin on a table or chair so they can practice comfortably.</span>
                        </li>
                      </ul>
                    </div>

                    {/* Box 3: Course Timings */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300 md:col-span-2">
                      <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-eh-peach" />
                        Official Course Teaching Times
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
                        <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <div className="text-eh-peach/40 uppercase tracking-widest font-bold">Comprehensive Courses</div>
                          <div className="text-sm font-bold text-eh-peach">2.5 to 3 Hours</div>
                          <div className="text-[11px] text-eh-peach/60 font-sans mt-1">CPR AED & First Aid (All Ages or Pediatric Combined)</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <div className="text-eh-peach/40 uppercase tracking-widest font-bold">CPR AED Core Only</div>
                          <div className="text-sm font-bold text-eh-peach">1 hr 20m - 2 Hours</div>
                          <div className="text-[11px] text-eh-peach/60 font-sans mt-1">Adult, Child, & Infant (Adult Only: 1-1.5 hrs; Child/Infant: 1.5 hrs)</div>
                        </div>
                        <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-1">
                          <div className="text-eh-peach/40 uppercase tracking-widest font-bold">First Aid Core Only</div>
                          <div className="text-sm font-bold text-eh-peach">1 Hour 15 Mins</div>
                          <div className="text-[11px] text-eh-peach/60 font-sans mt-1">First Aid Only Course (Excludes CPR & AED segments)</div>
                        </div>
                      </div>
                    </div>

                    {/* Box 4: Video vs Slideshow */}
                    <div className="bg-black/20 border border-white/5 rounded-2xl p-6 space-y-4 hover:border-eh-peach/25 transition-all duration-300 md:col-span-2">
                      <h4 className="text-base font-black text-eh-peach flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-eh-peach" />
                        Teaching Mediums: Video vs Slideshow
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-eh-peach/70">
                        <div className="space-y-2">
                          <h5 className="font-bold text-eh-peach flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-eh-red" />
                            Video Mode (Continuous Play)
                          </h5>
                          <p className="leading-relaxed text-xs">
                            High-quality narrations, hands-free automation, and perfect pacing. Excellent for standard classes, allowing you as the instructor to walk around, correct compression postures, monitor feedback devices, and assist students directly while the video does the talking.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <h5 className="font-bold text-eh-peach flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-eh-blue" />
                            Slideshow Mode (Self-Paced)
                          </h5>
                          <p className="leading-relaxed text-xs">
                            Fully manual, customized, and instructor-controlled. Excellent for adapting to class speeds, handling interactive Q&A sessions, diving into manual annotations, or customizing your presentation flow to suit special corporate or school audiences.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeGuidePath === 'portal' && (
                <div className="space-y-6">
                  {/* Step Indicator dots & tabs */}
                  <div className="flex flex-wrap items-center justify-between border-b border-white/5 pb-4 gap-4">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { step: 1, label: "1. Classes Page" },
                        { step: 2, label: "2. Create Class" },
                        { step: 3, label: "3. Build Roster" },
                        { step: 4, label: "4. Open Class" },
                        { step: 5, label: "5. Attendance" },
                        { step: 6, label: "6. Issue Certs" }
                      ].map((s) => (
                        <button
                          key={s.step}
                          onClick={() => setPortalStep(s.step)}
                          className={`${isMobileWeb ? 'mobile-coarse-target' : ''} px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all duration-300 cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue ${
                            portalStep === s.step
                              ? 'bg-eh-blue text-white border border-eh-blue shadow-[0_0_10px_rgba(62,184,255,0.25)]'
                              : 'bg-black/30 text-eh-peach/40 border border-white/5 hover:border-white/20'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-eh-peach/40 font-mono font-bold bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                      Step {portalStep} of 6
                    </div>
                  </div>

                  {/* Step Contents */}
                  {[
                    {
                      step: 1,
                      title: "1. Access your Dashboard",
                      subtitle: "Log in & navigate",
                      desc: "First, access your portal by logging into www.ehacademy.com using your registered instructor credentials. This brings you to your main Dashboard. From here, you can see your account stats, welcome banner, and general resources. To manage your courses, click 'Classes' in the left-hand navigation menu.",
                      image: "/guide/step1_dashboard.png"
                    },
                    {
                      step: 2,
                      title: "2. The Classes Page",
                      subtitle: "Your scheduling hub",
                      desc: "After clicking 'Classes', you will arrive at your class management hub. On the left, you'll see a list of all your upcoming classes. On the right, the monthly calendar highlights your active schedule. Click the dark blue 'Create a Class' button in the top-right corner to begin scheduling a new course.",
                      image: "/guide/step2_create_class.png"
                    },
                    {
                      step: 3,
                      title: "3. Fill Class Details",
                      subtitle: "Entering course info",
                      desc: "The 'Create a Class' form will replace the list. Fill in the required fields: select your name from the Instructor dropdown, enter the Date and Start Time, and select your Location and Client. If the location or client is new, click the 'Create New' quick links directly below each field to save them for future reuse.",
                      image: "/guide/step3_add_roster.png"
                    },
                    {
                      step: 4,
                      title: "4. Build the Roster & Submit",
                      subtitle: "Adding your students",
                      desc: "Click 'Add Roster' to expand the student section. You can enter students individually by typing their Name and Email and clicking 'Add Student', or upload a CSV in batch using our template. Once finished, choose the appropriate Certificate Type from the dropdown and click 'Create Class' at the bottom.",
                      image: "/guide/step4_detail_view.png"
                    },
                    {
                      step: 5,
                      title: "5. Mark Student Attendance",
                      subtitle: "Confirming participation",
                      desc: "From the Classes page, click on your created class in the list or calendar to open the Class Details page. Scroll down to the Roster section. Confirm each student's physical participation in the training session by clicking the green 'Mark as Attended' button next to their name.",
                      image: "/guide/step5_roster_list.png"
                    },
                    {
                      step: 6,
                      title: "6. Record Pass & Issue Certs",
                      subtitle: "Emailing digital cards",
                      desc: "After marking a student as attended, their status updates. Click 'Mark as Passed' for successful students. Once passed, click 'Send Certs To All Students' or 'Send Certificate' next to an individual student to instantly email their digital card. You can also click 'Download All Certs (ZIP)' to save a copy.",
                      image: "/guide/step6_mark_attendance.png"
                    }
                  ].map((s) => {
                    if (s.step !== portalStep) return null;
                    return (
                      <motion.div
                        key={s.step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
                      >
                        <div className="lg:col-span-2 space-y-4">
                          <div>
                            <span className="text-[10px] text-eh-blue-light uppercase tracking-widest font-mono font-bold">{s.subtitle}</span>
                            <h3 className="text-xl font-black text-eh-peach mt-0.5">{s.title}</h3>
                          </div>
                          <p className="text-sm text-eh-peach/70 leading-relaxed whitespace-pre-line">
                            {s.desc}
                          </p>
                          
                          {/* Quick advice box */}
                          <div className="bg-eh-blue/5 border border-eh-blue/15 rounded-2xl p-4 text-xs text-eh-blue-light flex gap-2">
                            <Info size={16} className="shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Pro Tip:</span> Everyday Hero Academy digital certifications are fully automated and emailed directly to your students' inboxes. <span className="text-eh-peach font-bold">Note:</span> Certifications can only be issued by accounts with an active paid subscription or a valid single class purchase.
                            </div>
                          </div>

                          {/* Navigation arrows inside details for convenience */}
                          <div className="flex items-center gap-3 pt-2">
                            <button
                              onClick={() => setPortalStep(prev => Math.max(1, prev - 1))}
                              disabled={portalStep === 1}
                              className={`${isMobileWeb ? 'mobile-coarse-target min-h-11' : ''} px-4 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold text-eh-peach flex items-center gap-1.5 transition-all border border-white/5 cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue`}
                            >
                              <ChevronLeft size={14} />
                              <span>Previous</span>
                            </button>
                            <button
                              onClick={() => setPortalStep(prev => Math.min(6, prev + 1))}
                              disabled={portalStep === 6}
                              className={`${isMobileWeb ? 'mobile-coarse-target min-h-11' : ''} px-4 py-2 bg-eh-blue hover:bg-eh-blue-light disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue`}
                            >
                              <span>Next Step</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {/* Screenshot view */}
                        <div className="lg:col-span-3 space-y-2">
                          <div className="bg-black/50 border border-white/10 rounded-2xl p-2 relative shadow-2xl overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300 flex items-end p-4">
                              <span className="text-[10px] text-eh-peach/60 uppercase tracking-widest font-mono">Clean screenshot with Claude overlays neutralized</span>
                            </div>
                            <img
                              src={s.image}
                              alt={s.title}
                              className="w-full h-auto rounded-xl object-contain border border-white/5 bg-[#151515]"
                            />
                          </div>
                          <div className="text-[10px] text-eh-peach/30 text-center font-mono uppercase tracking-widest">
                            Everyday Hero Academy Instructor Portal Interface
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`${isMobileWeb ? 'p-3 flex-wrap gap-3' : 'p-6'} bg-black/40 border-t border-white/5 flex items-center justify-between shrink-0`}>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-eh-peach/30 uppercase tracking-widest font-bold">CPR Trainer Pro v1.0.0</span>
                {activeGuidePath !== 'menu' && (
                  <button
                    onClick={() => setActiveGuidePath('menu')}
                    className={`${isMobileWeb ? 'mobile-coarse-target min-h-11' : ''} px-4 py-1.5 bg-white/5 hover:bg-white/10 text-eh-peach/60 hover:text-eh-peach border border-white/5 hover:border-white/10 rounded-full text-[10px] uppercase font-mono font-bold tracking-wider transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue`}
                  >
                    Main Menu
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowHowTo(false)}
                className={`${isMobileWeb ? 'mobile-coarse-target min-h-11' : ''} px-6 py-2.5 bg-eh-red hover:bg-eh-red-dark text-eh-peach font-bold rounded-full text-xs shadow-xl active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue`}
              >
                Close Guide
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
