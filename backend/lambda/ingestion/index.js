"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const riot_client_1 = require("./riot-client");
/**
 * Ingestion Lambda - Fetch match data from Riot API
 *
 * This function:
 * 1. Receives a player summoner name + region
 * 2. Fetches match history from Riot API
 * 3. Stores raw data in S3
 * 4. Saves player record to DynamoDB
 * 5. Triggers processing pipeline
 */
const s3Client = new client_s3_1.S3Client({ region: process.env.AWS_REGION });
const lambdaClient = new client_lambda_1.LambdaClient({ region: process.env.AWS_REGION });
const dynamoClient = new client_dynamodb_1.DynamoDBClient({ region: process.env.AWS_REGION });
const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region: process.env.AWS_REGION });
const RAW_BUCKET = process.env.RAW_BUCKET;
const PLAYERS_TABLE = process.env.PLAYERS_TABLE;
const PROCESSING_LAMBDA = process.env.PROCESSING_LAMBDA || 'rift-rewind-processing';
const RIOT_API_KEY_SECRET_NAME = process.env.RIOT_API_KEY_SECRET_NAME;
// Cache the API key to avoid repeated Secrets Manager calls
let cachedApiKey = null;
/**
 * Get Riot API key from Secrets Manager (with caching)
 */
async function getRiotApiKey() {
    if (cachedApiKey) {
        return cachedApiKey;
    }
    if (!RIOT_API_KEY_SECRET_NAME) {
        throw new Error('RIOT_API_KEY_SECRET_NAME environment variable is not set');
    }
    try {
        const response = await secretsClient.send(new client_secrets_manager_1.GetSecretValueCommand({
            SecretId: RIOT_API_KEY_SECRET_NAME,
        }));
        if (!response.SecretString) {
            throw new Error('Secret value is empty');
        }
        cachedApiKey = response.SecretString;
        console.log('✅ Successfully retrieved Riot API key from Secrets Manager');
        return cachedApiKey;
    }
    catch (error) {
        console.error('❌ Failed to retrieve Riot API key from Secrets Manager:', error);
        throw new Error('Failed to retrieve API key from Secrets Manager');
    }
}
const handler = async (event) => {
    console.log('Ingestion Lambda invoked', { event });
    // Handle OPTIONS preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: '',
        };
    }
    try {
        // Parse request body
        const body = event.body
            ? JSON.parse(event.body)
            : { summonerName: 'Demo', region: 'NA1' };
        const { summonerName, region, maxMatches = 50 } = body;
        console.log('Fetching data for:', { summonerName, region, maxMatches });
        // Get Riot API key from Secrets Manager
        const RIOT_API_KEY = await getRiotApiKey();
        // Initialize Riot API client
        const riotClient = new riot_client_1.RiotClient(RIOT_API_KEY, region);
        // Step 1: Get player PUUID using Riot ID format (gameName#tagLine)
        let puuid;
        let gameName;
        let tagLine;
        if (summonerName.includes('#')) {
            // User provided full Riot ID
            const [name, tag] = summonerName.split('#');
            gameName = name;
            tagLine = tag;
            try {
                const result = await riotClient.getSummonerByRiotId(gameName, tagLine);
                puuid = result.puuid;
                gameName = result.gameName;
                tagLine = result.tagLine;
            }
            catch (error) {
                if (error.response?.status === 404) {
                    return {
                        statusCode: 404,
                        headers: {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': '*',
                            'Access-Control-Allow-Methods': 'POST, OPTIONS',
                            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                        },
                        body: JSON.stringify({
                            error: 'Player not found',
                            message: `Summoner "${gameName}#${tagLine}" not found. Please verify the Riot ID is correct. You can find your Riot ID in the League client (it's displayed as "Name#TAG").`,
                        }),
                    };
                }
                throw error;
            }
        }
        else {
            // User only provided name - try common tag variations for the region
            gameName = summonerName;
            // Common tag patterns by region
            const commonTags = {
                'KR': ['KR1', 'KR', 'kr1'],
                'NA1': ['NA1', 'NA', 'na1'],
                'EUW1': ['EUW', 'EUW1', 'euw'],
                'EUNE': ['EUNE', 'EUN1', 'eune'],
                'JP1': ['JP1', 'JP', 'jp1'],
                'BR1': ['BR1', 'BR', 'br1'],
                'LA1': ['LA1', 'LAN', 'lan'],
                'LA2': ['LA2', 'LAS', 'las'],
                'OC1': ['OCE', 'OC1', 'oce'],
                'TR1': ['TR1', 'TR', 'tr1'],
                'RU': ['RU', 'RU1', 'ru'],
            };
            const tagsToTry = commonTags[region] || [region, region.replace('1', '')];
            // Try each tag variation
            for (const tryTag of tagsToTry) {
                try {
                    console.log(`Trying ${gameName}#${tryTag}`);
                    const result = await riotClient.getSummonerByRiotId(gameName, tryTag);
                    puuid = result.puuid;
                    tagLine = result.tagLine; // Use the actual tag from Riot
                    gameName = result.gameName; // Use the actual name from Riot (correct capitalization)
                    console.log(`✅ Found player: ${gameName}#${tagLine}`);
                    break;
                }
                catch (error) {
                    if (error.response?.status === 404) {
                        // Not found with this tag, try next
                        continue;
                    }
                    // Other error, rethrow
                    throw error;
                }
            }
            if (!puuid || !tagLine) {
                return {
                    statusCode: 404,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    },
                    body: JSON.stringify({
                        error: 'Player not found',
                        message: `Summoner "${summonerName}" not found in region ${region}. Please use the full Riot ID format: "Name#TAG" (e.g., "Chovy#KR1", "Faker#KR1", "Doublelift#NA1"). You can find your Riot ID in the League client.`,
                        suggestedFormats: tagsToTry.map(tag => `${summonerName}#${tag}`),
                    }),
                };
            }
        }
        const playerId = `${region}_${puuid.slice(0, 8)}`;
        console.log('Player found:', { playerId, puuid, gameName, tagLine });
        // Step 2: Save player to DynamoDB
        await dynamoClient.send(new client_dynamodb_1.PutItemCommand({
            TableName: PLAYERS_TABLE,
            Item: {
                playerId: { S: playerId },
                puuid: { S: puuid },
                summonerName: { S: `${gameName}#${tagLine}` },
                region: { S: region },
                lastUpdated: { S: new Date().toISOString() },
            },
        }));
        console.log('Player saved to DynamoDB');
        // Step 3: Fetch match IDs
        const matchIds = await riotClient.getMatchIds(puuid, 0, Math.min(maxMatches, 100));
        console.log(`Found ${matchIds.length} matches`);
        // Step 4: Fetch and store each match
        const storedMatches = [];
        for (let i = 0; i < Math.min(matchIds.length, maxMatches); i++) {
            const matchId = matchIds[i];
            try {
                console.log(`Fetching match ${i + 1}/${matchIds.length}: ${matchId}`);
                const matchData = await riotClient.getMatch(matchId);
                // Store raw match data in S3
                const key = `${region}/${puuid}/${matchId}.json`;
                await s3Client.send(new client_s3_1.PutObjectCommand({
                    Bucket: RAW_BUCKET,
                    Key: key,
                    Body: JSON.stringify(matchData),
                    ContentType: 'application/json',
                }));
                storedMatches.push(matchId);
                console.log(`Stored match ${matchId} to S3`);
                // Small delay to avoid rate limiting (Riot API is strict)
                if (i < matchIds.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            catch (error) {
                console.error(`Failed to fetch match ${matchId}:`, error);
                // Continue with other matches
            }
        }
        console.log(`Successfully stored ${storedMatches.length} matches`);
        // Step 5: Trigger processing Lambda for each match
        if (storedMatches.length > 0) {
            console.log(`Triggering processing for ${storedMatches.length} matches`);
            for (const matchId of storedMatches) {
                try {
                    await lambdaClient.send(new client_lambda_1.InvokeCommand({
                        FunctionName: PROCESSING_LAMBDA,
                        InvocationType: 'Event', // Async invocation
                        Payload: JSON.stringify({
                            puuid,
                            matchId,
                            region,
                        }),
                    }));
                    console.log(`Processing Lambda triggered for match ${matchId}`);
                }
                catch (error) {
                    console.error(`Failed to trigger processing Lambda for match ${matchId}:`, error);
                    // Non-fatal - match is stored in S3, can be reprocessed later
                }
            }
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: JSON.stringify({
                message: 'Ingestion completed successfully',
                puuid,
                summonerName,
                region,
                matchesFetched: storedMatches.length,
                totalMatches: matchIds.length,
            }),
        };
    }
    catch (error) {
        console.error('Error in ingestion:', error);
        // Parse the request body to get summoner info for error message
        let summonerName = 'Unknown';
        let region = 'Unknown';
        try {
            const requestBody = event.body ? JSON.parse(event.body) : {};
            summonerName = requestBody.summonerName || 'Unknown';
            region = requestBody.region || 'Unknown';
        }
        catch (e) {
            // Ignore parse errors
        }
        // Check if it's a 404 error (player not found)
        const isAxiosError = error && typeof error === 'object' && 'response' in error;
        const status = isAxiosError && error.response?.status;
        if (status === 404) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                },
                body: JSON.stringify({
                    error: 'Player not found',
                    message: `Summoner "${summonerName}" not found in region ${region}. Please check the spelling and try again. Make sure to use the format: Name#TAG (e.g., "Faker#KR" or "Doublelift#NA1")`,
                }),
            };
        }
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error instanceof Error ? error.stack : undefined,
            }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxrREFBZ0U7QUFDaEUsMERBQXFFO0FBQ3JFLDhEQUEwRTtBQUMxRSw0RUFBOEY7QUFDOUYsK0NBQTJDO0FBRTNDOzs7Ozs7Ozs7R0FTRztBQUVILE1BQU0sUUFBUSxHQUFHLElBQUksb0JBQVEsQ0FBQyxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7QUFDbEUsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUMsQ0FBQztBQUMxRSxNQUFNLFlBQVksR0FBRyxJQUFJLGdDQUFjLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBQzVFLE1BQU0sYUFBYSxHQUFHLElBQUksNkNBQW9CLENBQUMsRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0FBRW5GLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBVyxDQUFDO0FBQzNDLE1BQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYyxDQUFDO0FBQ2pELE1BQU0saUJBQWlCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsSUFBSSx3QkFBd0IsQ0FBQztBQUNwRixNQUFNLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsd0JBQXdCLENBQUM7QUFFdEUsNERBQTREO0FBQzVELElBQUksWUFBWSxHQUFrQixJQUFJLENBQUM7QUFFdkM7O0dBRUc7QUFDSCxLQUFLLFVBQVUsYUFBYTtJQUMxQixJQUFJLFlBQVksRUFBRSxDQUFDO1FBQ2pCLE9BQU8sWUFBWSxDQUFDO0lBQ3RC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RSxLQUFLLFlBQVksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTO2FBQzFELENBQUM7U0FDSCxDQUFDO0lBQ0osQ0FBQztBQUNILENBQUMsQ0FBQztBQW5SVyxRQUFBLE9BQU8sV0FtUmxCIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgUzNDbGllbnQsIFB1dE9iamVjdENvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtczMnO1xuaW1wb3J0IHsgTGFtYmRhQ2xpZW50LCBJbnZva2VDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvY2xpZW50LWxhbWJkYSc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCwgUHV0SXRlbUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xuaW1wb3J0IHsgU2VjcmV0c01hbmFnZXJDbGllbnQsIEdldFNlY3JldFZhbHVlQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zZWNyZXRzLW1hbmFnZXInO1xuaW1wb3J0IHsgUmlvdENsaWVudCB9IGZyb20gJy4vcmlvdC1jbGllbnQnO1xuXG4vKipcbiAqIEluZ2VzdGlvbiBMYW1iZGEgLSBGZXRjaCBtYXRjaCBkYXRhIGZyb20gUmlvdCBBUElcbiAqIFxuICogVGhpcyBmdW5jdGlvbjpcbiAqIDEuIFJlY2VpdmVzIGEgcGxheWVyIHN1bW1vbmVyIG5hbWUgKyByZWdpb25cbiAqIDIuIEZldGNoZXMgbWF0Y2ggaGlzdG9yeSBmcm9tIFJpb3QgQVBJXG4gKiAzLiBTdG9yZXMgcmF3IGRhdGEgaW4gUzNcbiAqIDQuIFNhdmVzIHBsYXllciByZWNvcmQgdG8gRHluYW1vREJcbiAqIDUuIFRyaWdnZXJzIHByb2Nlc3NpbmcgcGlwZWxpbmVcbiAqL1xuXG5jb25zdCBzM0NsaWVudCA9IG5ldyBTM0NsaWVudCh7IHJlZ2lvbjogcHJvY2Vzcy5lbnYuQVdTX1JFR0lPTiB9KTtcbmNvbnN0IGxhbWJkYUNsaWVudCA9IG5ldyBMYW1iZGFDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSk7XG5jb25zdCBkeW5hbW9DbGllbnQgPSBuZXcgRHluYW1vREJDbGllbnQoeyByZWdpb246IHByb2Nlc3MuZW52LkFXU19SRUdJT04gfSk7XG5jb25zdCBzZWNyZXRzQ2xpZW50ID0gbmV3IFNlY3JldHNNYW5hZ2VyQ2xpZW50KHsgcmVnaW9uOiBwcm9jZXNzLmVudi5BV1NfUkVHSU9OIH0pO1xuXG5jb25zdCBSQVdfQlVDS0VUID0gcHJvY2Vzcy5lbnYuUkFXX0JVQ0tFVCE7XG5jb25zdCBQTEFZRVJTX1RBQkxFID0gcHJvY2Vzcy5lbnYuUExBWUVSU19UQUJMRSE7XG5jb25zdCBQUk9DRVNTSU5HX0xBTUJEQSA9IHByb2Nlc3MuZW52LlBST0NFU1NJTkdfTEFNQkRBIHx8ICdyaWZ0LXJld2luZC1wcm9jZXNzaW5nJztcbmNvbnN0IFJJT1RfQVBJX0tFWV9TRUNSRVRfTkFNRSA9IHByb2Nlc3MuZW52LlJJT1RfQVBJX0tFWV9TRUNSRVRfTkFNRTtcblxuLy8gQ2FjaGUgdGhlIEFQSSBrZXkgdG8gYXZvaWQgcmVwZWF0ZWQgU2VjcmV0cyBNYW5hZ2VyIGNhbGxzXG5sZXQgY2FjaGVkQXBpS2V5OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblxuLyoqXG4gKiBHZXQgUmlvdCBBUEkga2V5IGZyb20gU2VjcmV0cyBNYW5hZ2VyICh3aXRoIGNhY2hpbmcpXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFJpb3RBcGlLZXkoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgaWYgKGNhY2hlZEFwaUtleSkge1xuICAgIHJldHVybiBjYWNoZWRBcGlLZXk7XG4gIH1cblxuICBpZiAoIVJJT1RfQVBJX0tFWV9TRUNSRVRfTkFNRSkge1xuICAgIHRocm93IG5ldyBFcnJvcignUklPVF9BUElfS0VZX1NFQ1JFVF9OQU1FIGVudmlyb25tZW50IHZhcmlhYmxlIGlzIG5vdCBzZXQnKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzZWNyZXRzQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgR2V0U2VjcmV0VmFsdWVDb21tYW5kKHtcbiAgICAgICAgU2VjcmV0SWQ6IFJJT1RfQVBJX0tFWV9TRUNSRVRfTkFNRSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmICghcmVzcG9uc2UuU2VjcmV0U3RyaW5nKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NlY3JldCB2YWx1ZSBpcyBlbXB0eScpO1xuICAgIH1cblxuICAgIGNhY2hlZEFwaUtleSA9IHJlc3BvbnNlLlNlY3JldFN0cmluZztcbiAgICBjb25zb2xlLmxvZygn4pyFIFN1Y2Nlc3NmdWxseSByZXRyaWV2ZWQgUmlvdCBBUEkga2V5IGZyb20gU2VjcmV0cyBNYW5hZ2VyJyk7XG4gICAgcmV0dXJuIGNhY2hlZEFwaUtleTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCfinYwgRmFpbGVkIHRvIHJldHJpZXZlIFJpb3QgQVBJIGtleSBmcm9tIFNlY3JldHMgTWFuYWdlcjonLCBlcnJvcik7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmV0cmlldmUgQVBJIGtleSBmcm9tIFNlY3JldHMgTWFuYWdlcicpO1xuICB9XG59XG5cbmludGVyZmFjZSBJbmdlc3Rpb25SZXF1ZXN0IHtcbiAgc3VtbW9uZXJOYW1lOiBzdHJpbmc7XG4gIHJlZ2lvbjogc3RyaW5nO1xuICBtYXhNYXRjaGVzPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogQVBJR2F0ZXdheVByb3h5RXZlbnQpOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xuICBjb25zb2xlLmxvZygnSW5nZXN0aW9uIExhbWJkYSBpbnZva2VkJywgeyBldmVudCB9KTtcblxuICAvLyBIYW5kbGUgT1BUSU9OUyBwcmVmbGlnaHQgcmVxdWVzdFxuICBpZiAoZXZlbnQuaHR0cE1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbic6ICcqJyxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnUE9TVCwgT1BUSU9OUycsXG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvbicsXG4gICAgICB9LFxuICAgICAgYm9keTogJycsXG4gICAgfTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgLy8gUGFyc2UgcmVxdWVzdCBib2R5XG4gICAgY29uc3QgYm9keTogSW5nZXN0aW9uUmVxdWVzdCA9IGV2ZW50LmJvZHkgXG4gICAgICA/IEpTT04ucGFyc2UoZXZlbnQuYm9keSkgXG4gICAgICA6IHsgc3VtbW9uZXJOYW1lOiAnRGVtbycsIHJlZ2lvbjogJ05BMScgfTtcblxuICAgIGNvbnN0IHsgc3VtbW9uZXJOYW1lLCByZWdpb24sIG1heE1hdGNoZXMgPSA1MCB9ID0gYm9keTtcblxuICAgIGNvbnNvbGUubG9nKCdGZXRjaGluZyBkYXRhIGZvcjonLCB7IHN1bW1vbmVyTmFtZSwgcmVnaW9uLCBtYXhNYXRjaGVzIH0pO1xuXG4gICAgLy8gR2V0IFJpb3QgQVBJIGtleSBmcm9tIFNlY3JldHMgTWFuYWdlclxuICAgIGNvbnN0IFJJT1RfQVBJX0tFWSA9IGF3YWl0IGdldFJpb3RBcGlLZXkoKTtcblxuICAgIC8vIEluaXRpYWxpemUgUmlvdCBBUEkgY2xpZW50XG4gICAgY29uc3QgcmlvdENsaWVudCA9IG5ldyBSaW90Q2xpZW50KFJJT1RfQVBJX0tFWSwgcmVnaW9uKTtcblxuICAgIC8vIFN0ZXAgMTogR2V0IHBsYXllciBQVVVJRCB1c2luZyBSaW90IElEIGZvcm1hdCAoZ2FtZU5hbWUjdGFnTGluZSlcbiAgICBsZXQgcHV1aWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBsZXQgZ2FtZU5hbWU6IHN0cmluZztcbiAgICBsZXQgdGFnTGluZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIFxuICAgIGlmIChzdW1tb25lck5hbWUuaW5jbHVkZXMoJyMnKSkge1xuICAgICAgLy8gVXNlciBwcm92aWRlZCBmdWxsIFJpb3QgSURcbiAgICAgIGNvbnN0IFtuYW1lLCB0YWddID0gc3VtbW9uZXJOYW1lLnNwbGl0KCcjJyk7XG4gICAgICBnYW1lTmFtZSA9IG5hbWU7XG4gICAgICB0YWdMaW5lID0gdGFnO1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByaW90Q2xpZW50LmdldFN1bW1vbmVyQnlSaW90SWQoZ2FtZU5hbWUsIHRhZ0xpbmUpO1xuICAgICAgICBwdXVpZCA9IHJlc3VsdC5wdXVpZDtcbiAgICAgICAgZ2FtZU5hbWUgPSByZXN1bHQuZ2FtZU5hbWU7XG4gICAgICAgIHRhZ0xpbmUgPSByZXN1bHQudGFnTGluZTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgaWYgKGVycm9yLnJlc3BvbnNlPy5zdGF0dXMgPT09IDQwNCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ1BPU1QsIE9QVElPTlMnLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgZXJyb3I6ICdQbGF5ZXIgbm90IGZvdW5kJyxcbiAgICAgICAgICAgICAgbWVzc2FnZTogYFN1bW1vbmVyIFwiJHtnYW1lTmFtZX0jJHt0YWdMaW5lfVwiIG5vdCBmb3VuZC4gUGxlYXNlIHZlcmlmeSB0aGUgUmlvdCBJRCBpcyBjb3JyZWN0LiBZb3UgY2FuIGZpbmQgeW91ciBSaW90IElEIGluIHRoZSBMZWFndWUgY2xpZW50IChpdCdzIGRpc3BsYXllZCBhcyBcIk5hbWUjVEFHXCIpLmAsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycm9yO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2VyIG9ubHkgcHJvdmlkZWQgbmFtZSAtIHRyeSBjb21tb24gdGFnIHZhcmlhdGlvbnMgZm9yIHRoZSByZWdpb25cbiAgICAgIGdhbWVOYW1lID0gc3VtbW9uZXJOYW1lO1xuICAgICAgXG4gICAgICAvLyBDb21tb24gdGFnIHBhdHRlcm5zIGJ5IHJlZ2lvblxuICAgICAgY29uc3QgY29tbW9uVGFnczogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge1xuICAgICAgICAnS1InOiBbJ0tSMScsICdLUicsICdrcjEnXSxcbiAgICAgICAgJ05BMSc6IFsnTkExJywgJ05BJywgJ25hMSddLFxuICAgICAgICAnRVVXMSc6IFsnRVVXJywgJ0VVVzEnLCAnZXV3J10sXG4gICAgICAgICdFVU5FJzogWydFVU5FJywgJ0VVTjEnLCAnZXVuZSddLFxuICAgICAgICAnSlAxJzogWydKUDEnLCAnSlAnLCAnanAxJ10sXG4gICAgICAgICdCUjEnOiBbJ0JSMScsICdCUicsICdicjEnXSxcbiAgICAgICAgJ0xBMSc6IFsnTEExJywgJ0xBTicsICdsYW4nXSxcbiAgICAgICAgJ0xBMic6IFsnTEEyJywgJ0xBUycsICdsYXMnXSxcbiAgICAgICAgJ09DMSc6IFsnT0NFJywgJ09DMScsICdvY2UnXSxcbiAgICAgICAgJ1RSMSc6IFsnVFIxJywgJ1RSJywgJ3RyMSddLFxuICAgICAgICAnUlUnOiBbJ1JVJywgJ1JVMScsICdydSddLFxuICAgICAgfTtcblxuICAgICAgY29uc3QgdGFnc1RvVHJ5ID0gY29tbW9uVGFnc1tyZWdpb25dIHx8IFtyZWdpb24sIHJlZ2lvbi5yZXBsYWNlKCcxJywgJycpXTtcbiAgICAgIFxuICAgICAgLy8gVHJ5IGVhY2ggdGFnIHZhcmlhdGlvblxuICAgICAgZm9yIChjb25zdCB0cnlUYWcgb2YgdGFnc1RvVHJ5KSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFRyeWluZyAke2dhbWVOYW1lfSMke3RyeVRhZ31gKTtcbiAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByaW90Q2xpZW50LmdldFN1bW1vbmVyQnlSaW90SWQoZ2FtZU5hbWUsIHRyeVRhZyk7XG4gICAgICAgICAgcHV1aWQgPSByZXN1bHQucHV1aWQ7XG4gICAgICAgICAgdGFnTGluZSA9IHJlc3VsdC50YWdMaW5lOyAvLyBVc2UgdGhlIGFjdHVhbCB0YWcgZnJvbSBSaW90XG4gICAgICAgICAgZ2FtZU5hbWUgPSByZXN1bHQuZ2FtZU5hbWU7IC8vIFVzZSB0aGUgYWN0dWFsIG5hbWUgZnJvbSBSaW90IChjb3JyZWN0IGNhcGl0YWxpemF0aW9uKVxuICAgICAgICAgIGNvbnNvbGUubG9nKGDinIUgRm91bmQgcGxheWVyOiAke2dhbWVOYW1lfSMke3RhZ0xpbmV9YCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICBpZiAoZXJyb3IucmVzcG9uc2U/LnN0YXR1cyA9PT0gNDA0KSB7XG4gICAgICAgICAgICAvLyBOb3QgZm91bmQgd2l0aCB0aGlzIHRhZywgdHJ5IG5leHRcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBPdGhlciBlcnJvciwgcmV0aHJvd1xuICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICghcHV1aWQgfHwgIXRhZ0xpbmUpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdQT1NULCBPUFRJT05TJyxcbiAgICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICBlcnJvcjogJ1BsYXllciBub3QgZm91bmQnLFxuICAgICAgICAgICAgbWVzc2FnZTogYFN1bW1vbmVyIFwiJHtzdW1tb25lck5hbWV9XCIgbm90IGZvdW5kIGluIHJlZ2lvbiAke3JlZ2lvbn0uIFBsZWFzZSB1c2UgdGhlIGZ1bGwgUmlvdCBJRCBmb3JtYXQ6IFwiTmFtZSNUQUdcIiAoZS5nLiwgXCJDaG92eSNLUjFcIiwgXCJGYWtlciNLUjFcIiwgXCJEb3VibGVsaWZ0I05BMVwiKS4gWW91IGNhbiBmaW5kIHlvdXIgUmlvdCBJRCBpbiB0aGUgTGVhZ3VlIGNsaWVudC5gLFxuICAgICAgICAgICAgc3VnZ2VzdGVkRm9ybWF0czogdGFnc1RvVHJ5Lm1hcCh0YWcgPT4gYCR7c3VtbW9uZXJOYW1lfSMke3RhZ31gKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gICAgXG4gICAgY29uc3QgcGxheWVySWQgPSBgJHtyZWdpb259XyR7cHV1aWQuc2xpY2UoMCwgOCl9YDtcblxuICAgIGNvbnNvbGUubG9nKCdQbGF5ZXIgZm91bmQ6JywgeyBwbGF5ZXJJZCwgcHV1aWQsIGdhbWVOYW1lLCB0YWdMaW5lIH0pO1xuXG4gICAgLy8gU3RlcCAyOiBTYXZlIHBsYXllciB0byBEeW5hbW9EQlxuICAgIGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFB1dEl0ZW1Db21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBQTEFZRVJTX1RBQkxFLFxuICAgICAgICBJdGVtOiB7XG4gICAgICAgICAgcGxheWVySWQ6IHsgUzogcGxheWVySWQgfSxcbiAgICAgICAgICBwdXVpZDogeyBTOiBwdXVpZCB9LFxuICAgICAgICAgIHN1bW1vbmVyTmFtZTogeyBTOiBgJHtnYW1lTmFtZX0jJHt0YWdMaW5lfWAgfSxcbiAgICAgICAgICByZWdpb246IHsgUzogcmVnaW9uIH0sXG4gICAgICAgICAgbGFzdFVwZGF0ZWQ6IHsgUzogbmV3IERhdGUoKS50b0lTT1N0cmluZygpIH0sXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zb2xlLmxvZygnUGxheWVyIHNhdmVkIHRvIER5bmFtb0RCJyk7XG5cbiAgICAvLyBTdGVwIDM6IEZldGNoIG1hdGNoIElEc1xuICAgIGNvbnN0IG1hdGNoSWRzID0gYXdhaXQgcmlvdENsaWVudC5nZXRNYXRjaElkcyhwdXVpZCwgMCwgTWF0aC5taW4obWF4TWF0Y2hlcywgMTAwKSk7XG4gICAgY29uc29sZS5sb2coYEZvdW5kICR7bWF0Y2hJZHMubGVuZ3RofSBtYXRjaGVzYCk7XG5cbiAgICAvLyBTdGVwIDQ6IEZldGNoIGFuZCBzdG9yZSBlYWNoIG1hdGNoXG4gICAgY29uc3Qgc3RvcmVkTWF0Y2hlczogc3RyaW5nW10gPSBbXTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKG1hdGNoSWRzLmxlbmd0aCwgbWF4TWF0Y2hlcyk7IGkrKykge1xuICAgICAgY29uc3QgbWF0Y2hJZCA9IG1hdGNoSWRzW2ldO1xuICAgICAgXG4gICAgICB0cnkge1xuICAgICAgICBjb25zb2xlLmxvZyhgRmV0Y2hpbmcgbWF0Y2ggJHtpICsgMX0vJHttYXRjaElkcy5sZW5ndGh9OiAke21hdGNoSWR9YCk7XG4gICAgICAgIGNvbnN0IG1hdGNoRGF0YSA9IGF3YWl0IHJpb3RDbGllbnQuZ2V0TWF0Y2gobWF0Y2hJZCk7XG5cbiAgICAgICAgLy8gU3RvcmUgcmF3IG1hdGNoIGRhdGEgaW4gUzNcbiAgICAgICAgY29uc3Qga2V5ID0gYCR7cmVnaW9ufS8ke3B1dWlkfS8ke21hdGNoSWR9Lmpzb25gO1xuICAgICAgICBhd2FpdCBzM0NsaWVudC5zZW5kKFxuICAgICAgICAgIG5ldyBQdXRPYmplY3RDb21tYW5kKHtcbiAgICAgICAgICAgIEJ1Y2tldDogUkFXX0JVQ0tFVCxcbiAgICAgICAgICAgIEtleToga2V5LFxuICAgICAgICAgICAgQm9keTogSlNPTi5zdHJpbmdpZnkobWF0Y2hEYXRhKSxcbiAgICAgICAgICAgIENvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcblxuICAgICAgICBzdG9yZWRNYXRjaGVzLnB1c2gobWF0Y2hJZCk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBTdG9yZWQgbWF0Y2ggJHttYXRjaElkfSB0byBTM2ApO1xuXG4gICAgICAgIC8vIFNtYWxsIGRlbGF5IHRvIGF2b2lkIHJhdGUgbGltaXRpbmcgKFJpb3QgQVBJIGlzIHN0cmljdClcbiAgICAgICAgaWYgKGkgPCBtYXRjaElkcy5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgYXdhaXQgbmV3IFByb21pc2UocmVzb2x2ZSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIDEwMCkpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKGBGYWlsZWQgdG8gZmV0Y2ggbWF0Y2ggJHttYXRjaElkfTpgLCBlcnJvcik7XG4gICAgICAgIC8vIENvbnRpbnVlIHdpdGggb3RoZXIgbWF0Y2hlc1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnNvbGUubG9nKGBTdWNjZXNzZnVsbHkgc3RvcmVkICR7c3RvcmVkTWF0Y2hlcy5sZW5ndGh9IG1hdGNoZXNgKTtcblxuICAgIC8vIFN0ZXAgNTogVHJpZ2dlciBwcm9jZXNzaW5nIExhbWJkYSBmb3IgZWFjaCBtYXRjaFxuICAgIGlmIChzdG9yZWRNYXRjaGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnNvbGUubG9nKGBUcmlnZ2VyaW5nIHByb2Nlc3NpbmcgZm9yICR7c3RvcmVkTWF0Y2hlcy5sZW5ndGh9IG1hdGNoZXNgKTtcbiAgICAgIFxuICAgICAgZm9yIChjb25zdCBtYXRjaElkIG9mIHN0b3JlZE1hdGNoZXMpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBhd2FpdCBsYW1iZGFDbGllbnQuc2VuZChcbiAgICAgICAgICAgIG5ldyBJbnZva2VDb21tYW5kKHtcbiAgICAgICAgICAgICAgRnVuY3Rpb25OYW1lOiBQUk9DRVNTSU5HX0xBTUJEQSxcbiAgICAgICAgICAgICAgSW52b2NhdGlvblR5cGU6ICdFdmVudCcsIC8vIEFzeW5jIGludm9jYXRpb25cbiAgICAgICAgICAgICAgUGF5bG9hZDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIHB1dWlkLFxuICAgICAgICAgICAgICAgIG1hdGNoSWQsXG4gICAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhgUHJvY2Vzc2luZyBMYW1iZGEgdHJpZ2dlcmVkIGZvciBtYXRjaCAke21hdGNoSWR9YCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihgRmFpbGVkIHRvIHRyaWdnZXIgcHJvY2Vzc2luZyBMYW1iZGEgZm9yIG1hdGNoICR7bWF0Y2hJZH06YCwgZXJyb3IpO1xuICAgICAgICAgIC8vIE5vbi1mYXRhbCAtIG1hdGNoIGlzIHN0b3JlZCBpbiBTMywgY2FuIGJlIHJlcHJvY2Vzc2VkIGxhdGVyXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdQT1NULCBPUFRJT05TJyxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLCBBdXRob3JpemF0aW9uJyxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIG1lc3NhZ2U6ICdJbmdlc3Rpb24gY29tcGxldGVkIHN1Y2Nlc3NmdWxseScsXG4gICAgICAgIHB1dWlkLFxuICAgICAgICBzdW1tb25lck5hbWUsXG4gICAgICAgIHJlZ2lvbixcbiAgICAgICAgbWF0Y2hlc0ZldGNoZWQ6IHN0b3JlZE1hdGNoZXMubGVuZ3RoLFxuICAgICAgICB0b3RhbE1hdGNoZXM6IG1hdGNoSWRzLmxlbmd0aCxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgaW4gaW5nZXN0aW9uOicsIGVycm9yKTtcbiAgICBcbiAgICAvLyBQYXJzZSB0aGUgcmVxdWVzdCBib2R5IHRvIGdldCBzdW1tb25lciBpbmZvIGZvciBlcnJvciBtZXNzYWdlXG4gICAgbGV0IHN1bW1vbmVyTmFtZSA9ICdVbmtub3duJztcbiAgICBsZXQgcmVnaW9uID0gJ1Vua25vd24nO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXF1ZXN0Qm9keSA9IGV2ZW50LmJvZHkgPyBKU09OLnBhcnNlKGV2ZW50LmJvZHkpIDoge307XG4gICAgICBzdW1tb25lck5hbWUgPSByZXF1ZXN0Qm9keS5zdW1tb25lck5hbWUgfHwgJ1Vua25vd24nO1xuICAgICAgcmVnaW9uID0gcmVxdWVzdEJvZHkucmVnaW9uIHx8ICdVbmtub3duJztcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAvLyBJZ25vcmUgcGFyc2UgZXJyb3JzXG4gICAgfVxuICAgIFxuICAgIC8vIENoZWNrIGlmIGl0J3MgYSA0MDQgZXJyb3IgKHBsYXllciBub3QgZm91bmQpXG4gICAgY29uc3QgaXNBeGlvc0Vycm9yID0gZXJyb3IgJiYgdHlwZW9mIGVycm9yID09PSAnb2JqZWN0JyAmJiAncmVzcG9uc2UnIGluIGVycm9yO1xuICAgIGNvbnN0IHN0YXR1cyA9IGlzQXhpb3NFcnJvciAmJiAoZXJyb3IgYXMgYW55KS5yZXNwb25zZT8uc3RhdHVzO1xuICAgIFxuICAgIGlmIChzdGF0dXMgPT09IDQwNCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICBoZWFkZXJzOiB7XG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ1BPU1QsIE9QVElPTlMnLFxuICAgICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSwgQXV0aG9yaXphdGlvbicsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogJ1BsYXllciBub3QgZm91bmQnLFxuICAgICAgICAgIG1lc3NhZ2U6IGBTdW1tb25lciBcIiR7c3VtbW9uZXJOYW1lfVwiIG5vdCBmb3VuZCBpbiByZWdpb24gJHtyZWdpb259LiBQbGVhc2UgY2hlY2sgdGhlIHNwZWxsaW5nIGFuZCB0cnkgYWdhaW4uIE1ha2Ugc3VyZSB0byB1c2UgdGhlIGZvcm1hdDogTmFtZSNUQUcgKGUuZy4sIFwiRmFrZXIjS1JcIiBvciBcIkRvdWJsZWxpZnQjTkExXCIpYCxcbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdQT1NULCBPUFRJT05TJyxcbiAgICAgICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLCBBdXRob3JpemF0aW9uJyxcbiAgICAgIH0sXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIGVycm9yOiAnSW50ZXJuYWwgc2VydmVyIGVycm9yJyxcbiAgICAgICAgbWVzc2FnZTogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAnVW5rbm93biBlcnJvcicsXG4gICAgICAgIGRldGFpbHM6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5zdGFjayA6IHVuZGVmaW5lZCxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cbn07XG4iXX0=