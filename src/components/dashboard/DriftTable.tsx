"use client";

import type { AnalysisResult } from "@/lib/analysis";
import type { MetricKey } from "@/lib/data/types";
import { METRIC_DEFS } from "@/lib/constants";
import { cx, fmtQ, pct, pp } from "@/lib/format";
import type { MetricDrift } from "@/lib/stats/drift";

interface DriftTableProps {
  analysis: AnalysisResult;
  selectedMetric: MetricKey;
  onSelectMetric: (metric: MetricKey) => void;
}

function verdictBadge(result: MetricDrift): string {
  if (result.status === "insufficient") return "badge-warn";
  if (result.status === "constant") return "badge-muted";
  if (result.globalQ != null && result.globalQ < 0.05) return "badge-sig";
  return "badge-muted";
}

export default function DriftTable({
  analysis,
  selectedMetric,
  onSelectMetric,
}: DriftTableProps) {
  const blocks = analysis.blockResult.blocks;
  const driftMap = new Map(
    analysis.drift.metrics.map((item) => [item.metric, item]),
  );

  return (
    <div className="card table-card">
      <div className="table-head">
        <div>
          <h3 className="table-title">指标级漂移汇总</h3>
          <p className="table-sub">
            中位数为区间内百分比；首末差 = 末段 − 首段（百分点）；q 为六项指标 BH
            校正后的置换检验 p 值。
          </p>
        </div>
        <span className="badge badge-muted">
          {analysis.drift.testedMetrics} / 6 项可检验
        </span>
      </div>

      <div className="table-wrap drift-table-wrap">
        <table className="data-table drift-table">
          <caption className="sr-only">各指标在最近周期段的中位数与漂移检验</caption>
          <thead>
            <tr>
              <th>指标</th>
              {blocks.map((block) => (
                <th key={block.index}>{block.label} 中位数</th>
              ))}
              <th>首末差 (95% CI)</th>
              <th>全局 q</th>
              <th>相邻显著变化</th>
              <th>结论</th>
            </tr>
          </thead>
          <tbody>
            {METRIC_DEFS.map((def) => {
              const result = driftMap.get(def.key);
              if (!result) {
                return (
                  <tr key={def.key} onClick={() => onSelectMetric(def.key)}>
                    <td>
                      <span className="metric-cell">
                        <span className="metric-dot" />
                        {def.label}
                      </span>
                    </td>
                    {blocks.map((block) => (
                      <td key={block.index}>—</td>
                    ))}
                    <td>—</td>
                    <td>
                      <span className="badge badge-muted">—</span>
                    </td>
                    <td>—</td>
                    <td>
                      <span className="badge badge-muted">样本不足</span>
                    </td>
                  </tr>
                );
              }
              return (
                <tr
                  key={def.key}
                  data-active={selectedMetric === def.key}
                  onClick={() => onSelectMetric(def.key)}
                >
                  <td>
                    <span className="metric-cell">
                      <span className="metric-dot" />
                      {def.label}
                    </span>
                  </td>
                  {result.blocks.map((block) => (
                    <td key={block.index} className="num">
                      {block.n > 0 ? pct(block.median, 2, def.signed) : "—"}
                    </td>
                  ))}
                  <td className="num">
                    {result.delta != null ? (
                      <span className="delta-cell">
                        <span>{pp(result.delta * 100, 2, true)}</span>
                        {result.deltaCI ? (
                          <span className="ci-text">
                            [{pp(result.deltaCI[0] * 100, 2, true)},{" "}
                            {pp(result.deltaCI[1] * 100, 2, true)}]
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span
                      className={cx(
                        "badge",
                        result.globalQ != null && result.globalQ < 0.05
                          ? "badge-sig"
                          : "badge-muted",
                      )}
                    >
                      {fmtQ(result.globalQ)}
                    </span>
                  </td>
                  <td className="adjacent-cell">
                    {result.globalQ != null && result.globalQ < 0.05 ? (
                      result.significantAdjacent.length > 0 ? (
                        result.significantAdjacent.map((item) => (
                          <span key={`${item.from}-${item.to}`} className="adj-chip">
                            {item.fromLabel}→{item.toLabel} D={item.d.toFixed(2)}
                          </span>
                        ))
                      ) : (
                        <span className="faint">全局显著，无相邻段显著</span>
                      )
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    <span className={cx("badge", verdictBadge(result))}>
                      {result.verdict}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="drift-mobile-list" aria-label="各指标漂移汇总">
        {METRIC_DEFS.map((def) => {
          const result = driftMap.get(def.key);
          if (!result) {
            return (
              <button
                type="button"
                key={def.key}
                className={cx(
                  "drift-mobile-card",
                  selectedMetric === def.key && "is-active",
                )}
                onClick={() => onSelectMetric(def.key)}
              >
                <span className="drift-mobile-head">
                  <span className="metric-cell">
                    <span className="metric-dot" />
                    {def.label}
                  </span>
                  <span className="badge badge-muted">样本不足</span>
                </span>
              </button>
            );
          }
          const significant =
            result.globalQ != null && result.globalQ < 0.05;
          return (
            <button
              type="button"
              key={def.key}
              className={cx(
                "drift-mobile-card",
                selectedMetric === def.key && "is-active",
              )}
              onClick={() => onSelectMetric(def.key)}
            >
              <span className="drift-mobile-head">
                <span className="metric-cell">
                  <span className="metric-dot" />
                  {def.label}
                </span>
                <span className={cx("badge", verdictBadge(result))}>
                  {result.verdict}
                </span>
              </span>

              <span className="drift-mobile-blocks">
                {result.blocks.map((block) => (
                  <span className="drift-mobile-block" key={block.index}>
                    <span className="drift-mobile-label">
                      {block.label} 中位数
                    </span>
                    <span className="num">
                      {block.n > 0 ? pct(block.median, 2, def.signed) : "—"}
                    </span>
                  </span>
                ))}
              </span>

              <span className="drift-mobile-foot">
                <span className="drift-mobile-delta">
                  <span className="drift-mobile-label">首末差 (95% CI)</span>
                  <span className="num">
                    {result.delta != null
                      ? pp(result.delta * 100, 2, true)
                      : "—"}
                  </span>
                  {result.deltaCI ? (
                    <span className="ci-text">
                      [{pp(result.deltaCI[0] * 100, 2, true)},{" "}
                      {pp(result.deltaCI[1] * 100, 2, true)}]
                    </span>
                  ) : null}
                </span>
                <span className="drift-mobile-q">
                  <span className="drift-mobile-label">全局 q</span>
                  <span
                    className={cx(
                      "badge",
                      significant ? "badge-sig" : "badge-muted",
                    )}
                  >
                    {fmtQ(result.globalQ)}
                  </span>
                </span>
              </span>

              {significant ? (
                <span className="drift-mobile-adj">
                  {result.significantAdjacent.length > 0 ? (
                    result.significantAdjacent.map((item) => (
                      <span
                        key={`${item.from}-${item.to}`}
                        className="adj-chip"
                      >
                        {item.fromLabel}→{item.toLabel} D=
                        {item.d.toFixed(2)}
                      </span>
                    ))
                  ) : (
                    <span className="faint">全局显著，无相邻段显著</span>
                  )}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="table-foot">
        相邻段检验为探索性定位，仅在全局 q &lt; 0.05 时解读；它告诉你变化更可能发生在哪一段，不额外证明因果。
      </p>
    </div>
  );
}
