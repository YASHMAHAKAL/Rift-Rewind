import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const s3Client = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE!;
const MATCHES_TABLE = process.env.MATCHES_TABLE!;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET!;
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

interface AIEvent {
  puuid: string;
  matchId: string;
  region: string;
  fragmentsKey: string;
}

/**
 * AI Lambda - Bedrock integration for insight generation
 */
export const handler = async (event: AIEvent): Promise<void> => {
  console.log('AI Lambda invoked', { event });

  const { puuid, matchId, region, fragmentsKey } = event;

  try {
    // 1. Read match fragments from S3
    const getCommand = new GetObjectCommand({
      Bucket: PROCESSED_BUCKET,
      Key: fragmentsKey,
    });
    
    const response = await s3Client.send(getCommand);
    const fragments = JSON.parse(await response.Body!.transformToString());
    
    console.log('Retrieved match fragments', { matchId });

    // 2. Get recent match history for context (last 10 matches)
    const recentMatches = await getRecentMatches(puuid);
    
    // 3. Generate insights using Bedrock Claude
    const insights = await generateInsights(fragments, recentMatches);
    
    // 4. Store insights in DynamoDB with 7-day TTL
    await dynamoClient.send(
      new PutCommand({
        TableName: INSIGHTS_TABLE,
        Item: {
          puuid,
          matchId,
          insightType: 'match-analysis',
          ...insights,
          timestamp: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
        },
      })
    );
    
    console.log('Stored insights in DynamoDB', { matchId });

    // 5. Store insights in S3 for archival
    const insightsKey = `${region}/${puuid}/${matchId}-insights.json`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: PROCESSED_BUCKET,
        Key: insightsKey,
        Body: JSON.stringify(insights),
        ContentType: 'application/json',
      })
    );
    
    console.log('Stored insights in S3', { insightsKey });
    console.log('AI processing complete', { matchId });
  } catch (error) {
    console.error('Error in AI processing:', error);
    throw error;
  }
};

/**
 * Get recent match history for context
 */
async function getRecentMatches(puuid: string) {
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: MATCHES_TABLE,
        KeyConditionExpression: 'puuid = :puuid',
        ExpressionAttributeValues: {
          ':puuid': puuid,
        },
        ScanIndexForward: false, // Newest first
        Limit: 10,
      })
    );
    
    return result.Items || [];
  } catch (error) {
    console.warn('Failed to get recent matches:', error);
    return [];
  }
}

/**
 * Generate insights using Bedrock Claude
 */
async function generateInsights(fragments: any, recentMatches: any[]) {
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
    const bedrockResponse = await bedrockClient.send(
      new InvokeModelCommand({
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
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
    const content = responseBody.content[0].text;
    
    // Parse Claude's JSON response
    const insights = JSON.parse(content);
    
    return insights;
  } catch (error) {
    console.warn('Bedrock call failed, using fallback insights:', error);
    return generateFallbackInsights(fragments, performance, avgKDA, winRate);
  }
}

/**
 * Fallback insights if Bedrock is unavailable
 */
function generateFallbackInsights(fragments: any, performance: any, avgKDA: number, winRate: number) {
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
