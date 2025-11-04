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
        // Query player from DynamoDB
        const result = await dynamoClient.send(new lib_dynamodb_1.GetCommand({
            TableName: PLAYERS_TABLE,
            Key: { puuid: playerId },
        }));
        if (!result.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders(),
                body: JSON.stringify({ error: 'Player not found' }),
            };
        }
        // Get match count
        const matchesResult = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: MATCHES_TABLE,
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId,
            },
            Select: 'COUNT',
        }));
        const player = result.Item;
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
        // Query matches from DynamoDB
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: MATCHES_TABLE,
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId,
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
        // Query insights from DynamoDB
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: INSIGHTS_TABLE,
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': playerId,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSw4REFBMEQ7QUFDMUQsd0RBQXlGO0FBRXpGLE1BQU0sWUFBWSxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUV6RSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWMsQ0FBQztBQUNqRCxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWMsQ0FBQztBQUNqRCxNQUFNLGNBQWMsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGNBQWUsQ0FBQztBQUVuRDs7Ozs7OztHQU9HO0FBRUksTUFBTSxPQUFPLEdBQUcsS0FBSyxFQUMxQixLQUEyQixFQUMzQixPQUFnQixFQUNnQixFQUFFO0lBQ2xDLE9BQU8sQ0FBQyxHQUFHLENBQUMsb0JBQW9CLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7SUFFbEYsTUFBTSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLEdBQUcsS0FBSyxDQUFDO0lBQ25ELE1BQU0sUUFBUSxHQUFHLGNBQWMsRUFBRSxRQUFRLENBQUM7SUFFMUMsb0NBQW9DO0lBQ3BDLElBQUksVUFBVSxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzdCLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxXQUFXLEVBQUU7WUFDdEIsSUFBSSxFQUFFLEVBQUU7U0FDVCxDQUFDO0lBQ0osQ0FBQztJQUVELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNkLE9BQU87WUFDTCxVQUFVLEVBQUUsR0FBRztZQUNmLE9BQU8sRUFBRSxXQUFXLEVBQUU7WUFDdEIsSUFBSSxFQUFFLElBQUksQ0FB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QUMsRUFBRSxFQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFFdEUsT0FBTztRQUNMLFlBQVksRUFBRSxPQUFPLENBQUMsTUFBTTtRQUM1QixPQUFPLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQ2xELE1BQU0sRUFBRSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUM5QyxXQUFXLEVBQUUsQ0FBQyxhQUFhLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7S0FDekQsQ0FBQztBQUNKLENBQUM7QUFFRDs7R0FFRztBQUNILFNBQVMsV0FBVztJQUNsQixPQUFPO1FBQ0wsY0FBYyxFQUFFLGtCQUFrQjtRQUNsQyw2QkFBNkIsRUFBRSxHQUFHO1FBQ2xDLDhCQUE4QixFQUFFLGtCQUFrQjtRQUNsRCw4QkFBOEIsRUFBRSw0QkFBNEI7S0FDN0QsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBUElHYXRld2F5UHJveHlFdmVudCwgQVBJR2F0ZXdheVByb3h5UmVzdWx0LCBDb250ZXh0IH0gZnJvbSAnYXdzLWxhbWJkYSc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBHZXRDb21tYW5kLCBRdWVyeUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuXG5jb25zdCBkeW5hbW9DbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20obmV3IER5bmFtb0RCQ2xpZW50KHt9KSk7XG5cbmNvbnN0IFBMQVlFUlNfVEFCTEUgPSBwcm9jZXNzLmVudi5QTEFZRVJTX1RBQkxFITtcbmNvbnN0IE1BVENIRVNfVEFCTEUgPSBwcm9jZXNzLmVudi5NQVRDSEVTX1RBQkxFITtcbmNvbnN0IElOU0lHSFRTX1RBQkxFID0gcHJvY2Vzcy5lbnYuSU5TSUdIVFNfVEFCTEUhO1xuXG4vKipcbiAqIEFQSSBMYW1iZGEgLSBQdWJsaWMgQVBJIGVuZHBvaW50c1xuICogXG4gKiBIYW5kbGVzOlxuICogLSBHRVQgL3BsYXllci97cGxheWVySWR9IC0gR2V0IHBsYXllciBwcm9maWxlXG4gKiAtIEdFVCAvcGxheWVyL3twbGF5ZXJJZH0vbWF0Y2hlcyAtIEdldCBtYXRjaCBoaXN0b3J5XG4gKiAtIEdFVCAvcGxheWVyL3twbGF5ZXJJZH0vaW5zaWdodHMgLSBHZXQgQUkgaW5zaWdodHNcbiAqL1xuXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChcbiAgZXZlbnQ6IEFQSUdhdGV3YXlQcm94eUV2ZW50LFxuICBjb250ZXh0OiBDb250ZXh0XG4pOiBQcm9taXNlPEFQSUdhdGV3YXlQcm94eVJlc3VsdD4gPT4ge1xuICBjb25zb2xlLmxvZygnQVBJIExhbWJkYSBpbnZva2VkJywgeyBwYXRoOiBldmVudC5wYXRoLCBtZXRob2Q6IGV2ZW50Lmh0dHBNZXRob2QgfSk7XG5cbiAgY29uc3QgeyBwYXRoLCBodHRwTWV0aG9kLCBwYXRoUGFyYW1ldGVycyB9ID0gZXZlbnQ7XG4gIGNvbnN0IHBsYXllcklkID0gcGF0aFBhcmFtZXRlcnM/LnBsYXllcklkO1xuXG4gIC8vIEhhbmRsZSBPUFRJT05TIGZvciBDT1JTIHByZWZsaWdodFxuICBpZiAoaHR0cE1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzKCksXG4gICAgICBib2R5OiAnJyxcbiAgICB9O1xuICB9XG5cbiAgaWYgKCFwbGF5ZXJJZCkge1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA0MDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01pc3NpbmcgcGxheWVySWQgcGFyYW1ldGVyJyB9KSxcbiAgICB9O1xuICB9XG5cbiAgdHJ5IHtcbiAgICAvLyBSb3V0ZSBiYXNlZCBvbiBwYXRoXG4gICAgaWYgKHBhdGguaW5jbHVkZXMoJy9pbnNpZ2h0cycpKSB7XG4gICAgICByZXR1cm4gYXdhaXQgZ2V0SW5zaWdodHMocGxheWVySWQpO1xuICAgIH0gZWxzZSBpZiAocGF0aC5pbmNsdWRlcygnL21hdGNoZXMnKSkge1xuICAgICAgcmV0dXJuIGF3YWl0IGdldE1hdGNoZXMocGxheWVySWQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYXdhaXQgZ2V0UGxheWVyKHBsYXllcklkKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgaW4gQVBJIGhhbmRsZXI6JywgZXJyb3IpO1xuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiA1MDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBlcnJvcjogJ0ludGVybmFsIHNlcnZlciBlcnJvcicsXG4gICAgICAgIG1lc3NhZ2U6IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ1Vua25vd24gZXJyb3InLFxuICAgICAgfSksXG4gICAgfTtcbiAgfVxufTtcblxuLyoqXG4gKiBHRVQgL3BsYXllci97cGxheWVySWR9IC0gR2V0IHBsYXllciBwcm9maWxlXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldFBsYXllcihwbGF5ZXJJZDogc3RyaW5nKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICAvLyBRdWVyeSBwbGF5ZXIgZnJvbSBEeW5hbW9EQlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IEdldENvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IFBMQVlFUlNfVEFCTEUsXG4gICAgICAgIEtleTogeyBwdXVpZDogcGxheWVySWQgfSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGlmICghcmVzdWx0Lkl0ZW0pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ1BsYXllciBub3QgZm91bmQnIH0pLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBHZXQgbWF0Y2ggY291bnRcbiAgICBjb25zdCBtYXRjaGVzUmVzdWx0ID0gYXdhaXQgZHluYW1vQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBNQVRDSEVTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncHV1aWQgPSA6cHV1aWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwdXVpZCc6IHBsYXllcklkLFxuICAgICAgICB9LFxuICAgICAgICBTZWxlY3Q6ICdDT1VOVCcsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBjb25zdCBwbGF5ZXIgPSByZXN1bHQuSXRlbTtcbiAgICBcbiAgICByZXR1cm4ge1xuICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgaGVhZGVyczogY29yc0hlYWRlcnMoKSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcHV1aWQ6IHBsYXllci5wdXVpZCxcbiAgICAgICAgc3VtbW9uZXJOYW1lOiBwbGF5ZXIuc3VtbW9uZXJOYW1lLFxuICAgICAgICByZWdpb246IHBsYXllci5yZWdpb24sXG4gICAgICAgIG1hdGNoQ291bnQ6IG1hdGNoZXNSZXN1bHQuQ291bnQgfHwgMCxcbiAgICAgICAgbGFzdFVwZGF0ZWQ6IHBsYXllci5sYXN0VXBkYXRlZCxcbiAgICAgIH0pLFxuICAgIH07XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZmV0Y2hpbmcgcGxheWVyOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIEdFVCAvcGxheWVyL3twbGF5ZXJJZH0vbWF0Y2hlcyAtIEdldCBtYXRjaCBoaXN0b3J5XG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGdldE1hdGNoZXMocGxheWVySWQ6IHN0cmluZyk6IFByb21pc2U8QVBJR2F0ZXdheVByb3h5UmVzdWx0PiB7XG4gIHRyeSB7XG4gICAgLy8gUXVlcnkgbWF0Y2hlcyBmcm9tIER5bmFtb0RCXG4gICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgZHluYW1vQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgUXVlcnlDb21tYW5kKHtcbiAgICAgICAgVGFibGVOYW1lOiBNQVRDSEVTX1RBQkxFLFxuICAgICAgICBLZXlDb25kaXRpb25FeHByZXNzaW9uOiAncHV1aWQgPSA6cHV1aWQnLFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwdXVpZCc6IHBsYXllcklkLFxuICAgICAgICB9LFxuICAgICAgICBTY2FuSW5kZXhGb3J3YXJkOiBmYWxzZSwgLy8gTmV3ZXN0IGZpcnN0XG4gICAgICAgIExpbWl0OiAyMCxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIGNvbnN0IG1hdGNoZXMgPSByZXN1bHQuSXRlbXMgfHwgW107XG5cbiAgICAvLyBDYWxjdWxhdGUgYWdncmVnYXRlIHN0YXRzXG4gICAgY29uc3QgYWdncmVnYXRlU3RhdHMgPSBjYWxjdWxhdGVBZ2dyZWdhdGVTdGF0cyhtYXRjaGVzKTtcblxuICAgIHJldHVybiB7XG4gICAgICBzdGF0dXNDb2RlOiAyMDAsXG4gICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBwdXVpZDogcGxheWVySWQsXG4gICAgICAgIG1hdGNoZXMsXG4gICAgICAgIGFnZ3JlZ2F0ZVN0YXRzLFxuICAgICAgICBjb3VudDogbWF0Y2hlcy5sZW5ndGgsXG4gICAgICB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIG1hdGNoZXM6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbi8qKlxuICogR0VUIC9wbGF5ZXIve3BsYXllcklkfS9pbnNpZ2h0cyAtIEdldCBBSSBpbnNpZ2h0c1xuICovXG5hc3luYyBmdW5jdGlvbiBnZXRJbnNpZ2h0cyhwbGF5ZXJJZDogc3RyaW5nKTogUHJvbWlzZTxBUElHYXRld2F5UHJveHlSZXN1bHQ+IHtcbiAgdHJ5IHtcbiAgICAvLyBDaGVjayBmb3IgZGVtbyBwbGF5ZXJcbiAgICBpZiAocGxheWVySWQgPT09ICdkZW1vJykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogMjAwLFxuICAgICAgICBoZWFkZXJzOiBjb3JzSGVhZGVycygpLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgcHV1aWQ6ICdkZW1vJyxcbiAgICAgICAgICBoZXJvU3VtbWFyeTogJ0RlbW8gcGxheWVyIHdpdGggc3Ryb25nIG1lY2hhbmljcyBhbmQgY29uc2lzdGVudCBwZXJmb3JtYW5jZSBhY3Jvc3MgbXVsdGlwbGUgY2hhbXBpb25zLicsXG4gICAgICAgICAgY29hY2hpbmdUaXBzOiBbXG4gICAgICAgICAgICAnRm9jdXMgb24gd2FyZCBwbGFjZW1lbnQgaW4gcml2ZXIgYnVzaGVzIGZvciBiZXR0ZXIgdmlzaW9uIGNvbnRyb2wnLFxuICAgICAgICAgICAgJ1ByYWN0aWNlIENTIHVuZGVyIHRvd2VyIHRvIG1haW50YWluIGdvbGQgYWR2YW50YWdlJyxcbiAgICAgICAgICAgICdXb3JrIG9uIGxhdGUtZ2FtZSBwb3NpdGlvbmluZyBkdXJpbmcgdGVhbSBmaWdodHMnLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcm9hc3RNb2RlOiBcIllvdSdyZSBkb2luZyBncmVhdCwgYnV0IHdlIGJvdGgga25vdyB5b3UgY291bGQgd2FyZCBtb3JlIVwiLFxuICAgICAgICAgIGhpZGRlbkdlbXM6ICdZb3VyIGF2ZXJhZ2UgdmlzaW9uIHNjb3JlIGlzIDE1JSBoaWdoZXIgdGhhbiBwbGF5ZXJzIGF0IHlvdXIgcmFuaycsXG4gICAgICAgICAgcGxheXN0eWxlSW5zaWdodHM6IHtcbiAgICAgICAgICAgIGFnZ3Jlc3Npb246IDc1LFxuICAgICAgICAgICAgdmlzaW9uOiA4NSxcbiAgICAgICAgICAgIGZhcm1pbmc6IDcwLFxuICAgICAgICAgICAgdGVhbWZpZ2h0aW5nOiA4MCxcbiAgICAgICAgICAgIGNvbnNpc3RlbmN5OiA3OCxcbiAgICAgICAgICB9LFxuICAgICAgICB9KSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gUXVlcnkgaW5zaWdodHMgZnJvbSBEeW5hbW9EQlxuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFF1ZXJ5Q29tbWFuZCh7XG4gICAgICAgIFRhYmxlTmFtZTogSU5TSUdIVFNfVEFCTEUsXG4gICAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdwdXVpZCA9IDpwdXVpZCcsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAnOnB1dWlkJzogcGxheWVySWQsXG4gICAgICAgIH0sXG4gICAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlLCAvLyBOZXdlc3QgZmlyc3RcbiAgICAgICAgTGltaXQ6IDEsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICBpZiAoIXJlc3VsdC5JdGVtcyB8fCByZXN1bHQuSXRlbXMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBzdGF0dXNDb2RlOiA0MDQsXG4gICAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzKCksXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBlcnJvcjogJ05vIGluc2lnaHRzIGF2YWlsYWJsZSB5ZXQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdJbnNpZ2h0cyBhcmUgYmVpbmcgZ2VuZXJhdGVkLiBQbGVhc2UgdHJ5IGFnYWluIGluIGEgZmV3IG1vbWVudHMuJyxcbiAgICAgICAgfSksXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IGluc2lnaHRzID0gcmVzdWx0Lkl0ZW1zWzBdO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGhlYWRlcnM6IGNvcnNIZWFkZXJzKCksXG4gICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHB1dWlkOiBwbGF5ZXJJZCxcbiAgICAgICAgaGVyb1N1bW1hcnk6IGluc2lnaHRzLmhlcm9TdW1tYXJ5LFxuICAgICAgICBjb2FjaGluZ1RpcHM6IGluc2lnaHRzLmNvYWNoaW5nVGlwcyxcbiAgICAgICAgcm9hc3RNb2RlOiBpbnNpZ2h0cy5yb2FzdE1vZGUsXG4gICAgICAgIGhpZGRlbkdlbXM6IGluc2lnaHRzLmhpZGRlbkdlbXMsXG4gICAgICAgIHBsYXlzdHlsZUluc2lnaHRzOiBpbnNpZ2h0cy5wbGF5c3R5bGVJbnNpZ2h0cyxcbiAgICAgICAgdGltZXN0YW1wOiBpbnNpZ2h0cy50aW1lc3RhbXAsXG4gICAgICB9KSxcbiAgICB9O1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGZldGNoaW5nIGluc2lnaHRzOicsIGVycm9yKTtcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG4vKipcbiAqIENhbGN1bGF0ZSBhZ2dyZWdhdGUgc3RhdGlzdGljcyBmcm9tIG1hdGNoIGhpc3RvcnlcbiAqL1xuZnVuY3Rpb24gY2FsY3VsYXRlQWdncmVnYXRlU3RhdHMobWF0Y2hlczogYW55W10pIHtcbiAgaWYgKG1hdGNoZXMubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRvdGFsTWF0Y2hlczogMCxcbiAgICAgIHdpblJhdGU6IDAsXG4gICAgICBhdmdLREE6IDAsXG4gICAgICBhdmdDU1Blck1pbjogMCxcbiAgICB9O1xuICB9XG5cbiAgY29uc3Qgd2lucyA9IG1hdGNoZXMuZmlsdGVyKChtKSA9PiBtLndpbikubGVuZ3RoO1xuICBjb25zdCB0b3RhbEtEQSA9IG1hdGNoZXMucmVkdWNlKChzdW0sIG0pID0+IHN1bSArIG0ua2RhLCAwKTtcbiAgY29uc3QgdG90YWxDU1Blck1pbiA9IG1hdGNoZXMucmVkdWNlKChzdW0sIG0pID0+IHN1bSArIG0uY3NQZXJNaW4sIDApO1xuXG4gIHJldHVybiB7XG4gICAgdG90YWxNYXRjaGVzOiBtYXRjaGVzLmxlbmd0aCxcbiAgICB3aW5SYXRlOiBNYXRoLnJvdW5kKCh3aW5zIC8gbWF0Y2hlcy5sZW5ndGgpICogMTAwKSxcbiAgICBhdmdLREE6ICh0b3RhbEtEQSAvIG1hdGNoZXMubGVuZ3RoKS50b0ZpeGVkKDIpLFxuICAgIGF2Z0NTUGVyTWluOiAodG90YWxDU1Blck1pbiAvIG1hdGNoZXMubGVuZ3RoKS50b0ZpeGVkKDEpLFxuICB9O1xufVxuXG4vKipcbiAqIENPUlMgaGVhZGVycyBmb3IgQVBJIEdhdGV3YXlcbiAqL1xuZnVuY3Rpb24gY29yc0hlYWRlcnMoKSB7XG4gIHJldHVybiB7XG4gICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1NZXRob2RzJzogJ0dFVCxQT1NULE9QVElPTlMnLFxuICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1IZWFkZXJzJzogJ0NvbnRlbnQtVHlwZSxBdXRob3JpemF0aW9uJyxcbiAgfTtcbn1cbiJdfQ==