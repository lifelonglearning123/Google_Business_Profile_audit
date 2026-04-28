import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Line,
  Circle,
} from "@react-pdf/renderer";
import type { Audit } from "@/lib/types";
import { BRAND_NAME } from "@/lib/brand";

/* ──── Palette (matches web) ──── */
const BRAND = "#4f46e5";
const BRAND_SOFT = "#eef2ff";
const GOOD = "#10b981";
const WARN = "#f59e0b";
const BAD = "#ef4444";
const INK = "#0f172a";
const INK_MUTED = "#64748b";
const INK_FAINT = "#94a3b8";
const HAIRLINE = "#e5e7eb";
const SURFACE = "#fafafa";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: INK,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  eyebrow: {
    fontSize: 8,
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h2: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: BRAND,
  },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  muted: { color: INK_MUTED },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: HAIRLINE,
    padding: 18,
    marginBottom: 18,
    backgroundColor: SURFACE,
  },
  heroLeft: { flex: 1 },
  statRow: { flexDirection: "row", gap: 20, marginTop: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: HAIRLINE, borderRadius: 4, padding: 8, backgroundColor: "#ffffff" },
  statLabel: {
    fontSize: 7,
    color: INK_FAINT,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: "Helvetica-Bold",
  },
  statValue: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 3, color: INK },
  subRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  barBg: { height: 5, backgroundColor: "#f1f5f9", borderRadius: 3, marginBottom: 6 },
  barFill: { height: 5, borderRadius: 3 },
  findingItem: { color: INK_MUTED, marginBottom: 2, paddingLeft: 8, fontSize: 9, lineHeight: 1.4 },
  card: {
    borderWidth: 1,
    borderColor: HAIRLINE,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#ffffff",
  },
  recHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  pill: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    padding: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
  },
  effortHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    marginBottom: 6,
  },
  effortLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: BRAND,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  rule: { flex: 1, height: 1, backgroundColor: HAIRLINE, marginLeft: 8 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: INK_FAINT,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingTop: 6,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    paddingLeft: 10,
    marginBottom: 6,
  },
});

function zoneColor(n: number): string {
  if (n >= 75) return GOOD;
  if (n >= 60) return WARN;
  return BAD;
}

function priorityColor(p: string): string {
  if (p === "high") return BAD;
  if (p === "medium") return WARN;
  return INK_MUTED;
}

const EFFORT_LABELS: Record<string, string> = {
  "quick-win": "Quick wins · Today",
  medium: "This week",
  project: "Bigger projects",
};
const EFFORT_ORDER = ["quick-win", "medium", "project"];

/* ──── PDF score dial (segmented arc) ──── */
function PdfScoreDial({ score, grade, size = 110 }: { score: number; grade: string; size?: number }) {
  const TICKS = 32;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - 10) / 2;
  const innerR = outerR - 6;
  const lit = Math.round((score / 100) * TICKS);

  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size}>
        {Array.from({ length: TICKS }).map((_, i) => {
          const angle = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
          const x1 = cx + innerR * Math.cos(angle);
          const y1 = cy + innerR * Math.sin(angle);
          const x2 = cx + outerR * Math.cos(angle);
          const y2 = cy + outerR * Math.sin(angle);
          const pct = (i / TICKS) * 100;
          const color =
            i < lit ? (pct < 45 ? BAD : pct < 75 ? WARN : GOOD) : HAIRLINE;
          return (
            <Line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          );
        })}
        <Circle cx={cx} cy={cy} r={innerR - 2} fill="#ffffff" />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: INK }}>{score}</Text>
        <Text style={{ fontSize: 7, color: INK_FAINT, fontFamily: "Helvetica-Bold", letterSpacing: 1, marginTop: 2 }}>
          GRADE {grade}
        </Text>
      </View>
    </View>
  );
}

/* ──── Main document ──── */
export default function ReportPdf({ audit }: { audit: Audit }) {
  const { gbp, scorecard, narrative, input } = audit;

  const groupedRecs = EFFORT_ORDER.map((effort) => ({
    effort,
    items: narrative.recommendations
      .filter((r) => (r.effort ?? "medium") === effort)
      .sort(
        (a, b) =>
          priorityWeight(a.priority) - priorityWeight(b.priority)
      ),
  })).filter((g) => g.items.length > 0);

  return (
    <Document
      title={`${BRAND_NAME} — ${gbp.name}`}
      author={BRAND_NAME}
      subject="Google Business Profile audit report"
    >
      {/* ─── Page 1: Hero + Scorecard ─── */}
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <PdfScoreDial score={scorecard.overall} grade={scorecard.grade} />
          <View style={styles.heroLeft}>
            <Text style={styles.eyebrow}>{BRAND_NAME} Report</Text>
            <Text style={styles.h1}>{gbp.name}</Text>
            <Text style={[styles.muted, { fontSize: 9 }]}>
              {[input.industry, gbp.address, input.location].filter(Boolean).join("  ·  ")}
            </Text>
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Rating</Text>
                <Text style={styles.statValue}>{gbp.rating ? gbp.rating.toFixed(1) : "—"}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Reviews</Text>
                <Text style={styles.statValue}>{gbp.reviewCount ?? "—"}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Categories</Text>
                <Text style={styles.statValue}>{gbp.categories.length}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Photos</Text>
                <Text style={styles.statValue}>{gbp.photoCount ?? "—"}</Text>
              </View>
            </View>
          </View>
        </View>

        {narrative.summary ? (
          <>
            <Text style={styles.h2}>Executive Summary</Text>
            <View style={styles.quote}>
              <Text style={{ lineHeight: 1.55, fontSize: 11, color: INK }}>
                {narrative.summary}
              </Text>
            </View>
          </>
        ) : null}

        {(narrative.strengths.length > 0 || narrative.weaknesses.length > 0) && (
          <>
            <Text style={styles.h2}>Strengths & Issues</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={[styles.h3, { color: GOOD }]}>Strengths</Text>
                {narrative.strengths.length === 0 ? (
                  <Text style={styles.muted}>None identified.</Text>
                ) : (
                  narrative.strengths.map((s, i) => (
                    <Text key={i} style={styles.findingItem}>• {s}</Text>
                  ))
                )}
              </View>
              <View style={[styles.card, { flex: 1 }]}>
                <Text style={[styles.h3, { color: BAD }]}>Issues to Fix</Text>
                {narrative.weaknesses.length === 0 ? (
                  <Text style={styles.muted}>None identified.</Text>
                ) : (
                  narrative.weaknesses.map((w, i) => (
                    <Text key={i} style={styles.findingItem}>• {w}</Text>
                  ))
                )}
              </View>
            </View>
          </>
        )}

        <Text style={styles.h2}>Scorecard</Text>
        {scorecard.subScores.map((s) => (
          <View key={s.key} style={{ marginBottom: 10 }}>
            <View style={styles.subRow}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{s.label}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{s.score}/100</Text>
            </View>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${s.score}%`, backgroundColor: zoneColor(s.score) },
                ]}
              />
            </View>
            {s.findings.slice(0, 3).map((f, i) => (
              <Text key={i} style={styles.findingItem}>• {f}</Text>
            ))}
          </View>
        ))}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}  ·  ${input.location}  ·  ${new Date(audit.createdAt).toLocaleDateString("en-GB")}`
          }
          fixed
        />
      </Page>

      {/* ─── Page 2: Action Plan + Industry Insights ─── */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Action Plan</Text>
        <Text style={styles.h1}>Your prioritised fixes</Text>

        {groupedRecs.length === 0 ? (
          <Text style={styles.muted}>No specific recommendations generated.</Text>
        ) : (
          groupedRecs.map((g) => (
            <View key={g.effort}>
              <View style={styles.effortHeader}>
                <Text style={styles.effortLabel}>{EFFORT_LABELS[g.effort]}</Text>
                <View style={styles.rule} />
              </View>
              {g.items.map((r, i) => (
                <View key={i} style={styles.card} wrap={false}>
                  <View style={styles.recHeader}>
                    <Text style={[styles.h3, { flex: 1, paddingRight: 8 }]}>{r.title}</Text>
                    <View style={{ flexDirection: "row", gap: 4 }}>
                      <Text
                        style={[
                          styles.pill,
                          { backgroundColor: priorityColor(r.priority), color: "#fff" },
                        ]}
                      >
                        {r.priority}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 10, lineHeight: 1.5, color: INK_MUTED }}>{r.detail}</Text>
                </View>
              ))}
            </View>
          ))
        )}

        {narrative.industryInsights.length > 0 && (
          <>
            <Text style={styles.h2}>Industry Insights · {input.industry}</Text>
            <View style={{ borderRadius: 6, backgroundColor: BRAND_SOFT, padding: 14 }}>
              {narrative.industryInsights.map((t, i) => (
                <Text key={i} style={{ fontSize: 10, color: INK, lineHeight: 1.5, marginBottom: 6 }}>
                  {i + 1}.  {t}
                </Text>
              ))}
            </View>
          </>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Page ${pageNumber} / ${totalPages}  ·  Report ID ${audit.id}`
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function priorityWeight(p: string): number {
  if (p === "high") return 0;
  if (p === "medium") return 1;
  return 2;
}
