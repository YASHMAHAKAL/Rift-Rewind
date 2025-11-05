/**
 * API Service Layer
 * Handles all communication with the backend API
 */

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';

interface PlayerProfile {
  puuid: string;
  summonerName: string;
  region: string;
  matchCount: number;
  lastUpdated: string;
}

interface Match {
  matchId: string;
  puuid: string;
  championName: string;
  championId: number;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  totalCS: number;
  csPerMin: number;
  goldEarned: number;
  damageDealt: number;
  damageTaken: number;
  visionScore: number;
  win: boolean;
  gameDuration: number;
  gameMode: string;
  timestamp: string;
}

interface AggregateStats {
  totalMatches: number;
  winRate: number;
  avgKDA: string;
  avgCSPerMin: string;
}

interface MatchesResponse {
  puuid: string;
  matches: Match[];
  aggregateStats: AggregateStats;
  count: number;
}

interface PlaystyleInsights {
  aggression: number;
  vision: number;
  farming: number;
  teamfighting: number;
  consistency: number;
}

interface Insights {
  puuid: string;
  heroSummary: string;
  coachingTips: string[];
  roastMode: string;
  hiddenGems: string;
  playstyleInsights: PlaystyleInsights;
  timestamp?: string;
}

interface IngestionRequest {
  summonerName: string;
  region: string;
  maxMatches?: number;
}

/**
 * Fetch player profile
 */
export async function getPlayerProfile(puuid: string): Promise<PlayerProfile> {
  const response = await fetch(`${API_BASE_URL}/player/${puuid}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch player: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch player match history
 */
export async function getPlayerMatches(puuid: string): Promise<MatchesResponse> {
  const response = await fetch(`${API_BASE_URL}/player/${puuid}/matches`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch player insights
 */
export async function getPlayerInsights(puuid: string): Promise<Insights> {
  const response = await fetch(`${API_BASE_URL}/player/${puuid}/insights`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Insights not ready yet. Please try again in a moment.');
    }
    throw new Error(`Failed to fetch insights: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Trigger data ingestion for a summoner
 * This calls the ingestion Lambda via API Gateway
 */
export async function ingestPlayerData(request: IngestionRequest): Promise<{ message: string; puuid: string }> {
  const response = await fetch(`${API_BASE_URL}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Failed to ingest player data');
  }
  
  return response.json();
}

/**
 * Get demo player data (for testing)
 */
export async function getDemoData(): Promise<{
  profile: PlayerProfile;
  matches: MatchesResponse;
  insights: Insights;
}> {
  const [profile, matches, insights] = await Promise.all([
    getPlayerProfile('demo'),
    getPlayerMatches('demo'),
    getPlayerInsights('demo'),
  ]);
  
  return { profile, matches, insights };
}

/**
 * Health check endpoint
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// Export types
export type {
  PlayerProfile,
  Match,
  AggregateStats,
  MatchesResponse,
  PlaystyleInsights,
  Insights,
  IngestionRequest,
};
