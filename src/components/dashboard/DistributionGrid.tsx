"use client";

import MetricDistributionCard from "./MetricDistributionCard";
import { METRIC_DEFS } from "@/lib/constants";
import type { AnalysisResult } from "@/lib/analysis";
import type { MetricKey, PeriodBlock } from "@/lib/data/types";
import type { MarketSnapshot } from "@/lib/session";
import { fmtNum } from "@/lib/format";

interface DistributionGridProps {
  analysis: AnalysisResult;
  selectedBlock: PeriodBlock | null;
  session: MarketSnapshot | null;
  selectedMetric: MetricKey;
  chartMode: "hist" | "ecdf";
  dark: boolean;
  onSelectMetric: (metric: MetricKey) => void;
  onChartMode: (mode: "hist" | "ecdf") => void;
}

function priceLabel(session: MarketSnapshot): string {
  return session.isToday && session.time < "15:00" ? "最新" : "收盘";
}

export default function DistributionGrid({
  analysis,
  selectedBlock,
  session,
  selectedMetric,
  chartMode,
  dark,
  onSelectMetric,
  onChartMode,
}: DistributionGridProps) {
  const driftMap = new Map(
    analysis.drift.metrics.map((item) => [item.metric, item]),
  );
  return (
    <section className="section" id="distributions">
      <div className="section-head">
        <h2 className="section-title">分布</h2>
        <div className="seg section-actions" role="group" aria-label="图表类型">
          <button
            type="button"
            data-active={chartMode === "hist"}
            onClick={() => onChartMode("hist")}
          >
            直方图
          </button>
          <button
            type="button"
            data-active={chartMode === "ecdf"}
            onClick={() => onChartMode("ecdf")}
          >
            累积分布
          </button>
        </div>
      </div>

      {session ? (
        <div className="session-note">
          <span className="session-badge">
            {session.isToday ? "当日" : "最近交易日"}
          </span>
          <span className="session-when mono">
            {session.date} {session.time}
          </span>
          <span className="session-price">
            {priceLabel(session)}{" "}
            <strong className="num">{fmtNum(session.close, 2)}</strong>
          </span>
          <span className="session-key">
            <i aria-hidden="true" />
            图中竖线
          </span>
        </div>
      ) : null}

      {analysis.blockResult.blocks.length === 0 ? (
        <p className="inline-note">
          区间不足以切出完整周期，当前只显示整体分布。
        </p>
      ) : null}

      <div className="metric-grid">
        {METRIC_DEFS.map((def) => (
          <MetricDistributionCard
            key={def.key}
            def={def}
            rows={analysis.rangeMetrics}
            block={selectedBlock}
            session={session}
            drift={driftMap.get(def.key)}
            chartMode={chartMode}
            active={selectedMetric === def.key}
            dark={dark}
            onSelect={() => {
              onSelectMetric(def.key);
              document
                .getElementById("drift-detail")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ))}
      </div>
    </section>
  );
}
