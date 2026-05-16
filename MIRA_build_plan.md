# M.I.R.A. — Market Intelligence & Research Agent — Build Plan

> **Builder note**: This plan is self-contained. You do not need to read the assessment PDF — every requirement from the brief is restated here. Execute the phases in order. After the build is complete, run the full test/verification suite in the last section before pushing.

---

## 1. Context

This implements the **Uniparticle Engineering Assessment (CS-001, Rev. B)** — a take-home AI Engineer brief to design, build, and containerize a fully autonomous AI agent codenamed **M.I.R.A.** that:

- Monitors equity markets
- Performs deep research on specific publicly-traded companies
- Generates structured, data-driven investment analysis reports
- Demonstrates **advanced agentic behavior** — autonomously deciding *what* research to perform, *which* tools to use, and *how* to synthesize structured market data + unstructured news into a coherent report

**Time budget**: assessment caps at 48 hours total; <24 hours is graded favorably. Build phases are sized accordingly.

**Branch**: All work happens on `claude/assessment-project-ai-dsFy2`. Final push to this branch only.

---

## 2. Brief requirements (full restatement so you don't need the PDF)

### 2.1 MANDATORY — Core (Section 2 of brief)

**A. Backend Architecture & Service Design**
- Runnable, self-contained Python backend service (FastAPI)
- `POST /analyze` accepting a natural-language user query (e.g., `"Analyze the near-term prospects of Tesla, Inc. (TSLA)."`)
- Analysis runs in a distinct async Agent Service (separate worker process)
- Endpoint returns `job_id` immediately
- `GET /status/{job_id}` for status checks
- All final output as predictable structured JSON (Pydantic models)
- Config via env vars (LLM provider, model name, polling intervals, etc.)

**B. Agentic Behavior & Tool Use**
- Multi-step planning (Chain-of-Thought or explicit planning)
- ≥3 distinct tools via function calling
- Agent picks next tool based on query + prior tool results
- **Tool 1 Market Data**: structured market data for target ticker — price, daily change, volume, market cap, P/E, 52-week range, recent quarterly revenues. Source: yfinance
- **Tool 2 News Retriever & Sentiment**: 5 most recent, relevant news articles + sentiment distribution (positive/negative/neutral) + per-article sentiment tags. Source: NewsAPI.org. Trade-off (LLM-as-sentiment vs FinBERT/VADER) **must be documented in README**
- **Tool 3 Peer & Market Correlation**: simulates fetching structured financial data (mock API returning last two quarterly revenues OR recent stock price)

**C. Output Structure — JSON, minimum fields**

| Field | Type | Description |
|---|---|---|
| `company_ticker` | String | e.g. "TSLA" |
| `company_name` | String | Full registered name |
| `analysis_summary` | String | Concise paragraph synthesizing all findings |
| `sentiment_score` | Float | Derived score in [-1.0, 1.0] |
| `market_snapshot` | Object | price, daily_change, market_cap, pe, 52w_range, last_two_quarterly_revenues |
| `correlation_analysis` | Object | Correlation vs S&P 500, sector ETF, peer(s) — peer plural |
| `key_findings` | String[] | **Top 3 actionable insights** — exactly 3 |
| `tools_used` | String[] | Tool names **in order of invocation** |
| `citation_sources` | URL[] | **All** news article URLs referenced (deduped) |
| `generated_at` | ISO 8601 | When the analysis completed |

### 2.2 ADVANCED — Spectacular Outcome (Section 3 of brief — TREATED AS MANDATORY for this build)

**A. Dynamic Reflection & Self-Correction**

After initial tool results, the agent must critique its findings and, if needed, re-plan a second research pass before final synthesis. Three concrete triggers:

1. **Sector correlation > 0.95**: stock's correlation with its sector ETF > 0.95 over the analysis window → trigger peer-comparison pass (fetch direct competitor's recent news AND price action)
2. **Stale news**: all news articles > 72 hours old → broaden search or fetch alternative sources (SEC filings via EDGAR, analyst ratings)
3. **Neutral/even sentiment**: sentiment distribution is perfectly neutral OR evenly split → fetch additional context (analyst commentary, earnings transcript snippets, or sector news) before issuing final score

**B. Long-Term Memory (Persistent Monitoring)**

- `POST /monitor_start` registers background task to monitor a ticker
- Configurable cadence, default **every 24 hours during trading days** (skip weekends + US market holidays)
- Monitoring runs the full analysis **only if** at least one of these is true since last run:
  - (a) **≥5 new articles** published
  - (b) closing price deviated **> 2 standard deviations** from 30-day mean
  - (c) trading volume **> 2× the 30-day average**
- When criteria met, the new analysis is stored tagged `PROACTIVE_ALERT` and records which trigger fired
- Per-ticker state (last run timestamp, baseline price/volume stats, last article IDs seen) must persist so monitoring **survives container restarts**

**C. Observability & Cost Controls**

- Per-job structured logs capturing **each tool invocation, its inputs, latency, and success/failure status**
- Token usage tracking per job: **prompt tokens, completion tokens, estimated cost** based on configured model
- **Configurable maximum tool-call budget** per job, default 10, to prevent runaway agent loops

**D. Evaluation**

- ≥3 documented test cases with inputs + expected output characteristics. Examples from brief:
  - `AAPL` analysis must include correlation with itself = 1.0
  - Unknown ticker must return graceful error (no hallucinated report)
  - Delisted ticker must fail gracefully
- ½–1 page written discussion in README on measuring agent quality at scale (ground-truth, LLM-as-judge, regression suites, etc.)

**E. Containerization**

- Working Dockerfile, runnable via single `docker build` + `docker run`
- `docker-compose.yml` encouraged for multi-service
- README must explain: execute the service, hit primary endpoint, check job status

### 2.3 Deliverables (Section 5 of brief)

- Source code (agent + tools + persistence)
- Dockerfile + docker-compose.yml
- README.md with: architectural diagram, technology choices+rationale, setup/run instructions, evaluation discussion, **"Known Limitations" section clearly marked**
- Dependency manifest (`requirements.txt` + `pyproject.toml`)
- `.env.example` listing all env vars (no secrets)
- `sample_output.json` — at least one full JSON report (real captured run)
- `postman_collection.json` — all endpoints with example **requests AND responses**

---

## 3. Stack decisions (locked in)

| Layer | Choice | Rationale |
|---|---|---|
| Backend framework | FastAPI + Pydantic v2 + uvicorn | Lightest async framework with native OpenAPI; Pydantic v2 has Rust core |
| Agent orchestration | **LangGraph** with explicit nodes + conditional edges + `PostgresSaver` checkpointer | Reflection-as-edge is first-class; built-in streaming maps to SSE; durable agent state across restarts |
| LLM primary | **`x-ai/grok-4.3`** via OpenRouter (paid) | #1 on Artificial Analysis agentic tool-calling leaderboard; $1.25/$2.50 per M tokens; 1M context |
| LLM fallback | **`meta-llama/llama-3.3-70b-instruct:free`** via OpenRouter | Free tier WITH function calling (gpt-oss free does NOT support function calling — DO NOT use it as fallback) |
| Sentiment | LLM-based (Grok) primary + Marketaux sentiment tags as cross-check | **No local ML inference** — no FinBERT/torch/transformers anywhere |
| Queue | **arq** + Redis (queue + cron) | Native asyncio, simpler than Celery, cron for monitoring |
| Database | **PostgreSQL** + SQLAlchemy 2.0 async + Alembic (default in compose); SQLite via `aiosqlite` fallback for standalone `docker run` | Production-shaped; same code targets both via env-driven URL |
| Streaming | SSE endpoint with `Last-Event-ID` reconnection; events buffered in Postgres `agent_events` table | Native `EventSource`; LangGraph emits per-node events natively |
| Caching | Redis cache TTLs: yfinance 5min, NewsAPI/Marketaux 1hr, EDGAR 24hr; URL-hash + title-fingerprint dedup for articles | Extends NewsAPI free-tier 100/day quota |
| Resilience | `pybreaker` circuit breakers per upstream API (separate from retry); `tenacity` for exponential backoff | Prevents thundering-herd against broken upstreams |
| Rate limiting | `slowapi` middleware on `/analyze` and `/monitor_start`, default 10/min per IP, env-configurable | Protects against accidental spam |
| HTTP client | Singleton `httpx.AsyncClient` (lifespan-managed), HTTP/2 enabled, shared by all tools | Connection pooling, lower latency |
| Prompt caching | OpenRouter `cache_control: {"type": "ephemeral"}` on system prompt + tool schemas | Token cost savings |
| Frontend | Next.js 14 App Router + Tailwind + shadcn/ui (3 polished pages) | Production `next start` in container |
| Observability | `structlog` JSON logs + `prometheus-client` `/metrics` + Grafana dashboard JSON | Per-tool spans + token/cost ledger in DB |
| CI | GitHub Actions: ruff + mypy + pytest + docker-build smoke + frontend lint+build; pre-commit hooks | Production rigor signal |
| Container | Multi-stage Dockerfile; docker-compose with 5 services | Single `docker build && docker run` still works in degraded SQLite standalone mode |

---

## 4. Architecture diagram (also goes into README as Mermaid)

```
┌─────────────┐   POST /analyze    ┌────────────────┐   enqueue    ┌──────────────────┐
│  Next.js    │ ─────────────────► │  FastAPI API   │ ───────────► │   arq worker     │
│  Frontend   │ ◄─── job_id ─────  │                │   (Redis)    │  (separate cont) │
│             │                     │                │              │                  │
│  3 pages:   │   SSE stream of    │  /status/{id}  │              │  LangGraph:      │
│  - submit   │ ◄── agent events ─ │  /status/.../  │ ◄─ progress ─│                  │
│  - live job │    /stream         │   stream       │              │ ┌──────────────┐ │
│  - monitor  │                    │                │              │ │  ticker_     │ │
└─────────────┘                    │ /monitor_start │              │ │  extractor   │ │
                                   │ /monitor       │              │ └──────┬───────┘ │
                                   │ /metrics       │              │        ▼         │
                                   │ /health /ready │              │ ┌──────────────┐ │
                                   └────────────────┘              │ │   planner    │ │
                                          │                         │ └──────┬───────┘ │
                                          ▼                         │        ▼         │
                                   ┌────────────────┐               │ ┌──────────────┐ │
                                   │   PostgreSQL   │               │ │tool_executor │ │
                                   │  - jobs        │ ◄─────────────│ │ ┌──────────┐ │ │
                                   │  - monitoring  │               │ │ │ market   │ │ │
                                   │  - tool_logs   │               │ │ │ news+sent│ │ │
                                   │  - llm_calls   │               │ │ │ correl   │ │ │
                                   │  - articles    │               │ │ │ peers    │ │ │
                                   │  - agent_events│               │ │ │ edgar    │ │ │
                                   │  - lg_checkpts │ ◄── PostgresSaver checkpointer ─┤
                                   └────────────────┘               │ │ └──────────┘ │ │
                                          ▲                         │ └──────┬───────┘ │
                                          │                         │        ▼         │
                                   ┌────────────────┐               │ ┌──────────────┐ │
                                   │     Redis      │               │ │  reflection  │─┐│
                                   │ - arq queue    │               │ │   critic     │ ││
                                   │ - arq cron     │               │ └──────┬───────┘ ││
                                   │ - api cache    │               │   needs replan?  ││
                                   └────────────────┘               │        │   yes ──┘│
                                          │                         │        ▼ no       │
                                          ▼ cron schedules          │ ┌──────────────┐ │
                                   ┌────────────────┐               │ │  synthesizer │ │
                                   │ arq cron (24h, │ ──── runs ───►│ │  (streaming) │ │
                                   │ trading days)  │  on triggers  │ └──────────────┘ │
                                   └────────────────┘               └──────────────────┘
```

External APIs called by tools: yfinance, NewsAPI.org, Marketaux, SEC EDGAR, OpenRouter (LLM).

---

## 5. Project layout (create this exact structure)

```
/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                       # FastAPI app + lifespan (DB, Redis, scheduler, HTTP client)
│   │   ├── config.py                     # Pydantic settings from env vars
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── analyze.py                # POST /analyze
│   │   │   ├── status.py                 # GET /status/{id} + /stream (SSE)
│   │   │   ├── monitor.py                # POST /monitor_start, GET /monitor, DELETE, history
│   │   │   └── ops.py                    # /health, /ready, /metrics
│   │   ├── agent/
│   │   │   ├── __init__.py
│   │   │   ├── state.py                  # AgentState TypedDict
│   │   │   ├── graph.py                  # LangGraph StateGraph build + compile
│   │   │   ├── nodes/
│   │   │   │   ├── ticker_extractor.py
│   │   │   │   ├── planner.py
│   │   │   │   ├── tool_executor.py
│   │   │   │   ├── reflection_critic.py
│   │   │   │   └── synthesizer.py
│   │   │   ├── edges.py                  # conditional edge functions
│   │   │   ├── prompts.py                # system + critic + synthesizer prompts
│   │   │   ├── events.py                 # AgentEvent types for SSE
│   │   │   └── checkpointer.py           # PostgresSaver setup
│   │   ├── tools/
│   │   │   ├── __init__.py
│   │   │   ├── base.py                   # Tool ABC: structured logging, latency, budget, circuit breaker
│   │   │   ├── market_data.py            # yfinance
│   │   │   ├── news_sentiment.py         # NewsAPI + Marketaux + LLM sentiment
│   │   │   ├── correlation.py            # Pearson vs SPX, sector ETF, peers
│   │   │   ├── peer_fundamentals.py      # MOCK stub honoring brief's "simulates" wording
│   │   │   └── edgar.py                  # SEC EDGAR (reflection fallback, proper User-Agent)
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   ├── client.py                 # OpenRouter via openai SDK
│   │   │   ├── pricing.yaml              # per-model $/1k token table
│   │   │   ├── budget.py                 # tool-call counter, token tracker, cost calc
│   │   │   └── retries.py                # tenacity wrapper + fallback chain
│   │   ├── persistence/
│   │   │   ├── __init__.py
│   │   │   ├── db.py                     # async engine + session factory
│   │   │   ├── models.py                 # SQLAlchemy 2.0 ORM
│   │   │   └── repos.py                  # JobRepo, MonitorRepo, ToolLogRepo, LLMCallRepo, ArticleRepo, EventRepo
│   │   ├── cache/
│   │   │   ├── __init__.py
│   │   │   ├── redis_cache.py            # async TTL cache wrapper
│   │   │   └── dedupe.py                 # URL-hash + title-fingerprint article dedup
│   │   ├── resilience/
│   │   │   ├── __init__.py
│   │   │   ├── breakers.py               # pybreaker instances per upstream
│   │   │   └── http_client.py            # singleton httpx.AsyncClient with HTTP/2
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── arq_settings.py           # arq WorkerSettings: queue + cron
│   │   │   └── jobs.py                   # analyze_ticker, monitor_tick (arq tasks)
│   │   ├── monitoring/
│   │   │   ├── __init__.py
│   │   │   ├── scheduler.py              # arq cron setup; trading-day filter
│   │   │   ├── baselines.py              # 30-day rolling price mean/std + volume avg
│   │   │   └── triggers.py               # 5+ new articles / 2σ price / 2× volume checks
│   │   └── observability/
│   │       ├── __init__.py
│   │       ├── logging.py                # structlog JSON config + context vars
│   │       └── metrics.py                # Prometheus counters/histograms
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py                   # fixtures
│   │   ├── test_api.py
│   │   ├── test_tools.py
│   │   ├── test_agent_graph.py
│   │   ├── test_monitoring_triggers.py
│   │   ├── test_cache.py
│   │   ├── test_breakers.py
│   │   ├── test_budget.py
│   │   ├── test_ticker_extraction.py
│   │   ├── test_reflection.py
│   │   ├── test_persistence.py
│   │   ├── test_cases/                   # golden case driver
│   │   │   └── test_golden.py
│   │   └── cassettes/                    # respx recordings of real upstream responses
│   ├── eval/
│   │   ├── __init__.py
│   │   ├── golden_cases.yaml             # 6 cases with expected output characteristics
│   │   ├── judge.py                      # LLM-as-judge rubric harness
│   │   ├── rubric.md                     # scoring criteria
│   │   └── run_eval.py
│   ├── alembic/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   ├── alembic.ini
│   ├── Dockerfile                        # multi-stage; CMD arg switches api/worker
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── .pre-commit-config.yaml
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # submit analysis form
│   │   ├── jobs/[id]/page.tsx            # live job view with SSE
│   │   └── monitor/page.tsx              # monitoring CRUD
│   ├── components/                       # shadcn/ui copies + custom
│   ├── lib/
│   │   ├── api.ts                        # typed fetch wrappers
│   │   └── sse.ts                        # EventSource hook
│   ├── public/
│   ├── Dockerfile                        # multi-stage; production next start
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
├── observability/
│   └── grafana/
│       └── dashboard.json
├── docs/
│   ├── architecture.md
│   └── postman_collection.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── docker.yml
├── sample_output.json
├── docker-compose.yml
├── .env.example
├── .dockerignore
├── .gitignore
├── Makefile
└── README.md
```

---

## 6. Environment variables (full list — goes in `.env.example`)

```bash
# === LLM ===
OPENROUTER_API_KEY=                            # required
LLM_PRIMARY_MODEL=x-ai/grok-4.3
LLM_FALLBACK_MODEL=meta-llama/llama-3.3-70b-instruct:free
LLM_TEMPERATURE=0.2
LLM_MAX_TOKENS=4096
LLM_REQUEST_TIMEOUT_SECONDS=120
LLM_PROMPT_CACHE_ENABLED=true

# === External data APIs ===
NEWSAPI_KEY=                                   # required
MARKETAUX_KEY=                                 # required for sentiment cross-check
ALPHAVANTAGE_KEY=                              # optional, secondary
FINNHUB_KEY=                                   # optional, secondary
EDGAR_USER_AGENT="MIRA Agent contact@example.com"  # required by SEC

# === Database ===
DATABASE_URL=postgresql+asyncpg://mira:mira@postgres:5432/mira
# Standalone fallback: sqlite+aiosqlite:///./mira.db

# === Redis ===
REDIS_URL=redis://redis:6379/0
# Standalone fallback: omit to disable caching + use in-process queue

# === Agent budget ===
MAX_TOOL_CALLS=10
MAX_REFLECTION_PASSES=2
MAX_TOKENS_PER_JOB=200000

# === Monitoring ===
MONITOR_DEFAULT_CADENCE_SECONDS=86400
MONITOR_BASELINE_WINDOW_DAYS=30
MONITOR_TRADING_CALENDAR=NYSE

# === Reflection trigger thresholds ===
REFLECTION_SECTOR_CORR_THRESHOLD=0.95
REFLECTION_STALE_NEWS_HOURS=72
REFLECTION_ANALYSIS_WINDOW_DAYS=90

# === Cache TTLs (seconds) ===
CACHE_TTL_YFINANCE=300
CACHE_TTL_NEWS=3600
CACHE_TTL_EDGAR=86400

# === Circuit breakers ===
BREAKER_FAIL_MAX=5
BREAKER_RESET_TIMEOUT_SECONDS=60

# === Rate limiting ===
RATELIMIT_ANALYZE=10/minute
RATELIMIT_MONITOR=5/minute

# === API ===
API_HOST=0.0.0.0
API_PORT=8000
FRONTEND_ORIGIN=http://localhost:3000
LOG_LEVEL=INFO
LOG_FORMAT=json                                # json | console

# === Frontend ===
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 7. Database schema (Alembic migration creates these tables)

```sql
-- jobs: every /analyze invocation
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query           TEXT NOT NULL,
  ticker          TEXT,
  status          TEXT NOT NULL,           -- queued|running|completed|failed|interrupted
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  result_json     JSONB,                    -- the full report when done
  error           TEXT,
  prompt_tokens   INT DEFAULT 0,
  completion_tokens INT DEFAULT 0,
  cost_usd        NUMERIC(10,6) DEFAULT 0,
  tool_calls_count INT DEFAULT 0,
  reflection_passes INT DEFAULT 0,
  alert_tag       TEXT,                     -- PROACTIVE_ALERT | null
  monitor_target_id UUID REFERENCES monitoring_targets(id),
  triggers_fired  TEXT[] DEFAULT '{}'
);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_ticker ON jobs(ticker);
CREATE INDEX idx_jobs_created ON jobs(created_at DESC);

-- monitoring_targets: persistent per-ticker monitors
CREATE TABLE monitoring_targets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker                   TEXT NOT NULL UNIQUE,
  cadence_seconds          INT NOT NULL DEFAULT 86400,
  peers                    TEXT[] DEFAULT '{}',
  baseline_price_mean      NUMERIC(14,4),
  baseline_price_std       NUMERIC(14,4),
  baseline_volume_avg      NUMERIC(20,2),
  baselines_computed_at    TIMESTAMPTZ,
  last_run_at              TIMESTAMPTZ,
  last_seen_article_urls   TEXT[] DEFAULT '{}',    -- bounded to last 50
  active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- tool_invocations: per-tool audit log (brief 3.C requirement)
CREATE TABLE tool_invocations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  input_json      JSONB NOT NULL,
  output_summary  TEXT,                     -- truncated output for log size
  latency_ms      INT NOT NULL,
  status          TEXT NOT NULL,            -- success|error|circuit_open|budget_exceeded
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tool_inv_job ON tool_invocations(job_id);

-- llm_calls: per-LLM-call token + cost ledger (brief 3.C requirement)
CREATE TABLE llm_calls (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id             UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  model              TEXT NOT NULL,
  prompt_tokens      INT NOT NULL,
  completion_tokens  INT NOT NULL,
  cost_usd           NUMERIC(10,6) NOT NULL,
  latency_ms         INT NOT NULL,
  cached             BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_llm_calls_job ON llm_calls(job_id);

-- articles: cached + deduped news articles
CREATE TABLE articles (
  url_hash         TEXT PRIMARY KEY,        -- sha256 of normalized URL
  url              TEXT NOT NULL,
  title            TEXT,
  title_fingerprint TEXT,                   -- shingled title hash for near-dup
  source           TEXT,
  published_at     TIMESTAMPTZ,
  ticker           TEXT,
  raw_json         JSONB,
  sentiment_label  TEXT,                    -- positive|negative|neutral
  sentiment_score  NUMERIC(5,4),
  cached_until     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_articles_ticker_pub ON articles(ticker, published_at DESC);

-- agent_events: SSE event log for reconnection / Last-Event-ID
CREATE TABLE agent_events (
  id          BIGSERIAL PRIMARY KEY,
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_job_id ON agent_events(job_id, id);

-- LangGraph checkpointer tables created by PostgresSaver.setup()
-- (lg_checkpoints, lg_writes, etc. — managed by langgraph-checkpoint-postgres)
```

---

## 8. Output schema (Pydantic — full shape)

```python
class MarketSnapshot(BaseModel):
    price: float
    daily_change_pct: float
    volume: int
    market_cap: float | None
    pe_ratio: float | None
    fifty_two_week_high: float
    fifty_two_week_low: float
    last_two_quarterly_revenues: list[QuarterlyRevenue]   # exactly 2 entries

class QuarterlyRevenue(BaseModel):
    quarter: str          # "2026 Q1"
    revenue_usd: float
    reported_at: datetime

class CorrelationAnalysis(BaseModel):
    vs_sp500: float
    vs_sector_etf: float
    sector_etf_symbol: str
    vs_peers: dict[str, float]    # {"MSFT": 0.78, "GOOGL": 0.65}
    window_days: int               # which window was used

class ArticleSentiment(BaseModel):
    url: str
    title: str
    source: str
    published_at: datetime
    sentiment: Literal["positive", "negative", "neutral"]
    sentiment_score: float          # [-1.0, 1.0]
    rationale: str | None

class SentimentDistribution(BaseModel):
    positive: int
    negative: int
    neutral: int
    total: int
    articles: list[ArticleSentiment]

class ToolInvocationLog(BaseModel):
    name: str
    input: dict
    output_summary: str
    latency_ms: int
    status: Literal["success", "error", "circuit_open", "budget_exceeded"]

class TokenUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost_usd: float
    model: str

class DataFreshness(BaseModel):
    newest_article_at: datetime | None
    market_data_at: datetime
    edgar_filing_at: datetime | None

class AnalysisReport(BaseModel):
    # === BRIEF-MANDATED MINIMUM FIELDS ===
    company_ticker: str
    company_name: str
    analysis_summary: str
    sentiment_score: float          # [-1.0, 1.0]
    market_snapshot: MarketSnapshot
    correlation_analysis: CorrelationAnalysis
    key_findings: list[str]          # exactly 3, validator enforces len == 3
    tools_used: list[str]            # in chronological order
    citation_sources: list[HttpUrl]  # deduped
    generated_at: datetime           # ISO 8601

    # === EXTRA FIELDS WE ADD ===
    degraded: bool = False
    degradation_reason: str | None = None
    reflection_passes: int = 0
    triggers_fired: list[str] = []
    confidence: float = 1.0
    data_freshness: DataFreshness
    sentiment_distribution: SentimentDistribution
    token_usage: TokenUsage
    tool_invocations: list[ToolInvocationLog]
    alert_tag: Literal["PROACTIVE_ALERT"] | None = None
    monitor_trigger: Literal["articles", "price_2sigma", "volume_2x"] | None = None

    @field_validator("key_findings")
    @classmethod
    def _exactly_three(cls, v):
        if len(v) != 3:
            raise ValueError("key_findings must contain exactly 3 items")
        return v
```

---

## 9. API endpoints — exact request/response shapes

### POST `/analyze`

**Request**:
```json
{"query": "Analyze the near-term prospects of Tesla, Inc. (TSLA)."}
```

**Response (202 Accepted)**:
```json
{"job_id": "8b3e9f6a-...", "status": "queued"}
```

**Behavior**: validates `query` (non-empty, ≤ 2000 chars), creates `jobs` row with `status="queued"`, enqueues arq job, returns immediately. Rate limited 10/min per IP.

### GET `/status/{job_id}`

**Response — running**:
```json
{
  "job_id": "8b3e9f6a-...",
  "status": "running",
  "progress": {"current_node": "tool_executor", "tools_called": ["market_data", "news_sentiment"]},
  "created_at": "2026-05-15T10:00:00Z",
  "started_at": "2026-05-15T10:00:02Z"
}
```

**Response — completed**:
```json
{
  "job_id": "8b3e9f6a-...",
  "status": "completed",
  "created_at": "...",
  "completed_at": "...",
  "report": { ...AnalysisReport... }
}
```

**Response — failed**:
```json
{"job_id": "...", "status": "failed", "error": "TICKER_NOT_FOUND: ZZZZZ123"}
```

### GET `/status/{job_id}/stream`

SSE endpoint. Headers: `Cache-Control: no-cache`, `Content-Type: text/event-stream`. Honors `Last-Event-ID` for replay from `agent_events` table.

Event types:
- `planner_decision`: `{plan: string, tools: string[]}`
- `tool_start`: `{tool: string, input: object}`
- `tool_end`: `{tool: string, output_summary: string, latency_ms: int, status: string}`
- `reflection_thought`: `{trigger_evaluated: string, fired: bool, reasoning: string}`
- `replan`: `{new_plan: string, tools: string[]}`
- `synthesis_token`: `{token: string}`
- `done`: `{report: AnalysisReport}`
- `error`: `{message: string}`

### POST `/monitor_start`

**Request**:
```json
{"ticker": "AAPL", "cadence_seconds": 86400, "peers": ["MSFT", "GOOGL"]}
```

**Response**:
```json
{"id": "uuid", "ticker": "AAPL", "cadence_seconds": 86400, "active": true, "next_run_at": "..."}
```

**Behavior**: upserts by `ticker` (idempotent), computes baselines from yfinance OHLC immediately, schedules arq cron, returns. Rate limited 5/min per IP.

### GET `/monitor`

Lists all active monitors with baselines and `last_run_at`.

### DELETE `/monitor/{ticker}`

Sets `active=false`, removes arq cron entry.

### GET `/monitor/{ticker}/history`

Returns all `jobs` rows where `monitor_target_id = ticker.id` AND `alert_tag = 'PROACTIVE_ALERT'`, newest first.

### GET `/health`

Always returns 200 `{"status": "ok"}`.

### GET `/ready`

Returns 200 if DB + Redis + OpenRouter reachable; 503 otherwise with diagnostic.

### GET `/metrics`

Prometheus exposition format. See Section 13 for metric names.

---

## 10. LangGraph state machine — exact spec

### AgentState (TypedDict in `agent/state.py`)

```python
class AgentState(TypedDict):
    # Inputs
    job_id: str
    query: str

    # Resolved
    ticker: str | None
    company_name: str | None
    sector: str | None
    sector_etf: str | None
    peers: list[str]

    # Tool execution
    plan: str
    tool_results: dict[str, Any]     # keyed by tool name
    tool_calls_made: int
    tools_used_order: list[str]
    citation_urls: list[str]

    # Reflection
    reflection_passes: int
    triggers_fired: list[str]
    needs_replan: bool

    # Budget
    tokens_used: int
    cost_usd: float

    # Errors
    errors: list[str]
    degraded: bool
    degradation_reason: str | None

    # Output
    report: AnalysisReport | None
```

### Graph build (in `agent/graph.py`)

```
START
  → ticker_extractor
  → planner
  → tool_executor
  → reflection_critic
     ├─ if needs_replan and reflection_passes < MAX_REFLECTION_PASSES:
     │     → planner (loop)
     └─ else:
           → synthesizer
  → END
```

Compiled with `PostgresSaver` checkpointer using thread_id = `job_id`.

### Node responsibilities

**`ticker_extractor`**:
- If query already contains an uppercase symbol matching `[A-Z]{1,5}` AND yfinance recognizes it → use directly
- Else call LLM with a tool-call asking for `extract_ticker(company_or_query: str) -> {ticker, company_name}` and validate against yfinance
- On failure → set `degraded=True`, `degradation_reason="TICKER_NOT_FOUND"`, skip to synthesizer with error report
- Emits `planner_decision` event with extracted ticker

**`planner`**:
- LLM call with system prompt explaining the task + tools available
- Returns plan as natural-language string + ordered list of tools to call
- On reflection pass, planner receives `triggers_fired` context and constructs second-pass plan
- Emits `planner_decision` event

**`tool_executor`**:
- Iterates over planner's tool list
- Each tool wrapped by `tools/base.py` decorator that:
  - Checks `tool_calls_made < MAX_TOOL_CALLS` (else raises `BudgetExceeded`)
  - Checks circuit breaker state (else returns `{status: "circuit_open"}`)
  - Times the call, stores `ToolInvocationLog`
  - Emits `tool_start` and `tool_end` events
- Stores results in `state["tool_results"][tool_name]`

**`reflection_critic`**:
- Evaluates three triggers (Section 11 below) against `tool_results`
- Sets `state["needs_replan"]` and appends to `triggers_fired`
- Emits `reflection_thought` event with reasoning for each trigger
- Bounded by `MAX_REFLECTION_PASSES`

**`synthesizer`**:
- LLM call with all `tool_results` as context
- Streams tokens via `synthesis_token` events
- Produces final `AnalysisReport` matching Pydantic schema
- Validators enforce: exactly 3 key_findings, sentiment_score ∈ [-1,1], generated_at = now()
- If validation fails → re-prompt once with errors; second failure → degraded report
- Emits `done` event with full report

### Conditional edge function

```python
def should_replan(state: AgentState) -> Literal["planner", "synthesizer"]:
    if state["needs_replan"] and state["reflection_passes"] < MAX_REFLECTION_PASSES:
        return "planner"
    return "synthesizer"
```

---

## 11. Reflection triggers — exact code-level logic

### Trigger 1: Sector correlation > 0.95

```python
def trigger_sector_correlation(state) -> bool:
    corr_data = state["tool_results"].get("correlation")
    if not corr_data:
        return False
    sector_corr = corr_data["correlation_analysis"]["vs_sector_etf"]
    return sector_corr > 0.95  # strict >, not >=
```

If fired, planner's next pass plan: fetch news + price action for top-1 peer from `state["peers"]`.

### Trigger 2: All news > 72 hours old

```python
def trigger_stale_news(state) -> bool:
    articles = state["tool_results"].get("news_sentiment", {}).get("articles", [])
    if not articles:
        return True   # no news at all is also a "stale" signal
    threshold = datetime.now(UTC) - timedelta(hours=72)
    return all(a["published_at"] < threshold for a in articles)
```

If fired, planner's next pass plan: call `edgar` tool for latest 10-Q/8-K filings within 30 days.

### Trigger 3: Neutral or evenly split sentiment

```python
def trigger_neutral_sentiment(state) -> bool:
    dist = state["tool_results"].get("news_sentiment", {}).get("distribution")
    if not dist:
        return False
    total = dist["total"]
    if total == 0:
        return False
    pos, neg, neu = dist["positive"], dist["negative"], dist["neutral"]
    # "Perfectly neutral OR evenly split"
    perfectly_neutral = (pos == 0 and neg == 0 and neu == total)
    evenly_split = (abs(pos - neg) <= 1 and neu >= math.ceil(total / 2))
    return perfectly_neutral or evenly_split
```

If fired, planner's next pass plan: call `edgar` for recent 8-K + planner LLM call to search for analyst commentary news segments.

---

## 12. Monitoring triggers — exact code-level logic

Run on each arq cron tick (only on US trading days per `pandas_market_calendars.get_calendar("NYSE")`).

### (a) ≥5 new articles since last run

```python
def trigger_new_articles(target, current_articles) -> bool:
    seen = set(target.last_seen_article_urls)
    new_urls = {a.url_hash for a in current_articles if a.url_hash not in seen}
    return len(new_urls) >= 5
```

URL hash = sha256 of normalized URL (lowercase host, strip UTM/fbclid params). Title fingerprint = shingled hash for near-dup detection (catch same article cross-posted).

### (b) Close > 2σ from 30-day mean

```python
def trigger_price_2sigma(target, today_close) -> bool:
    mean = target.baseline_price_mean
    std = target.baseline_price_std
    return abs(today_close - mean) > 2 * std
```

Baselines recomputed each tick from the last 30 trading days' closes via yfinance.

### (c) Volume > 2× 30-day average

```python
def trigger_volume_2x(target, today_volume) -> bool:
    return today_volume > 2 * target.baseline_volume_avg
```

### Tick orchestration

```python
async def monitor_tick(target_id: UUID):
    target = await MonitorRepo.get(target_id)
    if not target.active:
        return
    if not is_trading_day(now()):
        return

    # Recompute baselines
    ohlc = await yfinance_tool.fetch_ohlc(target.ticker, days=30)
    new_baselines = compute_baselines(ohlc)

    # Fetch latest articles + today's bar
    articles = await news_tool.fetch(target.ticker, since=target.last_run_at)
    today_bar = ohlc[-1]

    # Evaluate triggers
    fired = []
    if trigger_new_articles(target, articles):
        fired.append("articles")
    if trigger_price_2sigma(target, today_bar.close):
        fired.append("price_2sigma")
    if trigger_volume_2x(target, today_bar.volume):
        fired.append("volume_2x")

    if fired:
        job_id = await enqueue_analysis(
            query=f"Monitoring update for {target.ticker}",
            ticker=target.ticker,
            alert_tag="PROACTIVE_ALERT",
            monitor_target_id=target.id,
            triggers_fired=fired,
        )

    # Persist new state
    await MonitorRepo.update(target.id, {
        "baseline_price_mean": new_baselines.mean,
        "baseline_price_std": new_baselines.std,
        "baseline_volume_avg": new_baselines.volume_avg,
        "baselines_computed_at": now(),
        "last_run_at": now(),
        "last_seen_article_urls": dedup_keep_last_50(
            target.last_seen_article_urls + [a.url_hash for a in articles]
        ),
    })
```

---

## 13. Observability spec

### Structured logs (structlog JSON)

Every log line includes context vars: `request_id`, `job_id` (when applicable), `tool_name` (when applicable).

Per brief, every tool invocation logs `{name, input, latency_ms, status}` — these are persisted to `tool_invocations` AND emitted as structlog events.

### Prometheus metrics (`/metrics`)

```
mira_jobs_total{status}                          counter
mira_job_duration_seconds                        histogram
mira_tool_call_total{tool, status}              counter
mira_tool_call_latency_seconds{tool}            histogram
mira_llm_tokens_total{model, type}              counter   # type=prompt|completion
mira_llm_cost_usd_total{model}                  counter
mira_llm_call_latency_seconds{model}            histogram
mira_reflection_passes                           histogram
mira_monitor_triggers_total{trigger}            counter
mira_circuit_breaker_state{upstream}            gauge     # 0=closed, 1=open, 2=halfopen
mira_cache_hits_total{cache}                    counter
mira_cache_misses_total{cache}                  counter
```

### Grafana dashboard

`observability/grafana/dashboard.json` with panels:
- Jobs over time (success/failure)
- p50/p95/p99 job duration
- Tool call latency by tool
- LLM token usage + cost over time
- Reflection pass distribution
- Circuit breaker states
- Cache hit rate

---

## 14. Edge cases — comprehensive list

| # | Edge case | Handling |
|---|---|---|
| 1 | Unknown ticker (e.g., `ZZZZZ123`) | `ticker_extractor` fails → structured error `{error: "TICKER_NOT_FOUND"}`, no LLM hallucination |
| 2 | Delisted ticker (e.g., `LEHMQ`) | yfinance has historical but no current quote → `degraded: true`, `delisted: true`, partial report |
| 3 | NewsAPI 429/5xx | tenacity backoff → Marketaux fallback → EDGAR fallback |
| 4 | yfinance empty/blocked | Optional Finnhub fallback if `FINNHUB_KEY` set → else degraded |
| 5 | OpenRouter 429/5xx on Grok 4.3 | Fallback to `meta-llama/llama-3.3-70b-instruct:free` → if still failing, fail job with diagnostic |
| 6 | Container restart mid-job | On startup, mark `running` jobs as `interrupted`; arq retries pending jobs; LangGraph `PostgresSaver` resumes from last checkpoint |
| 7 | Concurrent `/monitor_start` for same ticker | Unique constraint on `ticker`, upsert returns existing row |
| 8 | Monitoring on weekend/holiday | `is_trading_day()` check exits cron tick early |
| 9 | Token budget exceeded mid-reflection | Synthesize from what we have, `degraded: true`, `degradation_reason="TOKEN_BUDGET_EXCEEDED"` |
| 10 | LLM and Marketaux sentiment disagree (>30% mismatch) | `confidence < 0.6` flag in report |
| 11 | NewsAPI returns zero articles | Reflection trigger 2 fires → EDGAR fallback per brief |
| 12 | LLM returns empty/short `key_findings` | Re-prompt once with stricter schema; if still <3, degraded |
| 13 | Citation dedup | Normalize URLs (strip UTM, lowercase host, trim trailing slash) before storing |
| 14 | Natural-language query without explicit ticker | `ticker_extractor` LLM call + yfinance lookup; ambiguous → return clarifying error |
| 15 | EDGAR rate limit (10 req/sec policy) | tenacity respects, set required `User-Agent: ${EDGAR_USER_AGENT}` header |
| 16 | SSE connection drop | Client reconnects with `Last-Event-ID` header; server replays from `agent_events` table |
| 17 | External API circuit open | Tool returns `{status: "circuit_open"}` immediately; breaker auto-recovers on cooldown |
| 18 | NewsAPI free-tier daily cap (100 req) | Redis cache extends effective limit; cache miss with circuit open → return cached + log warning |
| 19 | Frontend CORS | `CORSMiddleware` allows `FRONTEND_ORIGIN` env value |
| 20 | Reviewer spams `/analyze` | slowapi rate limit returns 429 with `Retry-After` |
| 21 | yfinance returns NaN for some fields (e.g., new IPO has no quarterly revenues yet) | Mark missing fields as `null` in schema; surface in `data_freshness` |
| 22 | LangGraph node exception | Wrap each node in try/except; on failure, mark job failed with traceback in `error` |
| 23 | Reflection loops infinitely | Bounded by `MAX_REFLECTION_PASSES` (default 2) |
| 24 | Worker dies mid-job | arq job retry on next worker; PostgresSaver resumes |
| 25 | Postgres connection pool exhausted | Pool size = 20 default, configurable via env; tenacity backoff on connection errors |
| 26 | LLM returns malformed JSON for structured output | Pydantic validation fails → re-prompt with error context; second failure → degraded |
| 27 | EDGAR returns 403 (bad User-Agent) | Verify `EDGAR_USER_AGENT` set; log diagnostic; fall back to news-only synthesis |
| 28 | Frontend SSE proxy buffering (some corporate proxies) | Set `X-Accel-Buffering: no` header to disable nginx-style buffering |
| 29 | Job query exceeds 2000 chars | API validation returns 422 with clear error |
| 30 | Two reflection passes both fire — different triggers each | Append to `triggers_fired`; planner sees full history; budget enforced |
| 31 | Sector ETF unknown for ticker's sector | Fall back to "SPY" (broad-market); log warning; correlation still computed |
| 32 | Peer list empty (small-cap with no obvious peers) | Use top-3 holdings of sector ETF as proxy peers; document in report |
| 33 | yfinance `info` dict missing `longName` | Fall back to `shortName`; if both missing, use ticker as company_name with `degraded: true` |
| 34 | Markdown injection in news titles | Sanitize before storing/rendering (use `html.escape` in citations) |
| 35 | LangGraph checkpointer Postgres downtime | Catch + retry; if persistent, fail job with clear error |

---

## 15. Build phases (execute in order)

### Phase 0 — Repo skeleton (~30 min)
- Create all directories per Section 5
- Write `pyproject.toml`, `requirements.txt`, `package.json`, `tsconfig.json`, `tailwind.config.ts`
- Write `.gitignore`, `.dockerignore`, `.env.example`, `Makefile`
- Write `alembic.ini` and empty `alembic/` skeleton
- Confirm: `cd backend && pip install -e .` succeeds

### Phase 1 — Persistence + config (~1 hr)
- `app/config.py` — Pydantic Settings reading all env vars in Section 6
- `app/persistence/models.py` — all SQLAlchemy 2.0 ORM models per Section 7
- `app/persistence/db.py` — async engine + session factory
- `app/persistence/repos.py` — repo classes for each table
- Generate initial Alembic migration: `alembic revision --autogenerate -m "initial"`
- Confirm: migration runs against Postgres in Docker AND SQLite

### Phase 2 — Observability + HTTP client + cache + breakers (~1 hr)
- `app/observability/logging.py` — structlog config + context vars
- `app/observability/metrics.py` — Prometheus collectors
- `app/resilience/http_client.py` — singleton `httpx.AsyncClient`
- `app/resilience/breakers.py` — pybreaker per upstream
- `app/cache/redis_cache.py` — async TTL cache wrapper
- `app/cache/dedupe.py` — URL hash + title fingerprint
- Tests: `test_cache.py`, `test_breakers.py`

### Phase 3 — LLM client (~1 hr)
- `app/llm/client.py` — openai SDK pointed at OpenRouter
- `app/llm/pricing.yaml` — Grok 4.3 + Llama 3.3 70B free pricing
- `app/llm/budget.py` — budget enforcer (raises `BudgetExceeded`)
- `app/llm/retries.py` — tenacity wrapper + fallback chain
- Implement: prompt_caching headers, function calling, streaming
- Tests: `test_budget.py`, LLM client integration test with mocked OpenRouter

### Phase 4 — Tools (~3 hr)
- `app/tools/base.py` — Tool ABC; decorator handles logging, latency, budget, breaker
- `app/tools/market_data.py` — yfinance; returns exactly the 7 brief fields + last 2 quarterly revenues
- `app/tools/correlation.py` — Pearson against SPY + sector ETF + peers, from yfinance OHLC over 90 trading days
- `app/tools/peer_fundamentals.py` — MOCK stub (returns canned last-2-quarter revenue/price for peers) honoring brief's "simulates" wording
- `app/tools/news_sentiment.py` — NewsAPI fetch + relevance filter (title/desc must contain company name or ticker) + Marketaux fetch + LLM sentiment classification + cross-check
- `app/tools/edgar.py` — SEC EDGAR latest 10-K/10-Q/8-K within 30 days, proper User-Agent
- Each tool has respx cassette tests in `tests/cassettes/`

### Phase 5 — Agent graph (~3 hr)
- `app/agent/state.py` — AgentState TypedDict
- `app/agent/prompts.py` — system, critic, synthesizer prompts (with prompt_cache markers)
- `app/agent/events.py` — AgentEvent types
- `app/agent/nodes/*.py` — five nodes per Section 10
- `app/agent/edges.py` — `should_replan` conditional edge
- `app/agent/checkpointer.py` — PostgresSaver setup
- `app/agent/graph.py` — StateGraph build + compile
- Tests: `test_agent_graph.py` (mocked LLM + tools), `test_reflection.py` (each trigger)

### Phase 6 — Workers + monitoring (~2 hr)
- `app/workers/arq_settings.py` — WorkerSettings: queue + cron
- `app/workers/jobs.py` — `analyze_ticker(ctx, job_id)` and `monitor_tick(ctx, target_id)`
- `app/monitoring/baselines.py` — 30-day rolling mean/std/avg
- `app/monitoring/triggers.py` — three trigger fns per Section 12
- `app/monitoring/scheduler.py` — trading-day filter, cron registration
- Tests: `test_monitoring_triggers.py` (each trigger with synthetic data)

### Phase 7 — API layer (~2 hr)
- `app/api/analyze.py` — POST /analyze
- `app/api/status.py` — GET /status/{id} + SSE /status/{id}/stream
- `app/api/monitor.py` — POST /monitor_start, GET /monitor, DELETE, history
- `app/api/ops.py` — /health, /ready, /metrics
- `app/main.py` — FastAPI app, lifespan (DB, Redis, HTTP client, scheduler), middleware (CORS, slowapi, request_id)
- Tests: `test_api.py`

### Phase 8 — Frontend (~3 hr)
- Scaffold Next.js 14 App Router project in `frontend/`
- Install: `tailwindcss`, `shadcn-ui` components (Card, Button, Badge, Tabs, Progress, Skeleton, Input, Textarea, Alert), `lucide-react`, `recharts`
- `app/page.tsx` — submit form + recent jobs list (fetches `GET /jobs?limit=10`)
- `app/jobs/[id]/page.tsx` — two-column live job view: SSE event stream on left, progressively-filling report on right
- `app/monitor/page.tsx` — table of monitors + new monitor form + alert history per ticker
- `lib/api.ts`, `lib/sse.ts`
- Production `next build` succeeds

### Phase 9 — Docker + compose (~1 hr)
- `backend/Dockerfile` — multi-stage; final ~150MB; CMD arg switches `api` (uvicorn) and `worker` (arq)
- `frontend/Dockerfile` — multi-stage; production `next start`
- `docker-compose.yml` — 5 services: api, worker, postgres, redis, frontend
- Confirm:
  - `docker compose up --build` → all healthy, frontend at :3000, API at :8000
  - `docker build -t mira-backend backend/ && docker run -e DATABASE_URL=sqlite+aiosqlite:///./mira.db -p 8000:8000 mira-backend api` → standalone SQLite mode works (brief constraint)

### Phase 10 — CI + pre-commit (~30 min)
- `.github/workflows/ci.yml` — ruff + mypy + pytest (with respx cassettes, no real external calls)
- `.github/workflows/docker.yml` — docker build smoke test
- `.pre-commit-config.yaml` — ruff, ruff-format, prettier, mypy

### Phase 11 — Evaluation (~1 hr)
- `eval/golden_cases.yaml` — 6 cases per Section 16
- `eval/rubric.md` — scoring criteria
- `eval/judge.py` — LLM-as-judge harness
- `eval/run_eval.py` — runs golden cases against the live agent

### Phase 12 — Documentation + deliverables (~1.5 hr)
- `README.md` — every brief-required section:
  - Architectural overview + Mermaid diagram
  - Technology choices + rationale (LLM choice section, sentiment trade-off section both explicit)
  - Setup + run instructions (env vars, docker compose up, hitting endpoints, checking job status)
  - Evaluation discussion — 250-500 words covering ground-truth, LLM-as-judge, regression suites, sentiment back-testing
  - **"## Known Limitations"** H2 section with honest list
- Capture `sample_output.json` from a real run against TSLA
- Build `docs/postman_collection.json` with all endpoints + captured response bodies from real smoke tests
- Final smoke test — full end-to-end run, capture sample output

### Phase 13 — Test + verify + commit (~1 hr)
- Run full test suite (see Section 17)
- Run verification checklist (see Section 18)
- Commit + push to `claude/assessment-project-ai-dsFy2`

---

## 16. Golden test cases (`eval/golden_cases.yaml`)

```yaml
- name: aapl_self_correlation
  query: "Analyze Apple Inc. (AAPL)"
  expect:
    status: completed
    report.correlation_analysis.vs_peers contains AAPL with value approximately 1.0
    report.company_ticker == "AAPL"
    len(report.key_findings) == 3
    report.degraded == false

- name: unknown_ticker
  query: "Analyze ZZZZZ123"
  expect:
    status: failed
    error contains "TICKER_NOT_FOUND"
    no LLM-generated report fields present

- name: delisted_ticker
  query: "Analyze Lehman Brothers (LEHMQ)"
  expect:
    status: completed
    report.degraded == true
    report.degradation_reason contains "delisted"

- name: idiosyncratic_no_reflection_replan
  query: "Analyze Tesla (TSLA)"
  expect:
    status: completed
    "sector_correlation" NOT in report.triggers_fired   # Tesla is idiosyncratic, low sector corr

- name: sector_correlated_triggers_peer_pass
  query: "Analyze Coca-Cola (KO)"
  expect:
    status: completed
    # KO tracks XLP (consumer staples ETF) closely → expect peer-pass trigger
    "sector_correlation" in report.triggers_fired
    report.reflection_passes >= 1

- name: degraded_on_news_failure
  query: "Analyze Microsoft (MSFT)"
  mock:
    newsapi: 503 for all requests
  expect:
    status: completed
    report.degraded == true
    "edgar" in report.tools_used   # fallback was triggered
```

---

## 17. Testing strategy

### Unit + integration tests (`pytest`)

Run with: `make test` → `pytest backend/tests/ -v --cov=backend/app --cov-report=term-missing`

**Required test files**:

| File | Coverage |
|---|---|
| `test_api.py` | All endpoints: 200/202/404/422/429 paths, SSE event ordering, rate-limit middleware |
| `test_tools.py` | Each tool with respx cassettes: success, 429, 5xx, malformed responses, empty results |
| `test_agent_graph.py` | Graph traversal: planner→tools→reflection→synth path; budget exhaustion; LLM mock |
| `test_reflection.py` | Each of the 3 reflection triggers in isolation, plus combined scenarios |
| `test_monitoring_triggers.py` | Each of the 3 monitoring triggers with synthetic baselines + data |
| `test_cache.py` | TTL expiry, dedup correctness, URL normalization |
| `test_breakers.py` | Closed→open transition, halfopen→closed/open transitions, per-upstream isolation |
| `test_budget.py` | Tool-call counter, token accumulator, cost calculation, budget exceeded raises |
| `test_ticker_extraction.py` | Natural-language queries, ambiguous companies, unknown tickers |
| `test_persistence.py` | All repo CRUD, interrupted-on-startup recovery, monitor state survives restart |
| `test_cases/test_golden.py` | Drives `eval/golden_cases.yaml` against the agent with mocked external APIs |

### Test quality requirements

- **No real external API calls in unit tests** — use respx cassettes (record once, replay)
- LLM mocked with deterministic responses for graph tests
- Coverage target: ≥80% on `app/` (CI gate, not blocking)
- Property-based tests for ticker normalization, URL normalization, baseline math (`hypothesis`)
- All async tests use `pytest-asyncio` with `asyncio_mode = "auto"` in `pyproject.toml`

### LLM-as-judge eval

Run with: `make eval` → `python -m backend.eval.run_eval`

- Runs all golden cases against the REAL agent (uses real OpenRouter key)
- Feeds each output to judge model with rubric scoring 0-5 on:
  - Factuality (do market_snapshot numbers look plausible)
  - Schema compliance (Pydantic validates without error)
  - Citation presence (citation_sources non-empty when news fetched)
  - Key findings actionability (judged subjectively)
  - Sentiment plausibility (matches dominant article tone)
- Threshold: mean ≥ 4.0 to pass
- Produces `eval/results/<timestamp>.json` with per-case scorecards

### Manual smoke tests (Phase 13, also Section 18)

Run a real `TSLA` analysis end-to-end, copy the result to `sample_output.json`. Capture Postman responses during the same session.

---

## 18. Verification checklist (run before `git push`)

### Functional verification

- [ ] `docker compose up --build` brings up all 5 services healthy
- [ ] Frontend loads at `http://localhost:3000`
- [ ] API docs at `http://localhost:8000/docs` load
- [ ] `POST /analyze` with `{"query":"Analyze Tesla (TSLA)"}` returns `{job_id, status:"queued"}` < 200ms
- [ ] `GET /status/{job_id}` polled → eventually returns `status: completed` with full report
- [ ] Report has ALL minimum-schema fields populated
- [ ] `key_findings` has exactly 3 items
- [ ] `tools_used` has names in chronological order
- [ ] `citation_sources` is deduped (no two identical URLs)
- [ ] `generated_at` parses as ISO 8601
- [ ] `correlation_analysis` has `vs_sp500`, `vs_sector_etf`, `vs_peers`
- [ ] `market_snapshot.last_two_quarterly_revenues` has exactly 2 entries
- [ ] `SSE /status/{job_id}/stream` emits planner_decision, tool_start, tool_end, reflection_thought, synthesis_token, done events
- [ ] Frontend live-job page renders events as they arrive
- [ ] `POST /monitor_start` with `{"ticker":"AAPL"}` returns `{active:true}`
- [ ] `GET /monitor` lists the new monitor
- [ ] arq cron tick runs on schedule (verify in logs)
- [ ] `DELETE /monitor/AAPL` removes the monitor

### Edge case verification

- [ ] `POST /analyze {"query":"Analyze ZZZZZ123"}` → status=failed, error contains "TICKER_NOT_FOUND"
- [ ] `POST /analyze {"query":"Analyze LEHMQ"}` → degraded:true
- [ ] Restart backend container mid-job → on resume, job either completes from checkpoint or marked `interrupted`
- [ ] Hit `/analyze` 15 times in 1 minute → 5th+ requests get 429 with Retry-After

### Observability verification

- [ ] `GET /metrics` returns Prometheus exposition with `mira_*` metrics populated
- [ ] DB: `SELECT * FROM tool_invocations WHERE job_id = '<id>'` shows per-tool input/latency/status rows
- [ ] DB: `SELECT * FROM llm_calls WHERE job_id = '<id>'` shows prompt/completion tokens and cost_usd
- [ ] `docker compose logs backend | jq .` shows structured JSON logs with `request_id` and `job_id` context

### Docker verification

- [ ] `docker compose down && docker compose up` reproduces clean working state
- [ ] `cd backend && docker build -t mira-backend . && docker run -e DATABASE_URL=sqlite+aiosqlite:///./mira.db -p 8000:8000 mira-backend api` → standalone mode works (brief constraint)
- [ ] Both Docker images < 250MB final compressed

### Tests + eval verification

- [ ] `make test` → all pytest tests pass
- [ ] `make eval` → LLM-as-judge mean score ≥ 4.0
- [ ] `ruff check backend/` → clean
- [ ] `mypy backend/app/` → clean
- [ ] `cd frontend && npm run lint && npm run build` → clean

### Deliverable verification

- [ ] `README.md` exists with all required sections:
  - [ ] Architectural overview + Mermaid diagram (renders on GitHub)
  - [ ] Technology choices + rationale (LLM choice subsection, sentiment trade-off subsection)
  - [ ] Setup + run instructions
  - [ ] Evaluation discussion 250-500 words
  - [ ] **`## Known Limitations`** H2 section, honest and accurate
- [ ] `.env.example` lists every env var read by `config.py`, no secrets, with comments
- [ ] `requirements.txt` and `pyproject.toml` both present and consistent
- [ ] `sample_output.json` is a real captured Tesla run (not a stub)
- [ ] `docs/postman_collection.json` imports cleanly into Postman; example responses populated from real smoke test
- [ ] `Dockerfile` works (covered above)
- [ ] `docker-compose.yml` works (covered above)

### Final commit + push

- [ ] `git add -A`
- [ ] `git commit -m "feat: implement M.I.R.A. autonomous market intelligence agent\n\nFull implementation of Uniparticle CS-001 assessment.\n- LangGraph agent with reflection (3 brief-mandated triggers)\n- 5 tools via function calling (market_data, news_sentiment, correlation, peer_fundamentals, edgar)\n- Persistent monitoring with 3 trigger conditions (5+ articles / 2σ price / 2x volume)\n- Observability: per-tool logs, token+cost ledger, configurable budget\n- 6 golden test cases + LLM-as-judge harness\n- Docker + docker-compose (5 services) + standalone SQLite mode\n- Next.js dashboard with SSE live agent thoughts\n- Grok 4.3 primary, Llama 3.3 70B free fallback"`
- [ ] `git push -u origin claude/assessment-project-ai-dsFy2`
- [ ] **Do NOT create a pull request** (not requested by user)

---

## 19. Existing patterns / libraries reused

Greenfield repo. Major external library reuses:

- `langgraph` + `langgraph-checkpoint-postgres` — agent state machine + checkpointing
- `openai` (with OpenRouter `base_url`) — LLM calls
- `yfinance` — market data
- `pandas_market_calendars` — trading-day awareness
- `arq` — async queue + cron
- `tenacity` — retry/backoff
- `pybreaker` — circuit breakers
- `slowapi` — rate limiting middleware
- `respx` — HTTP test mocking with cassettes
- `structlog` — JSON logs
- `prometheus-client` — `/metrics`
- `pydantic` v2, `pydantic-settings`
- `sqlalchemy` 2.0 async + `alembic` + `asyncpg` + `aiosqlite`
- `redis` (async) + `arq`
- `httpx` (HTTP/2)
- `pytest`, `pytest-asyncio`, `pytest-cov`, `hypothesis`
- `ruff`, `mypy`
- `shadcn/ui` copy-paste components, `lucide-react`, `recharts`

---

## 20. Known constraints / honest limitations (also goes in README "Known Limitations")

These appear honestly in the README:

- yfinance is unofficial — data freshness depends on Yahoo Finance scraping; brief permits this
- Tool 3 (`peer_fundamentals`) is a mock per the brief's exact wording ("simulates a mock API call"); real peer fundamentals would require a paid data subscription
- LLM-based sentiment may be miscalibrated on niche-finance jargon; cross-check with Marketaux raises but does not eliminate this risk; production system should use a finance-tuned model (FinBERT) — deliberately omitted here to avoid local ML inference and image bloat
- OpenRouter free-tier fallback (Llama 3.3 70B) has lower function-calling fidelity than Grok 4.3; complex reflection scenarios may degrade slightly when fallback fires
- 30-day baselines for monitoring are computed in-process each tick; a more scalable approach would precompute and stream baselines via a feature store for high-volume monitoring
- Sector ETF mapping is a static dict in `correlation.py`; a real system would derive this from a sector taxonomy service
- LLM-as-judge eval uses the same provider as the agent — for true rigor, judge should use a different model family (cross-model evaluation)

---

## 21. Frontend visual notes (for builder reference, frontend designed separately)

The user is designing the frontend shape separately (Claude.ai design chat + v0.dev). Builder agent should:

- Scaffold the Next.js project with the three pages as empty shells
- Wire up `lib/api.ts` and `lib/sse.ts` correctly
- Apply visual design (Tailwind classes, shadcn components) per any design artifacts the user provides
- If no design artifacts provided yet, implement functional MVP with:
  - shadcn Card layouts
  - Orange accent color (matching Uniparticle brand: `#FF6B35` family)
  - Geist Sans / Inter typography
  - 2-column grid on jobs page (events left, report right)
  - Loading skeletons, error alerts, success badges
  - Dark mode supported via shadcn defaults

---

**End of plan. The builder agent has everything needed to execute. Do not skip the verification checklist in Section 18 before pushing.**
