/**/**/**

 * Local test script for Ingestion Lambda

 *  * Local test script for Ingestion Lambda * Local test script for Ingestion Lambda

 * Usage:

 *   npm run build *  * 

 *   RIOT_API_KEY=your-key node dist/test-ingestion.js

 */ * Usage: * Usage:



import { handler } from './lambda/ingestion/index'; *   npm run build *   npm run build

import { APIGatewayProxyEvent } from 'aws-lambda';

 *   RIOT_API_KEY=your-key node dist/test-ingestion.js *   RIOT_API_KEY=your-key node dist/test-ingestion.js

// Mock environment variables

process.env.RAW_BUCKET = 'rift-rewind-raw-test'; */ */

process.env.PLAYERS_TABLE = 'rift-rewind-players';

process.env.PROCESSING_LAMBDA = 'rift-rewind-processing';

process.env.AWS_REGION = 'us-east-1';

process.env.RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-test-key';import { handler } from './lambda/ingestion/index';import { handler } from './lambda/ingestion/index';



async function testIngestion() {import { APIGatewayProxyEvent } from 'aws-lambda';import { APIGatewayProxyEvent } from 'aws-lambda';

  console.log('Testing Ingestion Lambda locally...\n');



  // Create mock API Gateway event

  const event: APIGatewayProxyEvent = {// Mock environment variables// Mock environment variables

    body: JSON.stringify({

      summonerName: 'Doublelift#NA1',process.env.RAW_BUCKET = 'rift-rewind-raw-test';process.env.RAW_BUCKET = 'rift-rewind-raw-test';

      region: 'NA1',

      maxMatches: 5,process.env.PLAYERS_TABLE = 'rift-rewind-players';process.env.PLAYERS_TABLE = 'rift-rewind-players';

    }),

    headers: {},process.env.PROCESSING_LAMBDA = 'rift-rewind-processing';process.env.PROCESSING_LAMBDA = 'rift-rewind-processing';

    multiValueHeaders: {},

    httpMethod: 'POST',process.env.AWS_REGION = 'us-east-1';process.env.AWS_REGION = 'us-east-1';

    isBase64Encoded: false,

    path: '/ingest',process.env.RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-test-key';process.env.RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-test-key';

    pathParameters: null,

    queryStringParameters: null,

    multiValueQueryStringParameters: null,

    stageVariables: null,async function testIngestion() {async function testIngestion() {

    requestContext: {} as any,

    resource: '',  console.log('Testing Ingestion Lambda locally...\n');  console.log('Testing Ingestion Lambda locally...\n');

  };



  try {

    const result = await handler(event);  // Create mock API Gateway event  // Create mock API Gateway event

    

    console.log('\n✅ Lambda executed successfully!');  const event: APIGatewayProxyEvent = {  const event: APIGatewayProxyEvent = {

    console.log('\nStatus Code:', result.statusCode);

    console.log('\nResponse Body:');    body: JSON.stringify({    body: JSON.stringify({

    console.log(JSON.parse(result.body));

          summonerName: 'Doublelift#NA1',      summonerName: 'Doublelift', // Famous NA player

    if (result.statusCode === 200) {

      console.log('\n🎉 Ingestion completed! Check S3 bucket and DynamoDB table.');      region: 'NA1',      region: 'NA1',

    }

  } catch (error) {      maxMatches: 5, // Just test with 5 matches      maxMatches: 5, // Just test with 5 matches

    console.error('\n❌ Lambda execution failed:');

    console.error(error);    }),    }),

    process.exit(1);

  }    headers: {},    headers: {},

}

    multiValueHeaders: {},    multiValueHeaders: {},

testIngestion();

    httpMethod: 'POST',    httpMethod: 'POST',

    isBase64Encoded: false,    isBase64Encoded: false,

    path: '/ingest',    path: '/ingest',

    pathParameters: null,    pathParameters: null,

    queryStringParameters: null,    queryStringParameters: null,

    multiValueQueryStringParameters: null,    multiValueQueryStringParameters: null,

    stageVariables: null,    stageVariables: null,

    requestContext: {} as any,    requestContext: {} as any,

    resource: '',    resource: '',

  };  };



  try {  try {

    const result = await handler(event);    const result = await handler(event);

        

    console.log('\n✅ Lambda executed successfully!');    console.log('\n✅ Lambda executed successfully!');

    console.log('\nStatus Code:', result.statusCode);    console.log('\nStatus Code:', result.statusCode);

    console.log('\nResponse Body:');    console.log('\nResponse Body:');

    console.log(JSON.parse(result.body));    console.log(JSON.parse(result.body));

        

    if (result.statusCode === 200) {    if (result.statusCode === 200) {

      console.log('\n🎉 Ingestion completed! Check S3 bucket and DynamoDB table.');      console.log('\n🎉 Ingestion completed! Check S3 bucket and DynamoDB table.');

    }    }

  } catch (error) {  } catch (error) {

    console.error('\n❌ Lambda execution failed:');    console.error('\n❌ Lambda execution failed:');

    console.error(error);    console.error(error);

    process.exit(1);    process.exit(1);

  }  }

}}



testIngestion();testIngestion();

