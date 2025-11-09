"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiftRewindStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigateway"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const path = __importStar(require("path"));
class RiftRewindStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // ========================================================================
        // Secrets Manager - Riot API Key
        // ========================================================================
        // Import existing secret (created manually or via CLI)
        const riotApiKeySecret = secretsmanager.Secret.fromSecretNameV2(this, 'RiotApiKeySecret', 'rift-rewind/riot-api-key');
        // ========================================================================
        // S3 Buckets
        // ========================================================================
        // Raw data bucket (match history from Riot API)
        const rawDataBucket = new s3.Bucket(this, 'RawDataBucket', {
            bucketName: `rift-rewind-raw-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // For hackathon only
            autoDeleteObjects: true,
        });
        // Processed data bucket (embeddings, cached insights)
        const processedDataBucket = new s3.Bucket(this, 'ProcessedDataBucket', {
            bucketName: `rift-rewind-processed-${this.account}`,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // Frontend hosting bucket
        const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
            bucketName: `rift-rewind-frontend-${this.account}`,
            websiteIndexDocument: 'index.html',
            websiteErrorDocument: 'index.html',
            publicReadAccess: false,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // ========================================================================
        // DynamoDB Tables
        // ========================================================================
        // Players table
        const playersTable = new dynamodb.Table(this, 'PlayersTable', {
            tableName: 'rift-rewind-players',
            partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        playersTable.addGlobalSecondaryIndex({
            indexName: 'puuid-index',
            partitionKey: { name: 'puuid', type: dynamodb.AttributeType.STRING },
        });
        // Matches table
        const matchesTable = new dynamodb.Table(this, 'MatchesTable', {
            tableName: 'rift-rewind-matches',
            partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'matchId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // Insights cache table
        const insightsTable = new dynamodb.Table(this, 'InsightsTable', {
            tableName: 'rift-rewind-insights',
            partitionKey: { name: 'playerId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            encryption: dynamodb.TableEncryption.AWS_MANAGED,
            timeToLiveAttribute: 'expiryTime',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        // ========================================================================
        // IAM Role for Lambda Functions
        // ========================================================================
        const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
            ],
        });
        // Grant Lambda permissions to access resources
        rawDataBucket.grantReadWrite(lambdaRole);
        processedDataBucket.grantReadWrite(lambdaRole);
        playersTable.grantReadWriteData(lambdaRole);
        matchesTable.grantReadWriteData(lambdaRole);
        insightsTable.grantReadWriteData(lambdaRole);
        // Grant access to read the Riot API key secret
        riotApiKeySecret.grantRead(lambdaRole);
        // Bedrock permissions
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
            resources: ['*'],
        }));
        // ========================================================================
        // Lambda Functions
        // ========================================================================
        const commonEnv = {
            PLAYERS_TABLE: playersTable.tableName,
            MATCHES_TABLE: matchesTable.tableName,
            INSIGHTS_TABLE: insightsTable.tableName,
            RAW_BUCKET: rawDataBucket.bucketName,
            PROCESSED_BUCKET: processedDataBucket.bucketName,
            // AWS_REGION is automatically set by Lambda runtime
        };
        // Ingestion Lambda (fetch data from Riot API)
        const ingestionLambda = new lambda.Function(this, 'IngestionLambda', {
            functionName: 'rift-rewind-ingestion',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ingestion')),
            timeout: cdk.Duration.seconds(300), // Increased for multiple API calls
            memorySize: 512,
            role: lambdaRole,
            environment: {
                ...commonEnv,
                RIOT_API_KEY_SECRET_NAME: riotApiKeySecret.secretName,
                PROCESSING_LAMBDA: 'rift-rewind-processing',
            },
        });
        // Processing Lambda (compute stats, create fragments)
        const processingLambda = new lambda.Function(this, 'ProcessingLambda', {
            functionName: 'rift-rewind-processing',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/processing')),
            timeout: cdk.Duration.seconds(300),
            memorySize: 1024,
            role: lambdaRole,
            environment: commonEnv,
        });
        // AI Lambda (Bedrock integration)
        const aiLambda = new lambda.Function(this, 'AILambda', {
            functionName: 'rift-rewind-ai',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/ai')),
            timeout: cdk.Duration.seconds(120),
            memorySize: 1024,
            role: lambdaRole,
            environment: {
                ...commonEnv,
                BEDROCK_MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
            },
        });
        // API Lambda (public endpoints)
        const apiLambda = new lambda.Function(this, 'APILambda', {
            functionName: 'rift-rewind-api',
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'index.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/api')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            role: lambdaRole,
            environment: commonEnv,
        });
        // Grant Lambda permission to invoke other Lambdas (for the pipeline)
        lambdaRole.addToPolicy(new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: [
                `arn:aws:lambda:${this.region}:${this.account}:function:rift-rewind-processing`,
                `arn:aws:lambda:${this.region}:${this.account}:function:rift-rewind-ai`,
            ],
        }));
        // ========================================================================
        // API Gateway
        // ========================================================================
        const api = new apigateway.RestApi(this, 'RiftRewindAPI', {
            restApiName: 'Rift Rewind API',
            description: 'API for Rift Rewind application',
            deployOptions: {
                stageName: 'prod',
            },
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        const apiIntegration = new apigateway.LambdaIntegration(apiLambda, {
            proxy: true,
        });
        const ingestionIntegration = new apigateway.LambdaIntegration(ingestionLambda, {
            proxy: true,
        });
        // POST /ingest - Trigger data ingestion
        const ingestResource = api.root.addResource('ingest', {
            defaultCorsPreflightOptions: {
                allowOrigins: apigateway.Cors.ALL_ORIGINS,
                allowMethods: ['POST', 'OPTIONS'],
                allowHeaders: ['Content-Type', 'Authorization'],
            },
        });
        ingestResource.addMethod('POST', ingestionIntegration);
        // /player/{playerId}
        const playerResource = api.root.addResource('player');
        const playerIdResource = playerResource.addResource('{playerId}');
        playerIdResource.addMethod('GET', apiIntegration);
        // /player/{playerId}/matches
        const matchesResource = playerIdResource.addResource('matches');
        matchesResource.addMethod('GET', apiIntegration);
        // /player/{playerId}/insights
        const insightsResource = playerIdResource.addResource('insights');
        insightsResource.addMethod('GET', apiIntegration);
        // ========================================================================
        // CloudFront Distribution (CDN for frontend)
        // ========================================================================
        const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI');
        frontendBucket.grantRead(originAccessIdentity);
        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(frontendBucket, {
                    originAccessIdentity,
                }),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            },
            defaultRootObject: 'index.html',
            errorResponses: [
                {
                    httpStatus: 404,
                    responseHttpStatus: 200,
                    responsePagePath: '/index.html',
                },
            ],
        });
        // ========================================================================
        // Outputs
        // ========================================================================
        new cdk.CfnOutput(this, 'APIEndpoint', {
            value: api.url,
            description: 'API Gateway endpoint URL',
        });
        new cdk.CfnOutput(this, 'CloudFrontURL', {
            value: `https://${distribution.distributionDomainName}`,
            description: 'CloudFront distribution URL',
        });
        new cdk.CfnOutput(this, 'RawDataBucketName', {
            value: rawDataBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'ProcessedDataBucketName', {
            value: processedDataBucket.bucketName,
        });
        new cdk.CfnOutput(this, 'FrontendBucketName', {
            value: frontendBucket.bucketName,
        });
        // Note: Cannot write endpoints.json here because api.url and distribution.distributionDomainName
        // are CDK tokens that only resolve after deployment.
        // Instead, manually update frontend/public/endpoints.json after deployment with the values from
        // CDK outputs, or use a post-deployment script.
        // Uncomment below if you want to generate a file with tokens (for reference only):
        /*
        const fs = require('fs');
        const endpointsConfig = {
          apiEndpoint: api.url,
          cloudFrontUrl: `https://${distribution.distributionDomainName}`,
          region: this.region,
          accountId: this.account,
          timestamp: new Date().toISOString()
        };
        const sharedPath = path.join(__dirname, '../../shared/endpoints.json');
        const frontendPath = path.join(__dirname, '../../frontend/public/endpoints.json');
        [path.dirname(sharedPath), path.dirname(frontendPath)].forEach(dir => {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        });
        const configContent = JSON.stringify(endpointsConfig, null, 2);
        fs.writeFileSync(sharedPath, configContent);
        fs.writeFileSync(frontendPath, configContent);
        console.log(`✅ API endpoints written to ${sharedPath} and ${frontendPath}`);
        */
    }
}
exports.RiftRewindStack = RiftRewindStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmlmdC1yZXdpbmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJyaWZ0LXJld2luZC1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsbUVBQXFEO0FBQ3JELCtEQUFpRDtBQUNqRCx1RUFBeUQ7QUFDekQseURBQTJDO0FBQzNDLHVFQUF5RDtBQUN6RCw0RUFBOEQ7QUFDOUQsK0VBQWlFO0FBRWpFLDJDQUE2QjtBQUU3QixNQUFhLGVBQWdCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDNUMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM5RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QiwyRUFBMkU7UUFDM0UsaUNBQWlDO1FBQ2pDLDJFQUEyRTtRQUUzRSx1REFBdUQ7UUFDdkQsTUFBTSxnQkFBZ0IsR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUM3RCxJQUFJLEVBQ0osa0JBQWtCLEVBQ2xCLDBCQUEwQixDQUMzQixDQUFDO1FBRUYsMkVBQTJFO1FBQzNFLGFBQWE7UUFDYiwyRUFBMkU7UUFFM0UsZ0RBQWdEO1FBQ2hELE1BQU0sYUFBYSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3pELFVBQVUsRUFBRSxtQkFBbUIsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUM3QyxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDLGlCQUFpQixDQUFDLFNBQVM7WUFDakQsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLHFCQUFxQjtZQUMvRCxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILHNEQUFzRDtRQUN0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LDBDQStUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzMyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtczMnO1xuaW1wb3J0ICogYXMgZHluYW1vZGIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWR5bmFtb2RiJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbGFtYmRhJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgY2xvdWRmcm9udCBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY2xvdWRmcm9udCc7XG5pbXBvcnQgKiBhcyBvcmlnaW5zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250LW9yaWdpbnMnO1xuaW1wb3J0ICogYXMgc2VjcmV0c21hbmFnZXIgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNlY3JldHNtYW5hZ2VyJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuZXhwb3J0IGNsYXNzIFJpZnRSZXdpbmRTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIFNlY3JldHMgTWFuYWdlciAtIFJpb3QgQVBJIEtleVxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgLy8gSW1wb3J0IGV4aXN0aW5nIHNlY3JldCAoY3JlYXRlZCBtYW51YWxseSBvciB2aWEgQ0xJKVxuICAgIGNvbnN0IHJpb3RBcGlLZXlTZWNyZXQgPSBzZWNyZXRzbWFuYWdlci5TZWNyZXQuZnJvbVNlY3JldE5hbWVWMihcbiAgICAgIHRoaXMsXG4gICAgICAnUmlvdEFwaUtleVNlY3JldCcsXG4gICAgICAncmlmdC1yZXdpbmQvcmlvdC1hcGkta2V5J1xuICAgICk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBTMyBCdWNrZXRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBSYXcgZGF0YSBidWNrZXQgKG1hdGNoIGhpc3RvcnkgZnJvbSBSaW90IEFQSSlcbiAgICBjb25zdCByYXdEYXRhQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnUmF3RGF0YUJ1Y2tldCcsIHtcbiAgICAgIGJ1Y2tldE5hbWU6IGByaWZ0LXJld2luZC1yYXctJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLCAvLyBGb3IgaGFja2F0aG9uIG9ubHlcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gUHJvY2Vzc2VkIGRhdGEgYnVja2V0IChlbWJlZGRpbmdzLCBjYWNoZWQgaW5zaWdodHMpXG4gICAgY29uc3QgcHJvY2Vzc2VkRGF0YUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1Byb2Nlc3NlZERhdGFCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgcmlmdC1yZXdpbmQtcHJvY2Vzc2VkLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gRnJvbnRlbmQgaG9zdGluZyBidWNrZXRcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Zyb250ZW5kQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYHJpZnQtcmV3aW5kLWZyb250ZW5kLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICB3ZWJzaXRlSW5kZXhEb2N1bWVudDogJ2luZGV4Lmh0bWwnLFxuICAgICAgd2Vic2l0ZUVycm9yRG9jdW1lbnQ6ICdpbmRleC5odG1sJyxcbiAgICAgIHB1YmxpY1JlYWRBY2Nlc3M6IGZhbHNlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gRHluYW1vREIgVGFibGVzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICAvLyBQbGF5ZXJzIHRhYmxlXG4gICAgY29uc3QgcGxheWVyc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdQbGF5ZXJzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdyaWZ0LXJld2luZC1wbGF5ZXJzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGxheWVySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICBwbGF5ZXJzVGFibGUuYWRkR2xvYmFsU2Vjb25kYXJ5SW5kZXgoe1xuICAgICAgaW5kZXhOYW1lOiAncHV1aWQtaW5kZXgnLFxuICAgICAgcGFydGl0aW9uS2V5OiB7IG5hbWU6ICdwdXVpZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgfSk7XG5cbiAgICAvLyBNYXRjaGVzIHRhYmxlXG4gICAgY29uc3QgbWF0Y2hlc1RhYmxlID0gbmV3IGR5bmFtb2RiLlRhYmxlKHRoaXMsICdNYXRjaGVzVGFibGUnLCB7XG4gICAgICB0YWJsZU5hbWU6ICdyaWZ0LXJld2luZC1tYXRjaGVzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGxheWVySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgc29ydEtleTogeyBuYW1lOiAnbWF0Y2hJZCcsIHR5cGU6IGR5bmFtb2RiLkF0dHJpYnV0ZVR5cGUuU1RSSU5HIH0sXG4gICAgICBiaWxsaW5nTW9kZTogZHluYW1vZGIuQmlsbGluZ01vZGUuUEFZX1BFUl9SRVFVRVNULFxuICAgICAgZW5jcnlwdGlvbjogZHluYW1vZGIuVGFibGVFbmNyeXB0aW9uLkFXU19NQU5BR0VELFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEluc2lnaHRzIGNhY2hlIHRhYmxlXG4gICAgY29uc3QgaW5zaWdodHNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCAnSW5zaWdodHNUYWJsZScsIHtcbiAgICAgIHRhYmxlTmFtZTogJ3JpZnQtcmV3aW5kLWluc2lnaHRzJyxcbiAgICAgIHBhcnRpdGlvbktleTogeyBuYW1lOiAncGxheWVySWQnLCB0eXBlOiBkeW5hbW9kYi5BdHRyaWJ1dGVUeXBlLlNUUklORyB9LFxuICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgIGVuY3J5cHRpb246IGR5bmFtb2RiLlRhYmxlRW5jcnlwdGlvbi5BV1NfTUFOQUdFRCxcbiAgICAgIHRpbWVUb0xpdmVBdHRyaWJ1dGU6ICdleHBpcnlUaW1lJyxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBJQU0gUm9sZSBmb3IgTGFtYmRhIEZ1bmN0aW9uc1xuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuXG4gICAgY29uc3QgbGFtYmRhUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZScsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZSgnc2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZScpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIEdyYW50IExhbWJkYSBwZXJtaXNzaW9ucyB0byBhY2Nlc3MgcmVzb3VyY2VzXG4gICAgcmF3RGF0YUJ1Y2tldC5ncmFudFJlYWRXcml0ZShsYW1iZGFSb2xlKTtcbiAgICBwcm9jZXNzZWREYXRhQnVja2V0LmdyYW50UmVhZFdyaXRlKGxhbWJkYVJvbGUpO1xuICAgIHBsYXllcnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEobGFtYmRhUm9sZSk7XG4gICAgbWF0Y2hlc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcbiAgICBpbnNpZ2h0c1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YShsYW1iZGFSb2xlKTtcblxuICAgIC8vIEdyYW50IGFjY2VzcyB0byByZWFkIHRoZSBSaW90IEFQSSBrZXkgc2VjcmV0XG4gICAgcmlvdEFwaUtleVNlY3JldC5ncmFudFJlYWQobGFtYmRhUm9sZSk7XG5cbiAgICAvLyBCZWRyb2NrIHBlcm1pc3Npb25zXG4gICAgbGFtYmRhUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJywgJ2JlZHJvY2s6SW52b2tlTW9kZWxXaXRoUmVzcG9uc2VTdHJlYW0nXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgIC8vIExhbWJkYSBGdW5jdGlvbnNcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGNvbW1vbkVudiA9IHtcbiAgICAgIFBMQVlFUlNfVEFCTEU6IHBsYXllcnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICBNQVRDSEVTX1RBQkxFOiBtYXRjaGVzVGFibGUudGFibGVOYW1lLFxuICAgICAgSU5TSUdIVFNfVEFCTEU6IGluc2lnaHRzVGFibGUudGFibGVOYW1lLFxuICAgICAgUkFXX0JVQ0tFVDogcmF3RGF0YUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgUFJPQ0VTU0VEX0JVQ0tFVDogcHJvY2Vzc2VkRGF0YUJ1Y2tldC5idWNrZXROYW1lLFxuICAgICAgLy8gQVdTX1JFR0lPTiBpcyBhdXRvbWF0aWNhbGx5IHNldCBieSBMYW1iZGEgcnVudGltZVxuICAgIH07XG5cbiAgICAvLyBJbmdlc3Rpb24gTGFtYmRhIChmZXRjaCBkYXRhIGZyb20gUmlvdCBBUEkpXG4gICAgY29uc3QgaW5nZXN0aW9uTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnSW5nZXN0aW9uTGFtYmRhJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAncmlmdC1yZXdpbmQtaW5nZXN0aW9uJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvaW5nZXN0aW9uJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSwgLy8gSW5jcmVhc2VkIGZvciBtdWx0aXBsZSBBUEkgY2FsbHNcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAuLi5jb21tb25FbnYsXG4gICAgICAgIFJJT1RfQVBJX0tFWV9TRUNSRVRfTkFNRTogcmlvdEFwaUtleVNlY3JldC5zZWNyZXROYW1lLFxuICAgICAgICBQUk9DRVNTSU5HX0xBTUJEQTogJ3JpZnQtcmV3aW5kLXByb2Nlc3NpbmcnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFByb2Nlc3NpbmcgTGFtYmRhIChjb21wdXRlIHN0YXRzLCBjcmVhdGUgZnJhZ21lbnRzKVxuICAgIGNvbnN0IHByb2Nlc3NpbmdMYW1iZGEgPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdQcm9jZXNzaW5nTGFtYmRhJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAncmlmdC1yZXdpbmQtcHJvY2Vzc2luZycsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3Byb2Nlc3NpbmcnKSksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgbWVtb3J5U2l6ZTogMTAyNCxcbiAgICAgIHJvbGU6IGxhbWJkYVJvbGUsXG4gICAgICBlbnZpcm9ubWVudDogY29tbW9uRW52LFxuICAgIH0pO1xuXG4gICAgLy8gQUkgTGFtYmRhIChCZWRyb2NrIGludGVncmF0aW9uKVxuICAgIGNvbnN0IGFpTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQUlMYW1iZGEnLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6ICdyaWZ0LXJld2luZC1haScsXG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfMThfWCxcbiAgICAgIGhhbmRsZXI6ICdpbmRleC5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL2FpJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTIwKSxcbiAgICAgIG1lbW9yeVNpemU6IDEwMjQsXG4gICAgICByb2xlOiBsYW1iZGFSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgLi4uY29tbW9uRW52LFxuICAgICAgICBCRURST0NLX01PREVMX0lEOiAnYW50aHJvcGljLmNsYXVkZS0zLWhhaWt1LTIwMjQwMzA3LXYxOjAnLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBMYW1iZGEgKHB1YmxpYyBlbmRwb2ludHMpXG4gICAgY29uc3QgYXBpTGFtYmRhID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQVBJTGFtYmRhJywge1xuICAgICAgZnVuY3Rpb25OYW1lOiAncmlmdC1yZXdpbmQtYXBpJyxcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU18xOF9YLFxuICAgICAgaGFuZGxlcjogJ2luZGV4LmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvYXBpJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgcm9sZTogbGFtYmRhUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiBjb21tb25FbnYsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBMYW1iZGEgcGVybWlzc2lvbiB0byBpbnZva2Ugb3RoZXIgTGFtYmRhcyAoZm9yIHRoZSBwaXBlbGluZSlcbiAgICBsYW1iZGFSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBhY3Rpb25zOiBbJ2xhbWJkYTpJbnZva2VGdW5jdGlvbiddLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBgYXJuOmF3czpsYW1iZGE6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmZ1bmN0aW9uOnJpZnQtcmV3aW5kLXByb2Nlc3NpbmdgLFxuICAgICAgICAgIGBhcm46YXdzOmxhbWJkYToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06ZnVuY3Rpb246cmlmdC1yZXdpbmQtYWlgLFxuICAgICAgICBdLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gICAgLy8gQVBJIEdhdGV3YXlcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IGFwaSA9IG5ldyBhcGlnYXRld2F5LlJlc3RBcGkodGhpcywgJ1JpZnRSZXdpbmRBUEknLCB7XG4gICAgICByZXN0QXBpTmFtZTogJ1JpZnQgUmV3aW5kIEFQSScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBmb3IgUmlmdCBSZXdpbmQgYXBwbGljYXRpb24nLFxuICAgICAgZGVwbG95T3B0aW9uczoge1xuICAgICAgICBzdGFnZU5hbWU6ICdwcm9kJyxcbiAgICAgIH0sXG4gICAgICBkZWZhdWx0Q29yc1ByZWZsaWdodE9wdGlvbnM6IHtcbiAgICAgICAgYWxsb3dPcmlnaW5zOiBhcGlnYXRld2F5LkNvcnMuQUxMX09SSUdJTlMsXG4gICAgICAgIGFsbG93TWV0aG9kczogYXBpZ2F0ZXdheS5Db3JzLkFMTF9NRVRIT0RTLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBhcGlJbnRlZ3JhdGlvbiA9IG5ldyBhcGlnYXRld2F5LkxhbWJkYUludGVncmF0aW9uKGFwaUxhbWJkYSwge1xuICAgICAgcHJveHk6IHRydWUsXG4gICAgfSk7XG4gICAgY29uc3QgaW5nZXN0aW9uSW50ZWdyYXRpb24gPSBuZXcgYXBpZ2F0ZXdheS5MYW1iZGFJbnRlZ3JhdGlvbihpbmdlc3Rpb25MYW1iZGEsIHtcbiAgICAgIHByb3h5OiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gUE9TVCAvaW5nZXN0IC0gVHJpZ2dlciBkYXRhIGluZ2VzdGlvblxuICAgIGNvbnN0IGluZ2VzdFJlc291cmNlID0gYXBpLnJvb3QuYWRkUmVzb3VyY2UoJ2luZ2VzdCcsIHtcbiAgICAgIGRlZmF1bHRDb3JzUHJlZmxpZ2h0T3B0aW9uczoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IGFwaWdhdGV3YXkuQ29ycy5BTExfT1JJR0lOUyxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbJ1BPU1QnLCAnT1BUSU9OUyddLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFsnQ29udGVudC1UeXBlJywgJ0F1dGhvcml6YXRpb24nXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgaW5nZXN0UmVzb3VyY2UuYWRkTWV0aG9kKCdQT1NUJywgaW5nZXN0aW9uSW50ZWdyYXRpb24pO1xuXG4gICAgLy8gL3BsYXllci97cGxheWVySWR9XG4gICAgY29uc3QgcGxheWVyUmVzb3VyY2UgPSBhcGkucm9vdC5hZGRSZXNvdXJjZSgncGxheWVyJyk7XG4gICAgY29uc3QgcGxheWVySWRSZXNvdXJjZSA9IHBsYXllclJlc291cmNlLmFkZFJlc291cmNlKCd7cGxheWVySWR9Jyk7XG4gICAgcGxheWVySWRSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uKTtcblxuICAgIC8vIC9wbGF5ZXIve3BsYXllcklkfS9tYXRjaGVzXG4gICAgY29uc3QgbWF0Y2hlc1Jlc291cmNlID0gcGxheWVySWRSZXNvdXJjZS5hZGRSZXNvdXJjZSgnbWF0Y2hlcycpO1xuICAgIG1hdGNoZXNSZXNvdXJjZS5hZGRNZXRob2QoJ0dFVCcsIGFwaUludGVncmF0aW9uKTtcblxuICAgIC8vIC9wbGF5ZXIve3BsYXllcklkfS9pbnNpZ2h0c1xuICAgIGNvbnN0IGluc2lnaHRzUmVzb3VyY2UgPSBwbGF5ZXJJZFJlc291cmNlLmFkZFJlc291cmNlKCdpbnNpZ2h0cycpO1xuICAgIGluc2lnaHRzUmVzb3VyY2UuYWRkTWV0aG9kKCdHRVQnLCBhcGlJbnRlZ3JhdGlvbik7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiAoQ0ROIGZvciBmcm9udGVuZClcbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cblxuICAgIGNvbnN0IG9yaWdpbkFjY2Vzc0lkZW50aXR5ID0gbmV3IGNsb3VkZnJvbnQuT3JpZ2luQWNjZXNzSWRlbnRpdHkodGhpcywgJ09BSScpO1xuICAgIGZyb250ZW5kQnVja2V0LmdyYW50UmVhZChvcmlnaW5BY2Nlc3NJZGVudGl0eSk7XG5cbiAgICBjb25zdCBkaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKGZyb250ZW5kQnVja2V0LCB7XG4gICAgICAgICAgb3JpZ2luQWNjZXNzSWRlbnRpdHksXG4gICAgICAgIH0pLFxuICAgICAgICB2aWV3ZXJQcm90b2NvbFBvbGljeTogY2xvdWRmcm9udC5WaWV3ZXJQcm90b2NvbFBvbGljeS5SRURJUkVDVF9UT19IVFRQUyxcbiAgICAgICAgY2FjaGVQb2xpY3k6IGNsb3VkZnJvbnQuQ2FjaGVQb2xpY3kuQ0FDSElOR19PUFRJTUlaRUQsXG4gICAgICB9LFxuICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6ICdpbmRleC5odG1sJyxcbiAgICAgIGVycm9yUmVzcG9uc2VzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogJy9pbmRleC5odG1sJyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAvLyBPdXRwdXRzXG4gICAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQVBJRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogYXBpLnVybCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEdhdGV3YXkgZW5kcG9pbnQgVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDbG91ZEZyb250VVJMJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ2xvdWRGcm9udCBkaXN0cmlidXRpb24gVVJMJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdSYXdEYXRhQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiByYXdEYXRhQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJvY2Vzc2VkRGF0YUJ1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogcHJvY2Vzc2VkRGF0YUJ1Y2tldC5idWNrZXROYW1lLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Zyb250ZW5kQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBmcm9udGVuZEJ1Y2tldC5idWNrZXROYW1lLFxuICAgIH0pO1xuXG4gICAgLy8gTm90ZTogQ2Fubm90IHdyaXRlIGVuZHBvaW50cy5qc29uIGhlcmUgYmVjYXVzZSBhcGkudXJsIGFuZCBkaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uRG9tYWluTmFtZVxuICAgIC8vIGFyZSBDREsgdG9rZW5zIHRoYXQgb25seSByZXNvbHZlIGFmdGVyIGRlcGxveW1lbnQuXG4gICAgLy8gSW5zdGVhZCwgbWFudWFsbHkgdXBkYXRlIGZyb250ZW5kL3B1YmxpYy9lbmRwb2ludHMuanNvbiBhZnRlciBkZXBsb3ltZW50IHdpdGggdGhlIHZhbHVlcyBmcm9tXG4gICAgLy8gQ0RLIG91dHB1dHMsIG9yIHVzZSBhIHBvc3QtZGVwbG95bWVudCBzY3JpcHQuXG4gICAgXG4gICAgLy8gVW5jb21tZW50IGJlbG93IGlmIHlvdSB3YW50IHRvIGdlbmVyYXRlIGEgZmlsZSB3aXRoIHRva2VucyAoZm9yIHJlZmVyZW5jZSBvbmx5KTpcbiAgICAvKlxuICAgIGNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTtcbiAgICBjb25zdCBlbmRwb2ludHNDb25maWcgPSB7XG4gICAgICBhcGlFbmRwb2ludDogYXBpLnVybCxcbiAgICAgIGNsb3VkRnJvbnRVcmw6IGBodHRwczovLyR7ZGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWV9YCxcbiAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICBhY2NvdW50SWQ6IHRoaXMuYWNjb3VudCxcbiAgICAgIHRpbWVzdGFtcDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpXG4gICAgfTtcbiAgICBjb25zdCBzaGFyZWRQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uLy4uL3NoYXJlZC9lbmRwb2ludHMuanNvbicpO1xuICAgIGNvbnN0IGZyb250ZW5kUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi8uLi9mcm9udGVuZC9wdWJsaWMvZW5kcG9pbnRzLmpzb24nKTtcbiAgICBbcGF0aC5kaXJuYW1lKHNoYXJlZFBhdGgpLCBwYXRoLmRpcm5hbWUoZnJvbnRlbmRQYXRoKV0uZm9yRWFjaChkaXIgPT4ge1xuICAgICAgaWYgKCFmcy5leGlzdHNTeW5jKGRpcikpIHtcbiAgICAgICAgZnMubWtkaXJTeW5jKGRpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgY29uZmlnQ29udGVudCA9IEpTT04uc3RyaW5naWZ5KGVuZHBvaW50c0NvbmZpZywgbnVsbCwgMik7XG4gICAgZnMud3JpdGVGaWxlU3luYyhzaGFyZWRQYXRoLCBjb25maWdDb250ZW50KTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKGZyb250ZW5kUGF0aCwgY29uZmlnQ29udGVudCk7XG4gICAgY29uc29sZS5sb2coYOKchSBBUEkgZW5kcG9pbnRzIHdyaXR0ZW4gdG8gJHtzaGFyZWRQYXRofSBhbmQgJHtmcm9udGVuZFBhdGh9YCk7XG4gICAgKi9cbiAgfVxufVxuIl19