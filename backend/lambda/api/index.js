"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const PLAYERS_TABLE = process.env.PLAYERS_TABLE;
const MATCHES_TABLE = process.env.MATCHES_TABLE;
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE;
/**
 * API Lambda - Public API endpoints
 *
 * Handles:
 * - GET /player/{playerId} - Get player profile
 * - GET /player/{playerId}/matches - Get match history
 * - GET /player/{playerId}/insights - Get AI insights
 */
const handler = async (event, context) => {
    console.log('API Lambda invoked', { path: event.path, method: event.httpMethod });
    const { path, httpMethod, pathParameters } = event;
    const playerId = pathParameters?.playerId;
    // Handle OPTIONS for CORS preflight
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: '',
        };
    }
    if (!playerId) {
        return {
            statusCode: 400,
            headers: corsHeaders(),
            body: JSON.stringify({ error: 'Missing playerId parameter' }),
        };
    }
    try {
        // Route based on path
        if (path.includes('/insights')) {
            return await getInsights(playerId);
        }
        else if (path.includes('/matches')) {
            return await getMatches(playerId);
        }
        else {
            return await getPlayer(playerId);
        }
    }
    catch (error) {
        console.error('Error in API handler:', error);
        return {
            statusCode: 500,
            headers: corsHeaders(),
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
        };
    }
};
exports.handler = handler;
/**
 * GET /player/{playerId} - Get player profile
 */
async function getPlayer(playerId) {
    try {
        // Query player from DynamoDB using GSI
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: PLAYERS_TABLE,
            IndexName: 'puuid-index',
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId, // playerId here is actually the puuid from the URL
            },
        }));
        if (!result.Items || result.Items.length === 0) {
            return {
                statusCode: 404,
                headers: corsHeaders(),
                body: JSON.stringify({ error: 'Player not found' }),
            };
        }
        const player = result.Items[0];
        // Get match count using the actual playerId from the player record
        const matchesResult = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: MATCHES_TABLE,
            KeyConditionExpression: 'playerId = :playerId',
            ExpressionAttributeValues: {
                ':playerId': player.playerId,
            },
            Select: 'COUNT',
        }));
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                puuid: player.puuid,
                summonerName: player.summonerName,
                region: player.region,
                matchCount: matchesResult.Count || 0,
                lastUpdated: player.lastUpdated,
            }),
        };
    }
    catch (error) {
        console.error('Error fetching player:', error);
        throw error;
    }
}
/**
 * GET /player/{playerId}/matches - Get match history
 */
async function getMatches(playerId) {
    try {
        // First get the player to get the actual playerId
        const playerResult = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: PLAYERS_TABLE,
            IndexName: 'puuid-index',
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId, // playerId here is actually the puuid from the URL
            },
        }));
        if (!playerResult.Items || playerResult.Items.length === 0) {
            return {
                statusCode: 404,
                headers: corsHeaders(),
                body: JSON.stringify({ error: 'Player not found' }),
            };
        }
        const player = playerResult.Items[0];
        // Query matches from DynamoDB using the actual playerId
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: MATCHES_TABLE,
            KeyConditionExpression: 'playerId = :playerId',
            ExpressionAttributeValues: {
                ':playerId': player.playerId,
            },
            ScanIndexForward: false, // Newest first
            Limit: 20,
        }));
        const matches = result.Items || [];
        // Calculate aggregate stats
        const aggregateStats = calculateAggregateStats(matches);
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                puuid: playerId,
                matches,
                aggregateStats,
                count: matches.length,
            }),
        };
    }
    catch (error) {
        console.error('Error fetching matches:', error);
        throw error;
    }
}
/**
 * GET /player/{playerId}/insights - Get AI insights
 */
async function getInsights(playerId) {
    try {
        // Check for demo player
        if (playerId === 'demo') {
            return {
                statusCode: 200,
                headers: corsHeaders(),
                body: JSON.stringify({
                    puuid: 'demo',
                    heroSummary: 'Demo player with strong mechanics and consistent performance across multiple champions.',
                    coachingTips: [
                        'Focus on ward placement in river bushes for better vision control',
                        'Practice CS under tower to maintain gold advantage',
                        'Work on late-game positioning during team fights',
                    ],
                    roastMode: "You're doing great, but we both know you could ward more!",
                    hiddenGems: 'Your average vision score is 15% higher than players at your rank',
                    playstyleInsights: {
                        aggression: 75,
                        vision: 85,
                        farming: 70,
                        teamfighting: 80,
                        consistency: 78,
                    },
                }),
            };
        }
        // First get the player to get the actual playerId
        const playerResult = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: PLAYERS_TABLE,
            IndexName: 'puuid-index',
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId, // playerId here is actually the puuid from the URL
            },
        }));
        if (!playerResult.Items || playerResult.Items.length === 0) {
            return {
                statusCode: 404,
                headers: corsHeaders(),
                body: JSON.stringify({ error: 'Player not found' }),
            };
        }
        const player = playerResult.Items[0];
        // Query insights from DynamoDB using the actual playerId
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: INSIGHTS_TABLE,
            KeyConditionExpression: 'playerId = :playerId',
            ExpressionAttributeValues: {
                ':playerId': player.playerId,
            },
            ScanIndexForward: false, // Newest first
            Limit: 1,
        }));
        if (!result.Items || result.Items.length === 0) {
            return {
                statusCode: 404,
                headers: corsHeaders(),
                body: JSON.stringify({
                    error: 'No insights available yet',
                    message: 'Insights are being generated. Please try again in a few moments.',
                }),
            };
        }
        const insights = result.Items[0];
        return {
            statusCode: 200,
            headers: corsHeaders(),
            body: JSON.stringify({
                puuid: playerId,
                heroSummary: insights.heroSummary,
                coachingTips: insights.coachingTips,
                roastMode: insights.roastMode,
                hiddenGems: insights.hiddenGems,
                playstyleInsights: insights.playstyleInsights,
                timestamp: insights.timestamp,
            }),
        };
    }
    catch (error) {
        console.error('Error fetching insights:', error);
        throw error;
    }
}
/**
 * Calculate aggregate statistics from match history
 */
function calculateAggregateStats(matches) {
    if (matches.length === 0) {
        return {
            totalMatches: 0,
            winRate: 0,
            avgKDA: 0,
            avgCSPerMin: 0,
        };
    }
    const wins = matches.filter((m) => m.win).length;
    const totalKDA = matches.reduce((sum, m) => sum + m.kda, 0);
    const totalCSPerMin = matches.reduce((sum, m) => sum + m.csPerMin, 0);
    return {
        totalMatches: matches.length,
        winRate: Math.round((wins / matches.length) * 100),
        avgKDA: (totalKDA / matches.length).toFixed(2),
        avgCSPerMin: (totalCSPerMin / matches.length).toFixed(1),
    };
}
/**
 * CORS headers for API Gateway
 */
function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQXlGO0FBRXpGLE1BQU0sWUFBWSxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUV6RSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWMsQ0FBQztBQUNqRCxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWMsQ0FBQztBQUNqRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWUsQ0FBQztBQUVuRDs7Ozs7OztHQU9HO0FBRUksTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUMzQixPQUFnQixFQUNnQixFQUFFO0lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFFbEYsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLEdBQUcsS0FBSyxDQUFDO0lBQ25ELE1BQU0sUUFBUSxHQUFHLGNBQWMsRUFBRSxRQUFRLENBQUM7SUFFMUMsb0NBQW9DO0lBQ3BDLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzdCLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxXQUFXLEVBQUU7WUFDdEIsSUFBSSxFQUFFLEVBQUU7U0FDVCxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxXQUFXLEVBQUU7WUFDdEIsSUFBSSxFQUFFLElBQUksQ0FB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QUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQztJQUNqRCxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDNUQsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBRXRFLE9BQU87UUFDTCxZQUFZLEVBQUUsT0FBTyxDQUFDLE1BQU07UUFDNUIsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQztRQUNsRCxNQUFNLEVBQUUsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7UUFDOUMsV0FBVyxFQUFFLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO0tBQ3pELENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLFdBQVc7SUFDbEIsT0FBTztRQUNMLGNBQWMsRUFBRSxrQkFBa0I7UUFDbEMsNkJBQTZCLEVBQUUsR0FBRztRQUNsQyw4QkFBOEIsRUFBRSxrQkFBa0I7UUFDbEQsOEJBQThCLEVBQUUsNEJBQTRCO0tBQzdELENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQVBJR2F0ZXdheVByb3h5RXZlbnQsIEFQSUdhdGV3YXlQcm94eVJlc3VsdCwgQ29udGV4dCB9IGZyb20gJ2F3cy1sYW1iZGEnO1xuaW1wb3J0IHsgRHluYW1vREJDbGllbnQgfSBmcm9tICdAYXdzLXNkay9jbGllbnQtZHluYW1vZGInO1xuaW1wb3J0IHsgRHluYW1vREJEb2N1bWVudENsaWVudCwgR2V0Q29tbWFuZCwgUXVlcnlDb21tYW5kIH0gZnJvbSAnQGF3cy1zZGsvbGliLWR5bmFtb2RiJztcblxuY29uc3QgZHluYW1vQ2xpZW50ID0gRHluYW1vREJEb2N1bWVudENsaWVudC5mcm9tKG5ldyBEeW5hbW9EQkNsaWVudCh7fSkpO1xuXG5jb25zdCBQTEFZRVJTX1RBQkxFID0gcHJvY2Vzcy5lbnYuUExBWUVSU19UQUJMRSE7XG5jb25zdCBNQVRDSEVTX1RBQkxFID0gcHJvY2Vzcy5lbnYuTUFUQ0hFU19UQUJMRSE7XG5jb25zdCBJTlNJR0hUU19UQUJMRSA9IHByb2Nlc3MuZW52LklOU0lHSFRTX1RBQkxFITtcblxuLyoqXG4gKiBBUEkgTGFtYmRhIC0gUHVibGljIEFQSSBlbmRwb2ludHNcbiAqIFxuICogSGFuZGxlczpcbiAqIC0gR0VUIC9wbGF5ZXIve3BsYXllcklkfSAtIEdldCBwbGF5ZXIgcHJvZmlsZVxuICogLSBHRVQgL3BsYXllci97cGxheWVySWR9L21hdGNoZXMgLSBHZXQgbWF0Y2ggaGlzdG9yeVxuICogLSBHRVQgL3BsYXllci97cGxheWVySWR9L2luc2lnaHRzIC0gR2V0IEFJIGluc2lnaHRzXG4gKi9cblxuZXhwb3J0IGNvbnN0IGhhbmRsZXIgPSBhc3luYyAoXG4gIGV2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudCxcbiAgY29udGV4dDogQ29udGV4dFxuKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+ID0+IHtcbiAgY29uc29sZS5sb2coJ0FQSSBMYW1iZGEgaW52b2tlZCcsIHsgcGF0aDogZXZlbnQucGF0aCwgbWV0aG9kOiBldmVudC5odHRwTWV0aG9kIH0pO1xuXG4gIGNvbnN0IHsgcGF0aCwgaHR0cE1ldGhvZCwgcGF0aFBhcmFtZXRlcnMgfSA9IGV2ZW50O1xuICBjb25zdCBwbGF5ZXJJZCA9IHBhdGhQYXJhbWV0ZXJzPy5wbGF5ZXJJZDtcblxuICAvLyBIYW5kbGUgT1BUSU9OUyBmb3IgQ09SUyBwcmVmbGlnaHRcbiAgaWYgKGh0dHBNZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgYm9keTogJycsXG4gICAgfTtcbiAgfVxuXG4gIGlmICghcGxheWVySWQpIHtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdNaXNzaW5nIHBsYXllcklkIHBhcmFtZXRlcicgfSksXG4gICAgfTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgLy8gUm91dGUgYmFzZWQgb24gcGF0aFxuICAgIGlmIChwYXRoLmluY2x1ZGVzKCcvaW5zaWdodHMnKSkge1xuICAgICAgcmV0dXJuIGF3YWl0IGdldEluc2lnaHRzKHBsYXllcklkKTtcbiAgICB9IGVsc2UgaWYgKHBhdGguaW5jbHVkZXMoJy9tYXRjaGVzJykpIHtcbiAgICAgIHJldHVybiBhd2FpdCBnZXRNYXRjaGVzKHBsYXllcklkKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIGF3YWl0IGdldFBsYXllcihwbGF5ZXJJZCk7XG4gICAgfVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIEFQSSBoYW5kbGVyOicsIGVycm9yKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogNTAwLFxuICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InLFxuICAgICAgICBtZXNzYWdlOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICdVbmtub3duIGVycm9yJyxcbiAgICAgIH0pLFxuICAgIH07XG4gIH1cbn07XG5cbi8qKlxuICogR0VUIC9wbGF5ZXIve3BsYXllcklkfSAtIEdldCBwbGF5ZXIgcHJvZmlsZVxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRQbGF5ZXIocGxheWVySWQ6IHN0cmluZyk6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiB7XG4gIHRyeSB7XG4gICAgLy8gUXVlcnkgcGxheWVyIGZyb20gRHluYW1vREIgdXNpbmcgR1NJXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBQTEFZRVJTX1RBQkxFLFxuICAgICAgICBJbmRleE5hbWU6ICdwdXVpZC1pbmRleCcsXG4gICAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdwdXVpZCA9IDpwdXVpZCcsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAnOnB1dWlkJzogcGxheWVySWQsIC8vIHBsYXllcklkIGhlcmUgaXMgYWN0dWFsbHkgdGhlIHB1dWlkIGZyb20gdGhlIFVSTFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgaWYgKCFyZXN1bHQuSXRlbXMgfHwgcmVzdWx0Lkl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDA0LFxuICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUGxheWVyIG5vdCBmb3VuZCcgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHBsYXllciA9IHJlc3VsdC5JdGVtc1swXTtcblxuICAgIC8vIEdldCBtYXRjaCBjb3VudCB1c2luZyB0aGUgYWN0dWFsIHBsYXllcklkIGZyb20gdGhlIHBsYXllciByZWNvcmRcbiAgICBjb25zdCBtYXRjaGVzUmVzdWx0ID0gYXdhaXQgZHluYW1vQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBNQVRDSEVTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncGxheWVySWQgPSA6cGxheWVySWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwbGF5ZXJJZCc6IHBsYXllci5wbGF5ZXJJZCxcbiAgICAgICAgfSxcbiAgICAgICAgU2VsZWN0OiAnQ09VTlQnLFxuICAgICAgfSlcbiAgICApO1xuICAgIFxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBwdXVpZDogcGxheWVyLnB1dWlkLFxuICAgICAgICBzdW1tb25lck5hbWU6IHBsYXllci5zdW1tb25lck5hbWUsXG4gICAgICAgIHJlZ2lvbjogcGxheWVyLnJlZ2lvbixcbiAgICAgICAgbWF0Y2hDb3VudDogbWF0Y2hlc1Jlc3VsdC5Db3VudCB8fCAwLFxuICAgICAgICBsYXN0VXBkYXRlZDogcGxheWVyLmxhc3RVcGRhdGVkLFxuICAgICAgfSksXG4gICAgfTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBmZXRjaGluZyBwbGF5ZXI6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogR0VUIC9wbGF5ZXIve3BsYXllcklkfS9tYXRjaGVzIC0gR2V0IG1hdGNoIGhpc3RvcnlcbiAqL1xuYXN5bmMgZnVuY3Rpb24gZ2V0TWF0Y2hlcyhwbGF5ZXJJZDogc3RyaW5nKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICAvLyBGaXJzdCBnZXQgdGhlIHBsYXllciB0byBnZXQgdGhlIGFjdHVhbCBwbGF5ZXJJZFxuICAgIGNvbnN0IHBsYXllclJlc3VsdCA9IGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogUExBWUVSU19UQUJMRSxcbiAgICAgICAgSW5kZXhOYW1lOiAncHV1aWQtaW5kZXgnLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncHV1aWQgPSA6cHV1aWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwdXVpZCc6IHBsYXllcklkLCAvLyBwbGF5ZXJJZCBoZXJlIGlzIGFjdHVhbGx5IHRoZSBwdXVpZCBmcm9tIHRoZSBVUkxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmICghcGxheWVyUmVzdWx0Lkl0ZW1zIHx8IHBsYXllclJlc3VsdC5JdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1BsYXllciBub3QgZm91bmQnIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBwbGF5ZXIgPSBwbGF5ZXJSZXN1bHQuSXRlbXNbMF07XG5cbiAgICAvLyBRdWVyeSBtYXRjaGVzIGZyb20gRHluYW1vREIgdXNpbmcgdGhlIGFjdHVhbCBwbGF5ZXJJZFxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogTUFUQ0hFU19UQUJMRSxcbiAgICAgICAgS2V5Q29uZGl0aW9uRXhwcmVzc2lvbjogJ3BsYXllcklkID0gOnBsYXllcklkJyxcbiAgICAgICAgRXhwcmVzc2lvbkF0dHJpYnV0ZVZhbHVlczoge1xuICAgICAgICAgICc6cGxheWVySWQnOiBwbGF5ZXIucGxheWVySWQsXG4gICAgICAgIH0sXG4gICAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlLCAvLyBOZXdlc3QgZmlyc3RcbiAgICAgICAgTGltaXQ6IDIwLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgbWF0Y2hlcyA9IHJlc3VsdC5JdGVtcyB8fCBbXTtcblxuICAgIC8vIENhbGN1bGF0ZSBhZ2dyZWdhdGUgc3RhdHNcbiAgICBjb25zdCBhZ2dyZWdhdGVTdGF0cyA9IGNhbGN1bGF0ZUFnZ3JlZ2F0ZVN0YXRzKG1hdGNoZXMpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzKCksXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHB1dWlkOiBwbGF5ZXJJZCxcbiAgICAgICAgbWF0Y2hlcyxcbiAgICAgICAgYWdncmVnYXRlU3RhdHMsXG4gICAgICAgIGNvdW50OiBtYXRjaGVzLmxlbmd0aCxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgbWF0Y2hlczonLCBlcnJvcik7XG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxuLyoqXG4gKiBHRVQgL3BsYXllci97cGxheWVySWR9L2luc2lnaHRzIC0gR2V0IEFJIGluc2lnaHRzXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldEluc2lnaHRzKHBsYXllcklkOiBzdHJpbmcpOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4ge1xuICB0cnkge1xuICAgIC8vIENoZWNrIGZvciBkZW1vIHBsYXllclxuICAgIGlmIChwbGF5ZXJJZCA9PT0gJ2RlbW8nKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzKCksXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBwdXVpZDogJ2RlbW8nLFxuICAgICAgICAgIGhlcm9TdW1tYXJ5OiAnRGVtbyBwbGF5ZXIgd2l0aCBzdHJvbmcgbWVjaGFuaWNzIGFuZCBjb25zaXN0ZW50IHBlcmZvcm1hbmNlIGFjcm9zcyBtdWx0aXBsZSBjaGFtcGlvbnMuJyxcbiAgICAgICAgICBjb2FjaGluZ1RpcHM6IFtcbiAgICAgICAgICAgICdGb2N1cyBvbiB3YXJkIHBsYWNlbWVudCBpbiByaXZlciBidXNoZXMgZm9yIGJldHRlciB2aXNpb24gY29udHJvbCcsXG4gICAgICAgICAgICAnUHJhY3RpY2UgQ1MgdW5kZXIgdG93ZXIgdG8gbWFpbnRhaW4gZ29sZCBhZHZhbnRhZ2UnLFxuICAgICAgICAgICAgJ1dvcmsgb24gbGF0ZS1nYW1lIHBvc2l0aW9uaW5nIGR1cmluZyB0ZWFtIGZpZ2h0cycsXG4gICAgICAgICAgXSxcbiAgICAgICAgICByb2FzdE1vZGU6IFwiWW91J3JlIGRvaW5nIGdyZWF0LCBidXQgd2UgYm90aCBrbm93IHlvdSBjb3VsZCB3YXJkIG1vcmUhXCIsXG4gICAgICAgICAgaGlkZGVuR2VtczogJ1lvdXIgYXZlcmFnZSB2aXNpb24gc2NvcmUgaXMgMTUlIGhpZ2hlciB0aGFuIHBsYXllcnMgYXQgeW91ciByYW5rJyxcbiAgICAgICAgICBwbGF5c3R5bGVJbnNpZ2h0czoge1xuICAgICAgICAgICAgYWdncmVzc2lvbjogNzUsXG4gICAgICAgICAgICB2aXNpb246IDg1LFxuICAgICAgICAgICAgZmFybWluZzogNzAsXG4gICAgICAgICAgICB0ZWFtZmlnaHRpbmc6IDgwLFxuICAgICAgICAgICAgY29uc2lzdGVuY3k6IDc4LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBGaXJzdCBnZXQgdGhlIHBsYXllciB0byBnZXQgdGhlIGFjdHVhbCBwbGF5ZXJJZFxuICAgIGNvbnN0IHBsYXllclJlc3VsdCA9IGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogUExBWUVSU19UQUJMRSxcbiAgICAgICAgSW5kZXhOYW1lOiAncHV1aWQtaW5kZXgnLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncHV1aWQgPSA6cHV1aWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwdXVpZCc6IHBsYXllcklkLCAvLyBwbGF5ZXJJZCBoZXJlIGlzIGFjdHVhbGx5IHRoZSBwdXVpZCBmcm9tIHRoZSBVUkxcbiAgICAgICAgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmICghcGxheWVyUmVzdWx0Lkl0ZW1zIHx8IHBsYXllclJlc3VsdC5JdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1BsYXllciBub3QgZm91bmQnIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICBjb25zdCBwbGF5ZXIgPSBwbGF5ZXJSZXN1bHQuSXRlbXNbMF07XG5cbiAgICAvLyBRdWVyeSBpbnNpZ2h0cyBmcm9tIER5bmFtb0RCIHVzaW5nIHRoZSBhY3R1YWwgcGxheWVySWRcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9DbGllbnQuc2VuZChcbiAgICAgIG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IElOU0lHSFRTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncGxheWVySWQgPSA6cGxheWVySWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwbGF5ZXJJZCc6IHBsYXllci5wbGF5ZXJJZCxcbiAgICAgICAgfSxcbiAgICAgICAgU2NhbkluZGV4Rm9yd2FyZDogZmFsc2UsIC8vIE5ld2VzdCBmaXJzdFxuICAgICAgICBMaW1pdDogMSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmICghcmVzdWx0Lkl0ZW1zIHx8IHJlc3VsdC5JdGVtcy5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIGVycm9yOiAnTm8gaW5zaWdodHMgYXZhaWxhYmxlIHlldCcsXG4gICAgICAgICAgbWVzc2FnZTogJ0luc2lnaHRzIGFyZSBiZWluZyBnZW5lcmF0ZWQuIFBsZWFzZSB0cnkgYWdhaW4gaW4gYSBmZXcgbW9tZW50cy4nLFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgaW5zaWdodHMgPSByZXN1bHQuSXRlbXNbMF07XG5cbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcHV1aWQ6IHBsYXllcklkLFxuICAgICAgICBoZXJvU3VtbWFyeTogaW5zaWdodHMuaGVyb1N1bW1hcnksXG4gICAgICAgIGNvYWNoaW5nVGlwczogaW5zaWdodHMuY29hY2hpbmdUaXBzLFxuICAgICAgICByb2FzdE1vZGU6IGluc2lnaHRzLnJvYXN0TW9kZSxcbiAgICAgICAgaGlkZGVuR2VtczogaW5zaWdodHMuaGlkZGVuR2VtcyxcbiAgICAgICAgcGxheXN0eWxlSW5zaWdodHM6IGluc2lnaHRzLnBsYXlzdHlsZUluc2lnaHRzLFxuICAgICAgICB0aW1lc3RhbXA6IGluc2lnaHRzLnRpbWVzdGFtcCxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgaW5zaWdodHM6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlIGFnZ3JlZ2F0ZSBzdGF0aXN0aWNzIGZyb20gbWF0Y2ggaGlzdG9yeVxuICovXG5mdW5jdGlvbiBjYWxjdWxhdGVBZ2dyZWdhdGVTdGF0cyhtYXRjaGVzOiBhbnlbXSkge1xuICBpZiAobWF0Y2hlcy5sZW5ndGggPT09IDApIHtcbiAgICByZXR1cm4ge1xuICAgICAgdG90YWxNYXRjaGVzOiAwLFxuICAgICAgd2luUmF0ZTogMCxcbiAgICAgIGF2Z0tEQTogMCxcbiAgICAgIGF2Z0NTUGVyTWluOiAwLFxuICAgIH07XG4gIH1cblxuICBjb25zdCB3aW5zID0gbWF0Y2hlcy5maWx0ZXIoKG0pID0+IG0ud2luKS5sZW5ndGg7XG4gIGNvbnN0IHRvdGFsS0RBID0gbWF0Y2hlcy5yZWR1Y2UoKHN1bSwgbSkgPT4gc3VtICsgbS5rZGEsIDApO1xuICBjb25zdCB0b3RhbENTUGVyTWluID0gbWF0Y2hlcy5yZWR1Y2UoKHN1bSwgbSkgPT4gc3VtICsgbS5jc1Blck1pbiwgMCk7XG5cbiAgcmV0dXJuIHtcbiAgICB0b3RhbE1hdGNoZXM6IG1hdGNoZXMubGVuZ3RoLFxuICAgIHdpblJhdGU6IE1hdGgucm91bmQoKHdpbnMgLyBtYXRjaGVzLmxlbmd0aCkgKiAxMDApLFxuICAgIGF2Z0tEQTogKHRvdGFsS0RBIC8gbWF0Y2hlcy5sZW5ndGgpLnRvRml4ZWQoMiksXG4gICAgYXZnQ1NQZXJNaW46ICh0b3RhbENTUGVyTWluIC8gbWF0Y2hlcy5sZW5ndGgpLnRvRml4ZWQoMSksXG4gIH07XG59XG5cbi8qKlxuICogQ09SUyBoZWFkZXJzIGZvciBBUEkgR2F0ZXdheVxuICovXG5mdW5jdGlvbiBjb3JzSGVhZGVycygpIHtcbiAgcmV0dXJuIHtcbiAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnOiAnR0VULFBPU1QsT1BUSU9OUycsXG4gICAgJ0FjY2Vzcy1Db250cm9sLUFsbG93LUhlYWRlcnMnOiAnQ29udGVudC1UeXBlLEF1dGhvcml6YXRpb24nLFxuICB9O1xufVxuIl19