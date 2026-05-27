import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, ChevronDown, CheckCircle2, HelpCircle, BookOpen, ChevronRight, GraduationCap, Baby, Book, Award, Heart } from 'lucide-react';
import { mediaUrl as m } from '../media-resolver';

interface HeaderNavProps {
  showSidebar: boolean;
  setShowSidebar: (v: boolean) => void;
  setActiveCourseIndex: (i: number | null) => void;
  setActiveSlideshowIndex: (i: number | null) => void;
  setSelectedManual: (m: any) => void;
  setActiveTab: (t: 'video'|'manual'|'slideshow'|'send-certs') => void;
  
  lastCprView: 'video'|'slideshow'|null;
  showCprSelector: boolean;
  setShowCprSelector: (v: boolean) => void;
  isCprActive: boolean;
  cprVaEnabled: boolean;
  setCprVaEnabled: (v: boolean) => void;
  
  lastFaView: 'video'|'slideshow'|null;
  showFaSelector: boolean;
  setShowFaSelector: (v: boolean) => void;
  isFaActive: boolean;
  faPediatric: boolean;
  setFaPediatric: (v: boolean) => void;
  faVaEnabled: boolean;
  setFaVaEnabled: (v: boolean) => void;
  
  setShowManualSelector: (v: boolean) => void;
  showManualSelector: boolean;
  selectedManual: any;
  
  activeTab: 'video'|'manual'|'slideshow'|'send-certs';
  previewManualIndex: number;
  setPreviewManualIndex: (i: number) => void;
  
  easterEggLevel: number;
  activeCourse: any;
  activeChapterIndex: number;
  
  updateAvailable: boolean;
  isUpdateMinimized: boolean;
  setIsUpdateMinimized: (v: boolean) => void;
  
  handleItemClick: (type: 'video'|'slideshow', courseIndex: number) => void;
  MANUALS: any[];
  
  EHLogo: any;
  CprIcon: any;
  FirstAidIcon: any;
}

export const HeaderNav = React.memo(function HeaderNav({
  showSidebar, setShowSidebar,
  setActiveCourseIndex, setActiveSlideshowIndex, setSelectedManual, setActiveTab,
  lastCprView, showCprSelector, setShowCprSelector, isCprActive, cprVaEnabled, setCprVaEnabled,
  lastFaView, showFaSelector, setShowFaSelector, isFaActive, faPediatric, setFaPediatric, faVaEnabled, setFaVaEnabled,
  setShowManualSelector, showManualSelector, selectedManual,
  activeTab, previewManualIndex, setPreviewManualIndex,
  easterEggLevel, activeCourse, activeChapterIndex,
  updateAvailable, isUpdateMinimized, setIsUpdateMinimized,
  handleItemClick, MANUALS,
  EHLogo, CprIcon, FirstAidIcon
}: HeaderNavProps) {
  return (
    <header className={`h-20 pr-4 xl:pr-8 border-b border-eh-peach/10 flex items-center justify-between bg-black z-[60] shrink-0 transition-[padding-left] duration-[400ms] ease-in-out relative ${
      showSidebar ? "pl-8" : "pl-4"
    }`}>
      <div className="flex items-center gap-6 h-full">
        <motion.div
          animate={{ 
            width: showSidebar ? 0 : 215, 
            opacity: showSidebar ? 0 : 1,
            x: showSidebar ? -10 : 0
          }}
          transition={{ type: "tween", ease: "easeInOut", duration: 0.4 }}
          className="flex items-center gap-3 overflow-hidden shrink-0"
        >
          <button 
            onClick={() => setShowSidebar(true)}
            className="p-1.5 rounded-lg border border-eh-peach/10 bg-black/40 text-eh-peach/60 hover:text-eh-red hover:border-eh-red/30 hover:bg-eh-red/5 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
            title="Expand Sidebar Menu"
          >
            <Menu size={18} />
          </button>
          
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              setActiveCourseIndex(null);
              setActiveSlideshowIndex(null);
              setSelectedManual(null);
              setActiveTab('video');
            }}
            title="Return to Main Menu"
          >
            <EHLogo className="h-11 w-11 shrink-0 ml-1" />
            <div className="flex flex-col shrink-0 select-none">
              <span className="text-[9.5px] font-bold tracking-[0.3em] text-eh-red leading-none mb-0.5" style={{ fontFamily: "'Inter', sans-serif" }}>EVERYDAY</span>
              <div className="flex flex-col">
                <span className="text-xl font-black leading-none tracking-tighter text-eh-peach" style={{ fontFamily: "'Inter', sans-serif" }}>HERO</span>
                <span className="text-[8px] font-bold tracking-[0.25em] text-eh-blue leading-none mt-0.5 opacity-70" style={{ fontFamily: "'Inter', sans-serif" }}>ACADEMY</span>
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="flex items-end h-full gap-2 lg:gap-8 z-50 pt-4">
          <div className="relative h-full flex items-end">
            <button 
              onClick={() => {
                if (lastCprView && (activeTab === 'manual' || activeTab === 'send-certs')) {
                  setActiveTab(lastCprView);
                  setShowSidebar(true);
                  setShowCprSelector(false);
                } else {
                  setShowCprSelector(!showCprSelector);
                }
                setShowFaSelector(false);
                setShowManualSelector(false);
              }}
              className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${isCprActive ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
              title="Select CPR & AED Course Edition"
            >
              <div className="flex items-center gap-2">
                <CprIcon className={`w-7 h-7 ${isCprActive ? 'text-eh-red' : 'text-eh-peach'}`} />
                <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">
                  CPR & AED
                </h2>
                <ChevronDown size={16} className={`text-eh-red transition-transform ${showCprSelector ? 'rotate-180' : ''}`} />
              </div>
            </button>

            <AnimatePresence>
              {showCprSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 z-50 origin-top-left"
                  style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                >
                  <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                    <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">CPR & AED FOR ALL AGES</h3>
                    <div className="flex gap-6">
                      <div className="flex-1 flex flex-col justify-between">
                        <AnimatePresence mode="popLayout">
                          <motion.ul 
                            key={cprVaEnabled ? 'cpr-va-list' : 'cpr-std-list'}
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="space-y-4 text-sm text-white font-bold w-full"
                          >
                            {cprVaEnabled ? (
                              <>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Narrated Course</strong> — Virtual Assistant guides each section</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Hands-free automation for classroom delivery</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full AHA & OSHA compliant certification</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Adults, children & infants</span></li>
                              </>
                            ) : (
                              <>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full CPR & AED Certification Course</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Teach at your own pace</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Covers Adult, Child & Infant CPR</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Interactive slides with practice cues</span></li>
                              </>
                            )}
                          </motion.ul>
                        </AnimatePresence>
                      </div>
                      <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 relative bg-black/40">
                          <AnimatePresence mode="popLayout">
                            <motion.img 
                              key={cprVaEnabled ? 'cpr-va' : 'cpr-std'}
                              src={m(cprVaEnabled ? "/CPR AED for All Ages with VA.webp" : "/CPR AED for All Ages Cover.webp")} 
                              alt="CPR AED Course Cover" 
                              className="w-full h-full object-cover absolute inset-0"
                              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[13px] text-white/90 font-bold tracking-wide">Enable Virtual Assistant?</span>
                          <button onClick={() => setCprVaEnabled(!cprVaEnabled)} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer ${cprVaEnabled ? 'bg-[#ff4b4b]' : 'bg-[#333]'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${cprVaEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        <div className="group relative w-full text-center">
                          <button className="text-xs font-bold tracking-wider text-white/70 hover:text-white transition-colors flex items-center gap-1 mx-auto cursor-pointer"><HelpCircle size={12} /><span>What is this?</span></button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">When enabled, a virtual assistant narrates each section of the course automatically, allowing hands-free teaching.</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { if (cprVaEnabled) { handleItemClick('video', 0); } else { handleItemClick('slideshow', 0); } }} className="w-full mt-5 py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all duration-300 cursor-pointer active:scale-[0.98] shadow-[0_0_20px_rgba(255,75,75,0.3)]">
                      START COURSE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative h-full flex items-end">
            <button 
              onClick={() => {
                if (lastFaView && (activeTab === 'manual' || activeTab === 'send-certs')) {
                  setActiveTab(lastFaView);
                  setShowSidebar(true);
                  setShowFaSelector(false);
                } else {
                  setShowFaSelector(!showFaSelector);
                }
                setShowCprSelector(false);
                setShowManualSelector(false);
              }}
              className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${isFaActive ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
              title="Select First Aid Course Edition"
            >
              <div className="flex items-center gap-2">
                <FirstAidIcon className={`w-7 h-7 ${isFaActive ? 'text-eh-red' : 'text-eh-peach'}`} />
                <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">
                  FIRST AID
                </h2>
                <ChevronDown size={16} className={`text-eh-red transition-transform ${showFaSelector ? 'rotate-180' : ''}`} />
              </div>
            </button>

            <AnimatePresence>
              {showFaSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 mt-2 z-50 origin-top-left"
                  style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                >
                  <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                    <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">{faPediatric ? 'PEDIATRIC FIRST AID' : 'FIRST AID FOR ALL AGES'}</h3>
                    <div className="flex gap-6">
                      <div className="flex-1 flex flex-col justify-between">
                        <AnimatePresence mode="popLayout">
                          <motion.ul 
                            key={faPediatric ? 'fa-pedi-list' : faVaEnabled ? 'fa-va-list' : 'fa-std-list'}
                            initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="space-y-4 text-sm text-white font-bold w-full"
                          >
                            {faPediatric ? (
                              <>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Pediatric-Focused Course</strong></span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Ideal for childcare & school staff</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Children & infants focus</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Self-paced slideshow format</span></li>
                              </>
                            ) : faVaEnabled ? (
                              <>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span><strong className="text-white">Narrated Course</strong> — Virtual Assistant guides each section</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Hands-free automation for classroom delivery</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full AHA & OSHA compliant certification</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Adults, children & infants</span></li>
                              </>
                            ) : (
                              <>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Full First Aid Certification Course</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Teach at your own pace</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Covers all age groups & scenarios</span></li>
                                <li className="flex items-center gap-3"><CheckCircle2 size={18} className="text-[#ff4b4b] shrink-0"/><span>Interactive slides with practice cues</span></li>
                              </>
                            )}
                          </motion.ul>
                        </AnimatePresence>
                      </div>
                      <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10 relative bg-black/40">
                          <AnimatePresence mode="popLayout">
                            <motion.img 
                              key={faPediatric ? 'fa-pedi' : faVaEnabled ? 'fa-va' : 'fa-std'}
                              src={m(faPediatric ? "/Pediatric First Aid Cover.webp" : faVaEnabled ? "/First Aid for All Ages with VA.webp" : "/First Aid for All Ages Cover.webp")} 
                              alt="First Aid Course Cover" 
                              className="w-full h-full object-cover absolute inset-0"
                              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </AnimatePresence>
                        </div>
                        <div className="flex items-center justify-between w-full group/va relative">
                          <span className={`text-[13px] font-bold tracking-wide ${faPediatric ? 'text-white/30' : 'text-white/90'}`}>Enable Virtual Assistant?</span>
                          <button onClick={() => { if (!faPediatric) setFaVaEnabled(!faVaEnabled); }} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 ${faPediatric ? 'bg-[#222] cursor-not-allowed' : faVaEnabled ? 'bg-[#ff4b4b] cursor-pointer' : 'bg-[#333] cursor-pointer'}`} disabled={faPediatric}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${faVaEnabled && !faPediatric ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                          {faPediatric && <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-56 opacity-0 group-hover/va:opacity-100 transition-opacity pointer-events-none z-50">Not available for Pediatric First Aid Course</div>}
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[13px] text-white/90 font-bold tracking-wide">Pediatric Focused?</span>
                          <button onClick={() => { const next = !faPediatric; setFaPediatric(next); if (next) { setFaVaEnabled(false); } }} className={`shrink-0 relative w-10 h-5 rounded-full transition-colors duration-300 cursor-pointer ${faPediatric ? 'bg-[#ff4b4b]' : 'bg-[#333]'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-300 ${faPediatric ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                        <div className="group relative w-full text-center">
                          <button className="text-xs font-bold tracking-wider text-white/70 hover:text-white transition-colors flex items-center gap-1 mx-auto cursor-pointer"><HelpCircle size={12} /><span>What is this?</span></button>
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-xl text-[10px] text-[#aaa] w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">When enabled, a virtual assistant narrates each section of the course automatically, allowing hands-free teaching.</div>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => { if (faPediatric) { handleItemClick('slideshow', 4); } else if (faVaEnabled) { handleItemClick('video', 1); } else { handleItemClick('slideshow', 1); } }} className="w-full mt-5 py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all duration-300 cursor-pointer active:scale-[0.98] shadow-[0_0_20px_rgba(255,75,75,0.3)]">
                      START COURSE
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative h-full flex items-end">
            <button 
              onClick={() => {
                if (selectedManual && activeTab !== 'manual') {
                  setActiveTab('manual');
                  setShowSidebar(true);
                  setShowManualSelector(false);
                } else {
                  setShowManualSelector(!showManualSelector);
                }
                setShowCprSelector(false);
                setShowFaSelector(false);
              }}
              className={`hidden sm:flex flex-col items-start px-4 ${selectedManual ? 'pb-2' : 'pb-4'} border-b-2 transition-colors ${activeTab === 'manual' ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
              title="Browse Student and Instructor Handbooks"
            >
              <div className="flex items-center gap-2">
                <BookOpen size={20} className={activeTab === 'manual' ? 'text-eh-red' : 'text-eh-peach'} />
                {selectedManual ? (
                  <>
                    <h2 className="font-serif text-xl font-bold leading-tight text-eh-peach tracking-tight">{selectedManual.title}</h2>
                    <ChevronDown size={16} className={`text-eh-red transition-transform ${showManualSelector ? 'rotate-180' : ''}`} />
                  </>
                ) : (
                  <>
                    <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">TRAINING MANUALS</h2>
                    <ChevronDown size={16} className={`text-eh-red transition-transform ${showManualSelector ? 'rotate-180' : ''}`} />
                  </>
                )}
              </div>
              {selectedManual && <p className="text-[10px] uppercase tracking-widest text-eh-red font-bold mt-0.5 ml-7">TRAINING MANUALS</p>}
            </button>

            <AnimatePresence>
              {showManualSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full right-0 mt-2 z-50 origin-top-right"
                  style={{ willChange: "transform, opacity", backfaceVisibility: "hidden" }}
                >
                  <div className="p-6 bg-[#0a0a0a]/85 backdrop-blur-3xl rounded-[24px] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] w-[560px] relative z-[9999]">
                    <h3 className="text-2xl font-black text-[#ff4b4b] uppercase tracking-tight leading-none text-center mb-5">CHOOSE TRAINING MANUAL</h3>
                    <div className="flex gap-6">
                      <div className="flex-1 flex flex-col justify-start">
                        <div className="space-y-3">
                          {MANUALS.map((manual, index) => (
                            <button
                              key={manual.id}
                              onClick={() => setPreviewManualIndex(index)}
                              className={`w-full text-left p-4 rounded-xl transition-all duration-500 border flex items-center justify-between group relative overflow-hidden ${previewManualIndex === index ? 'bg-gradient-to-r from-eh-red/20 to-transparent border-eh-red/50 shadow-[0_0_30px_rgba(255,75,75,0.2)] scale-[1.02]' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 hover:scale-[1.01]'}`}
                            >
                              {previewManualIndex === index && <div className="absolute left-0 top-0 bottom-0 w-1 bg-eh-red rounded-l-xl shadow-[0_0_10px_rgba(255,75,75,0.8)]" />}
                              <div className="flex items-center gap-4 z-10 relative">
                                <div className={`p-2 rounded-lg transition-colors duration-300 ${previewManualIndex === index ? 'bg-eh-red/20 text-eh-red shadow-[0_0_15px_rgba(255,75,75,0.3)]' : 'bg-black/40 text-white/50 group-hover:text-white/90 group-hover:bg-black/60'}`}>
                                  {manual.id === 'instructor' ? <GraduationCap size={20} /> : manual.id === 'pediatric' ? <Baby size={20} /> : <Book size={20} />}
                                </div>
                                <span className={`text-base font-black tracking-wide transition-colors duration-300 ${previewManualIndex === index ? 'text-white drop-shadow-[0_2px_4px_rgba(255,75,75,0.4)]' : 'text-white/70 group-hover:text-white'}`}>{manual.title}</span>
                              </div>
                              <div className={`transition-all duration-300 z-10 relative ${previewManualIndex === index ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0 group-hover:opacity-50 group-hover:translate-x-0'}`}>
                                <ChevronRight size={20} className={previewManualIndex === index ? "text-eh-red" : "text-white"} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="w-[260px] flex flex-col items-center gap-4 shrink-0">
                        <div className="w-full aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative bg-black/40 shadow-xl">
                          <AnimatePresence mode="popLayout">
                            <motion.img 
                              key={previewManualIndex}
                              src={m(MANUALS[previewManualIndex].thumbnail)} 
                              alt={MANUALS[previewManualIndex].title} 
                              className="w-full h-full object-cover absolute inset-0"
                              initial={{ opacity: 0, scale: 0.98, filter: 'blur(4px)' }}
                              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, scale: 1.02, filter: 'blur(4px)' }}
                              transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                          </AnimatePresence>
                        </div>
                        
                        <p className="text-xs text-white/70 text-center leading-relaxed font-medium min-h-[48px]">
                          {MANUALS[previewManualIndex].description}
                        </p>
                        
                        <button 
                          onClick={() => {
                            setSelectedManual(MANUALS[previewManualIndex]);
                            setShowManualSelector(false);
                            setShowSidebar(true);
                            setActiveTab('manual');
                          }}
                          className="w-full py-3 bg-[#ff4b4b] hover:bg-[#ff3333] text-white font-bold rounded-xl transition-all duration-300 tracking-wide mt-auto hover:shadow-[0_0_20px_rgba(255,75,75,0.4)] hover:scale-[1.02] active:scale-95"
                        >
                          OPEN {MANUALS[previewManualIndex].title.toUpperCase()}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative h-full flex items-end">
            <button 
              onClick={() => {
                setActiveTab('send-certs');
                setShowCprSelector(false);
                setShowFaSelector(false);
                setShowManualSelector(false);
              }}
              className={`hidden sm:flex flex-col items-start px-4 pb-4 border-b-2 transition-colors ${activeTab === 'send-certs' ? 'border-eh-red' : 'border-transparent hover:border-eh-peach/20 opacity-50 hover:opacity-100'}`}
              title="Done teaching? Ready to certify your students?"
            >
              <div className="flex items-center gap-2">
                <Award size={20} className={activeTab === 'send-certs' ? 'text-eh-red' : 'text-eh-peach'} />
                <h2 className="font-serif text-xl font-bold leading-tight text-eh-red tracking-tight uppercase">SEND CERTS</h2>
              </div>
            </button>
          </div>
          {easterEggLevel > 0 && (
            <div className="hidden sm:flex relative items-center justify-center self-center ml-2 h-10 w-14">
              <div 
                className={`absolute h-8 w-auto rounded overflow-hidden transition-all duration-1000 ease-in-out ${easterEggLevel === 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
              >
                <video src={m("/CPR-Dummies.mp4")} autoPlay loop muted playsInline className="h-full w-auto object-cover" />
              </div>
              
              <div 
                className={`absolute h-10 w-10 overflow-hidden transition-all duration-1000 ease-in-out ${easterEggLevel === 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'}`}
                style={{ 
                  WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 70%)', 
                  maskImage: 'radial-gradient(circle, black 40%, transparent 70%)' 
                }}
              >
                <video src={m("/WakeUp-Friends-SpaceStars.mp4")} autoPlay loop muted playsInline className="h-full w-full object-cover" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {activeCourse && (
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] text-eh-peach/40 uppercase tracking-widest font-mono">Current Progress</span>
            <span className="font-mono text-xs text-eh-peach/80">{Math.round(((activeChapterIndex + 1) / activeCourse.chapters.length) * 100)}% Complete</span>
          </div>
        )}

        <AnimatePresence>
          {updateAvailable && isUpdateMinimized && (
            <motion.button
              key="minimized-updater"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              onClick={() => setIsUpdateMinimized(false)}
              className="p-2.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors duration-300 shadow-[0_0_15px_rgba(239,68,68,0.2)] flex items-center justify-center cursor-pointer group shrink-0 animate-pulse"
              title="Update Available! Click to view details."
            >
              <motion.div
                animate={{
                  scale: [1, 1.25, 1.05, 1.25, 1, 1],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.15, 0.3, 0.45, 0.6, 1]
                }}
              >
                <Heart size={20} className="fill-red-500 text-red-500" />
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
});
