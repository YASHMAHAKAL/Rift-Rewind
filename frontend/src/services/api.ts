/**
 * API Service Layer
 * Handles all communication with the backend API
 */

// Function to get API base URL from endpoints.json or fallback to environment
async function getApiBaseUrl(): Promise<string> {
  try {
    // Try to fetch the endpoints file from public directory
    const response = await fetch('/endpoints.json');
    if (response.ok) {
      const endpoints = await response.json();
      // Remove trailing slash to avoid double slashes
      const apiUrl = endpoints.apiEndpoint.replace(/\/+$/, '');
      console.log('✅ Loaded API endpoint from endpoints.json:', apiUrl);
      return apiUrl;
    }
  } catch (error) {
    console.warn('Could not load endpoints.json, falling back to environment variable');
  }
  
  // Fallback to environment variable or localhost for development
  const fallbackUrl = (import.meta as any).env.VITE_API_URL || 'http://localhost:3000';
  return fallbackUrl.replace(/\/+$/, '');
}

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
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/player/${puuid}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch player: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch player match history
 */
export async function getPlayerMatches(puuid: string): Promise<MatchesResponse> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/player/${puuid}/matches`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch matches: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetch player insights
 */
export async function getPlayerInsights(puuid: string): Promise<Insights> {
  const baseUrl = await getApiBaseUrl();
  const response = await fetch(`${baseUrl}/player/${puuid}/insights`);
  
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
  const baseUrl = await getApiBaseUrl();
  
  console.log('🔄 Making API call to:', `${baseUrl}/ingest`);
  console.log('📤 Request payload:', JSON.stringify(request));
  
  const response = await fetch(`${baseUrl}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  
  console.log('📥 Response status:', response.status, response.statusText);
  
  if (!response.ok) {
    let errorText;
    try {
      errorText = await response.text();
      console.log('❌ Error response body:', errorText);
      
      // Try to parse as JSON first
      const errorData = JSON.parse(errorText);
      throw new Error(errorData.error || errorData.message || 'Failed to ingest player data');
    } catch (jsonError) {
      // If not JSON, use the raw text
      throw new Error(errorText || `HTTP ${response.status}: ${response.statusText}`);
    }
  }
  
  const result = await response.json();
  console.log('✅ Success response:', result);
  return result;
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
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}/health`);
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
