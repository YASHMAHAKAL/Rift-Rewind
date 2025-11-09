# 🚀 Deployment Guide - Rift Rewind

## GitHub Actions Setup

Your repository already has GitHub Actions workflows configured for automated deployment.

### Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

| Secret Name | Value | Description |
|------------|-------|-------------|
| `AWS_ACCESS_KEY_ID` | Your AWS Access Key | IAM user credentials |
| `AWS_SECRET_ACCESS_KEY` | Your AWS Secret Key | IAM user credentials |
| `AWS_ACCOUNT_ID` | `480731385241` | Your AWS Account ID |
| `FRONTEND_BUCKET_NAME` | `rift-rewind-frontend-480731385241` | S3 bucket for frontend |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E3KIPBRSFWH6AU` | CloudFront distribution ID |

### How to Get AWS Credentials

If you don't have an IAM user with programmatic access yet:

1. Go to AWS Console → IAM → Users
2. Create new user (e.g., `github-actions-deploy`)
3. Attach policies:
   - `AdministratorAccess` (for CDK deployments)
   - Or custom policy with: CloudFormation, Lambda, API Gateway, S3, CloudFront, DynamoDB, Secrets Manager
4. Create Access Key → Copy the ID and Secret Key
5. Add them to GitHub Secrets

### Workflows

#### 1. Backend Deployment (`.github/workflows/deploy-backend.yml`)
**Triggers:**
- Push to `main` branch with changes in `backend/` or `shared/`
- Manual workflow dispatch

**What it does:**
- Installs dependencies (including Lambda dependencies)
- Builds TypeScript
- Deploys AWS infrastructure via CDK
- Updates endpoints.json files

#### 2. Frontend Deployment (`.github/workflows/deploy-frontend.yml`)
**Triggers:**
- Push to `main` branch with changes in `frontend/`
- Manual workflow dispatch

**What it does:**
- Installs dependencies
- Builds React app with Vite
- Syncs to S3 bucket
- Invalidates CloudFront cache

## Manual Deployment

If you want to deploy manually:

### Backend
```bash
cd backend
npm install
npm run build
npm run deploy
```

### Frontend
```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://rift-rewind-frontend-480731385241 --delete
aws cloudfront create-invalidation --distribution-id E3KIPBRSFWH6AU --paths "/*"
```

## First Time Setup

1. **Add GitHub Secrets** (see table above)
2. **Push to main branch**:
   ```bash
   git add .
   git commit -m "chore: configure GitHub Actions"
   git push origin main
   ```
3. **Monitor deployment**:
   - Go to GitHub → Actions tab
   - Watch the workflow run
   - Check for any errors

## Deployment URLs

- **Frontend**: https://d1wnzolg96lql7.cloudfront.net
- **API**: https://4ehmfkh383.execute-api.us-east-1.amazonaws.com/prod/
- **AWS Console**: https://console.aws.amazon.com/

## Troubleshooting

### Build Fails
- Check GitHub Actions logs
- Ensure all secrets are set correctly
- Verify AWS credentials have necessary permissions

### Frontend Not Updating
- CloudFront cache might be stale
- Workflow automatically invalidates cache
- Wait 5-10 minutes for cache to clear

### Backend Deployment Fails
- Check CDK bootstrap is complete
- Ensure Secrets Manager has the Riot API key
- Verify Lambda dependencies are installed

## Cost Monitoring

- Lambda: Pay per request (~$0.20/1M requests)
- API Gateway: ~$3.50/1M requests
- S3: ~$0.023/GB/month
- CloudFront: ~$0.085/GB
- DynamoDB: Pay per request (~$1.25/1M writes)

**Expected monthly cost**: $5-30 depending on traffic

## Security Notes

- ✅ API keys stored in AWS Secrets Manager (not in code)
- ✅ Environment variables not committed to Git
- ✅ AWS credentials stored in GitHub Secrets (encrypted)
- ✅ CloudFront serves frontend over HTTPS
- ✅ API Gateway has CORS properly configured

## Next Steps

1. Set up GitHub Secrets
2. Push code to trigger first deployment
3. Monitor deployment in GitHub Actions
4. Test the deployed application
5. Set up custom domain (optional)
