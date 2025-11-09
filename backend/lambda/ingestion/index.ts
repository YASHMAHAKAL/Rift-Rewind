import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
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
const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION });

const RAW_BUCKET = process.env.RAW_BUCKET!;
const PLAYERS_TABLE = process.env.PLAYERS_TABLE!;
const PROCESSING_LAMBDA = process.env.PROCESSING_LAMBDA || 'rift-rewind-processing';
const RIOT_API_KEY_SECRET_NAME = process.env.RIOT_API_KEY_SECRET_NAME;

// Cache the API key to avoid repeated Secrets Manager calls
let cachedApiKey: string | null = null;

/**
 * Get Riot API key from Secrets Manager (with caching)
 */
async function getRiotApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  if (!RIOT_API_KEY_SECRET_NAME) {
    throw new Error('RIOT_API_KEY_SECRET_NAME environment variable is not set');
  }

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: RIOT_API_KEY_SECRET_NAME,
      })
    );

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    cachedApiKey = response.SecretString;
    console.log('✅ Successfully retrieved Riot API key from Secrets Manager');
    return cachedApiKey;
  } catch (error) {
    console.error('❌ Failed to retrieve Riot API key from Secrets Manager:', error);
    throw new Error('Failed to retrieve API key from Secrets Manager');
  }
}

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

    // Get Riot API key from Secrets Manager
    const RIOT_API_KEY = await getRiotApiKey();

    // Initialize Riot API client
    const riotClient = new RiotClient(RIOT_API_KEY, region);

    // Step 1: Get player PUUID using Riot ID format (gameName#tagLine)
    let puuid: string | undefined;
    let gameName: string;
    let tagLine: string | undefined;
    
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
      } catch (error: any) {
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
    } else {
      // User only provided name - try common tag variations for the region
      gameName = summonerName;
      
      // Common tag patterns by region
      const commonTags: Record<string, string[]> = {
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
        } catch (error: any) {
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
