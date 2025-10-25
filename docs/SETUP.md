# Setup Guide

Complete setup instructions for Rift Rewind. Follow these steps to get the project running locally and deployed to AWS.

---

## Prerequisites

### Required Accounts & Credentials

1. **AWS Account**
   - Sign up: https://aws.amazon.com/
   - Enable billing alerts (recommended)
   - Note your Account ID (12-digit number)

2. **Riot Developer Account**
   - Sign up: https://developer.riotgames.com/
   - Generate an API key (Personal or Production)
   - Copy your API key (starts with `RGAPI-`)

3. **GitHub Account** (optional, for CI/CD)
   - Fork this repository
   - Enable GitHub Actions

### Required Software

- **Node.js 18+**: Download from https://nodejs.org/
- **npm 9+**: Included with Node.js
- **AWS CLI v2**: Install from https://aws.amazon.com/cli/
- **Git**: https://git-scm.com/

### Verify Installation

```bash
node --version    # v18.0.0 or higher
npm --version     # 9.0.0 or higher
aws --version     # aws-cli/2.x.x or higher
git --version
```

---

## Step 1: Clone Repository

```bash
git clone https://github.com/your-username/rift-rewind.git
cd rift-rewind
```

---

## Step 2: Configure AWS Credentials

### Option A: AWS CLI Configuration (Recommended)

```bash
aws configure
```

Enter your credentials:
```
AWS Access Key ID: your-access-key
AWS Secret Access Key: your-secret-key
Default region name: us-east-1
Default output format: json
```

### Option B: Environment Variables

Copy the root `.env.example`:
```bash
cp .env.example .env
```

Edit `.env`:
```bash
AWS_ACCOUNT_ID=123456789012
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
RIOT_API_KEY=RGAPI-your-key-here
```

---

## Step 3: Install Dependencies

### Frontend

```bash
cd frontend
npm install
```

This installs:
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- D3.js / Visx
- TanStack Query

### Backend

```bash
cd ../backend
npm install
```

This installs:
- AWS CDK
- AWS SDK v3
- TypeScript
- Lambda types

---

## Step 4: Configure Environment Variables

### Frontend Environment

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```bash
VITE_API_URL=http://localhost:3000/dev  # Local development
# After deployment, replace with actual API Gateway URL
```

### Backend Environment

```bash
cd ../backend
cp .env.example .env
```

Edit `backend/.env`:
```bash
RIOT_API_KEY=RGAPI-your-key-here
CDK_DEFAULT_ACCOUNT=123456789012
CDK_DEFAULT_REGION=us-east-1
```

---

## Step 5: Bootstrap AWS CDK (First-time only)

If this is your first time using AWS CDK in this account/region:

```bash
cd backend
npx cdk bootstrap aws://ACCOUNT-ID/REGION
```

Example:
```bash
npx cdk bootstrap aws://123456789012/us-east-1
```

This creates an S3 bucket for CDK deployment artifacts.

---

## Step 6: Deploy Infrastructure to AWS

### Preview Changes (Optional)

```bash
cd backend
npm run synth  # Generate CloudFormation template
```

### Deploy

```bash
cd backend
npm run deploy
```

Expected output:
```
✅  RiftRewindStack

Outputs:
RiftRewindStack.ApiEndpoint = https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
RiftRewindStack.CloudFrontURL = https://d1234567890.cloudfront.net
RiftRewindStack.FrontendBucket = rift-rewind-frontend-123456789012

Stack ARN:
arn:aws:cloudformation:us-east-1:123456789012:stack/RiftRewindStack/...
```

**Copy these URLs!** You'll need them for the frontend.

---

## Step 7: Update Frontend with API URL

Edit `frontend/.env`:
```bash
VITE_API_URL=https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod
```

(Use the `ApiEndpoint` from CDK deployment output)

---

## Step 8: Build & Deploy Frontend

### Local Development (Optional)

```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

### Deploy to S3

```bash
cd frontend
npm run build  # Creates dist/ folder
```

Upload to S3:
```bash
aws s3 sync dist/ s3://rift-rewind-frontend-123456789012 --delete
```

(Replace bucket name with your `FrontendBucket` from CDK output)

### Invalidate CloudFront Cache

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR-DISTRIBUTION-ID \
  --paths "/*"
```

(Replace with your CloudFront distribution ID from CDK output)

---

## Step 9: Test the Application

### Test API Endpoints

```bash
curl https://abc123xyz.execute-api.us-east-1.amazonaws.com/prod/player/demo
```

Expected response:
```json
{
  "playerId": "demo",
  "summonerName": "Demo Player",
  "totalMatches": 342,
  "winRate": 54.2,
  "kda": 3.2
}
```

### Test Frontend

Open CloudFront URL in your browser:
```
https://d1234567890.cloudfront.net
```

Click "Try Demo" to see pre-loaded insights.

---

## Step 10: Set Up CI/CD (Optional)

### Add GitHub Secrets

Go to your GitHub repository settings → Secrets and variables → Actions.

Add these secrets:
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_ACCOUNT_ID`: Your 12-digit account ID
- `FRONTEND_BUCKET_NAME`: From CDK output (e.g., `rift-rewind-frontend-123456789012`)
- `CLOUDFRONT_DISTRIBUTION_ID`: From CloudFront console (e.g., `E1234567890ABC`)
- `API_URL`: Your API Gateway URL

### Test Workflows

Push to `main` branch:
```bash
git add .
git commit -m "feat: initial deployment"
git push origin main
```

Check GitHub Actions tab to see workflows running.

---

## Troubleshooting

### Issue: "CDK bootstrap required"

**Solution:**
```bash
cd backend
npx cdk bootstrap aws://YOUR-ACCOUNT-ID/us-east-1
```

### Issue: "Riot API 403 Forbidden"

**Solution:**
- Verify your API key is correct in `backend/.env`
- Check if your API key has expired (personal keys expire after 24 hours)
- Request a production key for longer validity

### Issue: "CloudFront not serving new files"

**Solution:**
```bash
# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id YOUR-DIST-ID \
  --paths "/*"
```

### Issue: "Lambda function timeout"

**Solution:**
- Check CloudWatch logs:
  ```bash
  aws logs tail /aws/lambda/RiftRewindStack-IngestionLambda --follow
  ```
- Increase timeout in `backend/lib/rift-rewind-stack.ts`:
  ```typescript
  timeout: Duration.seconds(300) // Increase from 60
  ```

### Issue: "DynamoDB throttling"

**Solution:**
- Enable on-demand billing (already configured in CDK stack)
- Check CloudWatch metrics for `ConsumedReadCapacityUnits`

---

## Next Steps

### Day 2: Implement Riot API Integration

1. Complete TODOs in `backend/lambda/ingestion/index.ts`
2. Use `backend/lib/riot-client.ts` for rate-limited API calls
3. Test with your own summoner name

### Day 3: Build Timeline Component

1. Create `frontend/src/components/Timeline.tsx`
2. Use D3.js or Visx for visualization
3. Connect to API endpoint: `/player/{id}/matches`

### Day 4: Implement AI Pipeline

1. Complete TODOs in `backend/lambda/ai/index.ts`
2. Configure Bedrock access in AWS Console
3. Test embedding generation and RAG retrieval

---

## Cost Monitoring

### Set Up Billing Alerts

1. Go to AWS Console → Billing → Budgets
2. Create budget: $50/month (recommended for hackathon)
3. Set alert at 80% threshold

### Estimated Costs (100 users)

- **Bedrock:** ~$5/month
- **Lambda:** ~$2/month
- **DynamoDB:** ~$3/month
- **S3:** ~$1/month
- **OpenSearch:** ~$10/month (t3.small.search)
- **CloudFront:** ~$2/month
- **Total:** ~$23/month

### Free Tier Eligible

- Lambda: 1M free requests/month
- S3: 5GB free storage
- CloudFront: 1TB free data transfer (first 12 months)
- API Gateway: 1M free requests/month (first 12 months)

---

## Resources

- **AWS CDK Docs:** https://docs.aws.amazon.com/cdk/
- **Riot API Docs:** https://developer.riotgames.com/docs/lol
- **Bedrock Docs:** https://docs.aws.amazon.com/bedrock/
- **React Docs:** https://react.dev/

---

## Getting Help

- **GitHub Issues:** https://github.com/your-username/rift-rewind/issues
- **Devpost Forum:** https://devpost.com/software/rift-rewind
- **AWS Support:** https://console.aws.amazon.com/support/

---

**Ready to build!** 🚀 Head to [METHODOLOGY.md](./METHODOLOGY.md) for AI implementation details.
