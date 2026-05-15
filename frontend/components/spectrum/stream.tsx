"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { S } from "./primitives";
import type { EventKind } from "./primitives";

export type CurrentTool = {
  kind: EventKind;
  name: string;
  input?: string;
  sub?: string;
};

export type TimelineEvent = {
  kind: EventKind;
  title: string;
  body: string;
  dur: string;
  flag?: boolean;
  live?: boolean;
};

export type Finding = {
  n: string;
  color: "coral" | "amber" | "azure" | "mint" | "violet" | "rose";
  h: string;
  b: string;
};

export type Citation = {
  source: string;
  title: string;
  when: string;
  color: "coral" | "amber" | "azure" | "mint" | "violet" | "rose";
};

export type MarketData = {
  price: string;
  delta: string;
  pe: string;
  peSub: string;
  range: string;
  rangeSub: string;
  q1: string;
  q1Delta: string;
  q4: string;
  q4Delta: string;
  spark: number[];
};

export type Sentiment = {
  pos: number;
  neu: number;
  neg: number;
  score: number;
  conf: number;
  label: string;
};

export type CorrelationRow = { label: string; value: number };

export type StreamState = {
  startedAt: number;
  events: TimelineEvent[];
  currentTool: CurrentTool | null;
  reflectionFired: boolean;
  replanned: boolean;
  market: MarketData | null;
  sentiment: Sentiment | null;
  correlation: CorrelationRow[] | null;
  narrative: string;
  narrativeDone: boolean;
  findings: Finding[];
  citations: Citation[];
  done: boolean;
};

export const TIMELINE_INITIAL: StreamState = {
  startedAt: 0,
  events: [],
  currentTool: null,
  reflectionFired: false,
  replanned: false,
  market: null,
  sentiment: null,
  correlation: null,
  narrative: "",
  narrativeDone: false,
  findings: [],
  citations: [],
  done: false,
};

const NARRATIVE_TEXT =
  "Coca-Cola is exhibiting sector-correlated weakness with idiosyncratic volume concerns. " +
  "North America volume declined 1.4% in the latest 10-Q while pricing rose 4.2% — " +
  "indicating elasticity headwinds that pricing power can mask only so long.";

function buildNarrativeStream(startAt: number, totalMs: number) {
  const tokens = NARRATIVE_TEXT.split(/(\s+)/).filter(Boolean);
  const n = tokens.length;
  const base = totalMs / n;
  const out: Array<{ at: number; token: string }> = [];
  let cursor = startAt;
  for (let i = 0; i < n; i++) {
    const tok = tokens[i];
    const jitter = (Math.sin(i * 1.7) + 1) * base * 0.3;
    let step = base + jitter * 0.4;
    if (/[.,—]$/.test(tok)) step += base * 3.5;
    out.push({ at: cursor, token: tok });
    cursor += step;
  }
  return out;
}

type TimelineStep = { at: number; apply: (s: StreamState) => StreamState };

function makeTimeline(): TimelineStep[] {
  const T: TimelineStep[] = [];

  T.push({
    at: 200,
    apply: (s) => ({
      ...s,
      events: [
        ...s.events,
        {
          kind: "plan",
          title: "Plan · 3 tools + reflection guard",
          body: "extract → market · news · correlation",
          dur: "0.4s",
        },
      ],
    }),
  });

  T.push({
    at: 700,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "tool",
        name: "market_data(KO)",
        input: '{ ticker: "KO" }',
        sub: "fetching quote and last 2 quarterly revenues from yfinance",
      },
    }),
  });

  T.push({
    at: 1500,
    apply: (s) => ({
      ...s,
      currentTool: null,
      market: {
        price: "$61.42",
        delta: "−0.6%",
        pe: "22.4",
        peSub: "sector 19.8",
        range: "54.0—66.2",
        rangeSub: "now 36th pct.",
        q1: "$11.30B",
        q1Delta: "+1.5%",
        q4: "$10.85B",
        q4Delta: "+8.2%",
        spark: [
          63.8, 64.1, 63.6, 63.9, 64.3, 63.7, 63.4, 63.0, 62.6, 62.8, 62.2, 61.8, 62.0,
          61.6, 61.42,
        ],
      },
      events: [
        ...s.events,
        {
          kind: "tool",
          title: "market_data(KO)",
          body: "$61.42 ↓0.6% · pe 22.4 · 52w 54.0–66.2",
          dur: "142ms",
        },
      ],
    }),
  });

  T.push({
    at: 1700,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "tool",
        name: "news_sentiment(KO, n=5)",
        input: '{ ticker: "KO", n: 5 }',
        sub: "NewsAPI top 5 articles · per-article sentiment + Marketaux cross-check",
      },
    }),
  });

  T.push({
    at: 2600,
    apply: (s) => ({
      ...s,
      currentTool: null,
      sentiment: { pos: 1, neu: 3, neg: 1, score: -0.04, conf: 0.55, label: "soft" },
      events: [
        ...s.events,
        {
          kind: "tool",
          title: "news_sentiment(KO, n=5)",
          body: "pos 1 · neu 3 · neg 1 — soft",
          dur: "631ms",
        },
      ],
    }),
  });

  T.push({
    at: 2800,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "tool",
        name: "correlation(KO, [SPX, XLP, PEP, MNST])",
        input: '{ window: "90d" }',
        sub: "Pearson over trailing 90 trading days vs benchmark, sector, peers",
      },
    }),
  });

  T.push({
    at: 3300,
    apply: (s) => ({
      ...s,
      currentTool: null,
      correlation: [
        { label: "vs. S&P 500", value: 0.81 },
        { label: "vs. XLP · sector", value: 0.94 },
        { label: "vs. PEP · peer", value: 0.71 },
        { label: "vs. MNST · peer", value: 0.34 },
      ],
      events: [
        ...s.events,
        {
          kind: "tool",
          title: "correlation(KO, [SPX, XLP, PEP, MNST])",
          body: "0.81 · 0.94 · 0.71 · 0.34",
          dur: "412ms",
        },
      ],
    }),
  });

  T.push({
    at: 3700,
    apply: (s) => ({
      ...s,
      reflectionFired: true,
      events: [
        ...s.events,
        {
          kind: "reflect",
          title: "critic · neutral_even fired",
          body: "|pos − neg| = 0 and neu ≥ 3",
          dur: "0.5s",
          flag: true,
        },
      ],
    }),
  });

  T.push({
    at: 4100,
    apply: (s) => ({
      ...s,
      replanned: true,
      events: [
        ...s.events,
        {
          kind: "replan",
          title: "Re-plan · +2 tools",
          body: "+ edgar · + news(analyst)",
          dur: "0.2s",
        },
      ],
    }),
  });

  T.push({
    at: 4400,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "tool",
        name: "edgar(KO)",
        input: '{ filings: ["10-Q", "8-K"], since: "30d" }',
        sub: "SEC EDGAR — fetching last 30-day filings (proper User-Agent set)",
      },
    }),
  });

  T.push({
    at: 5300,
    apply: (s) => ({
      ...s,
      currentTool: null,
      events: [
        ...s.events,
        {
          kind: "tool",
          title: "edgar(KO)",
          body: "10-Q apr 23 · NA vol −1.4% · pricing +4.2%",
          dur: "880ms",
        },
      ],
    }),
  });

  T.push({
    at: 5500,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "tool",
        name: 'news_sentiment(KO, "analyst commentary")',
        input: '{ query: "analyst commentary", recency: "7d" }',
        sub: "expanding research — fetching analyst notes after reflection",
      },
    }),
  });

  T.push({
    at: 6100,
    apply: (s) => ({
      ...s,
      currentTool: null,
      sentiment: { pos: 3, neu: 4, neg: 1, score: -0.12, conf: 0.66, label: "cautious" },
      events: [
        ...s.events,
        {
          kind: "tool",
          title: 'news_sentiment(KO, "analyst")',
          body: "pos 2 · neu 1 — RBC outperform · Citi neutral",
          dur: "522ms",
        },
      ],
    }),
  });

  T.push({
    at: 6300,
    apply: (s) => ({
      ...s,
      currentTool: {
        kind: "synth",
        name: "synthesize report",
        input: '{ model: "grok-4.3", stream: true }',
        sub: "composing structured report — streaming tokens →",
      },
      events: [
        ...s.events,
        {
          kind: "synth",
          title: "synthesize report",
          body: "streaming tokens to report panel",
          dur: "now",
          live: true,
        },
      ],
    }),
  });

  const narrStart = 6500;
  const narrEnd = 13200;
  const narrEvents = buildNarrativeStream(narrStart, narrEnd - narrStart);
  let narrAcc = "";
  for (const ne of narrEvents) {
    narrAcc += ne.token;
    const snapshot = narrAcc;
    T.push({ at: ne.at, apply: (s) => ({ ...s, narrative: snapshot }) });
  }

  T.push({
    at: 13400,
    apply: (s) => ({
      ...s,
      narrativeDone: true,
      findings: [
        ...s.findings,
        {
          n: "01",
          color: "coral",
          h: "Volume decline despite pricing power",
          b: "NA unit case volume −1.4% YoY (Q1) while net pricing +4.2% — masks softening demand. Watch elasticity into summer as the comp base hardens.",
        },
      ],
    }),
  });
  T.push({
    at: 13700,
    apply: (s) => ({
      ...s,
      findings: [
        ...s.findings,
        {
          n: "02",
          color: "amber",
          h: "Sector beta dominates near-term",
          b: "XLP correlation at 0.94. KO is moving with the staples cohort more than on company-specific catalysts. Idiosyncratic alpha is thin.",
        },
      ],
    }),
  });
  T.push({
    at: 14000,
    apply: (s) => ({
      ...s,
      findings: [
        ...s.findings,
        {
          n: "03",
          color: "azure",
          h: "Analyst tone constructive despite softness",
          b: "RBC reiterates Outperform ($72 PT); Citi Neutral; Morgan Stanley flags pricing offset. Volume risk acknowledged but not yet priced.",
        },
      ],
    }),
  });

  T.push({
    at: 14400,
    apply: (s) => ({
      ...s,
      citations: [
        ...s.citations,
        {
          source: "SEC · EDGAR",
          title: "KO Form 10-Q — Q1 2026",
          when: "23 apr",
          color: "azure",
        },
      ],
    }),
  });
  T.push({
    at: 14600,
    apply: (s) => ({
      ...s,
      citations: [
        ...s.citations,
        {
          source: "Reuters",
          title: "Coca-Cola lifts annual sales forecast on price hikes",
          when: "30 apr",
          color: "mint",
        },
      ],
    }),
  });
  T.push({
    at: 14800,
    apply: (s) => ({
      ...s,
      citations: [
        ...s.citations,
        {
          source: "WSJ",
          title: "Volume softness flagged as pricing nears ceiling",
          when: "02 may",
          color: "coral",
        },
      ],
    }),
  });
  T.push({
    at: 15000,
    apply: (s) => ({
      ...s,
      citations: [
        ...s.citations,
        {
          source: "RBC CM",
          title: "Reiterating Outperform, raising PT to $72",
          when: "10 may",
          color: "violet",
        },
      ],
    }),
  });

  T.push({
    at: 15400,
    apply: (s) => ({
      ...s,
      done: true,
      currentTool: null,
      events: [
        ...s.events.map((e) => (e.live ? { ...e, live: false, dur: "8.1s" } : e)),
        {
          kind: "done",
          title: "Filed.",
          body: "4.2k tokens · $0.018 · cache hit 31%",
          dur: "15.4s",
        },
      ],
    }),
  });

  return T;
}

export const TIMELINE = makeTimeline();
export const TIMELINE_DURATION = 15800;

export type StreamControlsValue = {
  replay: () => void;
  togglePlay: () => void;
  playing: boolean;
  elapsed: number;
  done: boolean;
};

export function useAgentStream(timeline = TIMELINE): {
  state: StreamState;
  controls: StreamControlsValue;
} {
  const [state, setState] = useState<StreamState>(TIMELINE_INITIAL);
  const [playing, setPlaying] = useState(true);
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    if (!playing) return;
    if (step >= timeline.length) return;
    const next = timeline[step];
    const targetTime = next.at;
    const now = performance.now() - startRef.current;
    const delay = Math.max(0, targetTime - now);
    const t = setTimeout(() => {
      setState((prev) => next.apply(prev));
      setStep((s) => s + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [playing, step, timeline]);

  useEffect(() => {
    if (!playing) return;
    if (step >= timeline.length) return;
    const id = setInterval(() => {
      setElapsed(Math.min(TIMELINE_DURATION, performance.now() - startRef.current));
    }, 60);
    return () => clearInterval(id);
  }, [playing, step, timeline.length]);

  const replay = useCallback(() => {
    setState(TIMELINE_INITIAL);
    setStep(0);
    setElapsed(0);
    startRef.current = performance.now();
    setPlaying(true);
  }, []);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (p) return false;
      startRef.current = performance.now() - elapsed;
      return true;
    });
  }, [elapsed]);

  return {
    state,
    controls: { replay, togglePlay, playing, elapsed, done: step >= timeline.length },
  };
}

export function StreamControls({ controls }: { controls: StreamControlsValue }) {
  const pct = Math.min(100, (controls.elapsed / TIMELINE_DURATION) * 100);
  return (
    <div
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        background: "rgba(247,245,240,0.92)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${S.border}`,
        borderRadius: 100,
        boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
      }}
    >
      <button
        onClick={controls.togglePlay}
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          border: "none",
          background: S.coral,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
        }}
        title={controls.playing ? "pause" : "play"}
      >
        {controls.playing ? "❚❚" : "▶"}
      </button>
      <div style={{ width: 180 }}>
        <div
          className="sp-mono"
          style={{
            fontSize: 10,
            color: S.text3,
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span>{(controls.elapsed / 1000).toFixed(1)}s</span>
          <span>{controls.done ? "done" : "streaming"}</span>
          <span>{(TIMELINE_DURATION / 1000).toFixed(1)}s</span>
        </div>
        <div
          style={{
            height: 4,
            background: S.surfaceHi,
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${S.coral}, ${S.violet})`,
              borderRadius: 2,
              transition: "width 60ms linear",
            }}
          />
        </div>
      </div>
      <button
        onClick={controls.replay}
        style={{
          padding: "6px 14px",
          border: `1px solid ${S.border}`,
          background: S.surface,
          color: S.text,
          fontSize: 12,
          fontWeight: 500,
          borderRadius: 100,
          cursor: "pointer",
          fontFamily: S.fSans,
        }}
      >
        ↻ Replay
      </button>
    </div>
  );
}
