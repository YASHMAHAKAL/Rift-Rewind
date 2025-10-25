# Detailed Architecture

## System Overview

Rift Rewind is a serverless, event-driven application built on AWS that processes League of Legends match data and generates personalized AI insights.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│                   (React + TypeScript)                           │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CloudFront (CDN)                              │
│              S3 Origin (Frontend Hosting)                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ API Calls
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API Gateway (REST)                             │
│                /player/{id}/insights                             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Lambda Proxy
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Lambda Functions                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Ingestion│→ │Processing│→ │    AI    │→ │   API    │       │
│  │  (Riot)  │  │  (Stats) │  │ (Bedrock)│  │ (Public) │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└────────────┬─────────┬─────────┬─────────┬──────────────────────┘
             │         │         │         │
             ▼         ▼         ▼         ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Data Layer                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ S3 Raw   │  │ S3 Proc  │  │ DynamoDB │  │OpenSearch│        │
│  │  Data    │  │  Data    │  │ (Tables) │  │ (Vectors)│        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
             │                   │
             ▼                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     External Services                             │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  Riot Games API  │         │ Amazon Bedrock   │              │
│  │  (Match Data)    │         │ (LLM + Embeddings)│              │
│  └──────────────────┘         └──────────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### Frontend (React + TypeScript)

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Framer Motion (animations)
- D3.js / Visx (data visualizations)
- React Router (routing)
- TanStack Query (data fetching)

**Key Pages:**
1. **Landing Page** (`/`)
   - Hero section with animated background
   - CTA buttons
   - Feature highlights

2. **Dashboard** (`/dashboard`)
   - Player search
   - Data fetching UI
   - Progress indicators

3. **Timeline** (`/timeline`)
   - Interactive match history visualization
   - Clickable match dots
   - Smooth animations

4. **Player Detail** (`/player/:id`)
   - Hero Summary
   - Coaching Tips
   - Playstyle Radar
   - Roast Mode / Hidden Gems
   - Social share generator

**Build & Deploy:**
```bash
cd frontend
npm install
npm run build
aws s3 sync dist/ s3://bucket-name
```

---

### Backend (AWS CDK + Lambda)

**Infrastructure as Code:**
- AWS CDK (TypeScript)
- Automated deployment
- Tag all resources: `rift-rewind-hackathon: 2025`

**Lambda Functions:**

#### 1. Ingestion Lambda
- **Trigger:** Manual invocation or scheduled
- **Runtime:** Node.js 18
- **Memory:** 512 MB
- **Timeout:** 60s
- **Purpose:** Fetch match data from Riot API
- **Flow:**
  1. Receive player PUUID
  2. Call Riot Match-V5 API with rate limiting
  3. Store raw JSON in S3 (`raw-bucket/player-id/match-id.json`)
  4. Invoke Processing Lambda

#### 2. Processing Lambda
- **Trigger:** S3 PUT event (raw data)
- **Runtime:** Node.js 18
- **Memory:** 1024 MB
- **Timeout:** 300s
- **Purpose:** Compute statistics and create fragments
- **Flow:**
  1. Read raw match JSON from S3
  2. Extract per-match stats (KDA, CS/min, etc.)
  3. Compute aggregates (win rate, trends)
  4. Create match fragments (early/mid/late game)
  5. Store in DynamoDB (`matches` table)
  6. Store fragments in S3 (`processed-bucket/fragments/`)
  7. Invoke AI Lambda

#### 3. AI Lambda
- **Trigger:** SQS message (from Processing Lambda)
- **Runtime:** Node.js 18
- **Memory:** 1024 MB
- **Timeout:** 120s
- **Purpose:** Generate embeddings and AI insights
- **Flow:**
  1. Read match fragments from S3
  2. Generate embeddings (Bedrock Titan)
  3. Index in OpenSearch (vector store)
  4. Retrieve top-k relevant fragments (RAG)
  5. Generate insights (Bedrock Claude):
     - Hero Summary
     - Coaching Tips
     - Roast Mode
     - Hidden Gems
  6. Cache in DynamoDB (`insights` table, TTL=7 days)
  7. Store in S3 (`processed-bucket/insights/`)

#### 4. API Lambda
- **Trigger:** API Gateway (HTTP request)
- **Runtime:** Node.js 18
- **Memory:** 512 MB
- **Timeout:** 30s
- **Purpose:** Public REST API
- **Endpoints:**
  - `GET /player/{playerId}` - Player profile + stats
  - `GET /player/{playerId}/matches` - Match history
  - `GET /player/{playerId}/insights` - AI insights
- **Flow:**
  1. Check cache (DynamoDB insights table)
  2. If fresh (< 7 days), return cached
  3. If stale, trigger AI Lambda and return processing status
  4. Return JSON response with CORS headers

---

### Data Storage

#### S3 Buckets

1. **Raw Data Bucket** (`rift-rewind-raw-{account}`)
   - Stores raw match JSON from Riot API
   - Structure: `player-id/match-id.json`
   - Lifecycle: Delete after 30 days (optional)

2. **Processed Data Bucket** (`rift-rewind-processed-{account}`)
   - Stores:
     - Match fragments (`fragments/player-id/match-id-phase.json`)
     - Embeddings (`embeddings/player-id/match-id-phase.npy`)
     - Cached insights (`insights/player-id.json`)
   - Lifecycle: Keep indefinitely (cost-optimized)

3. **Frontend Bucket** (`rift-rewind-frontend-{account}`)
   - Hosts static website (HTML, JS, CSS)
   - Origin for CloudFront

#### DynamoDB Tables

1. **Players Table** (`rift-rewind-players`)
   - **Partition Key:** `playerId` (String)
   - **Attributes:**
     - `puuid` (String, indexed via GSI)
     - `summonerName` (String)
     - `region` (String)
     - `createdAt` (ISO timestamp)
     - `lastUpdated` (ISO timestamp)
   - **GSI:** `puuid-index` for lookup by PUUID

2. **Matches Table** (`rift-rewind-matches`)
   - **Partition Key:** `playerId` (String)
   - **Sort Key:** `matchId` (String)
   - **Attributes:**
     - `gameCreation` (Number, Unix timestamp)
     - `gameDuration` (Number, seconds)
     - `win` (Boolean)
     - `kills`, `deaths`, `assists` (Numbers)
     - `championName` (String)
     - `stats` (Map, nested stats)

3. **Insights Table** (`rift-rewind-insights`)
   - **Partition Key:** `playerId` (String)
   - **Attributes:**
     - `heroSummary` (Map)
     - `coachingTips` (List)
     - `playstyleRadar` (Map)
     - `roastMode` (Map, optional)
     - `hiddenGems` (List, optional)
     - `generatedAt` (ISO timestamp)
     - `expiryTime` (Number, Unix timestamp, TTL attribute)

#### OpenSearch (Vector Index)

- **Domain:** `rift-rewind-vectors`
- **Index:** `match-fragments`
- **Schema:**
  ```json
  {
    "mappings": {
      "properties": {
        "fragmentId": { "type": "keyword" },
        "playerId": { "type": "keyword" },
        "matchId": { "type": "keyword" },
        "phase": { "type": "keyword" },
        "description": { "type": "text" },
        "embedding": { "type": "knn_vector", "dimension": 1536 }
      }
    }
  }
  ```
- **Use:** Semantic search for RAG retrieval

---

### AI Integration (Amazon Bedrock)

#### Models Used

1. **Titan Embeddings** (`amazon.titan-embed-text-v1`)
   - **Purpose:** Generate vector embeddings for match fragments
   - **Input:** Fragment description (text)
   - **Output:** 1536-dimensional vector
   - **Cost:** ~$0.0001 per 1K tokens

2. **Claude 3 Haiku** (`anthropic.claude-3-haiku-20240307-v1:0`)
   - **Purpose:** Generate insights (Hero Summary, Coaching Tips, etc.)
   - **Input:** Prompt + retrieved evidence (RAG)
   - **Output:** Structured JSON response
   - **Cost:** ~$0.25 per 1M input tokens, ~$1.25 per 1M output tokens

#### Prompt Templates

**Hero Summary:**
```
You are a League of Legends analyst. Generate a 30-second narrative...
[context: player stats, top fragments from RAG]
Output: 100-150 word story.
```

**Coaching Tips:**
```
Based on weaknesses: [list]
Evidence: [top-k fragments]
Generate 3 actionable tips with:
1. Drill
2. Measurable goal
3. Why it matters
```

---

### Deployment Pipeline (CI/CD)

**GitHub Actions Workflows:**

1. **deploy-frontend.yml**
   - Trigger: Push to `main` (frontend/ changes)
   - Steps: Build → Upload to S3 → Invalidate CloudFront

2. **deploy-backend.yml**
   - Trigger: Push to `main` (backend/ changes)
   - Steps: Build TypeScript → CDK Deploy

**Secrets Required:**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`
- `FRONTEND_BUCKET_NAME`
- `CLOUDFRONT_DISTRIBUTION_ID`
- `API_URL`

---

### Security

- **Encryption at Rest:** S3 (SSE-S3), DynamoDB (AWS-managed)
- **Encryption in Transit:** HTTPS only (CloudFront, API Gateway)
- **IAM:** Least-privilege roles for Lambda
- **API Keys:** Stored in Secrets Manager (Riot API key)
- **CORS:** Configured on API Gateway
- **Rate Limiting:** Implemented in Riot API client

---

### Cost Optimization

- **Small Models:** Claude Haiku (not Sonnet) for cost efficiency
- **Aggressive Caching:** 7-day TTL on insights
- **DynamoDB On-Demand:** Pay per request (no provisioned capacity)
- **Lambda:** Pay per invocation (no idle cost)
- **S3 Lifecycle:** Auto-delete old raw data

**Estimated Monthly Cost (100 users):**
- Bedrock: ~$5
- Lambda: ~$2
- DynamoDB: ~$3
- S3: ~$1
- OpenSearch: ~$10 (t3.small.search instance)
- CloudFront: ~$2
- **Total: ~$23/month**

---

### Monitoring & Observability

- **CloudWatch Logs:** All Lambda functions
- **CloudWatch Metrics:** Invocation count, duration, errors
- **X-Ray Tracing:** Distributed tracing (optional)
- **Custom Metrics:** Track Bedrock API calls, cache hit rate

---

## Development Workflow

### Local Development

```bash
# Frontend
cd frontend
npm install
npm run dev  # http://localhost:5173

# Backend
cd backend
npm install
npm run build
npm run cdk synth  # Preview CloudFormation
```

### Deployment

```bash
# Deploy infrastructure
cd backend
npm run deploy

# Upload frontend
cd frontend
npm run build
aws s3 sync dist/ s3://bucket-name
```

### Testing

```bash
# Unit tests (TODO)
npm test

# Integration tests (TODO)
npm run test:integration

# Load testing
ab -n 100 -c 10 https://api.example.com/prod/player/demo
```

---

## Future Enhancements

1. **Real-time Updates:** WebSocket support for live match tracking
2. **Social Features:** Compare with friends, leaderboards
3. **Advanced RAG:** Re-ranking models, hybrid search
4. **Multimodal:** Analyze replay videos (computer vision)
5. **Mobile App:** Native iOS/Android apps
6. **Fine-tuning:** Custom LLM on League coaching corpus

---

**Questions?** See [README.md](../README.md) or open a GitHub issue.
