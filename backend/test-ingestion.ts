/**
 * Local test script for Ingestion Lambda
 * 
 * Usage:
 *   npm run build
 *   RIOT_API_KEY=your-key node dist/test-ingestion.js
 */

import { handler } from './lambda/ingestion/index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Mock environment variables
process.env.RAW_BUCKET = 'rift-rewind-raw-test';
process.env.PLAYERS_TABLE = 'rift-rewind-players';
process.env.PROCESSING_LAMBDA = 'rift-rewind-processing';
process.env.AWS_REGION = 'us-east-1';
process.env.RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-test-key';

async function testIngestion() {
  console.log('Testing Ingestion Lambda locally...\n');

  // Create mock API Gateway event
  const event: APIGatewayProxyEvent = {
    body: JSON.stringify({
      summonerName: 'Doublelift', // Famous NA player
      region: 'NA1',
      maxMatches: 5, // Just test with 5 matches
    }),
    headers: {},
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/ingest',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  };

  try {
    const result = await handler(event);
    
    console.log('\n✅ Lambda executed successfully!');
    console.log('\nStatus Code:', result.statusCode);
    console.log('\nResponse Body:');
    console.log(JSON.parse(result.body));
    
    if (result.statusCode === 200) {
      console.log('\n🎉 Ingestion completed! Check S3 bucket and DynamoDB table.');
    }
  } catch (error) {
    console.error('\n❌ Lambda execution failed:');
    console.error(error);
    process.exit(1);
  }
}

testIngestion();
