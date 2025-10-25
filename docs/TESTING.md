# Testing Instructions for Judges

Thank you for reviewing **Rift Rewind**! This document provides step-by-step instructions for testing the application.

---

## Quick Start (Demo Account)

The fastest way to see the app in action is to use our pre-loaded demo account.

### Access the Demo

1. **Open the application:** https://rift-rewind.example.com *(replace with your actual CloudFront URL)*

2. **Click "Try Demo"** on the landing page

3. **You'll see:**
   - Pre-computed Hero Summary (AI-generated season narrative)
   - Interactive timeline with match history
   - AI coaching tips
   - Playstyle radar chart
   - Roast Mode (playful critique)
   - Hidden Gems (surprising insights)

### Demo Features to Test

- **Timeline Interaction:** Click on match dots to see detailed insights
- **Story Mode:** Scroll through the animated narrative
- **Social Sharing:** Click "Share" to generate a social media card
- **Evidence Linking:** Click "View Evidence" on any insight to see source matches

---

## Testing with Your Own League Account

If you'd like to see the app work with real data:

### Prerequisites
- Active League of Legends account
- Recent match history (at least 50 matches recommended)

### Steps

1. **Navigate to:** https://rift-rewind.example.com/dashboard

2. **Enter your summoner name and region**
   - Example: `Summoner Name: "YourName"`, `Region: "NA1"`

3. **Click "Fetch My Data"**
   - First-time processing takes 30-60 seconds
   - Progress indicator shows status

4. **Explore your personalized insights**

---

## API Testing (For Technical Review)

### API Endpoints

Base URL: `https://api.rift-rewind.example.com/prod` *(replace with your API Gateway URL)*

#### 1. Get Player Profile
```bash
curl https://api.rift-rewind.example.com/prod/player/demo
```

**Expected response:**
```json
{
  "playerId": "demo",
  "summonerName": "Demo Player",
  "region": "NA1",
  "totalMatches": 342,
  "winRate": 54.2,
  "kda": 3.2
}
```

#### 2. Get Match History
```bash
curl https://api.rift-rewind.example.com/prod/player/demo/matches
```

#### 3. Get AI Insights
```bash
curl https://api.rift-rewind.example.com/prod/player/demo/insights
```

---

## Architecture Review

### AWS Services Used

You can verify our AWS integration by checking:

1. **Amazon Bedrock:**
   - Model: `anthropic.claude-3-haiku-20240307-v1:0`
   - Used for: Hero Summary, Coaching Tips, Roast Mode

2. **Amazon OpenSearch:**
   - Vector index for match fragments
   - RAG retrieval for evidence-based insights

3. **AWS Lambda:**
   - Ingestion: Riot API data fetching
   - Processing: Statistical analysis
   - AI: Bedrock integration
   - API: Public endpoints

4. **Amazon DynamoDB:**
   - Tables: `players`, `matches`, `insights`

5. **Amazon S3:**
   - Buckets: Raw data, processed data, frontend hosting

6. **Amazon CloudFront:**
   - CDN for fast global delivery

7. **AWS Step Functions:**
   - Multi-step orchestration pipeline

### Infrastructure as Code

All infrastructure is defined in TypeScript using AWS CDK:
- See `backend/lib/rift-rewind-stack.ts`
- Deploy with: `cd backend && npm run deploy`

---

## Feature Checklist

Please test the following features and verify they work:

### Core Features
- [ ] Landing page loads with animations
- [ ] Demo account works out-of-the-box
- [ ] Hero Summary displays AI-generated narrative
- [ ] Interactive timeline is clickable and animated
- [ ] Match detail cards show insights + evidence
- [ ] Coaching tips are actionable and specific
- [ ] Playstyle radar visualizes strengths/weaknesses

### Bonus Features (Prize Categories)
- [ ] **Model Whisperer:** Check methodology doc for prompt engineering details
- [ ] **Roast Master 3000:** Try "Roast Mode" for playful critique
- [ ] **Hidden Gem Detector:** View "Hidden Gems" section
- [ ] **Chaos Engineering:** *(Optional)* Load test with: `ab -n 100 -c 10 https://api.example.com/prod/player/demo`

### UX & Polish
- [ ] Smooth animations and transitions
- [ ] Responsive design (test on mobile)
- [ ] Social share card generation works
- [ ] No console errors in browser devtools
- [ ] Fast load times (<3s for demo)

---

## Known Limitations

1. **Riot API Rate Limits:**
   - First-time data fetch for a new player may take 30-60 seconds
   - We cache aggressively to mitigate this

2. **Demo Data:**
   - Demo account uses pre-computed results
   - For testing AI freshness, use your own account

3. **Cost Optimization:**
   - We use small Bedrock models (Haiku) for cost efficiency
   - Cache insights for 7 days to reduce API calls

---

## Troubleshooting

### Issue: "Player not found"
- **Solution:** Verify summoner name and region are correct
- **Note:** Player must have recent match history

### Issue: "Processing timeout"
- **Solution:** Refresh page after 60 seconds
- **Note:** First-time processing takes longer; subsequent visits are cached

### Issue: API returns 500 error
- **Solution:** Check CloudWatch logs in AWS Console
- **Contact:** See GitHub repo issues or email support@example.com

---

## Source Code

**GitHub Repository:** https://github.com/your-username/rift-rewind

- Frontend: `frontend/`
- Backend: `backend/`
- Shared types: `shared/`
- Documentation: `docs/`

**License:** MIT (see `LICENSE` file)

---

## Demo Video

▶️ **3-Minute Demo:** https://youtube.com/watch?v=placeholder

Covers:
- Hero Summary & AI narrative
- Interactive timeline
- Coaching tips
- Roast Mode & Hidden Gems
- Social sharing

---

## Contact

For questions or issues during judging:

- **Email:** support@example.com
- **GitHub Issues:** https://github.com/your-username/rift-rewind/issues
- **Devpost:** https://devpost.com/software/rift-rewind

---

**Thank you for reviewing Rift Rewind!** We hope you enjoy exploring your League season story. 🎮✨
