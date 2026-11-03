import type { AnalysisResult } from "./analysis";
import type { MetricKey } from "./data/types";

const PERCENT_KEYS: Array<[MetricKey, string]> = [
  ["openRet", "open_ret_pct"],
  ["highRet", "high_ret_pct"],
  ["lowRet", "low_ret_pct"],
  ["amplitude", "amplitude_pct"],
  ["highVsOpen", "high_vs_open_pct"],
  ["lowVsOpen", "low_vs_open_pct"],
];

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function buildCsv(analysis: AnalysisResult): string {
  const blockByDate = new Map<string, string>();
  for (const block of analysis.blockResult.blocks) {
    for (const row of block.raw) {
      blockByDate.set(row.date, block.label);
    }
  }

  const header = [
    "date",
    "block",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "prev_close",
    ...PERCENT_KEYS.map(([, label]) => label),
    "zero_range",
    "gap_days",
  ];

  const lines = analysis.rangeMetrics.map((row) => {
    const percentage = PERCENT_KEYS.map(([key]) =>
      (row[key] * 100).toFixed(6),
    );
    return [
      row.date,
      blockByDate.get(row.date) ?? "",
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume,
      row.prevClose,
      ...percentage,
      row.zeroRange ? 1 : 0,
      row.gapDays,
    ]
      .map(csvCell)
      .join(",");
  });

  return `﻿${[header.join(","), ...lines].join("\n")}\n`;
}

export function downloadCsv(analysis: AnalysisResult): void {
  const blob = new Blob([buildCsv(analysis)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${analysis.options.symbol.symbol}_${analysis.options.start}_${analysis.options.end}_intraday.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
