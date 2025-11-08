import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Trophy, Target, Award, Lightbulb, AlertTriangle, TrendingUp, Flame, Sword, Shield, Users, Loader2, Download, Share2, Check } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { GlassCard } from './GlassCard';
import { StatCard } from './StatCard';
import { ChampionCard } from './ChampionCard';
import { PlayerRadarChart } from './PlayerRadarChart';
import { HexButton } from './HexButton';
import { ShareCard } from './ShareCard';
import { getPlayerProfile, getPlayerMatches, getPlayerInsights, PlayerProfile, MatchesResponse, Insights } from '../services/api';

export function PlayerDetailPage() {
  const { puuid } = useParams<{ puuid: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Get summoner name and region from URL params (if provided)
  const summonerName = searchParams.get('name') || 'Player';
  const region = searchParams.get('region') || 'Unknown';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [playerData, setPlayerData] = useState<{
    profile: PlayerProfile | null;
    matches: MatchesResponse | null;
    insights: Insights | null;
  }>({
    profile: null,
    matches: null,
    insights: null
  });

  useEffect(() => {
    const fetchPlayerData = async () => {
      if (!puuid) {
        setError('No player ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        console.log('🔄 Fetching player data for:', { puuid, summonerName, region });

        // Fetch player profile and matches
        const [profile, matches] = await Promise.all([
          getPlayerProfile(puuid),
          getPlayerMatches(puuid)
        ]);

        console.log('✅ Got profile and matches:', { profile, matches });

        setPlayerData(prev => ({ ...prev, profile, matches }));

        // Try to fetch insights (may not be ready yet)
        try {
          const insights = await getPlayerInsights(puuid);
          console.log('✅ Got insights:', insights);
          setPlayerData(prev => ({ ...prev, insights }));
        } catch (insightsError) {
          console.log('⚠️ Insights not ready yet:', insightsError);
          // This is okay - insights may still be processing
        }

      } catch (err) {
        console.error('❌ Error fetching player data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load player data');
      } finally {
        setLoading(false);
      }
    };

    if (puuid) {
      fetchPlayerData();
    }
  }, [puuid, summonerName, region]);

  // Download share card as PDF
  const handleDownloadCard = async () => {
    if (!shareCardRef.current) return;
    
    setDownloading(true);
    try {
      // Capture the card as canvas
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: '#010A13',
        scale: 2, // Higher quality
        logging: false,
      });
      
      // Convert canvas to image
      const imgData = canvas.toDataURL('image/png');
      
      // Create PDF
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      
      // Download PDF
      pdf.save(`rift-rewind-${summonerName.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF report. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Copy share link to clipboard
  const handleShareLink = async () => {
    const shareUrl = window.location.href;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        alert('Failed to copy link. Please copy manually: ' + shareUrl);
      }
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010A13] via-[#0A1428] to-[#1a0f2e] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-[#C89B3C] mx-auto mb-4" />
          <h2 className="text-2xl text-[#F0E6D2] mb-2">Loading Player Data</h2>
          <p className="text-[#CDBE91]">Analyzing matches for {summonerName}...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#010A13] via-[#0A1428] to-[#1a0f2e] flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl text-[#F0E6D2] mb-2">Error Loading Data</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <HexButton variant="primary" onClick={() => navigate('/dashboard')}>
            Back to Search
          </HexButton>
        </div>
      </div>
    );
  }

  const { profile, matches, insights } = playerData;

    // Calculate top champions from real match data
  const topChampions = matches ? (() => {
    const championStats: Record<string, { games: number; wins: number; id: number }> = {};
    
    matches.matches.forEach((match: any) => {
      const champName = match.championName;
      if (!championStats[champName]) {
        championStats[champName] = { games: 0, wins: 0, id: match.championId };
      }
      championStats[champName].games++;
      if (match.win) championStats[champName].wins++;
    });

    return Object.entries(championStats)
      .map(([name, stats]) => ({
        name,
        games: stats.games,
        winRate: Math.round((stats.wins / stats.games) * 100),
        mastery: 7 // We don't have mastery data, so default to 7
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 3);
  })() : [
    { name: 'Loading...', games: 0, winRate: 0, mastery: 0 }
  ];

  // Calculate fun stats from real match data
  const funStats = matches ? (() => {
    const matchData = matches.matches;
    const pentakills = matchData.filter((m: any) => m.kills >= 5).length;
    const longestGame = Math.max(...matchData.map((m: any) => m.gameDuration));
    const mostDeaths = Math.max(...matchData.map((m: any) => m.deaths));
    const shortestWin = Math.min(...matchData.filter((m: any) => m.win).map((m: any) => m.gameDuration));
    
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return [
      { emoji: '🔥', title: 'Pentakill-worthy', value: pentakills.toString(), description: `${pentakills} games with 5+ kills!` },
      { emoji: '⏰', title: 'Longest Game', value: formatTime(longestGame), description: 'That was exhausting' },
      { emoji: '💀', title: 'Most Deaths', value: mostDeaths.toString(), description: 'In a single game' },
      { emoji: '⚡', title: 'Fastest Win', value: formatTime(shortestWin), description: 'Speed run champion' },
      { emoji: '🎯', title: 'Avg KDA', value: matches.aggregateStats.avgKDA, description: 'Overall performance' },
      { emoji: '🌟', title: 'Win Rate', value: `${Math.round(matches.aggregateStats.winRate)}%`, description: 'Climb potential' },
    ];
  })() : [
    { emoji: '🔥', title: 'Pentakill Count', value: '3', description: 'You\'re a monster!' },
    { emoji: '😅', title: 'Flash Fails', value: '47', description: 'We\'ve all been there' },
    ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#010A13] via-[#0A1428] to-[#1a0f2e]">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Back Button */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="mb-6 text-[#CDBE91] hover:text-[#C89B3C] transition-colors flex items-center gap-2"
        >
          ← Back to Search
        </button>

        {/* Top Banner */}
        <GlassCard className="p-8 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Profile Icon */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 bg-gradient-to-br from-[#C89B3C] to-[#0397AB] animate-pulse" style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}></div>
                <div className="absolute inset-1 bg-[#0A1428] overflow-hidden flex items-center justify-center" style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}>
                  <Trophy className="w-10 h-10 text-[#C89B3C]" />
                </div>
              </div>

              {/* Player Info */}
              <div>
                <h1 className="text-5xl text-transparent bg-clip-text bg-gradient-to-r from-[#C89B3C] to-[#CDBE91] mb-2" style={{ fontWeight: 800 }}>
                  {profile?.summonerName || summonerName}
                </h1>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 bg-[#C89B3C]/20 border border-[#C89B3C]/50 text-[#C89B3C] text-sm uppercase tracking-wider">
                    {region}
                  </span>
                  <span className="text-[#F0E6D2]/70">
                    {matches ? `${matches.aggregateStats.totalMatches} games analyzed` : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rank Badge */}
            <div className="text-center">
              <div className="w-32 h-32 mx-auto mb-2 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-[#C89B3C] to-[#A67C2A] shadow-[0_0_40px_rgba(200,155,60,0.6)]" style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}></div>
                <div className="absolute inset-2 bg-[#010A13] flex items-center justify-center" style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}>
                  <span className="text-6xl text-[#C89B3C]" style={{ fontWeight: 800 }}>S+</span>
                </div>
              </div>
              <p className="text-[#CDBE91] text-sm uppercase tracking-wider">Season Grade</p>
            </div>
          </div>
        </GlassCard>

        {/* Hero Summary */}
        <GlassCard className="p-8 mb-8 relative overflow-hidden">
          {/* Background Blur */}
          <div className="absolute inset-0 opacity-10 bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900"></div>
          
          <div className="relative z-10">
            <h2 className="text-3xl text-[#CDBE91] mb-4 uppercase tracking-wider">Your Story</h2>
            {insights?.heroSummary ? (
              <p className="text-[#F0E6D2] text-lg leading-relaxed mb-6">
                {insights.heroSummary}
              </p>
            ) : (
              <p className="text-[#F0E6D2] text-lg leading-relaxed mb-6">
                {matches ? `This season, you've played ${matches.aggregateStats.totalMatches} games with a ${Math.round(matches.aggregateStats.winRate)}% win rate. ` : 'Loading your story...'}
                {topChampions.length > 0 && topChampions[0].name !== 'Loading...' 
                  ? `Your signature champion is ${topChampions[0].name} with ${topChampions[0].games} games and a ${topChampions[0].winRate}% win rate. `
                  : ''}
                {matches ? `You average ${matches.aggregateStats.avgKDA} KDA and ${matches.aggregateStats.avgCSPerMin} CS/min across your matches.` : ''}
              </p>
            )}

            {/* Key Stats Row */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-4xl text-[#C89B3C] mb-1" style={{ fontWeight: 800 }}>
                  {matches?.aggregateStats.totalMatches || 0}
                </div>
                <div className="text-sm text-[#CDBE91]/70 uppercase tracking-wider">Total Games</div>
              </div>
              <div className="text-center">
                <div className="text-4xl text-green-400 mb-1" style={{ fontWeight: 800 }}>
                  {matches ? `${Math.round(matches.aggregateStats.winRate)}%` : '0%'}
                </div>
                <div className="text-sm text-[#CDBE91]/70 uppercase tracking-wider">Win Rate</div>
              </div>
              <div className="text-center">
                <div className="text-4xl text-[#0397AB] mb-1" style={{ fontWeight: 800 }}>
                  {matches?.aggregateStats.avgKDA || '0.0'}
                </div>
                <div className="text-sm text-[#CDBE91]/70 uppercase tracking-wider">KDA</div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Stats Grid */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <Award className="w-6 h-6" />
            Performance Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard 
              icon={Sword} 
              label="Avg Kills" 
              value={matches ? (matches.matches.reduce((sum, m) => sum + m.kills, 0) / matches.matches.length).toFixed(1) : '0.0'} 
              subtext={`${matches?.aggregateStats.avgKDA || '0.0'} KDA`} 
              trend="up" 
            />
            <StatCard 
              icon={Shield} 
              label="Avg Deaths" 
              value={matches ? (matches.matches.reduce((sum, m) => sum + m.deaths, 0) / matches.matches.length).toFixed(1) : '0.0'} 
              subtext="Per game" 
              trend="down" 
            />
            <StatCard 
              icon={Users} 
              label="Avg Assists" 
              value={matches ? (matches.matches.reduce((sum, m) => sum + m.assists, 0) / matches.matches.length).toFixed(1) : '0.0'} 
              subtext={`${matches?.aggregateStats.avgCSPerMin || '0.0'} CS/min`} 
              trend="up" 
            />
          </div>
        </div>

        {/* Top Champions */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <Trophy className="w-6 h-6" />
            Champion Pool
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topChampions.map((champion, index) => (
              <ChampionCard key={index} {...champion} />
            ))}
          </div>
        </div>

        {/* Roast Mode Section */}
        {insights?.roastMode && (
          <div className="mb-8">
            <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
              <Flame className="w-6 h-6" />
              Roast Mode 🔥
            </h2>
            <GlassCard className="p-8 relative overflow-hidden" glowColor="gold">
              {/* Fire Background Effect */}
              <div className="absolute inset-0 opacity-10 bg-gradient-to-r from-orange-900 via-red-900 to-orange-900 animate-pulse"></div>
              
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                    <Flame className="w-8 h-8 text-white animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[#F0E6D2] text-xl leading-relaxed italic">
                      "{insights.roastMode}"
                    </p>
                    <p className="text-[#CDBE91]/60 text-sm mt-3">
                      💀 AI-generated roast • All in good fun!
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* AI Coaching Tips */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <Lightbulb className="w-6 h-6" />
            AI Coaching Insights
          </h2>
          {insights?.coachingTips && insights.coachingTips.length > 0 ? (
            <div className="space-y-4">
              {insights.coachingTips.map((tip, index) => (
                <GlassCard key={index} className="p-6" glowColor="blue">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#C89B3C] to-[#A67C2A] rounded-lg flex items-center justify-center flex-shrink-0">
                      <Lightbulb className="w-6 h-6 text-[#010A13]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[#F0E6D2] text-lg">{tip}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard className="p-8" glowColor="gold">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-[#C89B3C] mx-auto mb-4" />
                <h3 className="text-xl text-[#CDBE91] mb-2">AI Analysis in Progress</h3>
                <p className="text-[#F0E6D2]/70">
                  Our AI is analyzing your matches to generate personalized coaching insights. 
                  This usually takes 30-60 seconds. Refresh the page in a moment to see your tips!
                </p>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Playstyle Radar Chart */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <Target className="w-6 h-6" />
            Playstyle Analysis
          </h2>
          <GlassCard className="p-8">
            <PlayerRadarChart />
            <div className="mt-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl text-[#C89B3C]" style={{ fontWeight: 800 }}>
                  {insights?.playstyleInsights?.aggression ? Math.round(insights.playstyleInsights.aggression * 100) + '%' : '85%'}
                </div>
                <div className="text-sm text-[#CDBE91]/70">Aggression</div>
              </div>
              <div>
                <div className="text-2xl text-[#C89B3C]" style={{ fontWeight: 800 }}>
                  {insights?.playstyleInsights?.vision ? Math.round(insights.playstyleInsights.vision * 100) + '%' : '72%'}
                </div>
                <div className="text-sm text-[#CDBE91]/70">Vision Control</div>
              </div>
              <div>
                <div className="text-2xl text-[#C89B3C]" style={{ fontWeight: 800 }}>
                  {insights?.playstyleInsights?.teamfighting ? Math.round(insights.playstyleInsights.teamfighting * 100) + '%' : '91%'}
                </div>
                <div className="text-sm text-[#CDBE91]/70">Teamfighting</div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Match Timeline */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            Match Timeline
          </h2>
          <GlassCard className="p-8">
            <div className="relative h-32">
              {/* Timeline Line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-[#C89B3C]/20 via-[#C89B3C] to-[#0397AB]/20"></div>
              
              {/* Match Dots - Now using REAL match data! */}
              <div className="relative h-full flex items-center justify-between px-4">
                {matches && matches.matches.length > 0 ? (
                  matches.matches.slice(0, 20).reverse().map((match) => (
                    <div
                      key={match.matchId}
                      className={`w-3 h-3 rounded-full cursor-pointer transition-all duration-300 hover:scale-150 ${
                        match.win ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]'
                      }`}
                      title={`${match.win ? 'Victory' : 'Defeat'} - ${match.championName} (${match.kills}/${match.deaths}/${match.assists})`}
                    ></div>
                  ))
                ) : (
                  <div className="text-[#CDBE91]/50 text-center w-full">Loading matches...</div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-between text-sm text-[#CDBE91]/70">
              <span>← Oldest</span>
              <span>Recent →</span>
            </div>
          </GlassCard>
        </div>

        {/* Fun Stats */}
        <div className="mb-8">
          <h2 className="text-2xl text-[#CDBE91] mb-4 uppercase tracking-wider flex items-center gap-3">
            <Flame className="w-6 h-6" />
            Hidden Gems
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {funStats.map((stat, index) => (
              <GlassCard 
                key={index} 
                className="p-6 text-center transform transition-all duration-300 hover:scale-105 hover:rotate-1"
                glowColor={index % 2 === 0 ? 'gold' : 'blue'}
              >
                <div className="text-4xl mb-2">{stat.emoji}</div>
                <div className="text-3xl text-[#C89B3C] mb-1" style={{ fontWeight: 800 }}>
                  {stat.value}
                </div>
                <div className="text-sm text-[#CDBE91] mb-1 uppercase tracking-wide">
                  {stat.title}
                </div>
                <div className="text-xs text-[#F0E6D2]/50">
                  {stat.description}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Download & Share Buttons */}
          <div className="flex gap-4 justify-center mt-8">
            <HexButton 
              variant="primary" 
              onClick={handleDownloadCard}
              disabled={downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 inline mr-2" />
                  Download PDF Report
                </>
              )}
            </HexButton>
            <HexButton 
              variant="ghost"
              onClick={handleShareLink}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 inline mr-2" />
                  Link Copied!
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 inline mr-2" />
                  Share Link
                </>
              )}
            </HexButton>
          </div>
        </div>
      </div>

      {/* Hidden ShareCard for screenshot capture - hidden but renderable */}
      <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
        <div ref={shareCardRef}>
          <ShareCard
            summonerName={summonerName}
            region={region}
            totalMatches={matches?.aggregateStats.totalMatches || 0}
            winRate={matches ? Math.round(matches.aggregateStats.winRate) : 0}
            avgKDA={matches?.aggregateStats.avgKDA || '0.0'}
            topChampions={topChampions}
            heroSummary={insights?.heroSummary}
          />
        </div>
      </div>
    </div>
  );
}
