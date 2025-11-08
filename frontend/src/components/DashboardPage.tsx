import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { HexButton } from './HexButton';
import { GlassCard } from './GlassCard';
import { ingestPlayerData } from '../services/api';

export function DashboardPage() {
  const navigate = useNavigate();
  const [summonerName, setSummonerName] = useState('');
  const [region, setRegion] = useState('NA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const regions = [
    { code: 'NA', name: 'North America', flag: '🇺🇸' },
    { code: 'EUW', name: 'Europe West', flag: '🇪🇺' },
    { code: 'EUNE', name: 'Europe Nordic & East', flag: '🇪🇺' },
    { code: 'KR', name: 'Korea', flag: '🇰🇷' },
    { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'LAN', name: 'Latin America North', flag: '🇲🇽' },
    { code: 'LAS', name: 'Latin America South', flag: '🇦🇷' },
    { code: 'OCE', name: 'Oceania', flag: '🇦🇺' },
  ];

  const recentSearches = [
    { name: 'Faker', region: 'KR' },
    { name: 'Doublelift', region: 'NA' },
    { name: 'Caps', region: 'EUW' },
  ];

  const handleFetchData = async () => {
    if (!summonerName.trim()) {
      setError('Please enter a summoner name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Format summoner name properly for Riot API
      // If it doesn't contain '#', add the region tag
      let formattedSummonerName = summonerName.trim();
      if (!formattedSummonerName.includes('#')) {
        // Convert region to tag format (NA1 -> NA1, EUW1 -> EUW1, etc.)
        const regionTag = region === 'NA' ? 'NA1' : 
                         region === 'EUW' ? 'EUW1' : 
                         region === 'KR' ? 'KR' : 
                         `${region}1`;
        formattedSummonerName = `${formattedSummonerName}#${regionTag}`;
      }

      // Call the ingestion API
      const response = await ingestPlayerData({
        summonerName: formattedSummonerName,
        region: `${region}1`, // Convert NA -> NA1, EUW -> EUW1, etc.
        maxMatches: 50, // Fetch up to 50 recent matches
      });

      // Wait a moment for processing to start
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Navigate to player detail page with PUUID
      navigate(`/player/${response.puuid}?name=${encodeURIComponent(summonerName)}&region=${region}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch player data');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#010A13] via-[#0A1428] to-[#1a0f2e]"></div>
      
      {/* Hexagonal Grid Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>

      {/* Glowing Effects */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#C89B3C]/10 rounded-full blur-[150px]"></div>

      <div className="relative z-10 container mx-auto px-4 py-20 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-2xl">
          {/* Back Button */}
          <button 
            onClick={() => navigate('/')}
            className="mb-8 text-[#CDBE91] hover:text-[#C89B3C] transition-colors flex items-center gap-2"
          >
            ← Back to Home
          </button>

          {/* Main Card */}
          <GlassCard className="p-12">
            <div className="text-center mb-8">
              <h2 className="text-5xl uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#C89B3C] to-[#CDBE91] mb-4" style={{ fontWeight: 800 }}>
                Enter the Rift
              </h2>
              <p className="text-[#F0E6D2]/70">Discover your League of Legends journey</p>
            </div>

            {/* Input Form */}
            <div className="space-y-6">
              {/* Summoner Name Input */}
              <div>
                <label className="block text-[#CDBE91] uppercase tracking-wider mb-3 text-sm">
                  Summoner Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={summonerName}
                    onChange={(e) => setSummonerName(e.target.value)}
                    placeholder="Enter your summoner name..."
                    className="w-full bg-[#0A1428]/80 border-2 border-[#C89B3C]/30 focus:border-[#C89B3C] text-[#F0E6D2] px-6 py-4 outline-none transition-all duration-300 placeholder:text-[#CDBE91]/30"
                    style={{
                      clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && handleFetchData()}
                  />
                  <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#CDBE91]/50 w-5 h-5" />
                </div>
              </div>

              {/* Region Selector */}
              <div>
                <label className="block text-[#CDBE91] uppercase tracking-wider mb-3 text-sm">
                  Region
                </label>
                <div className="relative">
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-[#0A1428]/80 border-2 border-[#C89B3C]/30 focus:border-[#C89B3C] text-[#F0E6D2] px-6 py-4 outline-none transition-all duration-300 appearance-none cursor-pointer"
                    style={{
                      clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)'
                    }}
                  >
                    {regions.map((r) => (
                      <option key={r.code} value={r.code} className="bg-[#0A1428]">
                        {r.flag} {r.name}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-6 border-l-transparent border-r-transparent border-t-[#CDBE91]/50"></div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <HexButton 
                  variant="primary" 
                  onClick={handleFetchData}
                  className="w-full relative"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading Data...
                    </span>
                  ) : (
                    'Fetch My Data'
                  )}
                </HexButton>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 text-red-300 rounded">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="mt-6">
                  {/* Hexagon Spinner */}
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 border-4 border-[#C89B3C]/30 border-t-[#C89B3C] animate-spin" style={{
                      clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                    }}></div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="relative w-full h-2 bg-[#0A1428] overflow-hidden rounded-full">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#C89B3C] to-[#0397AB] animate-progress shadow-[0_0_10px_rgba(200,155,60,0.6)]"></div>
                  </div>
                  
                  <p className="text-center text-[#CDBE91] mt-4 text-sm">
                    Analyzing your matches...
                  </p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Recent Searches */}
          <div className="mt-8">
            <h3 className="text-[#CDBE91] uppercase tracking-wider mb-4 text-sm">Recent Searches</h3>
            <div className="flex gap-3">
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSummonerName(search.name);
                    setRegion(search.region);
                  }}
                  className="px-4 py-2 bg-[#0A1428]/60 border border-[#C89B3C]/20 hover:border-[#C89B3C]/50 text-[#F0E6D2] transition-all duration-300 hover:shadow-[0_0_15px_rgba(200,155,60,0.2)]"
                  style={{
                    clipPath: 'polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px)'
                  }}
                >
                  <span className="text-sm">{search.name}</span>
                  <span className="text-xs text-[#CDBE91]/60 ml-2">{search.region}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
