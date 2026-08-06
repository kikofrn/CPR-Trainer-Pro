import React from 'react';
import { X, Award, ExternalLink, Info, BookOpen } from 'lucide-react';
import { openExternalUrl, openPortal } from '../utils/browser';

interface SendCertsPageProps {
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  onReturnToMenu: () => void;
  onOpenGuide: () => void;
}

export function SendCertsPage({
  isOnline,
  setIsOnline,
  onReturnToMenu,
  onOpenGuide,
}: SendCertsPageProps) {
  return (
    <>
      {isOnline ? (
        <div className="w-full h-full bg-black/80 backdrop-blur-md overflow-y-auto pt-4 sm:pt-16 pb-24 sm:pb-16 px-3 sm:px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-5xl w-full mx-auto bg-[#131313]/90 border border-white/10 rounded-[24px] sm:rounded-[32px] p-5 pt-16 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden">
            {/* Decorative glowing red accent top border */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-eh-red to-eh-red/40" />
            
            {/* Glowing background circles for visual depth */}
            <div className="absolute -top-32 -left-32 w-64 h-64 bg-eh-red/5 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-eh-blue/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Close button */}
            <button 
              onClick={onReturnToMenu}
              aria-label="Close Send Certs"
              className="mobile-coarse-target absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer z-50 focus-visible:outline-2 focus-visible:outline-eh-blue"
              title="Return to Main Menu"
            >
              <X size={24} />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.8fr] gap-7 sm:gap-12 items-start mt-4">
              {/* Left Column: Info & Actions */}
              <div className="flex flex-col items-start justify-start">
                <div className="w-14 h-14 bg-eh-red/10 rounded-full flex items-center justify-center mb-6 relative border border-eh-red/20 shadow-[0_0_15px_rgba(245,57,78,0.15)]">
                  <Award size={28} className="text-eh-red animate-pulse" />
                </div>
                
                <h2 className="font-serif text-2xl md:text-3xl font-black text-eh-peach mb-3 tracking-tight">
                  EH Academy Portal
                </h2>
                <p className="text-eh-peach/80 text-sm leading-relaxed mb-6">
                  Done teaching? Ready to certify your students? Access the secure EH Academy Instructor Portal to issue training cards and finalize your class.
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-center mb-8">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 flex flex-col items-center space-y-3 hover:border-eh-red/20 transition-colors duration-300">
                    <div className="w-8 h-8 rounded bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">1</div>
                    <h4 className="text-sm md:text-base font-bold text-eh-peach">Secure Login</h4>
                    <p className="text-xs text-eh-peach/70 leading-relaxed">Use your instructor credentials.</p>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 flex flex-col items-center space-y-3 hover:border-eh-red/20 transition-colors duration-300">
                    <div className="w-8 h-8 rounded bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">2</div>
                    <h4 className="text-sm md:text-base font-bold text-eh-peach">Manage Classes</h4>
                    <p className="text-xs text-eh-peach/70 leading-relaxed">Select your active rosters.</p>
                  </div>
                  <div className="bg-black/30 border border-white/5 rounded-xl p-5 flex flex-col items-center space-y-3 hover:border-eh-red/20 transition-colors duration-300">
                    <div className="w-8 h-8 rounded bg-eh-blue/10 flex items-center justify-center text-eh-blue-light font-bold text-sm">3</div>
                    <h4 className="text-sm md:text-base font-bold text-eh-peach">Issue Cards</h4>
                    <p className="text-xs text-eh-peach/70 leading-relaxed">Award & email digital cards.</p>
                  </div>
                </div>
                
                <button 
                  onClick={openPortal}
                  className="min-h-11 w-full sm:w-auto px-5 sm:px-8 py-3.5 bg-eh-red hover:bg-eh-red-dark text-eh-peach font-black rounded-full text-sm shadow-2xl shadow-eh-red/30 transition-all flex items-center justify-center gap-3 group active:scale-95 cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue"
                >
                  <span>Open Instructor Portal</span>
                  <ExternalLink size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
                
                <div className="mt-4 flex flex-col gap-3 w-full">
                  <div className="flex items-center gap-2 text-[11px] text-eh-peach/40">
                    <Info size={12} className="text-eh-blue-light shrink-0" />
                    <span>Opens securely in your default browser</span>
                  </div>
                  
                  <button
                    onClick={onOpenGuide}
                    className="mobile-coarse-target min-h-11 text-[11px] text-eh-blue hover:text-eh-blue-light hover:underline font-bold transition-colors cursor-pointer bg-transparent border-none p-0 flex items-center gap-1.5 w-fit focus-visible:outline-2 focus-visible:outline-eh-blue"
                  >
                    <BookOpen size={12} />
                    <span>View Step-by-Step Roster Guide</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Sample Cards */}
              <div className="flex flex-col items-end justify-center w-full bg-black/20 rounded-2xl p-6 border border-white/5">
                <span className="text-[10px] font-bold text-eh-peach/50 uppercase tracking-widest font-mono mb-6 w-full text-left border-b border-white/10 pb-3">Sample Certification Cards</span>
                
                <div className="flex flex-col gap-6 w-full">
                  {/* Standard Card */}
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-eh-blue-light">CPR AED & FIRST AID FOR ALL AGES</span>
                    <button
                      type="button"
                      aria-label="Open portal for CPR AED and First Aid certification cards"
                      className="relative group w-full rounded-xl overflow-hidden border border-white/10 bg-transparent p-0 text-left shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-blue-light/30 hover:shadow-[0_4px_30px_rgba(74,158,255,0.15)] cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue"
                      onClick={openPortal}
                    >
                      <img 
                        src="/sample-cert.png" 
                        alt="Sample CPR Certification" 
                        className="w-full h-auto object-cover"
                      />
                    </button>
                  </div>
                  
                  {/* Pediatric Card */}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      <span className="text-sm font-bold text-eh-red">PEDIATRIC SPECIFIC</span>
                      <span className="text-[11px] text-eh-red/80 italic">- Perfect for Childcare Facilities!</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Open portal for pediatric certification cards"
                      className="relative group w-full rounded-xl overflow-hidden border border-white/10 bg-transparent p-0 text-left shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-red/30 hover:shadow-[0_4px_30px_rgba(245,57,78,0.15)] cursor-pointer focus-visible:outline-2 focus-visible:outline-eh-blue"
                      onClick={openPortal}
                    >
                      <img 
                        src="/sample-pediatric-cert.png" 
                        alt="Sample Pediatric Certification" 
                        className="w-full h-auto object-cover"
                      />
                    </button>
                  </div>
                </div>

                <div className="mt-8 pt-5 border-t border-white/10 w-full text-left">
                  <p className="text-[11px] text-eh-peach/50 leading-relaxed">
                    Everyday Hero Academy provides nationally recognized, fully compliant CPR and First Aid certifications built strictly on the latest 2025 AHA/ILCOR scientific standards. Because our curriculum mandates live, in-person skills assessments, our pediatric and adult cards meet or exceed all federal OSHA workplace safety requirements and satisfy state child-care licensing mandates including pediatric hands-on skills validation. To view our comprehensive state-by-state approval registry or download your compliance packet, visit <button onClick={() => openExternalUrl("https://ehacademy.com")} className="text-eh-blue hover:underline cursor-pointer inline font-bold">ehacademy.com</button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-black/85 overflow-y-auto pt-4 sm:pt-16 pb-24 sm:pb-16 px-3 sm:px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="max-w-3xl w-full mx-auto bg-[#131313] border border-white/10 rounded-[24px] p-5 pt-16 sm:p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col items-center justify-start">
            {/* Decorative top red bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-eh-red" />
            <button type="button" onClick={onReturnToMenu} aria-label="Close Send Certs" className="mobile-coarse-target absolute right-4 top-4 rounded-full p-2 text-white/45 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-eh-blue"><X size={24} /></button>
            
            <div className="w-20 h-20 bg-eh-red/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Info size={36} className="text-eh-red" />
            </div>
            
            <h2 className="font-serif text-3xl font-bold text-eh-peach mb-4 tracking-tight">Offline Mode</h2>
            <p className="text-eh-peach/80 text-base leading-relaxed mb-6">
              It looks like you are currently offline or have no internet access.
            </p>
            
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 text-left space-y-4 mb-6 w-full">
              <h3 className="text-sm font-bold uppercase tracking-wider text-eh-blue-light">Instructions for Instructors</h3>
              <p className="text-sm text-eh-peach/70 leading-relaxed">
                Please connect to the internet, then open a web browser and go to <a href="https://ehacademy.com" target="_blank" rel="noopener noreferrer" className="text-eh-red hover:underline font-bold">ehacademy.com</a> to log into your account and assign certification cards to your students.
              </p>
              <div className="h-px bg-white/5 w-full" />
              <p className="text-sm text-eh-peach/70 leading-relaxed">
                If you need any immediate assistance, please feel free to email us at <a href="mailto:info@ehacademy.com" className="text-eh-red hover:underline font-bold">info@ehacademy.com</a>.
              </p>
            </div>
            
            <button 
              onClick={() => setIsOnline(navigator.onLine)}
              className="min-h-11 w-full sm:w-auto px-8 py-3.5 bg-eh-peach hover:bg-white text-black font-bold rounded-full text-sm shadow-xl transition-all active:scale-95 cursor-pointer mb-3 focus-visible:outline-2 focus-visible:outline-eh-blue"
            >
              Retry Connection
            </button>
            <button type="button" onClick={onOpenGuide} className="mobile-coarse-target mb-6 flex min-h-11 items-center gap-2 text-sm font-bold text-eh-blue hover:underline focus-visible:outline-2 focus-visible:outline-eh-blue"><BookOpen size={16} /> View Step-by-Step Roster Guide</button>

            {/* Sample Certification Cards (Offline) */}
            <div className="mt-4 mb-4 flex flex-col items-center gap-4 w-full">
              <span className="text-[10px] font-bold text-eh-peach/40 uppercase tracking-widest font-mono border-b border-white/10 pb-2 w-full text-center">Sample Certification Cards</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-blue-light/30">
                  <img src="/sample-cert.png" alt="Sample CPR Certification" className="w-full h-auto object-cover" />
                </div>
                <div className="relative group rounded-xl overflow-hidden border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.4)] transition-all duration-300 hover:border-eh-red/30">
                  <img src="/sample-pediatric-cert.png" alt="Sample Pediatric Certification" className="w-full h-auto object-cover" />
                </div>
              </div>
            </div>

            {/* Compliance Disclaimer (Offline) */}
            <div className="mt-4 pt-6 border-t border-white/10 w-full text-center">
              <p className="text-[11px] text-eh-peach/50 leading-relaxed max-w-md mx-auto">
                Everyday Hero Academy provides nationally recognized, fully compliant CPR and First Aid certifications built strictly on the latest 2025 AHA/ILCOR scientific standards. Because our curriculum mandates live, in-person skills assessments, our pediatric and adult cards meet or exceed all federal OSHA workplace safety requirements and satisfy state child-care licensing mandates including pediatric hands-on skills validation. To view our comprehensive state-by-state approval registry or download your compliance packet, visit{" "}
                <button 
                  onClick={() => openExternalUrl("https://ehacademy.com")}
                  className="text-eh-blue hover:text-eh-blue-light hover:underline font-bold transition-colors cursor-pointer bg-transparent border-none p-0 inline font-mono"
                >
                  ehacademy.com
                </button>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
