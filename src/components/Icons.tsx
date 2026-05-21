export const CprIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Floor figure */}
    <path d="M100 150 H60 Q40 150 40 130 V110 H130 V150 Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round"/>
    <circle cx="160" cy="130" r="20" stroke="currentColor" strokeWidth="8"/>
    {/* Responder figure */}
    <circle cx="100" cy="40" r="25" stroke="currentColor" strokeWidth="8"/>
    <path d="M70 70 L100 95 L130 70" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M70 70 L80 115 L100 115 L120 115 L130 70" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Red Cross */}
    <path d="M90 60 H110 V80 H90 V60 Z" fill="#ff0000" />
    <path d="M80 70 H120 V90 H80 V70 Z" fill="#ff0000" />
    <path d="M90 50 H110 V100 H90 V50 Z" fill="#ff0000" />
  </svg>
);

export const FirstAidIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Running figure */}
    <circle cx="140" cy="40" r="25" fill="currentColor"/>
    <path d="M110 70 L130 50 L160 60 L180 50" stroke="currentColor" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M120 60 L90 100 L110 140 L70 180" stroke="currentColor" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M90 100 L140 120 L120 170" stroke="currentColor" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Red Briefcase */}
    <rect x="30" y="80" width="60" height="45" rx="5" fill="#ff0000"/>
    <path d="M50 80 V70 H70 V80" stroke="#ff0000" strokeWidth="6" fill="none"/>
    {/* White Cross */}
    <path d="M55 95 H65 V110 H55 V95 Z" fill="#ffffff" />
    <path d="M45 100 H75 V105 H45 V100 Z" fill="#ffffff" />
  </svg>
);
