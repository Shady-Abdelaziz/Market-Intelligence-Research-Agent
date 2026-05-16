"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { S, SpectrumGlobals, Tag } from "@/components/spectrum/primitives";

const NAV = [
  { name: "Analyze", href: "/" },
  { name: "Monitors", href: "/monitor" },
];

export default function ChromeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  return (
    <>
      <SpectrumGlobals />
      <div
        className="sp sp-page"
        style={{
          minHeight: "100vh",
          background: S.bg,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -340,
            right: -220,
            width: 820,
            height: 820,
            background: `radial-gradient(circle, ${S.coralSoft} 0%, transparent 65%)`,
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.85,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -400,
            left: -260,
            width: 760,
            height: 760,
            background: `radial-gradient(circle, ${S.violetSoft} 0%, transparent 65%)`,
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.55,
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <header
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              padding: "16px 40px",
              borderBottom: `1px solid ${S.border}`,
              backdropFilter: "blur(12px)",
              background: "rgba(247,245,240,0.78)",
              position: "sticky",
              top: 0,
              zIndex: 50,
            }}
          >
            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textDecoration: "none",
                color: S.text,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 9,
                  background: `linear-gradient(135deg, ${S.coral} 0%, ${S.violet} 100%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
                  M.I.R.A.
                </div>
                <div
                  className="sp-mono"
                  style={{ fontSize: 9, color: S.text3, letterSpacing: 0.6 }}
                >
                  v1.0 · grok-4.3
                </div>
              </div>
            </Link>

            <div style={{ width: 1, height: 24, background: S.border }} />

            <nav style={{ display: "flex", gap: 4 }}>
              {NAV.map((n) => {
                const active =
                  n.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.name}
                    href={n.href}
                    style={{
                      padding: "8px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: active ? S.text : S.text3,
                      background: active ? S.surfaceHi : "transparent",
                      borderRadius: 8,
                      textDecoration: "none",
                    }}
                  >
                    {n.name}
                  </Link>
                );
              })}
              <a
                href={`${apiBase}/docs`}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: S.text3,
                  textDecoration: "none",
                }}
              >
                API docs ↗
              </a>
            </nav>

            <div style={{ flex: 1 }} />

            <Tag color={S.mint} dot>
              live
            </Tag>
          </header>

          <main>{children}</main>

          <footer
            style={{
              borderTop: `1px solid ${S.border}`,
              padding: "18px 40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              color: S.text3,
              fontSize: 11,
            }}
          >
            <span className="sp-mono" style={{ letterSpacing: 0.6 }}>
              MARKET INTELLIGENCE · RESEARCH AGENT
            </span>
            <span className="sp-mono" style={{ letterSpacing: 0.6 }}>
              LangGraph · FastAPI · Next.js
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
