"use client";

import type { AnalysisResult } from "@/lib/analysis";
import { describe } from "@/lib/stats/describe";
import { fmtInt, pct, pp, signedClass } from "@/lib/format";
import type { PeriodBlock } from "@/lib/data/types";

interface SummaryTilesProps {
  analysis: AnalysisResult;
  selectedBlock: PeriodBlock | null;
}

export default function SummaryTiles({
  analysis,
  selectedBlock,
}: SummaryTilesProps) {
  const rows = analysis.rangeMetrics;
  const latest = rows[rows.length - 1];
  const first = rows[0];
  const rangeReturn = latest.close / first.prevClose - 1;
  const amplitudeStats = describe(rows.map((row) => row.amplitude));
  const blocks = analysis.blockResult.blocks;
  const lastBlock = blocks[blocks.length - 1];
  const amplitudeDrift = analysis.drift.metrics.find(
    (item) => item.metric === "amplitude",
  );
  const lastAmplitude = amplitudeDrift?.blocks.find(
    (block) => block.index === lastBlock?.index,
  );
  const selected = selectedBlock;

  return (
    <section className="card summary" aria-label="概览">
      <div className="summary-head">
        <div className="summary-identity">
          <span className="summary-symbol">
            {analysis.options.symbol.name}
          </span>
          <span className="mono summary-code">
            {analysis.options.symbol.symbol.toUpperCase()}
          </span>
          <span className="badge badge-muted">
            {analysis.options.fq === "qfq" ? "前复权" : "不复权"}
          </span>
          {selected ? (
            <span
              className="badge badge-sig"
              title={`${selected.startDate} ~ ${selected.endDate}`}
            >
              叠加 {selected.label}
            </span>
          ) : null}
        </div>
        <p className="summary-meta">
          {fmtInt(rows.length)} 个交易日 · 截至 {analysis.dataAsOf} · 最近{" "}
          {analysis.blockResult.effectiveK} 段 × {analysis.blockResult.effectiveP} 日
        </p>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="tile-label">最新收盘</span>
          <strong className="tile-value num">{latest.close.toFixed(2)}</strong>
          <span className="tile-sub">{latest.date}</span>
        </div>

        <div className="tile">
          <span className="tile-label">区间涨跌</span>
          <strong className={`tile-value num ${signedClass(rangeReturn)}`}>
            {pct(rangeReturn, 2, true)}
          </strong>
          <span className="tile-sub">
            {first.date} 前收 → {latest.date}
          </span>
        </div>

        <div className="tile">
          <span className="tile-label">振幅中位数</span>
          <strong className="tile-value num">
            {pct(amplitudeStats.median, 2, false)}
          </strong>
          <span className="tile-sub">
            P5 {pct(amplitudeStats.p5, 2, false)} ~ P95{" "}
            {pct(amplitudeStats.p95, 2, false)}
          </span>
        </div>

        <div className="tile">
          <span className="tile-label">
            振幅中位数 · {lastBlock?.label ?? "最近段"}
          </span>
          <strong className="tile-value num">
            {pct(lastAmplitude?.median, 2, false)}
          </strong>
          <span className="tile-sub">
            {amplitudeDrift?.delta != null
              ? `较 ${blocks[0]?.label ?? "B1"} ${pp(
                  amplitudeDrift.delta * 100,
                  2,
                  true,
                )}`
              : "—"}
          </span>
        </div>

        <div className="tile">
          <span className="tile-label">显著漂移指标</span>
          <strong className="tile-value num">
            {analysis.drift.significantCount}
            <span className="tile-value-den">
              /{analysis.drift.testedMetrics}
            </span>
          </strong>
          <span className="tile-sub">
            {analysis.drift.testedMetrics > 0 ? "q < 0.05" : "样本不足"}
          </span>
        </div>
      </div>
    </section>
  );
}
