"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postAnalyze } from "@/lib/api";
import { Btn, Eyebrow, S, Tag } from "@/components/spectrum/primitives";

interface Sample {
  ticker: string;
  company: string;
  prompt: string;
  color: string;
  tagline: string;
}

const SAMPLES: Sample[] = [
  {
    ticker: "TSLA",
    company: "Tesla, Inc.",
    prompt: "Analyze the near-term prospects of Tesla, Inc. (TSLA).",
    color: S.coral,
    tagline: "Near-term prospects",
  },
  {
    ticker: "AAPL",
    company: "Apple Inc.",
    prompt: "What's the outlook for Apple (AAPL) given recent news?",
    color: S.azure,
    tagline: "Outlook given news",
  },
  {
    ticker: "KO",
    company: "Coca-Cola Co.",
    prompt: "Should I be concerned about Coca-Cola (KO) right now?",
    color: S.amber,
    tagline: "Risk assessment",
  },
  {
    ticker: "NVDA",
    company: "NVIDIA Corp.",
    prompt: "Deep dive on NVDA fundamentals and sentiment.",
    color: S.violet,
    tagline: "Fundamentals & sentiment",
  },
];

const PIPELINE = [
  { n: "01", label: "Plan", c: S.azure, sub: "Extract ticker · decompose query" },
  { n: "02", label: "Tools", c: S.mint, sub: "Market · news · correlation · peers" },
  { n: "03", label: "Reflect", c: S.amber, sub: "Critique · re-plan if needed" },
  { n: "04", label: "Synthesize", c: S.violet, sub: "Stream the dossier · 3 findings" },
];

const CAPABILITIES = [
  {
    title: "Market data",
    body: "Price, P/E, market cap, 52-week range, and last two quarterly revenues — pulled live via yfinance.",
    c: S.mint,
  },
  {
    title: "News & sentiment",
    body: "Five most-relevant articles with per-article sentiment, deduped, and cross-referenced for citation.",
    c: S.azure,
  },
  {
    title: "Correlation & peers",
    body: "Pearson correlation vs S&P 500, sector ETF, and configurable peers over the analysis window.",
    c: S.violet,
  },
  {
    title: "Reflection & replan",
    body: "If sector correlation exceeds 0.95, news is stale, or sentiment is even — a second research pass fires automatically.",
    c: S.amber,
  },
  {
    title: "Persistent monitors",
    body: "Subscribe to a ticker and M.I.R.A. wakes on a 24h cadence — only reruns when material change is detected.",
    c: S.coral,
  },
  {
    title: "Observability",
    body: "Per-tool latency, token usage, and dollar cost streamed to the live dossier and persisted to Postgres.",
    c: S.rose,
  },
];

export default function SubmitPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(q: string) {
    setErr(null);
    setLoading(true);
    try {
      const { job_id } = await postAnalyze(q);
      router.push(`/jobs/${job_id}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to submit";
      setErr(msg);
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "0 40px 80px" }}>
      {/* Hero */}
      <section style={{ padding: "72px 0 56px", maxWidth: 1100 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 22,
            flexWrap: "wrap",
          }}
        >
          <Eyebrow>Autonomous equity research</Eyebrow>
          <span style={{ color: S.text4 }}>·</span>
          <Tag color={S.coral}>v1.0</Tag>
          <span style={{ color: S.text4 }}>·</span>
          <span className="sp-mono" style={{ fontSize: 11, color: S.text3 }}>
            LangGraph · grok-4.3 · ≤ 10 tool calls
          </span>
        </div>

        <h1
          className="sp-h1"
          style={{
            fontSize: "clamp(48px, 8vw, 104px)",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 0.98,
            margin: 0,
          }}
        >
          Plan. Probe.
          <br />
          <span
            style={{
              background: `linear-gradient(120deg, ${S.coral} 0%, ${S.violet} 100%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Synthesize.
          </span>
        </h1>

        <p
          style={{
            marginTop: 24,
            maxWidth: 720,
            fontSize: 19,
            lineHeight: 1.5,
            color: S.text2,
            fontWeight: 400,
          }}
        >
          M.I.R.A. is an autonomous research agent. Ask about a public equity in
          natural language — it plans the research, calls market-data, news, and
          correlation tools, reflects on the evidence, and files a structured
          investment analysis you can read while it streams.
        </p>

        {/* Submit form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (query.trim()) submit(query.trim());
          }}
          style={{ marginTop: 36 }}
        >
          <div
            style={{
              background: S.surface,
              border: `1px solid ${S.border}`,
              borderLeft: `3px solid ${S.coral}`,
              borderRadius: 14,
              padding: 18,
              boxShadow: "0 4px 24px rgba(12,13,17,0.04)",
            }}
          >
            <Eyebrow style={{ marginBottom: 10 }}>Operator&apos;s brief</Eyebrow>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='e.g. "Analyze the near-term prospects of Tesla, Inc. (TSLA)."'
              rows={3}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                resize: "vertical",
                background: "transparent",
                fontFamily: S.fSans,
                fontSize: 18,
                lineHeight: 1.45,
                color: S.text,
                letterSpacing: -0.2,
                fontWeight: 500,
                minHeight: 76,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${S.border}`,
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <span
                className="sp-mono"
                style={{ fontSize: 11, color: S.text3, letterSpacing: 0.4 }}
              >
                natural language · any US equity
              </span>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {err && (
                  <span
                    className="sp-mono"
                    style={{ fontSize: 11, color: S.rose }}
                  >
                    {err}
                  </span>
                )}
                <Btn
                  primary
                  type="submit"
                  disabled={loading || !query.trim()}
                  iconRight={<span>→</span>}
                  style={{
                    opacity: loading || !query.trim() ? 0.5 : 1,
                    cursor:
                      loading || !query.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Submitting…" : "Run analysis"}
                </Btn>
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Pipeline strip */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 0,
          marginBottom: 64,
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {PIPELINE.map((p, i) => (
          <div
            key={p.label}
            style={{
              padding: "22px 24px",
              borderRight:
                i < PIPELINE.length - 1 ? `1px solid ${S.border}` : "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                background: p.c,
                opacity: 0.8,
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
              }}
            >
              <span
                className="sp-mono"
                style={{
                  fontSize: 11,
                  color: p.c,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                }}
              >
                {p.n}
              </span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: -0.2,
                  color: S.text,
                }}
              >
                {p.label}
              </span>
            </div>
            <div className="sp-mono" style={{ fontSize: 11, color: S.text3 }}>
              {p.sub}
            </div>
          </div>
        ))}
      </section>

      {/* Sample queries */}
      <section style={{ marginBottom: 64 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <Eyebrow serial="A">Try a sample</Eyebrow>
          <span style={{ flex: 1, height: 1, background: S.border }} />
          <span className="sp-mono" style={{ fontSize: 10, color: S.text3 }}>
            one click · ~20s end-to-end
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 14,
          }}
        >
          {SAMPLES.map((s) => (
            <button
              key={s.ticker}
              onClick={() => submit(s.prompt)}
              disabled={loading}
              style={{
                textAlign: "left",
                padding: 20,
                background: S.surface,
                border: `1px solid ${S.border}`,
                borderTop: `2px solid ${s.color}`,
                borderRadius: 14,
                cursor: loading ? "wait" : "pointer",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transition:
                  "transform .15s, box-shadow .15s, border-color .15s",
                font: "inherit",
                fontFamily: S.fSans,
                color: S.text,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 10px 28px rgba(12,13,17,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  className="sp-mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: s.color,
                    padding: "3px 9px",
                    background: `${s.color}1a`,
                    border: `1px solid ${s.color}3a`,
                    borderRadius: 4,
                    letterSpacing: 1,
                  }}
                >
                  NYSE : {s.ticker}
                </span>
                <Tag color={s.color}>{s.tagline}</Tag>
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: -0.3,
                  color: S.text,
                  lineHeight: 1.25,
                }}
              >
                {s.company}
              </div>
              <div style={{ fontSize: 13, color: S.text2, lineHeight: 1.45 }}>
                {s.prompt}
              </div>
              <div
                className="sp-mono"
                style={{
                  fontSize: 10,
                  color: S.text3,
                  marginTop: "auto",
                  paddingTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>RUN ANALYSIS</span>
                <span style={{ color: s.color }}>→</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Capabilities grid */}
      <section>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <Eyebrow serial="B">Inside the loop</Eyebrow>
          <span style={{ flex: 1, height: 1, background: S.border }} />
          <span className="sp-mono" style={{ fontSize: 10, color: S.text3 }}>
            six surfaces · one report
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {CAPABILITIES.map((c) => (
            <div
              key={c.title}
              style={{
                padding: 20,
                background: S.surface,
                border: `1px solid ${S.border}`,
                borderRadius: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: c.c,
                    boxShadow: `0 0 10px ${c.c}80`,
                  }}
                />
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    letterSpacing: -0.2,
                    color: S.text,
                  }}
                >
                  {c.title}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: S.text2,
                  lineHeight: 1.55,
                }}
              >
                {c.body}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
