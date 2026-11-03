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

function sessionCopy(session: MarketSnapshot): {
  status: string;
  priceLabel: string;
} {
  if (session.isToday && session.time < "15:00") {
    return { status: "盘中，最新价视为收盘价", priceLabel: "最新" };
  }
  if (session.isToday) {
    return { status: "今日已收盘", priceLabel: "收盘" };
  }
  return { status: "沿用最近交易日", priceLabel: "收盘" };
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
  const copy = session ? sessionCopy(session) : null;

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
            {chartMode === "ecdf"
              ? " 累积分布中，正负双侧指标从两端分别向 0 轴累计并在 0 轴汇合；单侧指标按常规 ECDF 累计。"
              : ""}
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

      {session && copy ? (
        <div className="session-note">
          <span className="session-badge">当日位置</span>
          <span className="session-when">
            <strong>{session.isToday ? "今日" : "最近交易日"}</strong>
            <span className="mono faint">
              {session.date} {session.time}
            </span>
          </span>
          <span className="session-price">
            {copy.priceLabel}{" "}
            <strong className="num">{fmtNum(session.close, 2)}</strong>
          </span>
          <span className="session-status">{copy.status}</span>
          <span className="session-key">
            <i aria-hidden="true" />
            图中竖线为该交易日位置
          </span>
        </div>
      ) : null}

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
