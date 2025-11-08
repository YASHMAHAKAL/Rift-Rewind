import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { DashboardPage } from './components/DashboardPage';
import { PlayerDetailPage } from './components/PlayerDetailPage';

export default function App() {
  return (
    <Router>
      <div className="size-full">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/player/:puuid" element={<PlayerDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}
