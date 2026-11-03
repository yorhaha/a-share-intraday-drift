"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import {
  ecdfOption,
  histogramOption,
  type SessionMarker,
} from "@/components/charts/options";
import { BLOCK_COLORS } from "@/lib/constants";
import type { DailyMetrics, MetricDef, PeriodBlock } from "@/lib/data/types";
import type { MarketSnapshot } from "@/lib/session";
import type { MetricDrift } from "@/lib/stats/drift";
import { describe, percentileRank, sidePercentileRank } from "@/lib/stats/describe";
import { axisModeForMetric } from "@/lib/stats/distribution";
import { cx, fmtQ, pct, pp } from "@/lib/format";

interface MetricDistributionCardProps {
  def: MetricDef;
  rows: DailyMetrics[];
  block: PeriodBlock | null;
  session: MarketSnapshot | null;
  drift: MetricDrift | undefined;
  chartMode: "hist" | "ecdf";
  active: boolean;
  dark: boolean;
  onSelect: () => void;
}

function badgeFor(drift: MetricDrift | undefined): {
  text: string;
  className: string;
} {
  if (!drift) return { text: "未检验", className: "badge-muted" };
  if (drift.status === "constant") {
    return { text: "常数", className: "badge-muted" };
  }
  if (drift.status === "insufficient") {
    return { text: "样本不足", className: "badge-warn" };
  }
  if (drift.globalQ != null && drift.globalQ < 0.05) {
    return { text: `显著 q=${fmtQ(drift.globalQ)}`, className: "badge-sig" };
  }
  return {
    text: `未见漂移 q=${fmtQ(drift.globalQ)}`,
    className: "badge-muted",
  };
}

function rankText(rank: number): string {
  if (!Number.isFinite(rank)) return "—";
  const percent = rank * 100;
  if (percent > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

export default function MetricDistributionCard({
  def,
  rows,
  block,
  session,
  drift,
  chartMode,
  active,
  dark,
  onSelect,
}: MetricDistributionCardProps) {
  const overall = useMemo(
    () => rows.map((row) => row[def.key]),
    [rows, def.key],
  );
  const blockValues = useMemo(
    () => (block ? block.rows.map((row) => row[def.key]) : []),
    [block, def.key],
  );
  const sessionMarker = useMemo<SessionMarker | null>(() => {
    if (!session) return null;
    const value = session[def.key];
    if (!Number.isFinite(value)) return null;
    return { value, label: session.isToday ? "当日" : "最近" };
  }, [session, def.key]);
  const blockColor = block
    ? BLOCK_COLORS[(block.index - 1) % BLOCK_COLORS.length]
    : BLOCK_COLORS[0];
  const option = useMemo(
    () =>
      chartMode === "hist"
        ? histogramOption(
            overall,
            blockValues.length > 0 ? blockValues : null,
            block?.label ?? "",
            def,
            dark,
            blockColor,
            sessionMarker,
          )
        : ecdfOption(
            overall,
            blockValues.length > 0 ? blockValues : null,
            block?.label ?? "",
            def,
            dark,
            blockColor,
            sessionMarker,
          ),
    [
      chartMode,
      overall,
      blockValues,
      block?.label,
      def,
      dark,
      blockColor,
      sessionMarker,
    ],
  );

  const overallStats = useMemo(() => describe(overall), [overall]);
  const blockStats = useMemo(() => describe(blockValues), [blockValues]);
  const sessionRanks = useMemo(() => {
    if (!sessionMarker) return null;
    return {
      overall: percentileRank(overall, sessionMarker.value),
      block: block ? percentileRank(blockValues, sessionMarker.value) : NaN,
    };
  }, [sessionMarker, overall, blockValues, block]);
  const sessionSideRank = useMemo(() => {
    if (
      !sessionMarker ||
      chartMode !== "ecdf" ||
      axisModeForMetric(def.key) !== "symmetric"
    ) {
      return NaN;
    }
    return sidePercentileRank(overall, sessionMarker.value);
  }, [sessionMarker, chartMode, def.key, overall]);
  const badge = badgeFor(drift);

  return (
    <article className={cx("card metric-card", active && "is-active")}>
      <div className="metric-card-head">
        <div className="metric-title-wrap">
          <div className="metric-title-row">
            <h3 className="metric-title">{def.label}</h3>
            <span className="help-tip" title={def.description}>
              ?
            </span>
            <span className={cx("badge", badge.className)}>{badge.text}</span>
          </div>
          <p className="metric-desc">{def.description}</p>
        </div>
        <button
          type="button"
          className="metric-focus"
          onClick={onSelect}
          aria-label={`在漂移详情中查看${def.label}`}
        >
          {active ? "详情中" : "看漂移"}
        </button>
      </div>

      <div className="chart-box">
        <EChart option={option} height={208} />
      </div>

      <div className="metric-footer">
        {sessionMarker && sessionRanks ? (
          <div className="metric-stat-line metric-session-line">
            <span className="metric-stat-label">
              <span className="metric-dot metric-dot-session" aria-hidden="true" />
              {session?.isToday ? "当日" : "最近"}
            </span>
            <span className="num metric-session-value">
              {pct(sessionMarker.value, 2, def.signed)}
            </span>
            <span
              className="faint num"
              title="全区间历史样本中不超过该值的比例"
            >
              历史分位 {rankText(sessionRanks.overall)}
            </span>
            {Number.isFinite(sessionSideRank) ? (
              <span
                className="faint num"
                title="与累积分布纵轴一致：正值按正侧 ≥ 该值，负值按负侧 ≤ 该值"
              >
                同侧分位 {rankText(sessionSideRank)}
              </span>
            ) : null}
            {block ? (
              <span
                className="faint num"
                title={`${block.label}样本中不超过该值的比例`}
              >
                周期分位 {rankText(sessionRanks.block)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="metric-stat-line">
          <span className="metric-stat-label">全区间</span>
          <span className="num">
            n={overall.length} · 中位数 {pct(overallStats.median, 2, false)}
          </span>
          <span className="faint num">
            P5 {pct(overallStats.p5, 2, false)} ~ P95{" "}
            {pct(overallStats.p95, 2, false)}
          </span>
        </div>
        <div className="metric-stat-line">
          <span className="metric-stat-label">
            {block ? block.label : "选择周期"}
          </span>
          {block ? (
            <>
              <span className="num" style={{ color: blockColor }}>
                n={blockStats.n} · 中位数 {pct(blockStats.median, 2, false)}
              </span>
              <span className="faint num">
                {Number.isFinite(blockStats.median) &&
                Number.isFinite(overallStats.median)
                  ? `Δ ${pp(
                      (blockStats.median - overallStats.median) * 100,
                      2,
                      true,
                    )}`
                  : "—"}
              </span>
            </>
          ) : (
            <span className="faint">尚未切出完整周期</span>
          )}
        </div>
      </div>
    </article>
  );
}
