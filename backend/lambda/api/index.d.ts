import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
/**
 * API Lambda - Public API endpoints
 *
 * Handles:
 * - GET /player/{playerId} - Get player profile
 * - GET /player/{playerId}/matches - Get match history
 * - GET /player/{playerId}/insights - Get AI insights
 */
export declare const handler: (event: APIGatewayProxyEvent, context: Context) => Promise<APIGatewayProxyResult>;
