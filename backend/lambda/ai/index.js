"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const client_bedrock_runtime_1 = require("@aws-sdk/client-bedrock-runtime");
const s3Client = new client_s3_1.S3Client({});
const dynamoClient = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const bedrockClient = new client_bedrock_runtime_1.BedrockRuntimeClient({ region: 'us-east-1' });
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE;
const MATCHES_TABLE = process.env.MATCHES_TABLE;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
/**
 * AI Lambda - Bedrock integration for insight generation
 */
const handler = async (event) => {
    console.log('AI Lambda invoked', { event });
    const { puuid, matchId, region, fragmentsKey } = event;
    try {
        // 1. Read match fragments from S3
        const getCommand = new client_s3_1.GetObjectCommand({
            Bucket: PROCESSED_BUCKET,
            Key: fragmentsKey,
        });
        const response = await s3Client.send(getCommand);
        const fragments = JSON.parse(await response.Body.transformToString());
        console.log('Retrieved match fragments', { matchId });
        // 2. Get recent match history for context (last 10 matches)
        const recentMatches = await getRecentMatches(puuid);
        // Extract playerId from recent matches (format: region_puuid.slice(0,8))
        const playerId = `${region}_${puuid.slice(0, 8)}`;
        // 3. Generate insights using Bedrock Claude
        const insights = await generateInsights(fragments, recentMatches);
        // 4. Store insights in DynamoDB with 7-day TTL
        await dynamoClient.send(new lib_dynamodb_1.PutCommand({
            TableName: INSIGHTS_TABLE,
            Item: {
                playerId, // REQUIRED: DynamoDB partition key
                puuid,
                matchId,
                insightType: 'match-analysis',
                ...insights,
                timestamp: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
            },
        }));
        console.log('Stored insights in DynamoDB', { matchId });
        // 5. Store insights in S3 for archival
        const insightsKey = `${region}/${puuid}/${matchId}-insights.json`;
        await s3Client.send(new client_s3_1.PutObjectCommand({
            Bucket: PROCESSED_BUCKET,
            Key: insightsKey,
            Body: JSON.stringify(insights),
            ContentType: 'application/json',
        }));
        console.log('Stored insights in S3', { insightsKey });
        console.log('AI processing complete', { matchId });
    }
    catch (error) {
        console.error('Error in AI processing:', error);
        throw error;
    }
};
exports.handler = handler;
/**
 * Get recent match history for context
 */
async function getRecentMatches(puuid) {
    try {
        const result = await dynamoClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: MATCHES_TABLE,
            KeyConditionExpression: 'puuid = :puuid',
            ExpressionAttributeValues: {
                ':puuid': puuid,
            },
            ScanIndexForward: false, // Newest first
            Limit: 10,
        }));
        return result.Items || [];
    }
    catch (error) {
        console.warn('Failed to get recent matches:', error);
        return [];
    }
}
/**
 * Generate insights using Bedrock Claude
 */
async function generateInsights(fragments, recentMatches) {
    const performance = fragments.performance;
    const champion = fragments.matchId.split('-')[0]; // Simplified
    // Calculate aggregate stats from recent matches
    const avgKDA = recentMatches.length > 0
        ? recentMatches.reduce((sum, m) => sum + m.kda, 0) / recentMatches.length
        : performance.kda;
    const winRate = recentMatches.length > 0
        ? (recentMatches.filter(m => m.win).length / recentMatches.length) * 100
        : performance.kills > performance.deaths ? 60 : 40;
    // Prepare context for Claude
    const context = `
You are analyzing a League of Legends match for a player.

Match Summary: ${fragments.summary}

Performance Metrics:
- KDA: ${performance.kda.toFixed(2)} (${performance.kills}/${performance.deaths}/${performance.assists})
- CS/min: ${performance.csPerMin.toFixed(1)}
- Damage Share: ${performance.damageShare.toFixed(1)}%
- Vision Score: ${performance.visionScore}

Recent Performance Context:
- Average KDA (last 10 games): ${avgKDA.toFixed(2)}
- Win Rate: ${winRate.toFixed(0)}%

Key Moments: ${fragments.keyMoments.join(', ') || 'None'}
`;
    const prompt = `${context}

Based on this match data, provide insights in the following JSON format:

{
  "heroSummary": "A brief 2-3 sentence summary of the player's performance as this champion",
  "coachingTips": [
    "Specific actionable tip 1",
    "Specific actionable tip 2",
    "Specific actionable tip 3"
  ],
  "roastMode": "A playful, light-hearted roast about their gameplay (keep it fun, not mean)",
  "hiddenGems": "An interesting stat or pattern that shows improvement or potential",
  "playstyleInsights": {
    "aggression": 0-100,
    "vision": 0-100,
    "farming": 0-100,
    "teamfighting": 0-100,
    "consistency": 0-100
  }
}

Respond ONLY with valid JSON, no other text.`;
    try {
        const bedrockResponse = await bedrockClient.send(new client_bedrock_runtime_1.InvokeModelCommand({
            modelId: BEDROCK_MODEL_ID,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 1024,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }),
        }));
        const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
        const content = responseBody.content[0].text;
        // Parse Claude's JSON response
        const insights = JSON.parse(content);
        return insights;
    }
    catch (error) {
        console.warn('Bedrock call failed, using fallback insights:', error);
        return generateFallbackInsights(fragments, performance, avgKDA, winRate);
    }
}
/**
 * Fallback insights if Bedrock is unavailable
 */
function generateFallbackInsights(fragments, performance, avgKDA, winRate) {
    const tips = [];
    // Generate coaching tips based on stats
    if (performance.csPerMin < 5) {
        tips.push('Focus on last-hitting minions - aim for 6+ CS per minute');
    }
    if (performance.visionScore < 20) {
        tips.push('Place more wards to improve map vision and awareness');
    }
    if (performance.deaths > performance.kills + performance.assists) {
        tips.push('Work on positioning - staying alive is more valuable than risky plays');
    }
    if (performance.damageShare < 15) {
        tips.push('Look for more opportunities to deal damage in team fights');
    }
    // Fill remaining tips
    while (tips.length < 3) {
        tips.push('Keep practicing and focus on consistent improvement');
    }
    return {
        heroSummary: `Played with a ${performance.kda.toFixed(2)} KDA ratio, ${performance.csPerMin.toFixed(1)} CS/min. ${fragments.summary.includes('Victory') ? 'Contributed to the team victory!' : 'Fought hard but fell short this time.'}`,
        coachingTips: tips.slice(0, 3),
        roastMode: performance.deaths > 10 ? "You died more times than a cat has lives! Maybe invest in some tankier items?" : "Not bad, but let's aim for fewer 'respawn timers' next time!",
        hiddenGems: performance.kda > avgKDA ? `Your KDA this match (${performance.kda.toFixed(2)}) beat your average (${avgKDA.toFixed(2)}) - you're improving!` : "Every match is a learning opportunity - focus on one improvement area at a time.",
        playstyleInsights: {
            aggression: Math.min(100, Math.round((performance.kills + performance.assists) * 5)),
            vision: Math.min(100, Math.round(performance.visionScore * 3)),
            farming: Math.min(100, Math.round(performance.csPerMin * 15)),
            teamfighting: Math.min(100, Math.round(performance.damageShare * 5)),
            consistency: Math.min(100, Math.round(winRate)),
        },
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSxrREFBa0Y7QUFDbEYsOERBQTBEO0FBQzFELHdEQUF5RjtBQUN6Riw0RUFBMkY7QUFFM0YsTUFBTSxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ2xDLE1BQU0sWUFBWSxHQUFHLHFDQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLGdDQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztBQUN6RSxNQUFNLGFBQWEsR0FBRyxJQUFJLDZDQUFvQixDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFFeEUsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxjQUFlLENBQUM7QUFDbkQsTUFBTSxhQUFhLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFjLENBQUM7QUFDakQsTUFBTSxnQkFBZ0IsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFpQixDQUFDO0FBQ3ZELE1BQU0sZ0JBQWdCLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsSUFBSSx3Q0FBd0MsQ0FBQztBQVNsRzs7R0FFRztBQUNJLE1BQU0sT0FBTyxHQUFHLEtBQUssRUFBRSxLQUFjLEVBQWlCLEVBQUU7SUFDN0QsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7SUFFNUMsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLFlBQVksRUFBRSxHQUFHLEtBQUssQ0FBQztJQUV2RCxJQUFJLENBQUM7UUFDSCxrQ0FBa0M7UUFDbEMsTUFBTSxVQUFVLEdBQUcsSUFBSSw0QkFBZ0IsQ0FBQztZQUN0QyxNQUFNLEVBQUUsZ0JBQWdCO1lBQ3hCLEdBQUcsRUFBRSxZQUFZO1NBQ2xCLENBQUMsQ0FBQztRQUVILE1B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QUssQ0FBQyxXQUFXLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ3BFLFdBQVcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ2hEO0tBQ0YsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBTM0NsaWVudCwgR2V0T2JqZWN0Q29tbWFuZCwgUHV0T2JqZWN0Q29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1zMyc7XG5pbXBvcnQgeyBEeW5hbW9EQkNsaWVudCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1keW5hbW9kYic7XG5pbXBvcnQgeyBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LCBQdXRDb21tYW5kLCBRdWVyeUNvbW1hbmQgfSBmcm9tICdAYXdzLXNkay9saWItZHluYW1vZGInO1xuaW1wb3J0IHsgQmVkcm9ja1J1bnRpbWVDbGllbnQsIEludm9rZU1vZGVsQ29tbWFuZCB9IGZyb20gJ0Bhd3Mtc2RrL2NsaWVudC1iZWRyb2NrLXJ1bnRpbWUnO1xuXG5jb25zdCBzM0NsaWVudCA9IG5ldyBTM0NsaWVudCh7fSk7XG5jb25zdCBkeW5hbW9DbGllbnQgPSBEeW5hbW9EQkRvY3VtZW50Q2xpZW50LmZyb20obmV3IER5bmFtb0RCQ2xpZW50KHt9KSk7XG5jb25zdCBiZWRyb2NrQ2xpZW50ID0gbmV3IEJlZHJvY2tSdW50aW1lQ2xpZW50KHsgcmVnaW9uOiAndXMtZWFzdC0xJyB9KTtcblxuY29uc3QgSU5TSUdIVFNfVEFCTEUgPSBwcm9jZXNzLmVudi5JTlNJR0hUU19UQUJMRSE7XG5jb25zdCBNQVRDSEVTX1RBQkxFID0gcHJvY2Vzcy5lbnYuTUFUQ0hFU19UQUJMRSE7XG5jb25zdCBQUk9DRVNTRURfQlVDS0VUID0gcHJvY2Vzcy5lbnYuUFJPQ0VTU0VEX0JVQ0tFVCE7XG5jb25zdCBCRURST0NLX01PREVMX0lEID0gcHJvY2Vzcy5lbnYuQkVEUk9DS19NT0RFTF9JRCB8fCAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnO1xuXG5pbnRlcmZhY2UgQUlFdmVudCB7XG4gIHB1dWlkOiBzdHJpbmc7XG4gIG1hdGNoSWQ6IHN0cmluZztcbiAgcmVnaW9uOiBzdHJpbmc7XG4gIGZyYWdtZW50c0tleTogc3RyaW5nO1xufVxuXG4vKipcbiAqIEFJIExhbWJkYSAtIEJlZHJvY2sgaW50ZWdyYXRpb24gZm9yIGluc2lnaHQgZ2VuZXJhdGlvblxuICovXG5leHBvcnQgY29uc3QgaGFuZGxlciA9IGFzeW5jIChldmVudDogQUlFdmVudCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICBjb25zb2xlLmxvZygnQUkgTGFtYmRhIGludm9rZWQnLCB7IGV2ZW50IH0pO1xuXG4gIGNvbnN0IHsgcHV1aWQsIG1hdGNoSWQsIHJlZ2lvbiwgZnJhZ21lbnRzS2V5IH0gPSBldmVudDtcblxuICB0cnkge1xuICAgIC8vIDEuIFJlYWQgbWF0Y2ggZnJhZ21lbnRzIGZyb20gUzNcbiAgICBjb25zdCBnZXRDb21tYW5kID0gbmV3IEdldE9iamVjdENvbW1hbmQoe1xuICAgICAgQnVja2V0OiBQUk9DRVNTRURfQlVDS0VULFxuICAgICAgS2V5OiBmcmFnbWVudHNLZXksXG4gICAgfSk7XG4gICAgXG4gICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBzM0NsaWVudC5zZW5kKGdldENvbW1hbmQpO1xuICAgIGNvbnN0IGZyYWdtZW50cyA9IEpTT04ucGFyc2UoYXdhaXQgcmVzcG9uc2UuQm9keSEudHJhbnNmb3JtVG9TdHJpbmcoKSk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ1JldHJpZXZlZCBtYXRjaCBmcmFnbWVudHMnLCB7IG1hdGNoSWQgfSk7XG5cbiAgICAvLyAyLiBHZXQgcmVjZW50IG1hdGNoIGhpc3RvcnkgZm9yIGNvbnRleHQgKGxhc3QgMTAgbWF0Y2hlcylcbiAgICBjb25zdCByZWNlbnRNYXRjaGVzID0gYXdhaXQgZ2V0UmVjZW50TWF0Y2hlcyhwdXVpZCk7XG4gICAgXG4gICAgLy8gRXh0cmFjdCBwbGF5ZXJJZCBmcm9tIHJlY2VudCBtYXRjaGVzIChmb3JtYXQ6IHJlZ2lvbl9wdXVpZC5zbGljZSgwLDgpKVxuICAgIGNvbnN0IHBsYXllcklkID0gYCR7cmVnaW9ufV8ke3B1dWlkLnNsaWNlKDAsIDgpfWA7XG4gICAgXG4gICAgLy8gMy4gR2VuZXJhdGUgaW5zaWdodHMgdXNpbmcgQmVkcm9jayBDbGF1ZGVcbiAgICBjb25zdCBpbnNpZ2h0cyA9IGF3YWl0IGdlbmVyYXRlSW5zaWdodHMoZnJhZ21lbnRzLCByZWNlbnRNYXRjaGVzKTtcbiAgICBcbiAgICAvLyA0LiBTdG9yZSBpbnNpZ2h0cyBpbiBEeW5hbW9EQiB3aXRoIDctZGF5IFRUTFxuICAgIGF3YWl0IGR5bmFtb0NsaWVudC5zZW5kKFxuICAgICAgbmV3IFB1dENvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IElOU0lHSFRTX1RBQkxFLFxuICAgICAgICBJdGVtOiB7XG4gICAgICAgICAgcGxheWVySWQsIC8vIFJFUVVJUkVEOiBEeW5hbW9EQiBwYXJ0aXRpb24ga2V5XG4gICAgICAgICAgcHV1aWQsXG4gICAgICAgICAgbWF0Y2hJZCxcbiAgICAgICAgICBpbnNpZ2h0VHlwZTogJ21hdGNoLWFuYWx5c2lzJyxcbiAgICAgICAgICAuLi5pbnNpZ2h0cyxcbiAgICAgICAgICB0aW1lc3RhbXA6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICAgICAgICB0dGw6IE1hdGguZmxvb3IoRGF0ZS5ub3coKSAvIDEwMDApICsgNyAqIDI0ICogNjAgKiA2MCwgLy8gNyBkYXlzXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICk7XG4gICAgXG4gICAgY29uc29sZS5sb2coJ1N0b3JlZCBpbnNpZ2h0cyBpbiBEeW5hbW9EQicsIHsgbWF0Y2hJZCB9KTtcblxuICAgIC8vIDUuIFN0b3JlIGluc2lnaHRzIGluIFMzIGZvciBhcmNoaXZhbFxuICAgIGNvbnN0IGluc2lnaHRzS2V5ID0gYCR7cmVnaW9ufS8ke3B1dWlkfS8ke21hdGNoSWR9LWluc2lnaHRzLmpzb25gO1xuICAgIGF3YWl0IHMzQ2xpZW50LnNlbmQoXG4gICAgICBuZXcgUHV0T2JqZWN0Q29tbWFuZCh7XG4gICAgICAgIEJ1Y2tldDogUFJPQ0VTU0VEX0JVQ0tFVCxcbiAgICAgICAgS2V5OiBpbnNpZ2h0c0tleSxcbiAgICAgICAgQm9keTogSlNPTi5zdHJpbmdpZnkoaW5zaWdodHMpLFxuICAgICAgICBDb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSlcbiAgICApO1xuICAgIFxuICAgIGNvbnNvbGUubG9nKCdTdG9yZWQgaW5zaWdodHMgaW4gUzMnLCB7IGluc2lnaHRzS2V5IH0pO1xuICAgIGNvbnNvbGUubG9nKCdBSSBwcm9jZXNzaW5nIGNvbXBsZXRlJywgeyBtYXRjaElkIH0pO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluIEFJIHByb2Nlc3Npbmc6JywgZXJyb3IpO1xuICAgIHRocm93IGVycm9yO1xuICB9XG59O1xuXG4vKipcbiAqIEdldCByZWNlbnQgbWF0Y2ggaGlzdG9yeSBmb3IgY29udGV4dFxuICovXG5hc3luYyBmdW5jdGlvbiBnZXRSZWNlbnRNYXRjaGVzKHB1dWlkOiBzdHJpbmcpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBkeW5hbW9DbGllbnQuc2VuZChcbiAgICAgIG5ldyBRdWVyeUNvbW1hbmQoe1xuICAgICAgICBUYWJsZU5hbWU6IE1BVENIRVNfVEFCTEUsXG4gICAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICdwdXVpZCA9IDpwdXVpZCcsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVWYWx1ZXM6IHtcbiAgICAgICAgICAnOnB1dWlkJzogcHV1aWQsXG4gICAgICAgIH0sXG4gICAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlLCAvLyBOZXdlc3QgZmlyc3RcbiAgICAgICAgTGltaXQ6IDEwLFxuICAgICAgfSlcbiAgICApO1xuICAgIFxuICAgIHJldHVybiByZXN1bHQuSXRlbXMgfHwgW107XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gZ2V0IHJlY2VudCBtYXRjaGVzOicsIGVycm9yKTtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuLyoqXG4gKiBHZW5lcmF0ZSBpbnNpZ2h0cyB1c2luZyBCZWRyb2NrIENsYXVkZVxuICovXG5hc3luYyBmdW5jdGlvbiBnZW5lcmF0ZUluc2lnaHRzKGZyYWdtZW50czogYW55LCByZWNlbnRNYXRjaGVzOiBhbnlbXSkge1xuICBjb25zdCBwZXJmb3JtYW5jZSA9IGZyYWdtZW50cy5wZXJmb3JtYW5jZTtcbiAgY29uc3QgY2hhbXBpb24gPSBmcmFnbWVudHMubWF0Y2hJZC5zcGxpdCgnLScpWzBdOyAvLyBTaW1wbGlmaWVkXG4gIFxuICAvLyBDYWxjdWxhdGUgYWdncmVnYXRlIHN0YXRzIGZyb20gcmVjZW50IG1hdGNoZXNcbiAgY29uc3QgYXZnS0RBID0gcmVjZW50TWF0Y2hlcy5sZW5ndGggPiAwXG4gICAgPyByZWNlbnRNYXRjaGVzLnJlZHVjZSgoc3VtLCBtKSA9PiBzdW0gKyBtLmtkYSwgMCkgLyByZWNlbnRNYXRjaGVzLmxlbmd0aFxuICAgIDogcGVyZm9ybWFuY2Uua2RhO1xuICBcbiAgY29uc3Qgd2luUmF0ZSA9IHJlY2VudE1hdGNoZXMubGVuZ3RoID4gMFxuICAgID8gKHJlY2VudE1hdGNoZXMuZmlsdGVyKG0gPT4gbS53aW4pLmxlbmd0aCAvIHJlY2VudE1hdGNoZXMubGVuZ3RoKSAqIDEwMFxuICAgIDogcGVyZm9ybWFuY2Uua2lsbHMgPiBwZXJmb3JtYW5jZS5kZWF0aHMgPyA2MCA6IDQwO1xuXG4gIC8vIFByZXBhcmUgY29udGV4dCBmb3IgQ2xhdWRlXG4gIGNvbnN0IGNvbnRleHQgPSBgXG5Zb3UgYXJlIGFuYWx5emluZyBhIExlYWd1ZSBvZiBMZWdlbmRzIG1hdGNoIGZvciBhIHBsYXllci5cblxuTWF0Y2ggU3VtbWFyeTogJHtmcmFnbWVudHMuc3VtbWFyeX1cblxuUGVyZm9ybWFuY2UgTWV0cmljczpcbi0gS0RBOiAke3BlcmZvcm1hbmNlLmtkYS50b0ZpeGVkKDIpfSAoJHtwZXJmb3JtYW5jZS5raWxsc30vJHtwZXJmb3JtYW5jZS5kZWF0aHN9LyR7cGVyZm9ybWFuY2UuYXNzaXN0c30pXG4tIENTL21pbjogJHtwZXJmb3JtYW5jZS5jc1Blck1pbi50b0ZpeGVkKDEpfVxuLSBEYW1hZ2UgU2hhcmU6ICR7cGVyZm9ybWFuY2UuZGFtYWdlU2hhcmUudG9GaXhlZCgxKX0lXG4tIFZpc2lvbiBTY29yZTogJHtwZXJmb3JtYW5jZS52aXNpb25TY29yZX1cblxuUmVjZW50IFBlcmZvcm1hbmNlIENvbnRleHQ6XG4tIEF2ZXJhZ2UgS0RBIChsYXN0IDEwIGdhbWVzKTogJHthdmdLREEudG9GaXhlZCgyKX1cbi0gV2luIFJhdGU6ICR7d2luUmF0ZS50b0ZpeGVkKDApfSVcblxuS2V5IE1vbWVudHM6ICR7ZnJhZ21lbnRzLmtleU1vbWVudHMuam9pbignLCAnKSB8fCAnTm9uZSd9XG5gO1xuXG4gIGNvbnN0IHByb21wdCA9IGAke2NvbnRleHR9XG5cbkJhc2VkIG9uIHRoaXMgbWF0Y2ggZGF0YSwgcHJvdmlkZSBpbnNpZ2h0cyBpbiB0aGUgZm9sbG93aW5nIEpTT04gZm9ybWF0OlxuXG57XG4gIFwiaGVyb1N1bW1hcnlcIjogXCJBIGJyaWVmIDItMyBzZW50ZW5jZSBzdW1tYXJ5IG9mIHRoZSBwbGF5ZXIncyBwZXJmb3JtYW5jZSBhcyB0aGlzIGNoYW1waW9uXCIsXG4gIFwiY29hY2hpbmdUaXBzXCI6IFtcbiAgICBcIlNwZWNpZmljIGFjdGlvbmFibGUgdGlwIDFcIixcbiAgICBcIlNwZWNpZmljIGFjdGlvbmFibGUgdGlwIDJcIixcbiAgICBcIlNwZWNpZmljIGFjdGlvbmFibGUgdGlwIDNcIlxuICBdLFxuICBcInJvYXN0TW9kZVwiOiBcIkEgcGxheWZ1bCwgbGlnaHQtaGVhcnRlZCByb2FzdCBhYm91dCB0aGVpciBnYW1lcGxheSAoa2VlcCBpdCBmdW4sIG5vdCBtZWFuKVwiLFxuICBcImhpZGRlbkdlbXNcIjogXCJBbiBpbnRlcmVzdGluZyBzdGF0IG9yIHBhdHRlcm4gdGhhdCBzaG93cyBpbXByb3ZlbWVudCBvciBwb3RlbnRpYWxcIixcbiAgXCJwbGF5c3R5bGVJbnNpZ2h0c1wiOiB7XG4gICAgXCJhZ2dyZXNzaW9uXCI6IDAtMTAwLFxuICAgIFwidmlzaW9uXCI6IDAtMTAwLFxuICAgIFwiZmFybWluZ1wiOiAwLTEwMCxcbiAgICBcInRlYW1maWdodGluZ1wiOiAwLTEwMCxcbiAgICBcImNvbnNpc3RlbmN5XCI6IDAtMTAwXG4gIH1cbn1cblxuUmVzcG9uZCBPTkxZIHdpdGggdmFsaWQgSlNPTiwgbm8gb3RoZXIgdGV4dC5gO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgYmVkcm9ja1Jlc3BvbnNlID0gYXdhaXQgYmVkcm9ja0NsaWVudC5zZW5kKFxuICAgICAgbmV3IEludm9rZU1vZGVsQ29tbWFuZCh7XG4gICAgICAgIG1vZGVsSWQ6IEJFRFJPQ0tfTU9ERUxfSUQsXG4gICAgICAgIGNvbnRlbnRUeXBlOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgIGFjY2VwdDogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgYW50aHJvcGljX3ZlcnNpb246ICdiZWRyb2NrLTIwMjMtMDUtMzEnLFxuICAgICAgICAgIG1heF90b2tlbnM6IDEwMjQsXG4gICAgICAgICAgbWVzc2FnZXM6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgcm9sZTogJ3VzZXInLFxuICAgICAgICAgICAgICBjb250ZW50OiBwcm9tcHQsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgY29uc3QgcmVzcG9uc2VCb2R5ID0gSlNPTi5wYXJzZShuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYmVkcm9ja1Jlc3BvbnNlLmJvZHkpKTtcbiAgICBjb25zdCBjb250ZW50ID0gcmVzcG9uc2VCb2R5LmNvbnRlbnRbMF0udGV4dDtcbiAgICBcbiAgICAvLyBQYXJzZSBDbGF1ZGUncyBKU09OIHJlc3BvbnNlXG4gICAgY29uc3QgaW5zaWdodHMgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuICAgIFxuICAgIHJldHVybiBpbnNpZ2h0cztcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLndhcm4oJ0JlZHJvY2sgY2FsbCBmYWlsZWQsIHVzaW5nIGZhbGxiYWNrIGluc2lnaHRzOicsIGVycm9yKTtcbiAgICByZXR1cm4gZ2VuZXJhdGVGYWxsYmFja0luc2lnaHRzKGZyYWdtZW50cywgcGVyZm9ybWFuY2UsIGF2Z0tEQSwgd2luUmF0ZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBGYWxsYmFjayBpbnNpZ2h0cyBpZiBCZWRyb2NrIGlzIHVuYXZhaWxhYmxlXG4gKi9cbmZ1bmN0aW9uIGdlbmVyYXRlRmFsbGJhY2tJbnNpZ2h0cyhmcmFnbWVudHM6IGFueSwgcGVyZm9ybWFuY2U6IGFueSwgYXZnS0RBOiBudW1iZXIsIHdpblJhdGU6IG51bWJlcikge1xuICBjb25zdCB0aXBzID0gW107XG4gIFxuICAvLyBHZW5lcmF0ZSBjb2FjaGluZyB0aXBzIGJhc2VkIG9uIHN0YXRzXG4gIGlmIChwZXJmb3JtYW5jZS5jc1Blck1pbiA8IDUpIHtcbiAgICB0aXBzLnB1c2goJ0ZvY3VzIG9uIGxhc3QtaGl0dGluZyBtaW5pb25zIC0gYWltIGZvciA2KyBDUyBwZXIgbWludXRlJyk7XG4gIH1cbiAgaWYgKHBlcmZvcm1hbmNlLnZpc2lvblNjb3JlIDwgMjApIHtcbiAgICB0aXBzLnB1c2goJ1BsYWNlIG1vcmUgd2FyZHMgdG8gaW1wcm92ZSBtYXAgdmlzaW9uIGFuZCBhd2FyZW5lc3MnKTtcbiAgfVxuICBpZiAocGVyZm9ybWFuY2UuZGVhdGhzID4gcGVyZm9ybWFuY2Uua2lsbHMgKyBwZXJmb3JtYW5jZS5hc3Npc3RzKSB7XG4gICAgdGlwcy5wdXNoKCdXb3JrIG9uIHBvc2l0aW9uaW5nIC0gc3RheWluZyBhbGl2ZSBpcyBtb3JlIHZhbHVhYmxlIHRoYW4gcmlza3kgcGxheXMnKTtcbiAgfVxuICBpZiAocGVyZm9ybWFuY2UuZGFtYWdlU2hhcmUgPCAxNSkge1xuICAgIHRpcHMucHVzaCgnTG9vayBmb3IgbW9yZSBvcHBvcnR1bml0aWVzIHRvIGRlYWwgZGFtYWdlIGluIHRlYW0gZmlnaHRzJyk7XG4gIH1cbiAgXG4gIC8vIEZpbGwgcmVtYWluaW5nIHRpcHNcbiAgd2hpbGUgKHRpcHMubGVuZ3RoIDwgMykge1xuICAgIHRpcHMucHVzaCgnS2VlcCBwcmFjdGljaW5nIGFuZCBmb2N1cyBvbiBjb25zaXN0ZW50IGltcHJvdmVtZW50Jyk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIGhlcm9TdW1tYXJ5OiBgUGxheWVkIHdpdGggYSAke3BlcmZvcm1hbmNlLmtkYS50b0ZpeGVkKDIpfSBLREEgcmF0aW8sICR7cGVyZm9ybWFuY2UuY3NQZXJNaW4udG9GaXhlZCgxKX0gQ1MvbWluLiAke2ZyYWdtZW50cy5zdW1tYXJ5LmluY2x1ZGVzKCdWaWN0b3J5JykgPyAnQ29udHJpYnV0ZWQgdG8gdGhlIHRlYW0gdmljdG9yeSEnIDogJ0ZvdWdodCBoYXJkIGJ1dCBmZWxsIHNob3J0IHRoaXMgdGltZS4nfWAsXG4gICAgY29hY2hpbmdUaXBzOiB0aXBzLnNsaWNlKDAsIDMpLFxuICAgIHJvYXN0TW9kZTogcGVyZm9ybWFuY2UuZGVhdGhzID4gMTAgPyBcIllvdSBkaWVkIG1vcmUgdGltZXMgdGhhbiBhIGNhdCBoYXMgbGl2ZXMhIE1heWJlIGludmVzdCBpbiBzb21lIHRhbmtpZXIgaXRlbXM/XCIgOiBcIk5vdCBiYWQsIGJ1dCBsZXQncyBhaW0gZm9yIGZld2VyICdyZXNwYXduIHRpbWVycycgbmV4dCB0aW1lIVwiLFxuICAgIGhpZGRlbkdlbXM6IHBlcmZvcm1hbmNlLmtkYSA+IGF2Z0tEQSA/IGBZb3VyIEtEQSB0aGlzIG1hdGNoICgke3BlcmZvcm1hbmNlLmtkYS50b0ZpeGVkKDIpfSkgYmVhdCB5b3VyIGF2ZXJhZ2UgKCR7YXZnS0RBLnRvRml4ZWQoMil9KSAtIHlvdSdyZSBpbXByb3ZpbmchYCA6IFwiRXZlcnkgbWF0Y2ggaXMgYSBsZWFybmluZyBvcHBvcnR1bml0eSAtIGZvY3VzIG9uIG9uZSBpbXByb3ZlbWVudCBhcmVhIGF0IGEgdGltZS5cIixcbiAgICBwbGF5c3R5bGVJbnNpZ2h0czoge1xuICAgICAgYWdncmVzc2lvbjogTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKChwZXJmb3JtYW5jZS5raWxscyArIHBlcmZvcm1hbmNlLmFzc2lzdHMpICogNSkpLFxuICAgICAgdmlzaW9uOiBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQocGVyZm9ybWFuY2UudmlzaW9uU2NvcmUgKiAzKSksXG4gICAgICBmYXJtaW5nOiBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQocGVyZm9ybWFuY2UuY3NQZXJNaW4gKiAxNSkpLFxuICAgICAgdGVhbWZpZ2h0aW5nOiBNYXRoLm1pbigxMDAsIE1hdGgucm91bmQocGVyZm9ybWFuY2UuZGFtYWdlU2hhcmUgKiA1KSksXG4gICAgICBjb25zaXN0ZW5jeTogTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKHdpblJhdGUpKSxcbiAgICB9LFxuICB9O1xufVxuIl19