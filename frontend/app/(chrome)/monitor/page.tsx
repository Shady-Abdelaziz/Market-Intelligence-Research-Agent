"use client";
import { useEffect, useState } from "react";
import {
  deleteMonitor,
  listMonitors,
  monitorHistory,
  postMonitorStart,
} from "@/lib/api";
import { Btn, Eyebrow, S, Tag } from "@/components/spectrum/primitives";

interface Monitor {
  id: string;
  ticker: string;
  cadence_seconds: number;
  peers?: string[];
  active: boolean;
  last_run_at?: string | null;
  baseline_price_mean?: number | null;
  baseline_price_std?: number | null;
  baseline_volume_avg?: number | null;
}

interface HistoryEntry {
  job_id: string;
  created_at: string;
  triggers_fired?: string[];
}

const TRIGGERS = [
  { label: "≥5 new articles", c: S.azure },
  { label: "Price > 2σ move", c: S.coral },
  { label: "Volume > 2× avg", c: S.violet },
];

export default function MonitorPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [ticker, setTicker] = useState("");
  const [cadence, setCadence] = useState(86400);
  const [peers, setPeers] = useState("");
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const data = await listMonitors();
      setMonitors(data as Monitor[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to list monitors";
      setErr(msg);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    setErr(null);
    if (!ticker.trim()) {
      setErr("Ticker required");
      return;
    }
    setBusy(true);
    try {
      await postMonitorStart(
        ticker.toUpperCase(),
        cadence,
        peers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
      setTicker("");
      setPeers("");
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "failed";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: string) {
    await deleteMonitor(t);
    await refresh();
  }

  async function loadHistory(t: string) {
    setHistory((h) => ({ ...h, [t]: [] }));
    const rows = await monitorHistory(t);
    setHistory((h) => ({ ...h, [t]: rows as HistoryEntry[] }));
  }

  return (
    <div style={{ padding: "0 40px 80px" }}>
      <section style={{ padding: "56px 0 36px", maxWidth: 1100 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <Eyebrow>Persistent monitors</Eyebrow>
          <span style={{ color: S.text4 }}>·</span>
          <Tag color={S.coral}>cron · trading days</Tag>
        </div>

        <h1
          className="sp-h1"
          style={{
            fontSize: "clamp(40px, 6vw, 72px)",
            fontWeight: 600,
            letterSpacing: "-0.035em",
            lineHeight: 1.0,
            margin: 0,
          }}
        >
          Watch tickers. Re-run on signal.
        </h1>

        <p
          style={{
            marginTop: 18,
            maxWidth: 720,
            fontSize: 17,
            lineHeight: 1.5,
            color: S.text2,
          }}
        >
          M.I.R.A. wakes on a cadence (default 24h, trading days only) and only
          spends tokens on a fresh analysis if something material has changed
          since the last run.
        </p>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 22,
            flexWrap: "wrap",
          }}
        >
          {TRIGGERS.map((t) => (
            <Tag key={t.label} color={t.c} dot>
              {t.label}
            </Tag>
          ))}
        </div>
      </section>

      <section
        style={{
          marginBottom: 40,
          background: S.surface,
          border: `1px solid ${S.border}`,
          borderLeft: `3px solid ${S.violet}`,
          borderRadius: 14,
          padding: 22,
        }}
      >
        <Eyebrow serial="01" style={{ marginBottom: 14 }}>
          Add monitor
        </Eyebrow>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "120px 160px 1fr auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          <Field label="Ticker">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="AAPL"
              style={inputStyle}
            />
          </Field>
          <Field label="Cadence (sec)">
            <input
              type="number"
              value={cadence}
              onChange={(e) => setCadence(parseInt(e.target.value) || 0)}
              style={inputStyle}
            />
          </Field>
          <Field label="Peers (comma)">
            <input
              value={peers}
              onChange={(e) => setPeers(e.target.value)}
              placeholder="MSFT, GOOGL"
              style={inputStyle}
            />
          </Field>
          <Btn
            primary
            onClick={add}
            disabled={busy || !ticker.trim()}
            iconRight={<span>→</span>}
            style={{
              opacity: busy || !ticker.trim() ? 0.5 : 1,
              cursor: busy || !ticker.trim() ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Adding…" : "Start"}
          </Btn>
        </div>
        {err && (
          <div
            className="sp-mono"
            style={{ fontSize: 11, color: S.rose, marginTop: 10 }}
          >
            {err}
          </div>
        )}
      </section>

      <section>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <Eyebrow serial="02">Active monitors</Eyebrow>
          <span style={{ flex: 1, height: 1, background: S.border }} />
          <span className="sp-mono" style={{ fontSize: 10, color: S.text3 }}>
            {monitors.length} watching
          </span>
        </div>

        {monitors.length === 0 ? (
          <div
            style={{
              padding: 28,
              background: S.surface,
              border: `1px dashed ${S.borderHi}`,
              borderRadius: 14,
              textAlign: "center",
              color: S.text3,
            }}
          >
            <Eyebrow>no active monitors</Eyebrow>
            <div style={{ marginTop: 10, fontSize: 14 }}>
              Add a ticker above to begin proactive monitoring.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {monitors.map((m) => {
              const hours = (m.cadence_seconds / 3600).toFixed(0);
              const rows = history[m.ticker];
              return (
                <div
                  key={m.ticker}
                  style={{
                    padding: 22,
                    background: S.surface,
                    border: `1px solid ${S.border}`,
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 16,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="sp-mono"
                        style={{
                          fontSize: 18,
                          fontWeight: 600,
                          color: S.coral,
                          padding: "5px 12px",
                          background: S.coralSoft,
                          border: `1px solid ${S.coralLine}`,
                          borderRadius: 6,
                          letterSpacing: 1,
                        }}
                      >
                        {m.ticker}
                      </span>
                      <div>
                        <div
                          className="sp-mono"
                          style={{
                            fontSize: 11,
                            color: S.text3,
                            letterSpacing: 0.4,
                            marginBottom: 4,
                          }}
                        >
                          cadence {hours}h · last run{" "}
                          {m.last_run_at
                            ? new Date(m.last_run_at).toLocaleString()
                            : "—"}
                        </div>
                        <div style={{ display: "flex", gap: 18 }}>
                          <Mini
                            label="μ price"
                            value={
                              m.baseline_price_mean != null
                                ? `$${m.baseline_price_mean.toFixed(2)}`
                                : "—"
                            }
                          />
                          <Mini
                            label="σ price"
                            value={
                              m.baseline_price_std != null
                                ? `±${m.baseline_price_std.toFixed(2)}`
                                : "—"
                            }
                          />
                          <Mini
                            label="μ volume"
                            value={
                              m.baseline_volume_avg != null
                                ? formatVolume(m.baseline_volume_avg)
                                : "—"
                            }
                          />
                        </div>
                        {m.peers && m.peers.length > 0 && (
                          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                            <span
                              className="sp-mono"
                              style={{ fontSize: 10, color: S.text3 }}
                            >
                              peers:
                            </span>
                            {m.peers.map((p) => (
                              <Tag key={p} color={S.azure}>
                                {p}
                              </Tag>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Btn ghost small onClick={() => loadHistory(m.ticker)}>
                        History
                      </Btn>
                      <Btn
                        ghost
                        small
                        onClick={() => remove(m.ticker)}
                        style={{ color: S.rose, borderColor: `${S.rose}3a` }}
                      >
                        Stop
                      </Btn>
                    </div>
                  </div>

                  {rows !== undefined && (
                    <div
                      style={{
                        marginTop: 18,
                        paddingTop: 16,
                        borderTop: `1px solid ${S.border}`,
                      }}
                    >
                      <Eyebrow style={{ marginBottom: 10 }}>
                        proactive alerts
                      </Eyebrow>
                      {rows.length === 0 ? (
                        <div
                          className="sp-mono"
                          style={{ fontSize: 11, color: S.text3 }}
                        >
                          no alerts fired yet — baselines still settling
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                          }}
                        >
                          {rows.map((h) => (
                            <a
                              key={h.job_id}
                              href={`/jobs/${h.job_id}`}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "8px 12px",
                                background: S.surfaceHi,
                                borderRadius: 8,
                                textDecoration: "none",
                                color: S.text,
                              }}
                            >
                              <Tag color={S.coral} solid>
                                alert
                              </Tag>
                              <span
                                className="sp-mono"
                                style={{ fontSize: 11, color: S.text2 }}
                              >
                                {new Date(h.created_at).toLocaleString()}
                              </span>
                              <span style={{ flex: 1 }} />
                              <span
                                className="sp-mono"
                                style={{ fontSize: 11, color: S.text3 }}
                              >
                                {(h.triggers_fired || []).join(" · ") || "—"}
                              </span>
                              <span style={{ color: S.coral }}>→</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        className="sp-mono"
        style={{ fontSize: 9, color: S.text3, letterSpacing: 0.5 }}
      >
        {label.toUpperCase()}
      </span>
      <span
        className="sp-num"
        style={{ fontSize: 14, color: S.text, fontWeight: 500 }}
      >
        {value}
      </span>
    </div>
  );
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

const inputStyle: React.CSSProperties = {
  background: S.surfaceHi,
  border: `1px solid ${S.border}`,
  borderRadius: 8,
  padding: "9px 12px",
  fontFamily: S.fMono,
  fontSize: 13,
  color: S.text,
  outline: "none",
};
