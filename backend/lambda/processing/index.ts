import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const s3Client = new S3Client({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const lambdaClient = new LambdaClient({});

const MATCHES_TABLE = process.env.MATCHES_TABLE!;
const RAW_BUCKET = process.env.RAW_BUCKET!;
const PROCESSED_BUCKET = process.env.PROCESSED_BUCKET!;

// Utility functions (inline to avoid import issues)
function calculateKDA(kills: number, deaths: number, assists: number): number {
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

function calculateCSPerMin(cs: number, durationSeconds: number): number {
  return (cs / durationSeconds) * 60;
}

interface ProcessingEvent {
  puuid: string;
  matchId: string;
  region: string;
}

/**
 * Processing Lambda - Compute stats and create match fragments
 */
export const handler = async (event: ProcessingEvent): Promise<void> => {
  console.log('Processing Lambda invoked', { event });

  const { puuid, matchId, region } = event;

  try {
    // 1. Read raw match data from S3
    const s3Key = `${region}/${puuid}/${matchId}.json`;
    const getCommand = new GetObjectCommand({
      Bucket: RAW_BUCKET,
      Key: s3Key,
    });
    
    const response = await s3Client.send(getCommand);
    const matchData = JSON.parse(await response.Body!.transformToString());
    
    console.log('Retrieved match data', { matchId });

    // 2. Find player's participant data
    const participant = matchData.info.participants.find(
      (p: any) => p.puuid === puuid
    );
    
    if (!participant) {
      throw new Error(`Player ${puuid} not found in match ${matchId}`);
    }

    // 3. Compute statistics
    // CRITICAL: playerId MUST match the format used in ingestion Lambda
    // Ingestion uses: region_puuid.slice(0,8)
    // Example: "KR1_osKuSKIM" not "KR1_Faker"
    const playerId = `${region}_${puuid.slice(0, 8)}`;
    
    const stats = {
      playerId, // REQUIRED: DynamoDB partition key - MUST match ingestion format!
      matchId,
      puuid,
      championName: participant.championName,
      championId: participant.championId,
      role: participant.teamPosition || participant.individualPosition,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      kda: calculateKDA(participant.kills, participant.deaths, participant.assists),
      totalCS: participant.totalMinionsKilled + participant.neutralMinionsKilled,
      csPerMin: calculateCSPerMin(
        participant.totalMinionsKilled + participant.neutralMinionsKilled,
        matchData.info.gameDuration
      ),
      goldEarned: participant.goldEarned,
      damageDealt: participant.totalDamageDealtToChampions,
      damageTaken: participant.totalDamageTaken,
      visionScore: participant.visionScore,
      win: participant.win,
      gameDuration: matchData.info.gameDuration,
      gameMode: matchData.info.gameMode,
      queueId: matchData.info.queueId,
      gameCreation: matchData.info.gameCreation,
      timestamp: new Date(matchData.info.gameCreation).toISOString(),
    };

    // 4. Create match fragments for RAG (early/mid/late game analysis)
    const fragments = createMatchFragments(matchData, participant, stats);
    
    // 5. Store match stats in DynamoDB
    await dynamoClient.send(
      new PutCommand({
        TableName: MATCHES_TABLE,
        Item: {
          ...stats,
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
        },
      })
    );
    
    console.log('Stored match in DynamoDB', { matchId });

    // 6. Store fragments in processed bucket
    const fragmentsKey = `${region}/${puuid}/${matchId}-fragments.json`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: PROCESSED_BUCKET,
        Key: fragmentsKey,
        Body: JSON.stringify(fragments),
        ContentType: 'application/json',
      })
    );
    
    console.log('Stored fragments in S3', { fragmentsKey });

    // 7. Trigger AI Lambda for insight generation (async)
    try {
      await lambdaClient.send(
        new InvokeCommand({
          FunctionName: 'rift-rewind-ai',
          InvocationType: 'Event', // Async invoke
          Payload: JSON.stringify({
            puuid,
            matchId,
            region,
            fragmentsKey,
          }),
        })
      );
      console.log('Triggered AI Lambda', { matchId });
    } catch (error) {
      console.warn('Failed to trigger AI Lambda (non-critical):', error);
    }

    console.log('Processing complete', { matchId });
  } catch (error) {
    console.error('Error in processing:', error);
    throw error;
  }
};

/**
 * Create match fragments for RAG analysis
 */
function createMatchFragments(matchData: any, participant: any, stats: any) {
  const duration = matchData.info.gameDuration;
  const earlyGame = duration >= 600; // 10 minutes
  const midGame = duration >= 1200; // 20 minutes
  const lateGame = duration >= 1800; // 30 minutes

  return {
    matchId: stats.matchId,
    puuid: stats.puuid,
    summary: `${participant.championName} ${stats.role} - ${stats.win ? 'Victory' : 'Defeat'} - ${stats.kills}/${stats.deaths}/${stats.assists} KDA`,
    
    performance: {
      kda: stats.kda,
      kills: stats.kills,
      deaths: stats.deaths,
      assists: stats.assists,
      csPerMin: stats.csPerMin,
      goldPerMin: stats.goldEarned / (duration / 60),
      damageShare: calculateDamageShare(matchData, participant),
      visionScore: stats.visionScore,
    },
    
    phases: {
      early: earlyGame ? `Early game (0-10min): CS advantage, lane pressure` : null,
      mid: midGame ? `Mid game (10-20min): Team fights, objective control` : null,
      late: lateGame ? `Late game (20+min): Scaling, positioning` : null,
    },
    
    keyMoments: extractKeyMoments(participant),
    
    itemBuild: participant.item0 ? [
      participant.item0,
      participant.item1,
      participant.item2,
      participant.item3,
      participant.item4,
      participant.item5,
    ].filter(Boolean) : [],
    
    timestamp: stats.timestamp,
  };
}

/**
 * Calculate player's damage share in the team
 */
function calculateDamageShare(matchData: any, participant: any): number {
  const team = matchData.info.participants.filter(
    (p: any) => p.teamId === participant.teamId
  );
  const totalTeamDamage = team.reduce(
    (sum: number, p: any) => sum + p.totalDamageDealtToChampions,
    0
  );
  return totalTeamDamage > 0
    ? (participant.totalDamageDealtToChampions / totalTeamDamage) * 100
    : 0;
}

/**
 * Extract key performance moments
 */
function extractKeyMoments(participant: any) {
  const moments = [];
  
  if (participant.firstBloodKill) moments.push('First Blood');
  if (participant.pentaKills > 0) moments.push(`${participant.pentaKills} Penta Kill${participant.pentaKills > 1 ? 's' : ''}`);
  if (participant.quadraKills > 0) moments.push(`${participant.quadraKills} Quadra Kill${participant.quadraKills > 1 ? 's' : ''}`);
  if (participant.tripleKills > 0) moments.push(`${participant.tripleKills} Triple Kill${participant.tripleKills > 1 ? 's' : ''}`);
  if (participant.killingSprees > 0) moments.push('Killing Spree');
  if (participant.largestMultiKill >= 2) moments.push(`${participant.largestMultiKill}x Multikill`);
  
  return moments;
}
