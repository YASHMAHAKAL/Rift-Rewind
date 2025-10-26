import { S3Event } from 'aws-lambda';
/**
 * Processing Lambda - Compute stats and create match fragments
 *
 * This function:
 * 1. Reads raw match data from S3
 * 2. Computes per-match and aggregate statistics
 * 3. Creates match fragments for RAG
 * 4. Stores processed data in S3 and DynamoDB
 */
export declare const handler: (event: S3Event) => Promise<void>;
