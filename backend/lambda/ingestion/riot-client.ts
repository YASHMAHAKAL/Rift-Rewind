/**
 * Riot API Client
 * 
 * Handles rate limiting, retries, and typed responses from Riot Games API.
 * Documentation: https://developer.riotgames.com/apis
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// Region routing values
const REGION_ROUTING: Record<string, string> = {
  NA1: 'americas',
  BR1: 'americas',
  LA1: 'americas',
  LA2: 'americas',
  EUW1: 'europe',
  EUN1: 'europe',
  TR1: 'europe',
  RU: 'europe',
  KR: 'asia',
  JP1: 'asia',
  OC1: 'sea',
  PH2: 'sea',
  SG2: 'sea',
  TH2: 'sea',
  TW2: 'sea',
  VN2: 'sea',
};

export interface RiotMatchResponse {
  metadata: {
    matchId: string;
    participants: string[]; // PUUIDs
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
  // Many more fields available in Riot API...
}

export class RiotClient {
  private regionalClient: AxiosInstance;
  private routingClient: AxiosInstance;
  private apiKey: string;

  // Rate limiting state
  private requestQueue: Array<() => Promise<any>> = [];
  private requestsInFlight = 0;
  private maxConcurrent = 10; // Conservative limit

  constructor(apiKey: string, region: string) {
    this.apiKey = apiKey;

    // Regional endpoint (for summoner data)
    this.regionalClient = axios.create({
      baseURL: `https://${region.toLowerCase()}.api.riotgames.com`,
      headers: {
        'X-Riot-Token': apiKey,
      },
      timeout: 10000,
    });

    // Routing value endpoint (for match data)
    const routing = REGION_ROUTING[region] || 'americas';
    this.routingClient = axios.create({
      baseURL: `https://${routing}.api.riotgames.com`,
      headers: {
        'X-Riot-Token': apiKey,
      },
      timeout: 10000,
    });
  }

  /**
   * Get player PUUID by Riot ID (gameName#tagLine)
   * Uses Account V1 API (modern approach)
   */
  async getSummonerByRiotId(gameName: string, tagLine: string): Promise<{ puuid: string; gameName: string; tagLine: string }> {
    const response = await this.queueRequest(() =>
      this.routingClient.get(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`)
    );

    return {
      puuid: response.data.puuid,
      gameName: response.data.gameName,
      tagLine: response.data.tagLine,
    };
  }

  /**
   * Get player PUUID by summoner name (deprecated, kept for backward compatibility)
   * NOTE: This uses the old Summoner V4 API which may not work for all accounts
   */
  async getSummonerByName(summonerName: string): Promise<{ puuid: string; summonerId: string }> {
    const response = await this.queueRequest(() =>
      this.regionalClient.get(`/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`)
    );

    return {
      puuid: response.data.puuid,
      summonerId: response.data.id,
    };
  }

  /**
   * Get match IDs for a player (paginated)
   * @param puuid Player UUID
   * @param start Starting index (default 0)
   * @param count Number of matches to retrieve (max 100)
   */
  async getMatchIds(puuid: string, start = 0, count = 100): Promise<string[]> {
    const response = await this.queueRequest(() =>
      this.routingClient.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
        params: { start, count },
      })
    );

    return response.data;
  }

  /**
   * Get detailed match data
   */
  async getMatch(matchId: string): Promise<RiotMatchResponse> {
    const response = await this.queueRequest(() =>
      this.routingClient.get(`/lol/match/v5/matches/${matchId}`)
    );

    return response.data;
  }

  /**
   * Rate-limited request queue
   * Implements simple FIFO queue with concurrency control
   */
  private async queueRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.requestsInFlight++;

        try {
          const result = await this.retryWithBackoff(requestFn);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.requestsInFlight--;
          this.processQueue();
        }
      };

      if (this.requestsInFlight < this.maxConcurrent) {
        execute();
      } else {
        this.requestQueue.push(execute);
      }
    });
  }

  /**
   * Process queued requests
   */
  private processQueue(): void {
    while (this.requestsInFlight < this.maxConcurrent && this.requestQueue.length > 0) {
      const next = this.requestQueue.shift();
      if (next) next();
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retryWithBackoff<T>(
    requestFn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        const axiosError = error as AxiosError;

        // Don't retry on 4xx errors (except 429)
        if (axiosError.response && axiosError.response.status >= 400 && axiosError.response.status < 500) {
          if (axiosError.response.status === 429) {
            // Rate limited - wait for retry-after header
            const retryAfter = axiosError.response.headers['retry-after'];
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, attempt);
            console.warn(`Rate limited. Retrying after ${delay}ms...`);
            await this.sleep(delay);
            continue;
          }
          // Other 4xx errors - don't retry
          throw error;
        }

        // Retry on 5xx errors or network issues
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`Request failed (attempt ${attempt + 1}/${maxRetries + 1}). Retrying after ${delay}ms...`);
          await this.sleep(delay);
        } else {
          throw error;
        }
      }
    }

    throw new Error('Max retries exceeded');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
