import React from 'react';
import { GlassCard } from './GlassCard';

interface ChampionCardProps {
  name: string;
  games: number;
  winRate: number;
  mastery: number;
  imageUrl?: string;
}

export function ChampionCard({ name, games, winRate, mastery, imageUrl }: ChampionCardProps) {
  return (
    <GlassCard className="p-6 group cursor-pointer transform transition-all duration-300 hover:scale-105">
      {/* Champion Portrait */}
      <div className="relative w-24 h-24 mx-auto mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[#C89B3C] to-[#0397AB] rounded-full animate-pulse"></div>
        <div className="absolute inset-1 bg-[#0A1428] rounded-full overflow-hidden border-2 border-[#C89B3C]/50 group-hover:border-[#C89B3C] transition-all duration-300">
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#C89B3C] text-2xl">
              {name[0]}
            </div>
          )}
        </div>
        
        {/* Mastery Badge */}
        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-gradient-to-br from-[#C89B3C] to-[#A67C2A] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(200,155,60,0.5)] border-2 border-[#010A13]">
          <span className="text-[#010A13]">{mastery}</span>
        </div>
      </div>

      {/* Champion Name */}
      <h3 className="text-xl text-[#CDBE91] text-center mb-3 uppercase tracking-wide">
        {name}
      </h3>

      {/* Stats */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#F0E6D2]/60">Games</span>
          <span className="text-[#C89B3C]">{games}</span>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#F0E6D2]/60">Win Rate</span>
          <span className={winRate >= 50 ? 'text-green-400' : 'text-red-400'}>
            {winRate}%
          </span>
        </div>
      </div>

      {/* Win Rate Bar */}
      <div className="mt-4 h-2 bg-[#0A1428] rounded-full overflow-hidden">
        <div 
          className={`h-full ${winRate >= 50 ? 'bg-gradient-to-r from-green-500 to-green-400' : 'bg-gradient-to-r from-red-500 to-red-400'} transition-all duration-500 shadow-[0_0_10px_rgba(200,155,60,0.3)]`}
          style={{ width: `${winRate}%` }}
        ></div>
      </div>
    </GlassCard>
  );
}
