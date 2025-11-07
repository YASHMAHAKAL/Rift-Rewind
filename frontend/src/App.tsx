import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { PlayerDetailPage } from './components/PlayerDetailPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard' | 'player'>('landing');
  const [playerData, setPlayerData] = useState<{ puuid: string; summonerName: string; region: string } | null>(null);

  const handleNavigate = (page: string, data?: any) => {
    if (page === 'player' && data) {
      setPlayerData(data);
    }
    setCurrentPage(page as 'landing' | 'dashboard' | 'player');
  };

  return (
    <div className="size-full">
      {currentPage === 'landing' && <LandingPage onNavigate={handleNavigate} />}
      {currentPage === 'dashboard' && <DashboardPage onNavigate={handleNavigate} />}
      {currentPage === 'player' && playerData && (
        <PlayerDetailPage 
          key={playerData.puuid} 
          onNavigate={handleNavigate} 
          puuid={playerData.puuid}
          summonerName={playerData.summonerName}
          region={playerData.region}
        />
      )}
    </div>
  );
}
