import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';

export function PlayerRadarChart() {
  const data = [
    { category: 'Aggression', value: 75 },
    { category: 'Vision', value: 60 },
    { category: 'Objective', value: 85 },
    { category: 'Teamfight', value: 70 },
    { category: 'Laning', value: 80 },
    { category: 'Adaptability', value: 65 },
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <RadarChart data={data}>
        <PolarGrid stroke="#C89B3C" strokeOpacity={0.2} />
        <PolarAngleAxis 
          dataKey="category" 
          tick={{ fill: '#CDBE91', fontSize: 12 }}
          stroke="#C89B3C"
          strokeOpacity={0.3}
        />
        <Radar
          name="Player"
          dataKey="value"
          stroke="#C89B3C"
          fill="url(#radarGradient)"
          fillOpacity={0.6}
          strokeWidth={2}
        />
        <defs>
          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C89B3C" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#0397AB" stopOpacity={0.3} />
          </linearGradient>
        </defs>
      </RadarChart>
    </ResponsiveContainer>
  );
}
