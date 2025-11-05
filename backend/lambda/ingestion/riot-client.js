"use strict";
/**
 * Riot API Client
 *
 * Handles rate limiting, retries, and typed responses from Riot Games API.
 * Documentation: https://developer.riotgames.com/apis
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiotClient = void 0;
const axios_1 = __importDefault(require("axios"));
// Region routing values
const REGION_ROUTING = {
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
class RiotClient {
    constructor(apiKey, region) {
        // Rate limiting state
        this.requestQueue = [];
        this.requestsInFlight = 0;
        this.maxConcurrent = 10; // Conservative limit
        this.apiKey = apiKey;
        // Regional endpoint (for summoner data)
        this.regionalClient = axios_1.default.create({
            baseURL: `https://${region.toLowerCase()}.api.riotgames.com`,
            headers: {
                'X-Riot-Token': apiKey,
            },
            timeout: 10000,
        });
        // Routing value endpoint (for match data)
        const routing = REGION_ROUTING[region] || 'americas';
        this.routingClient = axios_1.default.create({
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
    async getSummonerByRiotId(gameName, tagLine) {
        const response = await this.queueRequest(() => this.routingClient.get(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`));
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
    async getSummonerByName(summonerName) {
        const response = await this.queueRequest(() => this.regionalClient.get(`/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`));
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
    async getMatchIds(puuid, start = 0, count = 100) {
        const response = await this.queueRequest(() => this.routingClient.get(`/lol/match/v5/matches/by-puuid/${puuid}/ids`, {
            params: { start, count },
        }));
        return response.data;
    }
    /**
     * Get detailed match data
     */
    async getMatch(matchId) {
        const response = await this.queueRequest(() => this.routingClient.get(`/lol/match/v5/matches/${matchId}`));
        return response.data;
    }
    /**
     * Rate-limited request queue
     * Implements simple FIFO queue with concurrency control
     */
    async queueRequest(requestFn) {
        return new Promise((resolve, reject) => {
            const execute = async () => {
                this.requestsInFlight++;
                try {
                    const result = await this.retryWithBackoff(requestFn);
                    resolve(result);
                }
                catch (error) {
                    reject(error);
                }
                finally {
                    this.requestsInFlight--;
                    this.processQueue();
                }
            };
            if (this.requestsInFlight < this.maxConcurrent) {
                execute();
            }
            else {
                this.requestQueue.push(execute);
            }
        });
    }
    /**
     * Process queued requests
     */
    processQueue() {
        while (this.requestsInFlight < this.maxConcurrent && this.requestQueue.length > 0) {
            const next = this.requestQueue.shift();
            if (next)
                next();
        }
    }
    /**
     * Retry logic with exponential backoff
     */
    async retryWithBackoff(requestFn, maxRetries = 3, baseDelay = 1000) {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            }
            catch (error) {
                const axiosError = error;
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
                }
                else {
                    throw error;
                }
            }
        }
        throw new Error('Max retries exceeded');
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.RiotClient = RiotClient;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmlvdC1jbGllbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyaW90LWNsaWVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7O0dBS0c7Ozs7OztBQUVILGtEQUF5RDtBQUV6RCx3QkFBd0I7QUFDeEIsTUFBTSxjQUFjLEdBQTJCO0lBQzdDLEdBQUcsRUFBRSxVQUFVO0lBQ2YsR0FBRyxFQUFFLFVBQVU7SUFDZixHQUFHLEVBQUUsVUFBVTtJQUNmLEdBQUcsRUFBRSxVQUFVO0lBQ2YsSUFBSSxFQUFFLFFBQVE7SUFDZCxJQUFJLEVBQUUsUUFBUTtJQUNkLEdBQUcsRUFBRSxRQUFRO0lBQ2IsRUFBRSxFQUFFLFFBQVE7SUFDWixFQUFFLEVBQUUsTUFBTTtJQUNWLEdBQUcsRUFBRSxNQUFNO0lBQ1gsR0FBRyxFQUFFLEtBQUs7SUFDVixHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxLQUFLO0lBQ1YsR0FBRyxFQUFFLEtBQUs7SUFDVixHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxLQUFLO0NBQ1gsQ0FBQztBQWlDRixNQUFhLFVBQVU7SUFVckIsWUFBWSxNQUFjLEVBQUUsTUFBYztRQUwxQyxzQkFBc0I7UUFDZCxpQkFBWSxHQUE4QixFQUFFLENBQUM7UUFDN0MscUJBQWdCLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLGtCQUFhLEdBQUcsRUFBRSxDQUFDLENBQUMscUJBQXFCO1FBRy9DLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBRXJCLHdDQUF3QztRQUN4QyxJQUFJLENBQUMsY0FBYyxHQUFHLGVBQUssQ0FBQyxNQUFNLENBQUM7WUFDakMsT0FBTyxFQUFFLFdBQVcsTUFBTSxDQUFDLFdBQVcsRUFBRSxvQkFBb0I7WUFDNUQsT0FBTyxFQUFFO2dCQUNQLGNBQWMsRUFBRSxNQUFNO2FBQ3ZCO1lBQ0QsT0FBTyxFQUFFLEtBQUs7U0FDZixDQUFDLENBQUM7UUFFSCwwQ0FBMEM7UUFDMUMsTUFBTSxPQUFP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QUFFLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzNELENBQUM7Q0FDRjtBQTlLRCxnQ0E4S0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFJpb3QgQVBJIENsaWVudFxuICogXG4gKiBIYW5kbGVzIHJhdGUgbGltaXRpbmcsIHJldHJpZXMsIGFuZCB0eXBlZCByZXNwb25zZXMgZnJvbSBSaW90IEdhbWVzIEFQSS5cbiAqIERvY3VtZW50YXRpb246IGh0dHBzOi8vZGV2ZWxvcGVyLnJpb3RnYW1lcy5jb20vYXBpc1xuICovXG5cbmltcG9ydCBheGlvcywgeyBBeGlvc0luc3RhbmNlLCBBeGlvc0Vycm9yIH0gZnJvbSAnYXhpb3MnO1xuXG4vLyBSZWdpb24gcm91dGluZyB2YWx1ZXNcbmNvbnN0IFJFR0lPTl9ST1VUSU5HOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICBOQTE6ICdhbWVyaWNhcycsXG4gIEJSMTogJ2FtZXJpY2FzJyxcbiAgTEExOiAnYW1lcmljYXMnLFxuICBMQTI6ICdhbWVyaWNhcycsXG4gIEVVVzE6ICdldXJvcGUnLFxuICBFVU4xOiAnZXVyb3BlJyxcbiAgVFIxOiAnZXVyb3BlJyxcbiAgUlU6ICdldXJvcGUnLFxuICBLUjogJ2FzaWEnLFxuICBKUDE6ICdhc2lhJyxcbiAgT0MxOiAnc2VhJyxcbiAgUEgyOiAnc2VhJyxcbiAgU0cyOiAnc2VhJyxcbiAgVEgyOiAnc2VhJyxcbiAgVFcyOiAnc2VhJyxcbiAgVk4yOiAnc2VhJyxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmlvdE1hdGNoUmVzcG9uc2Uge1xuICBtZXRhZGF0YToge1xuICAgIG1hdGNoSWQ6IHN0cmluZztcbiAgICBwYXJ0aWNpcGFudHM6IHN0cmluZ1tdOyAvLyBQVVVJRHNcbiAgfTtcbiAgaW5mbzoge1xuICAgIGdhbWVDcmVhdGlvbjogbnVtYmVyO1xuICAgIGdhbWVEdXJhdGlvbjogbnVtYmVyO1xuICAgIGdhbWVNb2RlOiBzdHJpbmc7XG4gICAgZ2FtZVZlcnNpb246IHN0cmluZztcbiAgICBwYXJ0aWNpcGFudHM6IFJpb3RQYXJ0aWNpcGFudFtdO1xuICB9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJpb3RQYXJ0aWNpcGFudCB7XG4gIHB1dWlkOiBzdHJpbmc7XG4gIHN1bW1vbmVyTmFtZTogc3RyaW5nO1xuICBjaGFtcGlvbk5hbWU6IHN0cmluZztcbiAgdGVhbUlkOiBudW1iZXI7XG4gIHdpbjogYm9vbGVhbjtcbiAga2lsbHM6IG51bWJlcjtcbiAgZGVhdGhzOiBudW1iZXI7XG4gIGFzc2lzdHM6IG51bWJlcjtcbiAgZ29sZEVhcm5lZDogbnVtYmVyO1xuICB0b3RhbERhbWFnZURlYWx0VG9DaGFtcGlvbnM6IG51bWJlcjtcbiAgdmlzaW9uU2NvcmU6IG51bWJlcjtcbiAgdG90YWxNaW5pb25zS2lsbGVkOiBudW1iZXI7XG4gIG5ldXRyYWxNaW5pb25zS2lsbGVkOiBudW1iZXI7XG4gIC8vIE1hbnkgbW9yZSBmaWVsZHMgYXZhaWxhYmxlIGluIFJpb3QgQVBJLi4uXG59XG5cbmV4cG9ydCBjbGFzcyBSaW90Q2xpZW50IHtcbiAgcHJpdmF0ZSByZWdpb25hbENsaWVudDogQXhpb3NJbnN0YW5jZTtcbiAgcHJpdmF0ZSByb3V0aW5nQ2xpZW50OiBBeGlvc0luc3RhbmNlO1xuICBwcml2YXRlIGFwaUtleTogc3RyaW5nO1xuXG4gIC8vIFJhdGUgbGltaXRpbmcgc3RhdGVcbiAgcHJpdmF0ZSByZXF1ZXN0UXVldWU6IEFycmF5PCgpID0+IFByb21pc2U8YW55Pj4gPSBbXTtcbiAgcHJpdmF0ZSByZXF1ZXN0c0luRmxpZ2h0ID0gMDtcbiAgcHJpdmF0ZSBtYXhDb25jdXJyZW50ID0gMTA7IC8vIENvbnNlcnZhdGl2ZSBsaW1pdFxuXG4gIGNvbnN0cnVjdG9yKGFwaUtleTogc3RyaW5nLCByZWdpb246IHN0cmluZykge1xuICAgIHRoaXMuYXBpS2V5ID0gYXBpS2V5O1xuXG4gICAgLy8gUmVnaW9uYWwgZW5kcG9pbnQgKGZvciBzdW1tb25lciBkYXRhKVxuICAgIHRoaXMucmVnaW9uYWxDbGllbnQgPSBheGlvcy5jcmVhdGUoe1xuICAgICAgYmFzZVVSTDogYGh0dHBzOi8vJHtyZWdpb24udG9Mb3dlckNhc2UoKX0uYXBpLnJpb3RnYW1lcy5jb21gLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnWC1SaW90LVRva2VuJzogYXBpS2V5LFxuICAgICAgfSxcbiAgICAgIHRpbWVvdXQ6IDEwMDAwLFxuICAgIH0pO1xuXG4gICAgLy8gUm91dGluZyB2YWx1ZSBlbmRwb2ludCAoZm9yIG1hdGNoIGRhdGEpXG4gICAgY29uc3Qgcm91dGluZyA9IFJFR0lPTl9ST1VUSU5HW3JlZ2lvbl0gfHwgJ2FtZXJpY2FzJztcbiAgICB0aGlzLnJvdXRpbmdDbGllbnQgPSBheGlvcy5jcmVhdGUoe1xuICAgICAgYmFzZVVSTDogYGh0dHBzOi8vJHtyb3V0aW5nfS5hcGkucmlvdGdhbWVzLmNvbWAsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdYLVJpb3QtVG9rZW4nOiBhcGlLZXksXG4gICAgICB9LFxuICAgICAgdGltZW91dDogMTAwMDAsXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHBsYXllciBQVVVJRCBieSBSaW90IElEIChnYW1lTmFtZSN0YWdMaW5lKVxuICAgKiBVc2VzIEFjY291bnQgVjEgQVBJIChtb2Rlcm4gYXBwcm9hY2gpXG4gICAqL1xuICBhc3luYyBnZXRTdW1tb25lckJ5UmlvdElkKGdhbWVOYW1lOiBzdHJpbmcsIHRhZ0xpbmU6IHN0cmluZyk6IFByb21pc2U8eyBwdXVpZDogc3RyaW5nOyBnYW1lTmFtZTogc3RyaW5nOyB0YWdMaW5lOiBzdHJpbmcgfT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5xdWV1ZVJlcXVlc3QoKCkgPT5cbiAgICAgIHRoaXMucm91dGluZ0NsaWVudC5nZXQoYC9yaW90L2FjY291bnQvdjEvYWNjb3VudHMvYnktcmlvdC1pZC8ke2VuY29kZVVSSUNvbXBvbmVudChnYW1lTmFtZSl9LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHRhZ0xpbmUpfWApXG4gICAgKTtcblxuICAgIHJldHVybiB7XG4gICAgICBwdXVpZDogcmVzcG9uc2UuZGF0YS5wdXVpZCxcbiAgICAgIGdhbWVOYW1lOiByZXNwb25zZS5kYXRhLmdhbWVOYW1lLFxuICAgICAgdGFnTGluZTogcmVzcG9uc2UuZGF0YS50YWdMaW5lLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogR2V0IHBsYXllciBQVVVJRCBieSBzdW1tb25lciBuYW1lIChkZXByZWNhdGVkLCBrZXB0IGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5KVxuICAgKiBOT1RFOiBUaGlzIHVzZXMgdGhlIG9sZCBTdW1tb25lciBWNCBBUEkgd2hpY2ggbWF5IG5vdCB3b3JrIGZvciBhbGwgYWNjb3VudHNcbiAgICovXG4gIGFzeW5jIGdldFN1bW1vbmVyQnlOYW1lKHN1bW1vbmVyTmFtZTogc3RyaW5nKTogUHJvbWlzZTx7IHB1dWlkOiBzdHJpbmc7IHN1bW1vbmVySWQ6IHN0cmluZyB9PiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnF1ZXVlUmVxdWVzdCgoKSA9PlxuICAgICAgdGhpcy5yZWdpb25hbENsaWVudC5nZXQoYC9sb2wvc3VtbW9uZXIvdjQvc3VtbW9uZXJzL2J5LW5hbWUvJHtlbmNvZGVVUklDb21wb25lbnQoc3VtbW9uZXJOYW1lKX1gKVxuICAgICk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcHV1aWQ6IHJlc3BvbnNlLmRhdGEucHV1aWQsXG4gICAgICBzdW1tb25lcklkOiByZXNwb25zZS5kYXRhLmlkLFxuICAgIH07XG4gIH1cblxuICAvKipcbiAgICogR2V0IG1hdGNoIElEcyBmb3IgYSBwbGF5ZXIgKHBhZ2luYXRlZClcbiAgICogQHBhcmFtIHB1dWlkIFBsYXllciBVVUlEXG4gICAqIEBwYXJhbSBzdGFydCBTdGFydGluZyBpbmRleCAoZGVmYXVsdCAwKVxuICAgKiBAcGFyYW0gY291bnQgTnVtYmVyIG9mIG1hdGNoZXMgdG8gcmV0cmlldmUgKG1heCAxMDApXG4gICAqL1xuICBhc3luYyBnZXRNYXRjaElkcyhwdXVpZDogc3RyaW5nLCBzdGFydCA9IDAsIGNvdW50ID0gMTAwKTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5xdWV1ZVJlcXVlc3QoKCkgPT5cbiAgICAgIHRoaXMucm91dGluZ0NsaWVudC5nZXQoYC9sb2wvbWF0Y2gvdjUvbWF0Y2hlcy9ieS1wdXVpZC8ke3B1dWlkfS9pZHNgLCB7XG4gICAgICAgIHBhcmFtczogeyBzdGFydCwgY291bnQgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIHJldHVybiByZXNwb25zZS5kYXRhO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCBkZXRhaWxlZCBtYXRjaCBkYXRhXG4gICAqL1xuICBhc3luYyBnZXRNYXRjaChtYXRjaElkOiBzdHJpbmcpOiBQcm9taXNlPFJpb3RNYXRjaFJlc3BvbnNlPiB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnF1ZXVlUmVxdWVzdCgoKSA9PlxuICAgICAgdGhpcy5yb3V0aW5nQ2xpZW50LmdldChgL2xvbC9tYXRjaC92NS9tYXRjaGVzLyR7bWF0Y2hJZH1gKVxuICAgICk7XG5cbiAgICByZXR1cm4gcmVzcG9uc2UuZGF0YTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSYXRlLWxpbWl0ZWQgcmVxdWVzdCBxdWV1ZVxuICAgKiBJbXBsZW1lbnRzIHNpbXBsZSBGSUZPIHF1ZXVlIHdpdGggY29uY3VycmVuY3kgY29udHJvbFxuICAgKi9cbiAgcHJpdmF0ZSBhc3luYyBxdWV1ZVJlcXVlc3Q8VD4ocmVxdWVzdEZuOiAoKSA9PiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGNvbnN0IGV4ZWN1dGUgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucmVxdWVzdHNJbkZsaWdodCsrO1xuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5yZXRyeVdpdGhCYWNrb2ZmKHJlcXVlc3RGbik7XG4gICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgdGhpcy5yZXF1ZXN0c0luRmxpZ2h0LS07XG4gICAgICAgICAgdGhpcy5wcm9jZXNzUXVldWUoKTtcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgaWYgKHRoaXMucmVxdWVzdHNJbkZsaWdodCA8IHRoaXMubWF4Q29uY3VycmVudCkge1xuICAgICAgICBleGVjdXRlKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJlcXVlc3RRdWV1ZS5wdXNoKGV4ZWN1dGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFByb2Nlc3MgcXVldWVkIHJlcXVlc3RzXG4gICAqL1xuICBwcml2YXRlIHByb2Nlc3NRdWV1ZSgpOiB2b2lkIHtcbiAgICB3aGlsZSAodGhpcy5yZXF1ZXN0c0luRmxpZ2h0IDwgdGhpcy5tYXhDb25jdXJyZW50ICYmIHRoaXMucmVxdWVzdFF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IG5leHQgPSB0aGlzLnJlcXVlc3RRdWV1ZS5zaGlmdCgpO1xuICAgICAgaWYgKG5leHQpIG5leHQoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogUmV0cnkgbG9naWMgd2l0aCBleHBvbmVudGlhbCBiYWNrb2ZmXG4gICAqL1xuICBwcml2YXRlIGFzeW5jIHJldHJ5V2l0aEJhY2tvZmY8VD4oXG4gICAgcmVxdWVzdEZuOiAoKSA9PiBQcm9taXNlPFQ+LFxuICAgIG1heFJldHJpZXMgPSAzLFxuICAgIGJhc2VEZWxheSA9IDEwMDBcbiAgKTogUHJvbWlzZTxUPiB7XG4gICAgZm9yIChsZXQgYXR0ZW1wdCA9IDA7IGF0dGVtcHQgPD0gbWF4UmV0cmllczsgYXR0ZW1wdCsrKSB7XG4gICAgICB0cnkge1xuICAgICAgICByZXR1cm4gYXdhaXQgcmVxdWVzdEZuKCk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zdCBheGlvc0Vycm9yID0gZXJyb3IgYXMgQXhpb3NFcnJvcjtcblxuICAgICAgICAvLyBEb24ndCByZXRyeSBvbiA0eHggZXJyb3JzIChleGNlcHQgNDI5KVxuICAgICAgICBpZiAoYXhpb3NFcnJvci5yZXNwb25zZSAmJiBheGlvc0Vycm9yLnJlc3BvbnNlLnN0YXR1cyA+PSA0MDAgJiYgYXhpb3NFcnJvci5yZXNwb25zZS5zdGF0dXMgPCA1MDApIHtcbiAgICAgICAgICBpZiAoYXhpb3NFcnJvci5yZXNwb25zZS5zdGF0dXMgPT09IDQyOSkge1xuICAgICAgICAgICAgLy8gUmF0ZSBsaW1pdGVkIC0gd2FpdCBmb3IgcmV0cnktYWZ0ZXIgaGVhZGVyXG4gICAgICAgICAgICBjb25zdCByZXRyeUFmdGVyID0gYXhpb3NFcnJvci5yZXNwb25zZS5oZWFkZXJzWydyZXRyeS1hZnRlciddO1xuICAgICAgICAgICAgY29uc3QgZGVsYXkgPSByZXRyeUFmdGVyID8gcGFyc2VJbnQocmV0cnlBZnRlcikgKiAxMDAwIDogYmFzZURlbGF5ICogTWF0aC5wb3coMiwgYXR0ZW1wdCk7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYFJhdGUgbGltaXRlZC4gUmV0cnlpbmcgYWZ0ZXIgJHtkZWxheX1tcy4uLmApO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5zbGVlcChkZWxheSk7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gT3RoZXIgNHh4IGVycm9ycyAtIGRvbid0IHJldHJ5XG4gICAgICAgICAgdGhyb3cgZXJyb3I7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBSZXRyeSBvbiA1eHggZXJyb3JzIG9yIG5ldHdvcmsgaXNzdWVzXG4gICAgICAgIGlmIChhdHRlbXB0IDwgbWF4UmV0cmllcykge1xuICAgICAgICAgIGNvbnN0IGRlbGF5ID0gYmFzZURlbGF5ICogTWF0aC5wb3coMiwgYXR0ZW1wdCk7XG4gICAgICAgICAgY29uc29sZS53YXJuKGBSZXF1ZXN0IGZhaWxlZCAoYXR0ZW1wdCAke2F0dGVtcHQgKyAxfS8ke21heFJldHJpZXMgKyAxfSkuIFJldHJ5aW5nIGFmdGVyICR7ZGVsYXl9bXMuLi5gKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnNsZWVwKGRlbGF5KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcignTWF4IHJldHJpZXMgZXhjZWVkZWQnKTtcbiAgfVxuXG4gIHByaXZhdGUgc2xlZXAobXM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xuICB9XG59XG4iXX0=