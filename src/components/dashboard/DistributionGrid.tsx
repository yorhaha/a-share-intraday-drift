"use client";

import MetricDistributionCard from "./MetricDistributionCard";
import { METRIC_DEFS } from "@/lib/constants";
import type { AnalysisResult } from "@/lib/analysis";
import type { MetricKey, PeriodBlock } from "@/lib/data/types";

interface DistributionGridProps {
  analysis: AnalysisResult;
  selectedBlock: PeriodBlock | null;
  selectedMetric: MetricKey;
  chartMode: "hist" | "ecdf";
  dark: boolean;
  onSelectMetric: (metric: MetricKey) => void;
  onChartMode: (mode: "hist" | "ecdf") => void;
}

export default function DistributionGrid({
  analysis,
  selectedBlock,
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
        <div>
          <span className="section-kicker">01 · 分布</span>
          <h2 className="section-title">六项日内指标的分布</h2>
          <p className="section-sub">
            灰色为所选区间的整体分布，彩色为当前周期
            {selectedBlock ? ` ${selectedBlock.label}` : "（未选中）"}
            。点击卡片标题或「看漂移」可跳到该指标的周期对比。
          </p>
        </div>
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

      {analysis.blockResult.blocks.length === 0 ? (
        <p className="inline-note">
          当前区间不足以切出完整周期，卡片只显示整体分布；可拉长区间或缩短周期。
        </p>
      ) : null}

      <div className="metric-grid">
        {METRIC_DEFS.map((def) => (
          <MetricDistributionCard
            key={def.key}
            def={def}
            rows={analysis.rangeMetrics}
            block={selectedBlock}
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
