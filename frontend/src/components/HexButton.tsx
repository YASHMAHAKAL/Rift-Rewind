import React from 'react';

interface HexButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  className?: string;
}

export function HexButton({ children, variant = 'primary', onClick, className = '' }: HexButtonProps) {
  const baseStyles = "relative px-8 py-3 uppercase tracking-wider transition-all duration-300 overflow-hidden group";
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-[#C89B3C] to-[#A67C2A] text-[#010A13] shadow-[0_0_20px_rgba(200,155,60,0.4)] hover:shadow-[0_0_30px_rgba(200,155,60,0.6)]",
    ghost: "border-2 border-[#C89B3C] text-[#C89B3C] hover:bg-[#C89B3C] hover:text-[#010A13] hover:shadow-[0_0_20px_rgba(200,155,60,0.3)]"
  };

  return (
    <button 
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
      }}
    >
      <span className="relative z-10">{children}</span>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-700"></div>
    </button>
  );
}
