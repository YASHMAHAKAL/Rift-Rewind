/**
 * Shared TypeScript types for Rift Rewind
 * Used by both frontend and backend
 */
export interface Player {
    id: string;
    puuid: string;
    summonerName: string;
    region: RiotRegion;
    createdAt: string;
    lastUpdated: string;
}
export type RiotRegion = 'NA1' | 'EUW1' | 'EUN1' | 'KR' | 'BR1' | 'LA1' | 'LA2' | 'OC1' | 'TR1' | 'RU' | 'JP1';
export interface Match {
    matchId: string;
    gameCreation: number;
    gameDuration: number;
    gameMode: string;
    gameType: string;
    queueId: number;
    platformId: string;
    participants: Participant[];
    playerParticipantId: number;
}
export interface Participant {
    participantId: number;
    championId: number;
    championName: string;
    teamId: number;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
    goldEarned: number;
    totalDamageDealt: number;
    totalDamageDealtToChampions: number;
    visionScore: number;
    wardsPlaced: number;
    wardsKilled: number;
    role: string;
    lane: string;
    timeline?: ParticipantTimeline;
}
export interface ParticipantTimeline {
    csDiffPerMinDeltas?: Record<string, number>;
    goldPerMinDeltas?: Record<string, number>;
    xpPerMinDeltas?: Record<string, number>;
    damageTakenPerMinDeltas?: Record<string, number>;
}
export interface PlayerStats {
    playerId: string;
    totalMatches: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    kda: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
    avgCS: number;
    avgCSPerMin: number;
    avgGoldPerMin: number;
    avgVisionScore: number;
    topChampions: ChampionStat[];
    roleDistribution: RoleDistribution;
    trends: TrendData;
    lastCalculated: string;
}
export interface ChampionStat {
    championId: number;
    championName: string;
    games: number;
    wins: number;
    winRate: number;
    kda: number;
    avgKills: number;
    avgDeaths: number;
    avgAssists: number;
}
export interface RoleDistribution {
    TOP: number;
    JUNGLE: number;
    MIDDLE: number;
    BOTTOM: number;
    UTILITY: number;
}
export interface TrendData {
    last30Days: TrendStats;
    last90Days: TrendStats;
    fullYear: TrendStats;
}
export interface TrendStats {
    matchCount: number;
    winRate: number;
    kda: number;
    avgCSPerMin: number;
    improvement: number;
}
export interface PlayerInsights {
    playerId: string;
    heroSummary: HeroSummary;
    coachingTips: CoachingTip[];
    playstyleRadar: PlaystyleRadar;
    roastMode?: RoastInsight;
    hiddenGems?: HiddenGem[];
    generatedAt: string;
    cacheExpiry: string;
}
export interface HeroSummary {
    narrative: string;
    keyHighlights: string[];
    standoutMoments: string[];
    growthAreas: string[];
    evidenceMatchIds: string[];
}
export interface CoachingTip {
    id: string;
    title: string;
    description: string;
    drill: string;
    measurableGoal: string;
    whyItMatters: string;
    priority: 'high' | 'medium' | 'low';
    category: 'laning' | 'teamfighting' | 'vision' | 'macro' | 'mechanics';
    evidenceMatchIds: string[];
    confidenceScore: number;
}
export interface PlaystyleRadar {
    laning: number;
    teamfighting: number;
    vision: number;
    objectiveControl: number;
    roaming: number;
    consistency: number;
    mechanics: number;
    decisionMaking: number;
}
export interface RoastInsight {
    roast: string;
    genuineCompliment: string;
    evidenceMatchIds: string[];
}
export interface HiddenGem {
    title: string;
    description: string;
    percentile?: number;
    evidenceMatchIds: string[];
}
export interface MatchFragment {
    fragmentId: string;
    matchId: string;
    playerId: string;
    phase: 'early' | 'mid' | 'late' | 'event';
    timeRange: string;
    description: string;
    stats: Record<string, number>;
    outcome: 'positive' | 'neutral' | 'negative';
    embedding?: number[];
    relevanceScore?: number;
}
export interface SocialShareCard {
    playerId: string;
    type: 'hero-summary' | 'playstyle-radar' | 'top-champions' | 'roast';
    imageUrl: string;
    shareText: string;
    generatedAt: string;
}
export interface GetPlayerStatsRequest {
    playerId?: string;
    puuid?: string;
    summonerName?: string;
    region?: RiotRegion;
    forceRefresh?: boolean;
}
export interface GetPlayerStatsResponse {
    player: Player;
    stats: PlayerStats;
    insights: PlayerInsights;
    cacheHit: boolean;
}
export interface MatchListRequest {
    playerId: string;
    startIndex?: number;
    count?: number;
    queueId?: number;
    startTime?: number;
    endTime?: number;
}
export interface MatchListResponse {
    matches: Match[];
    totalMatches: number;
    nextIndex?: number;
}
export interface APIError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
}
export type ErrorCode = 'PLAYER_NOT_FOUND' | 'RIOT_API_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'INSUFFICIENT_DATA' | 'BEDROCK_ERROR' | 'OPENSEARCH_ERROR' | 'INTERNAL_ERROR' | 'VALIDATION_ERROR';
export interface AppConfig {
    riotApiKey: string;
    riotRegion: RiotRegion;
    awsRegion: string;
    bedrockModelId: string;
    openSearchEndpoint: string;
    s3BucketPrefix: string;
    cacheTTL: number;
    rateLimit: {
        requestsPerSecond: number;
        requestsPer2Min: number;
    };
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];
