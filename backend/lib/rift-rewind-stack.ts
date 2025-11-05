import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';
import * as path from 'path';

export class RiftRewindStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // Bedrock permissions
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: ['*'],
      })
    );

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
        RIOT_API_KEY: process.env.RIOT_API_KEY || 'RGAPI-demo-key',
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
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['lambda:InvokeFunction'],
        resources: [
          `arn:aws:lambda:${this.region}:${this.account}:function:rift-rewind-processing`,
          `arn:aws:lambda:${this.region}:${this.account}:function:rift-rewind-ai`,
        ],
      })
    );

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

    const apiIntegration = new apigateway.LambdaIntegration(apiLambda);
    const ingestionIntegration = new apigateway.LambdaIntegration(ingestionLambda);

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
  }
}
