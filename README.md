# Smart Lead Ranker

Turn a messy list of companies into a ranked, cleaned, explained call list — so a salesperson knows **who to contact first and why**.

## What It Does

Smart Lead Ranker takes a CSV of company names and websites, enriches each one using Apollo.io, Hunter.io, and web scraping, scores them against your Ideal Customer Profile (ICP), and produces a ranked call list with transparent reasons for every score.

**Edge over typical lead tools:**
- Scoring against **your own** target customer profile, not a generic algorithm
- AI-powered **reason for every score** via Gemini LLM — no black-box
- **Multi-source enrichment**: Apollo.io + Hunter.io + web scraping for 90%+ accuracy
- Honest **data-quality labels** (high / medium / low) and completeness percentages
- HubSpot-compatible CSV export for seamless CRM integration
- Ethical data collection — respects robots.txt, no CAPTCHA bypass

## How It Works

1. **Define your ICP** — industry keywords, company size, region, target roles
2. **Upload a CSV** — company names + websites (sample data included)
3. **Auto-enrichment** — scrapes websites, calls Apollo/Hunter APIs, validates emails via MX
4. **AI scoring** — deterministic 0-100 score + Gemini-generated insights
5. **Ranked call list** — sorted by priority with one-click export

## Setup

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/KJ-Patil/smart-lead-ranker.git
cd smart-lead-ranker
npm install
cp .env.example .env.local
# Edit .env.local with your API keys (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_PROVIDER` | No | `mock` (default), `gemini`, or `groq` |
| `GEMINI_API_KEY` | For AI insights | Free from [Google AI Studio](https://aistudio.google.com/apikey) |
| `GROQ_API_KEY` | For Groq LLM | Free from [Groq Console](https://console.groq.com/keys) |
| `APOLLO_API_KEY` | For enrichment | Free tier: 10K credits/month from [Apollo.io](https://app.apollo.io) |
| `HUNTER_API_KEY` | For email lookup | Free tier: 25 searches/month from [Hunter.io](https://hunter.io/api-keys) |
| `NEXT_PUBLIC_SUPABASE_URL` | For persistence | From [Supabase](https://supabase.com) dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For persistence | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | For persistence | Supabase service role key |

**The app works fully without any API keys** — uses mock LLM + web scraping only. Each API key you add increases accuracy.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend                         │
│  Next.js 16 App Router + React 19 + Tailwind 4     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ ICP Form │  │CSV Upload│  │ 3-Panel Dashboard│  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
└───────┼──────────────┼────────────────┼─────────────┘
        │              │                │
┌───────▼──────────────▼────────────────▼─────────────┐
│                  API Routes (Serverless)             │
│  POST /api/icp    POST /api/leads    GET /api/export│
│  POST /api/enrich GET /api/jobs/:id  PATCH/DELETE   │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│               Enrichment Engine                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │Apollo.io │  │Hunter.io │  │Web Scraper       │  │
│  │(contacts)│  │(emails)  │  │(Cheerio+robots)  │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       └──────────────┴────────────────┘             │
│                      │                              │
│  ┌──────────┐  ┌─────▼─────┐  ┌──────────────────┐ │
│  │MX Verify │  │ Scoring   │  │ Gemini LLM       │ │
│  │(DNS API) │  │ (0-100)   │  │ (AI insights)    │ │
│  └──────────┘  └───────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│              Supabase (PostgreSQL)                   │
│  icp_profiles │ leads │ enrichment_cache │ jobs     │
│  (In-memory fallback when Supabase not configured)  │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 16.4 (App Router) | Serverless API routes + SSR |
| Language | TypeScript 5.x | Type safety across stack |
| Styling | Tailwind CSS 4 | Claymorphism UI design |
| Database | Supabase (PostgreSQL) | Persistent storage + RLS |
| Scraping | fetch + Cheerio | Lightweight HTML parsing |
| Enrichment | Apollo.io + Hunter.io APIs | Verified contacts & company data |
| LLM | Gemini 3.5 Flash (fallback chain) | AI-generated insights |
| Validation | Zod | Runtime schema validation |
| CSV | PapaParse | Client-side CSV parsing |
| Testing | Vitest | Unit tests for scoring + utils |
| Hosting | Vercel (serverless) | Zero-config deployment |

## Scoring System (0-100)

Deterministic, rule-based scoring — the LLM never changes the score, only explains it.

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| ICP Match | 30% | Industry keyword overlap (word-boundary matching) |
| Hiring Signal | 20% | Job listings, "we're hiring" language on careers page |
| Contactability | 20% | MX-verified emails + phone numbers from tel: links |
| Size Fit | 15% | Employee count vs. your target range (filters out customer/revenue counts) |
| Data Completeness | 15% | How many data fields were successfully extracted |

## Data Enrichment Pipeline

**3-source layered enrichment for maximum accuracy:**

1. **Apollo.io** (primary) — verified emails, direct phone numbers, employee count, industry classification
2. **Hunter.io** (secondary) — additional verified work emails from company domains
3. **Web Scraping** (fallback) — hiring signals, keyword matches, summary, size signals from company websites

Data from APIs takes priority. Web scraping fills gaps. All sources are optional — the app degrades gracefully.

**Scraper accuracy measures:**
- Extracts emails from `mailto:` links and visible text only (strips `<script>`, `<style>`, `<noscript>`)
- Only keeps emails matching the company domain
- Phone numbers only from `tel:` links and contact/footer sections
- Employee counts validated against surrounding context (filters out "customers", "users", "downloads")
- Keyword matching uses word boundaries (case-insensitive)

## Caching & Performance

- **Enrichment cache**: keyed by domain, 7-day TTL — no site is scraped twice
- **Batch processing**: 5 leads at a time with background job queue
- **Per-domain rate limiting**: 2-second minimum between requests to the same domain
- **Retry with exponential backoff**: up to 2 retries on failed fetches
- **LLM model fallback**: gemini-3.5-flash → gemini-3.8-flash → gemini-3.7-flash
- **Force re-enrich**: clears cache and re-scrapes all leads with fresh data

## Export Formats

| Format | Description |
|--------|-------------|
| **Standard CSV** | All lead data with scores, emails, phones |
| **HubSpot CSV** | CRM-ready format with mapped field names |
| **Top-10 Report** | Markdown summary of best leads with outreach angles |

## Ethical Data Collection

- **robots.txt**: respected before any page fetch
- **Public data only**: only publicly listed business information is collected
- **No login-walled sites**: never accesses data behind authentication
- **No CAPTCHA bypass**: blocked pages are marked "needs manual review"
- **Data deletion**: users can delete individual leads
- **Realistic User-Agent**: identifies itself honestly
- **MX disclaimer**: shown in UI — confirms domain can receive mail, not that a mailbox exists

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy — serverless functions handle all API routes

```bash
npm run build  # Verify locally first
```

## Running Tests

```bash
npx vitest run
```

Tests cover: domain normalization, deduplication, email validation, scoring engine, and LLM JSON schema validation.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── icp/route.ts          # ICP CRUD
│   │   ├── leads/route.ts        # CSV upload + list
│   │   ├── leads/[id]/route.ts   # Lead PATCH/DELETE
│   │   ├── enrich/route.ts       # Background enrichment + force re-enrich
│   │   ├── jobs/[id]/route.ts    # Job progress polling
│   │   └── export/route.ts       # CSV, HubSpot, summary report
│   ├── globals.css               # Claymorphism design system
│   ├── layout.tsx
│   └── page.tsx                  # 3-panel dashboard
├── components/
│   ├── icp-form.tsx              # Target customer form
│   ├── csv-upload.tsx            # Drag-and-drop CSV upload
│   ├── stepper.tsx               # 3-step progress stepper
│   ├── lead-table.tsx            # Sortable ranked lead table
│   ├── lead-drawer.tsx           # Lead detail side panel
│   └── progress-bar.tsx          # Enrichment progress
├── lib/
│   ├── types.ts                  # TypeScript interfaces
│   ├── utils.ts                  # Domain normalization, dedupe, validation
│   ├── scraper.ts                # Web scraper (Cheerio + robots.txt)
│   ├── api-enrichment.ts         # Apollo.io + Hunter.io integration
│   ├── scoring.ts                # Deterministic 0-100 scoring
│   ├── llm.ts                    # Gemini/Groq with model fallback
│   ├── store.ts                  # Supabase-first, in-memory fallback
│   └── supabase.ts               # Lazy Supabase client
├── data/
│   └── sample-leads.csv          # 30 real SaaS companies for testing
├── __tests__/
│   ├── utils.test.ts
│   ├── scoring.test.ts
│   └── llm.test.ts
├── .env.example                  # All configurable API keys
└── vitest.config.ts
```
