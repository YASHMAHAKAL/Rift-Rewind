#!/bin/bash

# Script to update endpoints.json after CDK deployment
# Usage: ./scripts/update-endpoints.sh

set -e

echo "📝 Updating endpoints.json files..."

# Get stack outputs
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name RiftRewindStack \
  --query 'Stacks[0].Outputs[?OutputKey==`APIEndpoint`].OutputValue' \
  --output text \
  --region us-east-1)

CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name RiftRewindStack \
  --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' \
  --output text \
  --region us-east-1)

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Create JSON content
cat > ../shared/endpoints.json <<EOF
{
  "apiEndpoint": "$API_ENDPOINT",
  "cloudFrontUrl": "$CLOUDFRONT_URL",
  "region": "us-east-1",
  "accountId": "$ACCOUNT_ID",
  "timestamp": "$TIMESTAMP"
}
EOF

# Copy to frontend
cp ../shared/endpoints.json ../frontend/public/endpoints.json

echo "✅ Updated endpoints.json files:"
echo "   API Endpoint: $API_ENDPOINT"
echo "   CloudFront: $CLOUDFRONT_URL"
echo ""
echo "📁 Files updated:"
echo "   - shared/endpoints.json"
echo "   - frontend/public/endpoints.json"
