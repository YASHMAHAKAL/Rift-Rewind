#!/bin/bash

echo "=========================================="
echo "🚀 Pre-Deployment Checklist"
echo "=========================================="
echo ""

# Check AWS CLI
echo "1️⃣  Checking AWS CLI..."
if command -v aws &> /dev/null; then
    AWS_VERSION=$(aws --version 2>&1)
    echo "   ✅ AWS CLI installed: $AWS_VERSION"
else
    echo "   ❌ AWS CLI not found. Install with:"
    echo "      sudo apt install awscli  (Ubuntu/Debian)"
    echo "      brew install awscli      (macOS)"
    exit 1
fi
echo ""

# Check AWS credentials
echo "2️⃣  Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    AWS_USER=$(aws sts get-caller-identity --query Arn --output text)
    echo "   ✅ AWS credentials configured"
    echo "   Account ID: $AWS_ACCOUNT"
    echo "   User: $AWS_USER"
else
    echo "   ❌ AWS credentials not configured. Run:"
    echo "      aws configure"
    exit 1
fi
echo ""

# Check Node.js
echo "3️⃣  Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.js installed: $NODE_VERSION"
    
    if [[ "${NODE_VERSION:1:2}" -lt 18 ]]; then
        echo "   ⚠️  Warning: Node.js 18+ recommended (you have $NODE_VERSION)"
    fi
else
    echo "   ❌ Node.js not found. Install from https://nodejs.org/"
    exit 1
fi
echo ""

# Check npm dependencies
echo "4️⃣  Checking backend dependencies..."
if [ -d "node_modules" ]; then
    echo "   ✅ Dependencies installed"
else
    echo "   ⚠️  Dependencies not installed. Running npm install..."
    npm install
fi
echo ""

# Check Riot API key
echo "5️⃣  Checking Riot API key..."
if [ -z "$RIOT_API_KEY" ]; then
    echo "   ❌ RIOT_API_KEY not set. Set it with:"
    echo "      export RIOT_API_KEY=\"RGAPI-your-key-here\""
    echo ""
    echo "   Get your key from: https://developer.riotgames.com/"
    exit 1
else
    echo "   ✅ RIOT_API_KEY is set"
    echo "   Key: ${RIOT_API_KEY:0:15}..."
fi
echo ""

# Check CDK installation
echo "6️⃣  Checking AWS CDK..."
if npm list aws-cdk-lib &> /dev/null; then
    echo "   ✅ AWS CDK installed"
else
    echo "   ❌ AWS CDK not installed. Installing..."
    npm install
fi
echo ""

# Check if CDK is bootstrapped
echo "7️⃣  Checking CDK bootstrap..."
DEFAULT_REGION=$(aws configure get region)
if [ -z "$DEFAULT_REGION" ]; then
    DEFAULT_REGION="us-east-1"
fi

echo "   Checking region: $DEFAULT_REGION"
BOOTSTRAP_STACK=$(aws cloudformation describe-stacks \
    --stack-name CDKToolkit \
    --region $DEFAULT_REGION \
    --query 'Stacks[0].StackStatus' \
    --output text 2>/dev/null)

if [ "$BOOTSTRAP_STACK" == "CREATE_COMPLETE" ] || [ "$BOOTSTRAP_STACK" == "UPDATE_COMPLETE" ]; then
    echo "   ✅ CDK is bootstrapped in $DEFAULT_REGION"
else
    echo "   ⚠️  CDK not bootstrapped. You'll need to run:"
    echo "      npx cdk bootstrap aws://$AWS_ACCOUNT/$DEFAULT_REGION"
    echo ""
    read -p "   Run bootstrap now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npx cdk bootstrap aws://$AWS_ACCOUNT/$DEFAULT_REGION
    fi
fi
echo ""

# Summary
echo "=========================================="
echo "✅ Pre-deployment check complete!"
echo "=========================================="
echo ""
echo "📋 Summary:"
echo "   AWS Account: $AWS_ACCOUNT"
echo "   Region: $DEFAULT_REGION"
echo "   Riot API Key: Set ✅"
echo ""
echo "🚀 Ready to deploy! Run:"
echo "   npm run deploy"
echo ""
