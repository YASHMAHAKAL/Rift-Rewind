import React from 'react';

interface HexButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function HexButton({ children, variant = 'primary', onClick, className = '', disabled = false }: HexButtonProps) {
  const baseStyles = "relative px-8 py-3 uppercase tracking-wider transition-all duration-300 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantStyles = {
    primary: "bg-gradient-to-r from-[#C89B3C] to-[#A67C2A] text-[#010A13] shadow-[0_0_20px_rgba(200,155,60,0.4)] hover:shadow-[0_0_30px_rgba(200,155,60,0.6)] disabled:hover:shadow-[0_0_20px_rgba(200,155,60,0.4)]",
    ghost: "border-2 border-[#C89B3C] text-[#C89B3C] hover:bg-[#C89B3C] hover:text-[#010A13] hover:shadow-[0_0_20px_rgba(200,155,60,0.3)] disabled:hover:bg-transparent disabled:hover:text-[#C89B3C]"
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
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
