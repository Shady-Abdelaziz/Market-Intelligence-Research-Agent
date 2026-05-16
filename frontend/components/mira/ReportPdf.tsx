"use client";

/**
 * Print-optimized PDF rendering of an AnalysisReport.
 *
 * Uses @react-pdf/renderer (real PDF primitives — selectable text, vector
 * shapes, small file sizes) instead of html2canvas-style HTML rasterization.
 * The layout is intentionally NOT a mirror of the dashboard; it's a flat
 * analyst-note layout that prints well on A4 with proper page breaks.
 */

import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import type { Report } from "./Report";

const COLORS = {
  fg: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  pos: "#16a34a",
  neg: "#dc2626",
  accent: "#2563eb",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.fg,
    lineHeight: 1.4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottom: `1pt solid ${COLORS.border}`,
    paddingBottom: 10,
    marginBottom: 14,
  },
  ticker: { fontSize: 22, fontFamily: "Helvetica-Bold" },
  company: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  metaCol: { fontSize: 8, color: COLORS.muted, textAlign: "right", lineHeight: 1.5 },
  badge: {
    fontSize: 8,
    color: COLORS.neg,
    border: `1pt solid ${COLORS.neg}`,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  para: { marginBottom: 6 },
  finding: { flexDirection: "row", marginBottom: 4 },
  findingNum: {
    width: 18,
    color: COLORS.muted,
    fontFamily: "Helvetica-Bold",
  },
  findingBody: { flex: 1 },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  card: {
    border: `1pt solid ${COLORS.border}`,
    padding: 8,
    borderRadius: 3,
    marginBottom: 6,
  },
  kv: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  k: { color: COLORS.muted, fontSize: 9 },
  v: { fontFamily: "Helvetica-Bold", fontSize: 9 },
  bullCard: { borderLeft: `2pt solid ${COLORS.pos}`, paddingLeft: 8, marginBottom: 8 },
  bearCard: { borderLeft: `2pt solid ${COLORS.neg}`, paddingLeft: 8, marginBottom: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 2 },
  chipPos: { fontSize: 8, color: COLORS.pos, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: "#dcfce7", borderRadius: 999 },
  chipNeg: { fontSize: 8, color: COLORS.neg, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: "#fee2e2", borderRadius: 999 },
  corrRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  corrLabel: { width: 110, fontSize: 9 },
  corrBar: { flex: 1, height: 4, backgroundColor: COLORS.border, borderRadius: 2, overflow: "hidden" },
  corrFill: { height: "100%", backgroundColor: COLORS.fg },
  corrValue: { width: 36, textAlign: "right", fontSize: 9, fontFamily: "Helvetica-Bold" },
  corrCaption: { fontSize: 7, color: COLORS.muted, marginLeft: 110, marginBottom: 4 },
  article: { marginBottom: 4, borderBottom: `0.5pt solid ${COLORS.border}`, paddingBottom: 3 },
  articleTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  articleMeta: { fontSize: 7, color: COLORS.muted, marginTop: 1 },
  citation: { fontSize: 8, marginBottom: 2, color: COLORS.accent },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
    borderTop: `0.5pt solid ${COLORS.border}`,
    paddingTop: 6,
  },
});

function fmtBig(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e12) return (v / 1e12).toFixed(2) + "T";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return v.toFixed(0);
}

function fmtUsd(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
}

function shortDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(+d)) return s;
  return d.toISOString().slice(0, 10);
}

function corrCaption(v: number | null | undefined, kind: "index" | "peer"): string {
  if (v == null || Number.isNaN(v)) return "no overlap window";
  if (v <= -0.3) return kind === "peer" ? "Inversely tied to this peer" : "Inversely correlated";
  if (v < 0.3) return kind === "peer" ? "Trades independently of this peer" : "Moves on its own";
  if (v < 0.7) return kind === "peer" ? "Loose link to this peer" : "Mixed sector / idiosyncratic";
  if (v < 0.95) return kind === "peer" ? "Strong tie to this peer" : "Strong sector tie";
  return "Moves with the sector; idiosyncratic signal limited";
}

function CorrLine({ label, value, kind }: { label: string; value: number | null; kind: "index" | "peer" }) {
  const safe = value == null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
  return (
    <View>
      <View style={styles.corrRow}>
        <Text style={styles.corrLabel}>{label}</Text>
        <View style={styles.corrBar}>
          <View style={[styles.corrFill, { width: `${safe * 100}%` }]} />
        </View>
        <Text style={styles.corrValue}>{value == null ? "—" : value.toFixed(2)}</Text>
      </View>
      <Text style={styles.corrCaption}>{corrCaption(value, kind)}</Text>
    </View>
  );
}

function ReportPdfDocument({ report, jobId }: { report: Report; jobId: string }) {
  const m = report.market_snapshot;
  const c = report.correlation_analysis;
  const ea = report.extended_analysis;
  const hasOutlook = !!(
    ea &&
    (ea.bull_case || ea.bear_case || (ea.catalysts && ea.catalysts.length) || (ea.risks && ea.risks.length) || ea.valuation_context)
  );
  const summaryParas = (report.analysis_summary || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document
      title={`M.I.R.A. — ${report.company_ticker}`}
      author="M.I.R.A. (Market Intelligence & Research Agent)"
      subject={`Equity research note · ${report.company_name}`}
      keywords={`${report.company_ticker}, equity research, ${report.tools_used.join(", ")}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.ticker}>{report.company_ticker}</Text>
            <Text style={styles.company}>{report.company_name}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text>Equity research note</Text>
            <Text>Filed {shortDate(report.generated_at)}</Text>
            <Text>Job {jobId.slice(0, 8)}</Text>
            {report.alert_tag && <Text style={styles.badge}>{report.alert_tag}</Text>}
          </View>
        </View>

        {report.degraded && report.degradation_reason && (
          <View style={[styles.card, { borderColor: COLORS.neg, marginBottom: 10 }]}>
            <Text style={{ fontFamily: "Helvetica-Bold", color: COLORS.neg, fontSize: 9 }}>
              Degraded report · {report.degradation_reason}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>I — Summary</Text>
        {(summaryParas.length ? summaryParas : [report.analysis_summary || "—"]).map((p, i) => (
          <Text key={i} style={styles.para}>
            {p}
          </Text>
        ))}

        {hasOutlook && (
          <>
            <Text style={styles.sectionTitle}>I.5 — Outlook</Text>
            {ea?.bull_case && (
              <View style={styles.bullCard} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.pos, marginBottom: 2 }}>
                  Bull case
                </Text>
                <Text>{ea.bull_case}</Text>
              </View>
            )}
            {ea?.bear_case && (
              <View style={styles.bearCard} wrap={false}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.neg, marginBottom: 2 }}>
                  Bear case
                </Text>
                <Text>{ea.bear_case}</Text>
              </View>
            )}
            {ea?.catalysts && ea.catalysts.length > 0 && (
              <View style={{ marginBottom: 6 }} wrap={false}>
                <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 3 }}>CATALYSTS</Text>
                <View style={styles.chipsWrap}>
                  {ea.catalysts.map((cat, i) => (
                    <Text key={i} style={styles.chipPos}>
                      {cat}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {ea?.risks && ea.risks.length > 0 && (
              <View style={{ marginBottom: 6 }} wrap={false}>
                <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 3 }}>RISKS</Text>
                <View style={styles.chipsWrap}>
                  {ea.risks.map((r, i) => (
                    <Text key={i} style={styles.chipNeg}>
                      {r}
                    </Text>
                  ))}
                </View>
              </View>
            )}
            {ea?.valuation_context && (
              <Text style={{ fontSize: 8, color: COLORS.muted, marginBottom: 6 }}>
                Valuation · {ea.valuation_context}
              </Text>
            )}
          </>
        )}

        <Text style={styles.sectionTitle}>II — Key findings</Text>
        {report.key_findings.map((f, i) => (
          <View key={i} style={styles.finding} wrap={false}>
            <Text style={styles.findingNum}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.findingBody}>{f}</Text>
          </View>
        ))}

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Market snapshot</Text>
            <View style={styles.card}>
              <View style={styles.kv}>
                <Text style={styles.k}>Price</Text>
                <Text style={styles.v}>
                  ${fmtUsd(m.price)} ({fmtPct(m.daily_change_pct)})
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>Market cap</Text>
                <Text style={styles.v}>${fmtBig(m.market_cap)}</Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>P/E (TTM)</Text>
                <Text style={styles.v}>{m.pe_ratio != null ? m.pe_ratio.toFixed(1) + "×" : "—"}</Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>52-week range</Text>
                <Text style={styles.v}>
                  ${fmtUsd(m.fifty_two_week_low)} – ${fmtUsd(m.fifty_two_week_high)}
                </Text>
              </View>
              <View style={styles.kv}>
                <Text style={styles.k}>Volume</Text>
                <Text style={styles.v}>{fmtBig(m.volume)}</Text>
              </View>
              {(m.last_two_quarterly_revenues || []).map((q) => (
                <View style={styles.kv} key={q.quarter}>
                  <Text style={styles.k}>Revenue · {q.quarter}</Text>
                  <Text style={styles.v}>${fmtBig(q.revenue_usd)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Correlation · {c.window_days}d</Text>
            <View style={styles.card}>
              <CorrLine label="S&P 500 (SPY)" value={c.vs_sp500} kind="index" />
              <CorrLine label={`Sector ETF (${c.sector_etf_symbol})`} value={c.vs_sector_etf} kind="index" />
              {Object.entries(c.vs_peers).map(([p, v]) => (
                <CorrLine key={p} label={p} value={v} kind="peer" />
              ))}
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>III — News &amp; sentiment</Text>
        <Text style={{ marginBottom: 4 }}>
          Score{" "}
          <Text style={{ fontFamily: "Helvetica-Bold" }}>
            {report.sentiment_score >= 0 ? "+" : ""}
            {report.sentiment_score.toFixed(2)}
          </Text>{" "}
          · {report.sentiment_distribution.positive}+ / {report.sentiment_distribution.neutral}~ /{" "}
          {report.sentiment_distribution.negative}− across {report.sentiment_distribution.total} articles.
        </Text>
        {report.sentiment_distribution.articles.slice(0, 5).map((a, i) => (
          <View key={i} style={styles.article} wrap={false}>
            <Text style={styles.articleTitle}>{a.title || a.url}</Text>
            <Text style={styles.articleMeta}>
              {a.source || "—"} · {shortDate(a.published_at)} · {a.sentiment} ({a.sentiment_score >= 0 ? "+" : ""}
              {a.sentiment_score.toFixed(2)})
            </Text>
            {a.rationale && (
              <Text style={[styles.articleMeta, { color: COLORS.fg, marginTop: 1 }]}>{a.rationale}</Text>
            )}
          </View>
        ))}

        <Text style={styles.sectionTitle}>IV — Citations</Text>
        {report.citation_sources.map((url, i) => (
          <Link key={i} src={url} style={styles.citation}>
            [{String(i + 1).padStart(2, "0")}] {url}
          </Link>
        ))}

        <View style={styles.footer} fixed>
          <Text>
            M.I.R.A. · {report.tools_used.length} tools · {report.reflection_passes} reflection pass
            {report.reflection_passes === 1 ? "" : "es"} · ${report.token_usage.cost_usd.toFixed(4)} cost
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function exportReportPdf(report: Report, jobId: string, filename: string): Promise<void> {
  const blob = await pdf(<ReportPdfDocument report={report} jobId={jobId} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
