/**
 * Riot API Client
 *
 * Handles rate limiting, retries, and typed responses from Riot Games API.
 * Documentation: https://developer.riotgames.com/apis
 */
export interface RiotMatchResponse {
    metadata: {
        matchId: string;
        participants: string[];
    };
    info: {
        gameCreation: number;
        gameDuration: number;
        gameMode: string;
        gameVersion: string;
        participants: RiotParticipant[];
    };
}
export interface RiotParticipant {
    puuid: string;
    summonerName: string;
    championName: string;
    teamId: number;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    goldEarned: number;
    totalDamageDealtToChampions: number;
    visionScore: number;
    totalMinionsKilled: number;
    neutralMinionsKilled: number;
}
export declare class RiotClient {
    private regionalClient;
    private routingClient;
    private apiKey;
    private requestQueue;
    private requestsInFlight;
    private maxConcurrent;
    constructor(apiKey: string, region: string);
    /**
     * Get player PUUID by Riot ID (gameName#tagLine)
     * Uses Account V1 API (modern approach)
     */
    getSummonerByRiotId(gameName: string, tagLine: string): Promise<{
        puuid: string;
        gameName: string;
        tagLine: string;
    }>;
    /**
     * Get player PUUID by summoner name (deprecated, kept for backward compatibility)
     * NOTE: This uses the old Summoner V4 API which may not work for all accounts
     */
    getSummonerByName(summonerName: string): Promise<{
        puuid: string;
        summonerId: string;
    }>;
    /**
     * Get match IDs for a player (paginated)
     * @param puuid Player UUID
     * @param start Starting index (default 0)
     * @param count Number of matches to retrieve (max 100)
     */
    getMatchIds(puuid: string, start?: number, count?: number): Promise<string[]>;
    /**
     * Get detailed match data
     */
    getMatch(matchId: string): Promise<RiotMatchResponse>;
    /**
     * Rate-limited request queue
     * Implements simple FIFO queue with concurrency control
     */
    private queueRequest;
    /**
     * Process queued requests
     */
    private processQueue;
    /**
     * Retry logic with exponential backoff
     */
    private retryWithBackoff;
    private sleep;
}
