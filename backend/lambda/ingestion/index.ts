import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { RiotClient } from '../../lib/riot-client';

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

  try {
    // Parse request body
    const body: IngestionRequest = event.body 
      ? JSON.parse(event.body) 
      : { summonerName: 'Demo', region: 'NA1' };

    const { summonerName, region, maxMatches = 50 } = body;

    console.log('Fetching data for:', { summonerName, region, maxMatches });

    // Initialize Riot API client
    const riotClient = new RiotClient(RIOT_API_KEY, region);

    // Step 1: Get player PUUID
    const { puuid, summonerId } = await riotClient.getSummonerByName(summonerName);
    const playerId = `${region}_${puuid.slice(0, 8)}`;

    console.log('Player found:', { playerId, puuid, summonerId });

    // Step 2: Save player to DynamoDB
    await dynamoClient.send(
      new PutItemCommand({
        TableName: PLAYERS_TABLE,
        Item: {
          playerId: { S: playerId },
          puuid: { S: puuid },
          summonerName: { S: summonerName },
          region: { S: region },
          summonerId: { S: summonerId },
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
        const key = `${playerId}/${matchId}.json`;
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

    // Step 5: Trigger processing Lambda
    if (storedMatches.length > 0) {
      try {
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: PROCESSING_LAMBDA,
            InvocationType: 'Event', // Async invocation
            Payload: JSON.stringify({
              playerId,
              region,
              matchIds: storedMatches,
            }),
          })
        );
        console.log('Processing Lambda triggered');
      } catch (error) {
        console.error('Failed to trigger processing Lambda:', error);
        // Non-fatal - matches are stored, can be reprocessed later
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'Ingestion completed successfully',
        playerId,
        summonerName,
        region,
        matchesFetched: storedMatches.length,
        totalMatches: matchIds.length,
      }),
    };
  } catch (error) {
    console.error('Error in ingestion:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      }),
    };
  }
};
