# Rift Rewind: Interactive Yearbook

**Your Season, Your Story — League of Legends AI-Powered Year-in-Review**

A visually stunning, AI-powered web application that transforms a League of Legends player's full-year match history into a personalized, interactive yearbook with coaching insights, storytelling, and shareable social content.

🏆 **Built for AWS Rift Rewind Hackathon 2025**

---

## 🎯 What It Does

- **Hero Summary**: AI-generated 30-second narrative of your League season
- **Interactive Timeline**: Animated, clickable match history with detailed insights
- **AI Coaching**: Actionable improvement tips based on your performance data
- **Playstyle Radar**: Visual breakdown of your strengths and weaknesses
- **Roast Master 3000**: Playful, constructive critiques with personality
- **Hidden Gem Detector**: Discover your underrated strengths
- **Social Sharing**: Generate beautiful cards for Twitter/Discord

---

## 🏗️ Architecture

### Tech Stack

**Frontend:**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui components
- Recharts (data visualizations)
- React Router (navigation)
- html2canvas + jsPDF (PDF generation)
- Hosted on AWS S3 + CloudFront CDN

**Backend:**
- AWS Lambda (Node.js/TypeScript)
- API Gateway (REST endpoints)
- Amazon Bedrock (Claude 3 Haiku - LLM for AI insights)
- Amazon DynamoDB (3 tables: Players, Matches, Insights)
- Riot Games API client with rate limiting

**Data Source:**
- Riot Games League of Legends API (Match-V5, Summoner-V4)

**Infrastructure:**
- AWS CDK (TypeScript) - Infrastructure as Code
- GitHub Actions (CI/CD with automated deployments)
- Docker bundling for Lambda dependencies

### Architecture Diagram

```
┌─────────────┐
│ Riot Games  │
│   API       │
└──────┬──────┘
       │
       v
┌──────────────────────────────────────────────────────┐
│              AWS Cloud (us-east-1)                    │
│                                                       │
│  ┌──────────────┐         ┌────────────────┐        │
│  │ API Gateway  │◀────────│  CloudFront    │        │
│  │ REST API     │         │  CDN           │        │
│  └──────┬───────┘         └────────┬───────┘        │
│         │                          │                 │
│         v                          v                 │
│  ┌──────────────────────────────────────┐           │
│  │         Lambda Functions             │           │
│  │  ┌──────────┐  ┌──────────┐         │           │
│  │  │Ingestion │  │Processing│         │           │
│  │  │(Riot API)│  │(Analysis)│         │           │
│  │  └────┬─────┘  └────┬─────┘         │           │
│  │       │             │                │           │
│  │  ┌────v─────┐  ┌───v──────┐         │           │
│  │  │   AI     │  │   API    │         │           │
│  │  │(Bedrock) │  │(Handlers)│         │           │
│  │  └────┬─────┘  └──────────┘         │           │
│  └───────┼────────────────────────────┘           │
│          │                                         │
│          v                                         │
│  ┌──────────────────────────────┐                 │
│  │      Amazon DynamoDB          │                 │
│  │  ┌──────────┐ ┌──────────┐   │                 │
│  │  │ Players  │ │ Matches  │   │                 │
│  │  │  Table   │ │  Table   │   │                 │
│  │  └──────────┘ └──────────┘   │                 │
│  │  ┌──────────┐                │                 │
│  │  │ Insights │                │                 │
│  │  │  Table   │                │                 │
│  │  └──────────┘                │                 │
│  └──────────────────────────────┘                 │
│                                                    │
│  ┌──────────────────────────────┐                 │
│  │         S3 Bucket             │                 │
│  │   (Frontend Static Hosting)   │                 │
│  │   - index.html                │                 │
│  │   - React app bundles         │                 │
│  │   - Assets & images           │                 │
│  └──────────────────────────────┘                 │
│                                                    │
└────────────────────────────────────────────────────┘
                    │
                    v
           ┌─────────────────┐
           │  React Frontend │
           │  (User Browser) │
           └─────────────────┘
```

---

## 🚀 Quick Start

### Live Demo

🌐 **Production URL:** https://d2c0pe955in7w2.cloudfront.net

### Prerequisites

- Node.js 18+ and npm
- AWS Account with CLI configured
- Riot Games Developer API Key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YASHMAHAKAL/Rift-Rewind.git
cd Rift-Rewind
```

2. **Install frontend dependencies**
```bash
cd frontend
npm install
```

3. **Install backend dependencies**
```bash
cd ../backend
npm install
```

4. **Configure Riot API Key**

Add your Riot API key to AWS Secrets Manager or Lambda environment variables:
```bash
aws secretsmanager create-secret \
  --name RiotApiKey \
  --secret-string "your_riot_api_key_here" \
  --region us-east-1
```

5. **Deploy AWS infrastructure**
```bash
cd backend
npm run build
cdk deploy --all
```

6. **Deploy frontend**
```bash
cd ../frontend
npm run build
# Frontend automatically deployed via GitHub Actions on push
```

7. **Run frontend locally (development)**
```bash
cd frontend
npm run dev
# Opens on http://localhost:3000 (or next available port)
```

---

## 📁 Project Structure

```
rift-rewind/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utility functions
│   │   └── types/         # TypeScript types
│   ├── public/            # Static assets
│   └── package.json
│
├── backend/               # AWS CDK + Lambda functions
│   ├── lib/               # CDK stack definitions
│   ├── lambda/            # Lambda function code
│   │   ├── ingestion/     # Riot API data ingestion
│   │   ├── processing/    # Data processing
│   │   ├── ai/            # Bedrock integration
│   │   └── api/           # API handlers
│   ├── bin/               # CDK app entry point
│   └── package.json
│
├── shared/                # Shared code between frontend/backend
│   ├── types/             # TypeScript types
│   ├── schemas/           # JSON schemas
│   └── utils/             # Shared utilities
│
├── docs/                  # Documentation
│   ├── METHODOLOGY.md     # AI methodology (for Devpost)
│   ├── TESTING.md         # Testing instructions
│   └── ARCHITECTURE.md    # Detailed architecture
│
├── .github/
│   └── workflows/         # CI/CD pipelines
│       ├── deploy-frontend.yml
│       └── deploy-backend.yml
│
├── README.md              # This file
└── LICENSE                # MIT License
```

---

## 🎬 Demo Video

▶️ Demo video coming soon (will be added before Devpost submission)

---

## 🧠 How It Works

### 1. Data Ingestion (`/ingest` endpoint)
- User enters summoner name and region on dashboard
- Ingestion Lambda fetches player profile via Riot API (Summoner-V4)
- Retrieves match history (up to 50 recent matches)
- Stores player data in DynamoDB Players table
- Stores individual match data in DynamoDB Matches table
- Rate limiting implemented to respect Riot API limits

### 2. Data Processing (Processing Lambda)
- Extracts per-match statistics:
  - KDA (Kills, Deaths, Assists)
  - CS (Creep Score) and CS/min
  - Gold earned, damage dealt
  - Vision score, wards placed
  - Champion played, role, lane
- Computes aggregate statistics:
  - Overall win rate and trends
  - Champion mastery and most played
  - Performance metrics (avg KDA, avg CS, etc.)
  - Strengths and weaknesses identification

### 3. AI Insight Generation (AI Lambda + Bedrock)
- Uses Amazon Bedrock with Claude 3 Haiku model
- Generates personalized insights:
  - **Season Summary**: 200-word narrative of player's journey
  - **Top Achievements**: 3 highlighted successes
  - **Improvement Areas**: 3 actionable coaching tips
  - **Playstyle Analysis**: Detailed breakdown with radar chart data
  - **Hidden Gems**: Non-obvious strengths discovered
  - **Fun Roasts**: Playful, constructive critique
- Insights cached in DynamoDB Insights table

### 4. API Delivery (API Lambda + API Gateway)
- RESTful endpoints:
  - `GET /profile/{puuid}` - Player profile data
  - `GET /matches/{puuid}` - Match history
  - `GET /insights/{puuid}` - AI-generated insights
  - `POST /ingest` - Trigger data ingestion
- CORS enabled for frontend access
- Error handling with proper status codes

### 5. Frontend Rendering
- **Landing Page**: Hero section with call-to-action
- **Dashboard**: Search interface for player lookup
- **Player Detail Page**: 
  - Interactive statistics with Recharts visualizations
  - Radar chart for playstyle analysis
  - Champion performance cards
  - AI insights display
  - Shareable PDF card generation (html2canvas + jsPDF)
- Smooth animations and responsive design
- Glass morphism UI effects with Tailwind CSS

---

## 🏅 Hackathon Judging Criteria

| Criteria | How We Address It |
|----------|-------------------|
| **Insight Quality** | Evidence-backed insights from real match data, actionable coaching tips, explainability |
| **Technical Execution** | Production-ready architecture, error handling, monitoring, IaC with CDK |
| **Creativity & UX** | Cinematic animations, interactive timeline, story mode, playful features |
| **AWS Integration** | Deep usage: Bedrock, OpenSearch, Step Functions, Lambda, DynamoDB, S3, CloudFront |
| **Unique & Vibes** | Yearbook metaphor, Roast Mode, Hidden Gems, social sharing |

---

## 🎁 Bonus Prize Targets

- **Model Whisperer Prize**: Prompt engineering ablation, small model optimization
- **Roast Master 3000**: Constructive humor with safety guardrails
- **Hidden Gem Detector**: Statistical discovery algorithm for non-obvious strengths
- **Chaos Engineering**: Load testing, resilience demonstrations

---

## 🧪 Testing

**Live Production Testing:**

1. Visit: https://d2c0pe955in7w2.cloudfront.net
2. Enter any valid League of Legends summoner name
3. Select region (NA, EUW, KR, etc.)
4. Click "Analyze Player"
5. View AI-generated insights and statistics

**API Testing:**

```bash
# Test API endpoint health
curl https://zwhnu7r1yc.execute-api.us-east-1.amazonaws.com/prod/

# Ingest player data (replace with valid summoner name)
curl -X POST https://zwhnu7r1yc.execute-api.us-east-1.amazonaws.com/prod/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "summonerName": "Hide on bush",
    "region": "KR",
    "maxMatches": 20
  }'

# Get player insights (replace {puuid} with actual PUUID)
curl https://zwhnu7r1yc.execute-api.us-east-1.amazonaws.com/prod/insights/{puuid}
```

See [TESTING.md](./docs/TESTING.md) for detailed testing documentation.

---

## 📊 AWS Services Used

- **Amazon Bedrock**: Claude 3 Haiku for AI-powered narrative generation and insights
- **AWS Lambda**: 4 serverless functions (Ingestion, Processing, AI, API handlers)
- **Amazon DynamoDB**: 3 NoSQL tables (Players, Matches, Insights) with on-demand pricing
- **Amazon S3**: Static website hosting for React frontend
- **Amazon API Gateway**: REST API with CORS support
- **Amazon CloudFront**: Global CDN for fast content delivery
- **AWS CloudWatch**: Monitoring, logging, and metrics
- **AWS IAM**: Security and least-privilege access control
- **AWS CDK**: Infrastructure as Code (TypeScript)
- **AWS Secrets Manager**: Secure API key storage (recommended)

**Total Services:** 10 AWS services integrated

---

## 💰 Cost Optimization

- **Claude 3 Haiku**: Cost-effective model (~$0.25 per 1M input tokens)
- **Insight caching**: DynamoDB stores generated insights to avoid re-processing
- **DynamoDB on-demand**: Pay only for actual reads/writes
- **Lambda optimization**: Efficient code with minimal cold starts
- **Docker bundling**: Only necessary dependencies packaged
- **Rate limiting**: Respect Riot API limits, avoid unnecessary calls
- **CloudFront caching**: Reduces S3 read requests

**Estimated cost with AWS credits:** ~$10-30 for hackathon duration

---

## 🔒 Security & Privacy

- **HTTPS Only**: CloudFront enforces SSL/TLS encryption in transit
- **IAM Roles**: Lambda functions use least-privilege IAM roles
- **DynamoDB Encryption**: Data encrypted at rest by default
- **CORS Configuration**: Strict origin policies on API Gateway
- **No PII Storage**: Only public Riot data (PUUID, summoner names)
- **Rate Limiting**: Riot API client respects rate limits
- **CloudFront Protection**: DDoS protection and geographic restrictions available

---

## 📝 License

MIT License - See [LICENSE](./LICENSE)

---

## 👥 Team

**Solo Developer:** Yash Mahakal (@YASHMAHAKAL)

Built with ❤️ for AWS Rift Rewind Hackathon 2025

---

## 🙏 Acknowledgments

- **AWS** for hosting the hackathon and providing credits
- **Riot Games** for the League of Legends API
- **Devpost** for the platform

---

## 📧 Contact

**GitHub:** [@YASHMAHAKAL](https://github.com/YASHMAHAKAL)  
**Devpost:** Coming soon (will be added after submission)

---

**⭐ If you find this project interesting, please star the repo!**
