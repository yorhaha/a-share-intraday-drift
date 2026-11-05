"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import { timeSeriesOption } from "@/components/charts/options";
import { BLOCK_COLORS, METRIC_DEFS } from "@/lib/constants";
import type { AnalysisResult } from "@/lib/analysis";
import type { DailyMetrics, MetricDef } from "@/lib/data/types";
import type { MetricDrift } from "@/lib/stats/drift";
import { cx, fmtQ } from "@/lib/format";

interface TimeSeriesChartProps {
  rows: DailyMetrics[];
  def: MetricDef;
  blocks: Array<{ startDate: string; endDate: string; label: string }>;
  dark: boolean;
  drift: MetricDrift | undefined;
}

function TimeSeriesChart({
  rows,
  def,
  blocks,
  dark,
  drift,
}: TimeSeriesChartProps) {
  const option = useMemo(
    () => timeSeriesOption(rows, def, blocks, dark),
    [rows, def, blocks, dark],
  );
  const significant = drift?.globalQ != null && drift.globalQ < 0.05;

  return (
    <div className="card time-card">
      <div className="time-card-head">
        <span className="time-title">{def.label}</span>
        <span
          className={cx(
            "badge",
            significant ? "badge-sig" : "badge-muted",
          )}
        >
          q = {fmtQ(drift?.globalQ)}
        </span>
      </div>
      <div className="chart-box">
        <EChart option={option} height={156} />
      </div>
    </div>
  );
}

export default function TimeSeriesGrid({ analysis, dark }: { analysis: AnalysisResult; dark: boolean }) {
  const blocks = useMemo(
    () =>
      analysis.blockResult.blocks.map((block) => ({
        startDate: block.startDate,
        endDate: block.endDate,
        label: block.label,
      })),
    [analysis.blockResult.blocks],
  );
  const driftMap = new Map(
    analysis.drift.metrics.map((item) => [item.metric, item]),
  );

  return (
    <section className="section" id="timeseries">
      <div className="section-head">
        <h2 className="section-title">时间序列</h2>
        <div className="block-legend">
          {analysis.blockResult.blocks.map((block, index) => (
            <span className="block-legend-item" key={block.index}>
              <span
                className="metric-dot"
                style={{ background: BLOCK_COLORS[index % BLOCK_COLORS.length] }}
              />
              <span>{block.label}</span>
              <span className="faint mono">
                {block.startDate.slice(5)}~{block.endDate.slice(5)}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="time-grid">
        {METRIC_DEFS.map((def) => (
          <TimeSeriesChart
            key={def.key}
            rows={analysis.rangeMetrics}
            def={def}
            blocks={blocks}
            dark={dark}
            drift={driftMap.get(def.key)}
          />
        ))}
      </div>
    </section>
  );
}
