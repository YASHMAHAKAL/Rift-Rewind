import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { PlayerDetailPage } from './components/PlayerDetailPage';

export default function App() {
  const [currentPage, setCurrentPage] = useState<'landing' | 'dashboard' | 'player'>('landing');

  return (
    <div className="size-full">
      {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
      {currentPage === 'dashboard' && <DashboardPage onNavigate={setCurrentPage} />}
      {currentPage === 'player' && <PlayerDetailPage onNavigate={setCurrentPage} />}
    </div>
  );
}
