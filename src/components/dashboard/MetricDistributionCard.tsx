"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import { ecdfOption, histogramOption } from "@/components/charts/options";
import { BLOCK_COLORS } from "@/lib/constants";
import type { DailyMetrics, MetricDef, PeriodBlock } from "@/lib/data/types";
import type { MetricDrift } from "@/lib/stats/drift";
import { describe } from "@/lib/stats/describe";
import { cx, fmtQ, pct, pp } from "@/lib/format";

interface MetricDistributionCardProps {
  def: MetricDef;
  rows: DailyMetrics[];
  block: PeriodBlock | null;
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

export default function MetricDistributionCard({
  def,
  rows,
  block,
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
          )
        : ecdfOption(
            overall,
            blockValues.length > 0 ? blockValues : null,
            block?.label ?? "",
            def,
            dark,
            blockColor,
          ),
    [chartMode, overall, blockValues, block?.label, def, dark, blockColor],
  );

  const overallStats = useMemo(() => describe(overall), [overall]);
  const blockStats = useMemo(() => describe(blockValues), [blockValues]);
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
