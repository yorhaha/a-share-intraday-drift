"use client";

import { useMemo } from "react";
import EChart from "@/components/charts/EChart";
import {
  blockBoxOption,
  blockEcdfOption,
  medianTrendOption,
} from "@/components/charts/options";
import DriftTable from "./DriftTable";
import { ALPHA, BLOCK_COLORS, METRIC_MAP } from "@/lib/constants";
import type { AnalysisResult } from "@/lib/analysis";
import type { MetricKey, PeriodBlock } from "@/lib/data/types";
import type { MetricDrift } from "@/lib/stats/drift";
import { cx, fmtQ, pct, pp } from "@/lib/format";

interface DriftSectionProps {
  analysis: AnalysisResult;
  selectedMetric: MetricKey;
  selectedBlock: PeriodBlock | null;
  dark: boolean;
  onSelectMetric: (metric: MetricKey) => void;
  onSelectBlock: (block: PeriodBlock | null) => void;
}

interface Conclusion {
  tone: "sig" | "none" | "warn";
  headline: string;
  detail: string;
}

function buildConclusion(analysis: AnalysisResult): Conclusion {
  const { drift } = analysis;
  if (drift.metrics.length === 0) {
    return {
      tone: "warn",
      headline: "周期不足",
      detail: "至少需要 2 个完整周期。",
    };
  }
  if (drift.testedMetrics === 0) {
    return {
      tone: "warn",
      headline: "样本不足",
      detail: "每段至少需要 10 个有效交易日。",
    };
  }
  const significant = drift.metrics.filter(
    (item) => item.globalQ != null && item.globalQ < ALPHA,
  );
  if (significant.length === 0) {
    return {
      tone: "none",
      headline: "未检出显著漂移",
      detail: `${drift.testedMetrics} 项可检验指标 BH 校正后 q ≥ 0.05。`,
    };
  }

  const lead = [...significant].sort((a, b) => {
    const aDelta = a.delta == null ? -1 : Math.abs(a.delta);
    const bDelta = b.delta == null ? -1 : Math.abs(b.delta);
    return bDelta - aDelta;
  })[0];
  const leadFirst = lead.blocks[0];
  const leadLast = lead.blocks[lead.blocks.length - 1];
  const adj = lead.significantAdjacent[0];
  const names = significant.map((item) => item.label).join("、");

  const headline = `${names} 显著漂移`;
  let detail = "";
  if (leadFirst && leadLast && lead.delta != null) {
    detail = `${lead.label}中位数 ${pct(leadFirst.median, 2, true)} → ${pct(
      leadLast.median,
      2,
      true,
    )}，首末差 ${pp(lead.delta * 100, 2, true)}`;
    if (lead.deltaCI) {
      detail += `（95% CI ${pp(lead.deltaCI[0] * 100, 2, true)} ~ ${pp(
        lead.deltaCI[1] * 100,
        2,
        true,
      )}）`;
    }
    detail += `，q = ${fmtQ(lead.globalQ)}`;
  } else {
    detail = `${lead.label} q = ${fmtQ(lead.globalQ)}`;
  }
  if (adj) {
    detail += ` · 相邻 ${adj.fromLabel}→${adj.toLabel} D=${adj.d.toFixed(2)}`;
  }
  return { tone: "sig", headline, detail };
}

export default function DriftSection({
  analysis,
  selectedMetric,
  selectedBlock,
  dark,
  onSelectMetric,
  onSelectBlock,
}: DriftSectionProps) {
  const blocks = analysis.blockResult.blocks;
  const driftMap = new Map(
    analysis.drift.metrics.map((item) => [item.metric, item]),
  );
  const selected: MetricDrift | undefined =
    driftMap.get(selectedMetric) ?? analysis.drift.metrics[0];
  const def = selected ? METRIC_MAP[selected.metric] : METRIC_MAP[selectedMetric];
  const blockSeries = useMemo(
    () =>
      selected
        ? selected.blocks.map((summary, index) => ({
            label: summary.label,
            values:
              blocks[index]?.rows.map((row) => row[selected.metric]) ?? [],
            color: BLOCK_COLORS[index % BLOCK_COLORS.length],
          }))
        : [],
    [selected, blocks],
  );
  const overallValues = useMemo(
    () =>
      selected
        ? analysis.rangeMetrics.map((row) => row[selected.metric])
        : [],
    [analysis.rangeMetrics, selected],
  );
  const ecdfOpt = useMemo(
    () =>
      selected
        ? blockEcdfOption(overallValues, blockSeries, def, dark)
        : null,
    [selected, overallValues, blockSeries, def, dark],
  );
  const boxOpt = useMemo(
    () =>
      selected ? blockBoxOption(overallValues, blockSeries, def, dark) : null,
    [selected, overallValues, blockSeries, def, dark],
  );
  const trendOpt = useMemo(
    () => (selected ? medianTrendOption(selected, def, dark) : null),
    [selected, def, dark],
  );

  if (blocks.length < 2) {
    return (
      <section className="section" id="drift-detail">
        <div className="section-head">
          <h2 className="section-title">漂移</h2>
        </div>
        <div className="card empty-block">
          <strong>周期不足</strong>
          <p>
            {analysis.blockResult.warnings[0] ??
              "拉长日期区间，或缩短周期长度。"}
          </p>
        </div>
      </section>
    );
  }

  const conclusion = buildConclusion(analysis);
  const ci = selected?.deltaCI;

  return (
    <section className="section" id="drift-detail">
      <div className="section-head">
        <h2 className="section-title">漂移</h2>
        <span className="badge badge-muted">
          {blocks[0]?.startDate} ~ {blocks[blocks.length - 1]?.endDate}
        </span>
      </div>

      <div className={cx("conclusion", `conclusion-${conclusion.tone}`)}>
        <span className="conclusion-mark" aria-hidden="true" />
        <div>
          <strong>{conclusion.headline}</strong>
          <p>{conclusion.detail}</p>
        </div>
      </div>

      <DriftTable
        analysis={analysis}
        selectedMetric={selectedMetric}
        onSelectMetric={onSelectMetric}
      />

      {selected && ecdfOpt && boxOpt && trendOpt ? (
        <div className="card detail-card" id="drift-detail-panel">
          <div className="detail-head">
            <div className="detail-title-row">
              <h3 className="detail-title">{def.label}</h3>
              <span
                className={cx(
                  "badge",
                  selected.status === "insufficient"
                    ? "badge-warn"
                    : selected.globalQ != null && selected.globalQ < ALPHA
                      ? "badge-sig"
                      : "badge-muted",
                )}
              >
                {selected.verdict} · q={fmtQ(selected.globalQ)}
              </span>
              {selectedBlock ? (
                <button
                  type="button"
                  className="badge badge-sig detail-overlay-pill"
                  onClick={() => onSelectBlock(null)}
                  title="取消在分布卡片中叠加周期"
                >
                  叠加 {selectedBlock.label} ×
                </button>
              ) : null}
            </div>
            <div className="detail-metrics">
              <div>
                <span className="detail-metric-label">首末差</span>
                <strong className="num">
                  {selected.delta != null
                    ? pp(selected.delta * 100, 2, true)
                    : "—"}
                </strong>
                {ci ? (
                  <span className="detail-metric-sub num">
                    95% CI {pp(ci[0] * 100, 2, true)} ~{" "}
                    {pp(ci[1] * 100, 2, true)}
                  </span>
                ) : null}
              </div>
              <div>
                <span className="detail-metric-label">最大两两 KS D</span>
                <strong className="num">
                  {selected.observedD != null
                    ? selected.observedD.toFixed(3)
                    : "—"}
                </strong>
                <span className="detail-metric-sub">
                  IQR 末/首{" "}
                  {selected.iqrRatio != null
                    ? selected.iqrRatio.toFixed(2)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {selected.warning ? (
            <p className="inline-note">{selected.warning}</p>
          ) : null}

          <div className="detail-grid">
            <div className="chart-card">
              <div className="chart-card-head">各周期 ECDF</div>
              <div className="chart-box">
                <EChart option={ecdfOpt} height={250} />
              </div>
            </div>
            <div className="chart-card">
              <div className="chart-card-head">各周期箱线图</div>
              <div className="chart-box">
                <EChart option={boxOpt} height={250} />
              </div>
            </div>
          </div>

          <div className="chart-card trend-card">
            <div className="chart-card-head">中位数与 95% CI</div>
            <div className="chart-box">
              <EChart option={trendOpt} height={220} />
            </div>
          </div>

          <div className="detail-lower">
            <div className="table-card card-flat">
              <div className="table-head compact">
                <h4 className="table-title">各周期统计</h4>
              </div>
              <div className="table-wrap block-table-wrap">
                <table className="data-table block-table">
                  <thead>
                    <tr>
                      <th>周期</th>
                      <th>日期</th>
                      <th>n</th>
                      <th>中位数</th>
                      <th>均值</th>
                      <th>标准差</th>
                      <th>IQR</th>
                      <th>P5 ~ P95</th>
                      <th>中位数 95% CI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.blocks.map((summary, index) => {
                      const block = blocks[index];
                      const active = selectedBlock?.index === summary.index;
                      return (
                        <tr
                          key={summary.index}
                          data-active={active}
                          onClick={() =>
                            onSelectBlock(active ? null : block ?? null)
                          }
                        >
                          <td>
                            <span className="metric-cell">
                              <span
                                className="metric-dot"
                                style={{
                                  background:
                                    BLOCK_COLORS[
                                      index % BLOCK_COLORS.length
                                    ],
                                }}
                              />
                              {summary.label}
                            </span>
                          </td>
                          <td className="mono date-cell">
                            {summary.startDate} ~ {summary.endDate}
                          </td>
                          <td className="num">{summary.n}</td>
                          <td className="num">
                            {pct(summary.median, 2, def.signed)}
                          </td>
                          <td className="num">
                            {pct(summary.mean, 2, def.signed)}
                          </td>
                          <td className="num">
                            {pct(summary.std, 2, false)}
                          </td>
                          <td className="num">
                            {pct(summary.q3 - summary.q1, 2, false)}
                          </td>
                          <td className="num">
                            {pct(summary.p5, 2, def.signed)} ~{" "}
                            {pct(summary.p95, 2, def.signed)}
                          </td>
                          <td className="num">
                            {summary.ci
                              ? `${pp(
                                  summary.ci[0] * 100,
                                  2,
                                  def.signed,
                                )} ~ ${pp(
                                  summary.ci[1] * 100,
                                  2,
                                  def.signed,
                                )}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="block-mobile-list">
                {selected.blocks.map((summary, index) => {
                  const block = blocks[index];
                  const active = selectedBlock?.index === summary.index;
                  return (
                    <button
                      type="button"
                      key={summary.index}
                      className={cx(
                        "block-mobile-card",
                        active && "is-active",
                      )}
                      onClick={() =>
                        onSelectBlock(active ? null : block ?? null)
                      }
                    >
                      <span className="block-mobile-head">
                        <span className="metric-cell">
                          <span
                            className="metric-dot"
                            style={{
                              background:
                                BLOCK_COLORS[index % BLOCK_COLORS.length],
                            }}
                          />
                          {summary.label}
                        </span>
                        <span className="block-mobile-date mono">
                          {summary.startDate} ~ {summary.endDate}
                        </span>
                        <span className="badge badge-muted">
                          n={summary.n}
                        </span>
                      </span>
                      <span className="block-mobile-grid">
                        <span>
                          <span className="drift-mobile-label">中位数</span>
                          <span className="num">
                            {pct(summary.median, 2, def.signed)}
                          </span>
                        </span>
                        <span>
                          <span className="drift-mobile-label">均值</span>
                          <span className="num">
                            {pct(summary.mean, 2, def.signed)}
                          </span>
                        </span>
                        <span>
                          <span className="drift-mobile-label">标准差</span>
                          <span className="num">
                            {pct(summary.std, 2, false)}
                          </span>
                        </span>
                        <span>
                          <span className="drift-mobile-label">IQR</span>
                          <span className="num">
                            {pct(summary.q3 - summary.q1, 2, false)}
                          </span>
                        </span>
                        <span>
                          <span className="drift-mobile-label">
                            P5 ~ P95
                          </span>
                          <span className="num">
                            {pct(summary.p5, 2, def.signed)} ~{" "}
                            {pct(summary.p95, 2, def.signed)}
                          </span>
                        </span>
                        <span>
                          <span className="drift-mobile-label">
                            中位数 95% CI
                          </span>
                          <span className="num">
                            {summary.ci
                              ? `${pp(
                                  summary.ci[0] * 100,
                                  2,
                                  def.signed,
                                )} ~ ${pp(
                                  summary.ci[1] * 100,
                                  2,
                                  def.signed,
                                )}`
                              : "—"}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="adjacent-panel card-flat">
              <div className="table-head compact">
                <h4 className="table-title">相邻周期 KS</h4>
              </div>
              {selected.adjacent.length === 0 ? (
                <p className="adj-empty">
                  至少一个相邻段的样本少于 10 日，未做相邻检验。
                </p>
              ) : (
                <ul className="adj-list">
                  {selected.adjacent.map((item) => {
                    const significant =
                      item.q != null && item.q < ALPHA;
                    return (
                      <li
                        key={`${item.from}-${item.to}`}
                        className={cx("adj-item", significant && "is-sig")}
                      >
                        <span className="adj-pair">
                          {item.fromLabel} → {item.toLabel}
                        </span>
                        <span className="num">D = {item.d.toFixed(3)}</span>
                        <span className="num faint">
                          p = {fmtQ(item.p)}
                        </span>
                        <span
                          className={cx(
                            "badge",
                            significant ? "badge-sig" : "badge-muted",
                          )}
                        >
                          q = {fmtQ(item.q)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card empty-block">
          <strong>暂无可展示的周期统计</strong>
          <p>拉长区间或检查数据后重试。</p>
        </div>
      )}
    </section>
  );
}
