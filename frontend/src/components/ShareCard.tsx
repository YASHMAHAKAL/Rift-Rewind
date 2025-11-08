import { Trophy, Target } from 'lucide-react';

interface ShareCardProps {
  summonerName: string;
  region: string;
  totalMatches: number;
  winRate: number;
  avgKDA: string;
  topChampions: Array<{ name: string; games: number; winRate: number }>;
  heroSummary?: string;
}

export function ShareCard({ 
  summonerName, 
  region, 
  totalMatches, 
  winRate, 
  avgKDA,
  topChampions,
  heroSummary 
}: ShareCardProps) {
  return (
    <div style={{
      width: '800px',
      padding: '32px',
      backgroundColor: '#010A13',
      position: 'relative',
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: '0',
        opacity: 0.05,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0l25.98 15v30L30 60 4.02 45V15z' fill='none' stroke='%23C89B3C' stroke-width='1'/%3E%3C/svg%3E")`,
        backgroundSize: '60px 60px',
      }}></div>

      <div style={{
        padding: '32px',
        backgroundColor: 'rgba(10, 20, 40, 0.8)',
        border: '2px solid rgba(200, 155, 60, 0.2)',
        borderRadius: '12px',
        position: 'relative',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #C89B3C 0%, #0397AB 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Trophy style={{ width: '32px', height: '32px', color: '#010A13' }} />
            </div>
            <div>
              <h1 style={{
                fontSize: '36px',
                fontWeight: 800,
                background: 'linear-gradient(90deg, #C89B3C 0%, #CDBE91 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
              }}>
                {summonerName}
              </h1>
              <p style={{ color: 'rgba(205, 190, 145, 0.7)', margin: 0, fontSize: '14px' }}>
                {region} • 2025 Season
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', color: '#C89B3C', fontWeight: 800 }}>S+</div>
            <p style={{ fontSize: '12px', color: '#CDBE91', margin: 0 }}>SEASON GRADE</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            backgroundColor: 'rgba(10, 20, 40, 0.5)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(200, 155, 60, 0.2)',
          }}>
            <div style={{ fontSize: '28px', color: '#C89B3C', fontWeight: 800 }}>{totalMatches}</div>
            <div style={{ fontSize: '12px', color: 'rgba(205, 190, 145, 0.7)', textTransform: 'uppercase' }}>
              Total Games
            </div>
          </div>
          <div style={{
            backgroundColor: 'rgba(10, 20, 40, 0.5)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(200, 155, 60, 0.2)',
          }}>
            <div style={{ fontSize: '28px', color: '#4ade80', fontWeight: 800 }}>{winRate}%</div>
            <div style={{ fontSize: '12px', color: 'rgba(205, 190, 145, 0.7)', textTransform: 'uppercase' }}>
              Win Rate
            </div>
          </div>
          <div style={{
            backgroundColor: 'rgba(10, 20, 40, 0.5)',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid rgba(200, 155, 60, 0.2)',
          }}>
            <div style={{ fontSize: '28px', color: '#0397AB', fontWeight: 800 }}>{avgKDA}</div>
            <div style={{ fontSize: '12px', color: 'rgba(205, 190, 145, 0.7)', textTransform: 'uppercase' }}>
              KDA
            </div>
          </div>
        </div>

        {/* Hero Summary */}
        {heroSummary && (
          <div style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'rgba(10, 20, 40, 0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(200, 155, 60, 0.1)',
          }}>
            <p style={{
              color: '#F0E6D2',
              fontSize: '14px',
              lineHeight: '1.6',
              fontStyle: 'italic',
              margin: 0,
            }}>
              "{heroSummary.slice(0, 200)}..."
            </p>
          </div>
        )}

        {/* Top Champions */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '14px',
            color: '#CDBE91',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            <Target style={{ width: '16px', height: '16px' }} />
            Top Champions
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {topChampions.slice(0, 3).map((champion, index) => (
              <div key={index} style={{
                backgroundColor: 'rgba(10, 20, 40, 0.5)',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(200, 155, 60, 0.2)',
              }}>
                <div style={{ fontSize: '18px', color: '#CDBE91', marginBottom: '4px' }}>
                  {champion.name}
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(240, 230, 210, 0.6)' }}>
                  {champion.games} games • {champion.winRate}% WR
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          paddingTop: '16px',
          borderTop: '1px solid rgba(200, 155, 60, 0.2)',
        }}>
          <div style={{
            fontSize: '24px',
            fontWeight: 800,
            background: 'linear-gradient(90deg, #C89B3C 0%, #0397AB 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            RIFT REWIND 2025
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(205, 190, 145, 0.5)', marginTop: '4px' }}>
            Your Season, Your Story
          </p>
        </div>
      </div>
    </div>
  );
}
