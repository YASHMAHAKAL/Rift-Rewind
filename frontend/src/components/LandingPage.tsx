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
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" 
           style={{
             backgroundImage: 'url(https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/a7e2287b-ae42-4616-ac2b-9023e7710c47/denmedb-f8c8adf4-b1fb-4770-be69-d7494c8f821d.jpg?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1cm46YXBwOjdlMGQxODg5ODIyNjQzNzNhNWYwZDQxNWVhMGQyNmUwIiwiaXNzIjoidXJuOmFwcDo3ZTBkMTg4OTgyMjY0MzczYTVmMGQ0MTVlYTBkMjZlMCIsIm9iaiI6W1t7InBhdGgiOiIvZi9hN2UyMjg3Yi1hZTQyLTQ2MTYtYWMyYi05MDIzZTc3MTBjNDcvZGVubWVkYi1mOGM4YWRmNC1iMWZiLTQ3NzAtYmU2OS1kNzQ5NGM4ZjgyMWQuanBnIn1dXSwiYXVkIjpbInVybjpzZXJ2aWNlOmZpbGUuZG93bmxvYWQiXX0.5xllHLEizuPfw8sans7g3XktVIDIurUgFeykmxWq-bI)',
           }}>
      </div>
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#010A13]/95 via-[#0A1428]/90 to-[#1a0f2e]/95"></div>
      
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
              <h1 className="text-8xl tracking-widest uppercase text-white" style={{ 
                fontWeight: 800,
                textShadow: '0 0 40px rgba(200,155,60,0.8), 0 0 80px rgba(200,155,60,0.6), 0 4px 20px rgba(0,0,0,0.9), 0 8px 40px rgba(0,0,0,0.8)',
                WebkitTextStroke: '2px rgba(255,255,255,0.3)',
              }}>
                RIFT REWIND
              </h1>
              <div className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#C89B3C] to-transparent shadow-[0_0_20px_rgba(200,155,60,0.8)]"></div>
            </div>
          </div>

          <p className="text-3xl text-[#F0E6D2] mb-4 tracking-wide" style={{
            textShadow: '0 2px 20px rgba(0,0,0,0.9), 0 4px 40px rgba(0,0,0,0.8), 0 0 30px rgba(240,230,210,0.3)'
          }}>Your Season, Your Story</p>
          <p className="text-lg text-[#CDBE91] mb-12 max-w-2xl mx-auto" style={{
            textShadow: '0 2px 15px rgba(0,0,0,0.95), 0 4px 30px rgba(0,0,0,0.8)',
            fontWeight: 500
          }}>
            Dive deep into your League of Legends journey. Uncover insights, relive epic moments, and level up your gameplay.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-6 justify-center mb-16">
            <HexButton variant="primary" onClick={() => navigate('/dashboard')}>
              Open Your Yearbook
            </HexButton>
            <HexButton variant="primary" onClick={() => navigate('/player/demo')}>
              Try Demo
            </HexButton>
          </div>

          {/* Hero Visual */}
          <div className="relative w-full max-w-4xl mx-auto h-96 mt-16">
            <div className="absolute inset-0 bg-gradient-to-t from-[#010A13] via-transparent to-transparent z-10"></div>
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Hexagon Frame */}
              <div className="absolute w-80 h-80 animate-spin-slow" style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                border: '6px solid #00ff00',
                filter: 'drop-shadow(0 0 20px #00ff00) drop-shadow(0 0 40px #00ff00)'
              }}></div>
              <div className="absolute w-64 h-64 animate-spin-reverse" style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                border: '5px solid #ff00ff',
                filter: 'drop-shadow(0 0 20px #ff00ff) drop-shadow(0 0 40px #ff00ff)'
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
