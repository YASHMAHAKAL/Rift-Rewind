import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'gold' | 'blue';
}

export function GlassCard({ children, className = '', glowColor = 'gold' }: GlassCardProps) {
  const glowColors = {
    gold: 'shadow-[0_0_20px_rgba(200,155,60,0.15)] hover:shadow-[0_0_30px_rgba(200,155,60,0.25)] border-[#C89B3C]/20',
    blue: 'shadow-[0_0_20px_rgba(3,151,171,0.15)] hover:shadow-[0_0_30px_rgba(3,151,171,0.25)] border-[#0397AB]/20'
  };

  return (
    <div 
      className={`bg-gradient-to-br from-[#0A1428]/80 to-[#010A13]/60 backdrop-blur-md border-2 ${glowColors[glowColor]} transition-all duration-300 ${className}`}
      style={{
        clipPath: 'polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)'
      }}
    >
      {children}
    </div>
  );
}
