import { Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HexButton } from './HexButton';
import { GlassCard } from './GlassCard';

export function LandingPage() {
  const navigate = useNavigate();
  const features = [
    {
      icon: Sparkles,
      title: "AI-Powered Insights",
      description: "Get personalized coaching tips and playstyle analysis powered by advanced algorithms"
    },
    {
      icon: TrendingUp,
      title: "Interactive Timeline",
      description: "Visualize your season journey with detailed match history and performance trends"
    },
    {
      icon: Trophy,
      title: "Share Your Story",
      description: "Create shareable highlights of your best moments and achievements"
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#010A13] via-[#0A1428] to-[#1a0f2e] animate-gradient"></div>
      
      {/* Hexagonal Grid Pattern Overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px'
      }}></div>

      {/* Glowing Orbs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-[#C89B3C]/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#0397AB]/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>

      <div className="relative z-10 container mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-32 mt-20">
          {/* Logo/Title */}
          <div className="mb-8 inline-block">
            <div className="relative">
              <h1 className="text-8xl tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#C89B3C] to-[#CDBE91] drop-shadow-[0_0_30px_rgba(200,155,60,0.5)]" style={{ fontWeight: 800 }}>
                RIFT REWIND
              </h1>
              <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C89B3C] to-transparent"></div>
            </div>
          </div>

          <p className="text-3xl text-[#F0E6D2] mb-4 tracking-wide">Your Season, Your Story</p>
          <p className="text-lg text-[#CDBE91]/70 mb-12 max-w-2xl mx-auto">
            Dive deep into your League of Legends journey. Uncover insights, relive epic moments, and level up your gameplay.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-6 justify-center mb-16">
            <HexButton variant="primary" onClick={() => navigate('/dashboard')}>
              Open Your Yearbook
            </HexButton>
            <HexButton variant="ghost" onClick={() => navigate('/player/demo')}>
              Try Demo
            </HexButton>
          </div>

          {/* Hero Visual */}
          <div className="relative w-full max-w-4xl mx-auto h-96 mt-16">
            <div className="absolute inset-0 bg-gradient-to-t from-[#010A13] via-transparent to-transparent z-10"></div>
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Hexagon Frame */}
              <div className="absolute w-80 h-80 border-4 border-[#C89B3C]/30 animate-spin-slow" style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
              }}></div>
              <div className="absolute w-64 h-64 border-2 border-[#0397AB]/30 animate-spin-reverse" style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
              }}></div>
              {/* Center Icon */}
              <div className="relative w-32 h-32 bg-gradient-to-br from-[#C89B3C] to-[#0397AB] rounded-full flex items-center justify-center shadow-[0_0_60px_rgba(200,155,60,0.6)]">
                <Trophy className="w-16 h-16 text-[#010A13]" />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <GlassCard key={index} className="p-8 group cursor-pointer" glowColor={index === 1 ? 'blue' : 'gold'}>
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 mb-6 bg-gradient-to-br from-[#C89B3C] to-[#A67C2A] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(200,155,60,0.4)] group-hover:shadow-[0_0_30px_rgba(200,155,60,0.6)] transition-all duration-300 group-hover:scale-110" style={{
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                }}>
                  <feature.icon className="w-10 h-10 text-[#010A13]" />
                </div>
                <h3 className="text-xl uppercase tracking-wider text-[#CDBE91] mb-3">{feature.title}</h3>
                <p className="text-[#F0E6D2]/70">{feature.description}</p>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 15s ease infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse 15s linear infinite;
        }
      `}</style>
    </div>
  );
}
