import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const PLAYERS_TABLE = process.env.PLAYERS_TABLE!;
const MATCHES_TABLE = process.env.MATCHES_TABLE!;
const INSIGHTS_TABLE = process.env.INSIGHTS_TABLE!;

/**
 * API Lambda - Public API endpoints
 * 
 * Handles:
 * - GET /player/{playerId} - Get player profile
 * - GET /player/{playerId}/matches - Get match history
 * - GET /player/{playerId}/insights - Get AI insights
 */

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
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
    } else if (path.includes('/matches')) {
      return await getMatches(playerId);
    } else {
      return await getPlayer(playerId);
    }
  } catch (error) {
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

/**
 * GET /player/{playerId} - Get player profile
 */
async function getPlayer(playerId: string): Promise<APIGatewayProxyResult> {
  try {
    // Query player from DynamoDB
    const result = await dynamoClient.send(
      new GetCommand({
        TableName: PLAYERS_TABLE,
        Key: { puuid: playerId },
      })
    );

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Player not found' }),
      };
    }

    // Get match count
    const matchesResult = await dynamoClient.send(
      new QueryCommand({
        TableName: MATCHES_TABLE,
        KeyConditionExpression: 'puuid = :puuid',
        ExpressionAttributeValues: {
          ':puuid': playerId,
        },
        Select: 'COUNT',
      })
    );

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
  } catch (error) {
    console.error('Error fetching player:', error);
    throw error;
  }
}

/**
 * GET /player/{playerId}/matches - Get match history
 */
async function getMatches(playerId: string): Promise<APIGatewayProxyResult> {
  try {
    // Query matches from DynamoDB
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: MATCHES_TABLE,
        KeyConditionExpression: 'puuid = :puuid',
        ExpressionAttributeValues: {
          ':puuid': playerId,
        },
        ScanIndexForward: false, // Newest first
        Limit: 20,
      })
    );

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
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
}

/**
 * GET /player/{playerId}/insights - Get AI insights
 */
async function getInsights(playerId: string): Promise<APIGatewayProxyResult> {
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
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: INSIGHTS_TABLE,
        KeyConditionExpression: 'puuid = :puuid',
        ExpressionAttributeValues: {
          ':puuid': playerId,
        },
        ScanIndexForward: false, // Newest first
        Limit: 1,
      })
    );

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
  } catch (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }
}

/**
 * Calculate aggregate statistics from match history
 */
function calculateAggregateStats(matches: any[]) {
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
