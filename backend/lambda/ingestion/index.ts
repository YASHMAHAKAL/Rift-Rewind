import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { RiotClient } from './riot-client';

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

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

const RAW_BUCKET = process.env.RAW_BUCKET!;
const PLAYERS_TABLE = process.env.PLAYERS_TABLE!;
const PROCESSING_LAMBDA = process.env.PROCESSING_LAMBDA || 'rift-rewind-processing';
const RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-demo-key';

interface IngestionRequest {
  summonerName: string;
  region: string;
  maxMatches?: number;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
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
    const body: IngestionRequest = event.body 
      ? JSON.parse(event.body) 
      : { summonerName: 'Demo', region: 'NA1' };

    const { summonerName, region, maxMatches = 50 } = body;

    console.log('Fetching data for:', { summonerName, region, maxMatches });

    // Initialize Riot API client
    const riotClient = new RiotClient(RIOT_API_KEY, region);

    // Step 1: Get player PUUID using Riot ID format (gameName#tagLine)
    // If summonerName contains '#', split it; otherwise use summonerName as gameName and region as tagLine
    let puuid: string;
    let gameName: string;
    let tagLine: string;
    
    if (summonerName.includes('#')) {
      const [name, tag] = summonerName.split('#');
      gameName = name;
      tagLine = tag;
      const result = await riotClient.getSummonerByRiotId(gameName, tagLine);
      puuid = result.puuid;
    } else {
      // Fallback: try old API (may not work for all accounts)
      gameName = summonerName;
      tagLine = region.replace('1', ''); // NA1 -> NA
      const result = await riotClient.getSummonerByRiotId(gameName, tagLine);
      puuid = result.puuid;
    }
    
    const playerId = `${region}_${puuid.slice(0, 8)}`;

    console.log('Player found:', { playerId, puuid, gameName, tagLine });

    // Step 2: Save player to DynamoDB
    await dynamoClient.send(
      new PutItemCommand({
        TableName: PLAYERS_TABLE,
        Item: {
          playerId: { S: playerId },
          puuid: { S: puuid },
          summonerName: { S: `${gameName}#${tagLine}` },
          region: { S: region },
          lastUpdated: { S: new Date().toISOString() },
        },
      })
    );

    console.log('Player saved to DynamoDB');

    // Step 3: Fetch match IDs
    const matchIds = await riotClient.getMatchIds(puuid, 0, Math.min(maxMatches, 100));
    console.log(`Found ${matchIds.length} matches`);

    // Step 4: Fetch and store each match
    const storedMatches: string[] = [];
    for (let i = 0; i < Math.min(matchIds.length, maxMatches); i++) {
      const matchId = matchIds[i];
      
      try {
        console.log(`Fetching match ${i + 1}/${matchIds.length}: ${matchId}`);
        const matchData = await riotClient.getMatch(matchId);

        // Store raw match data in S3
        const key = `${region}/${puuid}/${matchId}.json`;
        await s3Client.send(
          new PutObjectCommand({
            Bucket: RAW_BUCKET,
            Key: key,
            Body: JSON.stringify(matchData),
            ContentType: 'application/json',
          })
        );

        storedMatches.push(matchId);
        console.log(`Stored match ${matchId} to S3`);

        // Small delay to avoid rate limiting (Riot API is strict)
        if (i < matchIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
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
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: PROCESSING_LAMBDA,
              InvocationType: 'Event', // Async invocation
              Payload: JSON.stringify({
                puuid,
                matchId,
                region,
              }),
            })
          );
          console.log(`Processing Lambda triggered for match ${matchId}`);
        } catch (error) {
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
  } catch (error) {
    console.error('Error in ingestion:', error);
    
    // Parse the request body to get summoner info for error message
    let summonerName = 'Unknown';
    let region = 'Unknown';
    try {
      const requestBody = event.body ? JSON.parse(event.body) : {};
      summonerName = requestBody.summonerName || 'Unknown';
      region = requestBody.region || 'Unknown';
    } catch (e) {
      // Ignore parse errors
    }
    
    // Check if it's a 404 error (player not found)
    const isAxiosError = error && typeof error === 'object' && 'response' in error;
    const status = isAxiosError && (error as any).response?.status;
    
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
