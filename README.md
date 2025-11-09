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
- Tailwind CSS + Framer Motion (animations)
- D3.js / Visx (data visualizations)
- Hosted on AWS S3 + CloudFront

**Backend:**
- AWS Lambda (Node.js/TypeScript)
- API Gateway (REST endpoints)
- Amazon Bedrock (LLM for narratives)
- Amazon OpenSearch (vector embeddings + RAG)
- AWS Step Functions (orchestration)
- Amazon DynamoDB (data storage)
- Amazon S3 (raw data, cache, assets)

**Data Source:**
- Riot Games League of Legends API (Match-V5)

**Infrastructure:**
- AWS CDK (TypeScript) - Infrastructure as Code
- GitHub Actions (CI/CD)

### Architecture Diagram

`````
┌─────────────┐
│ Riot Games  │
│   API       │
└──────┬──────┘
       │
       v
┌─────────────────────────────────────────────────┐
│              AWS Cloud                           │
│                                                  │
│  ┌──────────┐    ┌────────────┐   ┌──────────┐│
│  │ Lambda   │───▶│ S3 Bucket  │   │ DynamoDB ││
│  │ Ingestion│    │ Raw Data   │   │ Matches  ││
│  └──────────┘    └────────────┘   └──────────┘│
│       │                                         │
│       v                                         │
│  ┌──────────┐    ┌────────────┐                │
│  │ Lambda   │───▶│ OpenSearch │                │
│  │ Process  │    │ Embeddings │                │
│  └──────────┘    └────────────┘                │
│       │                                         │
│       v                                         │
│  ┌──────────┐    ┌────────────┐                │
│  │ Bedrock  │───▶│ S3 Bucket  │                │
│  │ LLM      │    │ Insights   │                │
│  └──────────┘    └────────────┘                │
│       │                                         │
│       v                                         │
│  ┌──────────┐    ┌────────────┐                │
│  │ API      │◀───│ CloudFront │                │
│  │ Gateway  │    │ + S3 Web   │                │
│  └──────────┘    └────────────┘                │
│       │                 ▲                       │
└───────┼─────────────────┼───────────────────────┘
        │                 │
        v                 │
   ┌─────────────────────────┐
   │   React Frontend        │
   │   (User Browser)        │
   └─────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- AWS Account with CLI configured
- Riot Games Developer API Key

### Installation

1. **Clone the repository**
```bash
cd "/home/yash/Rift-Rewind: 2025"
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

4. **Configure environment variables**

Create `backend/.env`:
```env
RIOT_API_KEY=your_riot_api_key_here
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your_aws_account_id
```

Create `frontend/.env`:
```env
VITE_API_URL=http://localhost:3000
```

5. **Deploy AWS infrastructure**
```bash
cd backend
npm run deploy
```

6. **Run frontend locally**
```bash
cd ../frontend
npm run dev
```

Open http://localhost:5173

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

▶️ [Watch Demo on YouTube](https://youtube.com/placeholder) (3 minutes)

---

## 🧠 How It Works

### 1. Data Ingestion
- User provides Riot summoner name/PUUID
- Lambda fetches full-year match history via Riot API
- Raw match data stored in S3
- Rate limiting + caching to respect API limits

### 2. Data Processing
- Extract per-match stats (KDA, CS, gold, vision, objectives)
- Compute aggregates (win rate, trends, champion mastery)
- Create match fragments for RAG (early game, teamfights, objectives)

### 3. AI Generation
- Generate embeddings for match fragments (Amazon Bedrock)
- Index embeddings in OpenSearch vector database
- Retrieve relevant evidence using semantic search
- Generate insights using Amazon Bedrock LLM:
  - Hero Summary (season narrative)
  - Coaching tips (actionable improvements)
  - Playstyle analysis
  - Roast/Hidden Gems (fun modes)

### 4. Caching & Optimization
- Cache LLM outputs in S3/DynamoDB
- Batch processing via Step Functions
- Cost optimization through small models + smart prompting

### 5. Frontend Rendering
- Interactive timeline with smooth animations
- Match detail cards with evidence linking
- Social share card generator (Canvas API)
- Responsive, accessible design

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

See [TESTING.md](./docs/TESTING.md) for detailed testing instructions.

**Quick test:**
```bash
# Test with demo account
curl https://api.rift-rewind.example.com/player/demo

# Or use the web UI
# Navigate to https://rift-rewind.example.com
# Click "Try Demo" button
```

**Demo accounts:**
- `demo-player-1`: Mid lane main, steady improvement
- `demo-player-2`: Support main, vision specialist
- `demo-player-3`: ADC main, comeback king

---

## 📊 AWS Services Used

- **Amazon Bedrock**: LLM for narrative generation and insights
- **Amazon OpenSearch**: Vector embeddings and semantic search
- **AWS Lambda**: Serverless compute for data processing and APIs
- **Amazon DynamoDB**: NoSQL database for user data and matches
- **Amazon S3**: Object storage for raw data, cache, and static assets
- **AWS Step Functions**: Orchestration of multi-step pipelines
- **Amazon API Gateway**: REST API endpoints
- **Amazon CloudFront**: CDN for fast global delivery
- **Amazon Cognito**: User authentication (optional)
- **AWS CloudWatch**: Monitoring and logging
- **AWS X-Ray**: Distributed tracing
- **AWS IAM**: Security and access control
- **AWS CDK**: Infrastructure as Code

---

## 💰 Cost Optimization

- Small Bedrock models (cost-effective)
- Aggressive caching (precompute outputs)
- Batch processing (reduce API calls)
- Rate limiting (respect Riot API)
- DynamoDB on-demand pricing
- Lambda cold start optimization

**Estimated cost for hackathon:** ~$20-50 with AWS credits

---

## 🔒 Security & Privacy

- API keys stored in AWS Secrets Manager
- Encryption at rest (S3, DynamoDB) with KMS
- Encryption in transit (HTTPS only)
- Least-privilege IAM roles
- No PII storage (hashed player IDs)
- Rate limiting + DDoS protection (CloudFront)

---

## 📝 License

MIT License - See [LICENSE](./LICENSE)

---

## 👥 Team

Built with ❤️ for AWS Rift Rewind Hackathon 2025

---

## 🙏 Acknowledgments

- **AWS** for hosting the hackathon and providing credits
- **Riot Games** for the League of Legends API
- **Devpost** for the platform

---

## 📧 Contact

Questions? [support@example.com](mailto:support@example.com)

**Devpost:** [View Submission](https://devpost.com/software/rift-rewind)

---

**⭐ If you find this project interesting, please star the repo!**
