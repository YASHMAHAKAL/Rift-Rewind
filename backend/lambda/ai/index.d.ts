import { SQSEvent } from 'aws-lambda';
/**
 * AI Lambda - Bedrock integration for insight generation
 *
 * This function:
 * 1. Generates embeddings for match fragments (Bedrock Titan)
 * 2. Indexes embeddings in OpenSearch
 * 3. Generates insights using Bedrock Claude (with RAG)
 *    - Hero Summary
 *    - Coaching Tips
 *    - Roast Mode
 *    - Hidden Gems
 * 4. Caches results in S3/DynamoDB
 */
export declare const handler: (event: SQSEvent) => Promise<void>;
