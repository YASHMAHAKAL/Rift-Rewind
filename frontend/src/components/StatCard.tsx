import React from 'react';
import { LucideIcon } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down';
}

export function StatCard({ icon: Icon, label, value, subtext, trend }: StatCardProps) {
  return (
    <GlassCard className="p-6 text-center group cursor-pointer transform transition-all duration-300 hover:scale-105">
      <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-[#C89B3C] to-[#A67C2A] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(200,155,60,0.3)] group-hover:shadow-[0_0_25px_rgba(200,155,60,0.5)] transition-all duration-300">
        <Icon className="w-6 h-6 text-[#010A13]" />
      </div>
      
      <div className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-[#C89B3C] to-[#CDBE91] mb-2" style={{ fontWeight: 800 }}>
        {value}
      </div>
      
      <div className="text-sm uppercase tracking-wider text-[#CDBE91]/70 mb-1">
        {label}
      </div>
      
      {subtext && (
        <div className={`text-xs ${trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-[#F0E6D2]/50'}`}>
          {trend === 'up' && '↑ '}
          {trend === 'down' && '↓ '}
          {subtext}
        </div>
      )}
    </GlassCard>
  );
}
