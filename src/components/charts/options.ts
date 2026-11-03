"use client";

import type { EChartsCoreOption } from "echarts/core";
import { BLOCK_COLORS, OVERALL_COLOR } from "@/lib/constants";
import type { DailyMetrics, MetricDef } from "@/lib/data/types";
import {
  boxStats,
  ecdfPoints,
  histogramWithEdges,
  twoSidedEcdfPoints,
} from "@/lib/stats/describe";
import {
  axisModeForMetric,
  distributionAxis,
  HISTOGRAM_BIN_WIDTH_PCT,
} from "@/lib/stats/distribution";
import type {
  DistributionAxis,
  DistributionAxisMode,
} from "@/lib/stats/distribution";
import type { MetricDrift } from "@/lib/stats/drift";
import { pct, pp } from "@/lib/format";

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

interface ChartTheme {
  axis: string;
  split: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  subText: string;
  session: string;
  sessionText: string;
}

function theme(dark: boolean): ChartTheme {
  return dark
    ? {
        axis: "#8e9aac",
        split: "rgba(148, 163, 184, 0.14)",
        tooltipBg: "#151d2a",
        tooltipBorder: "#2b3648",
        tooltipText: "#e8edf5",
        subText: "#aab4c3",
        session: "#f8fafc",
        sessionText: "#0b1220",
      }
    : {
        axis: "#7a8496",
        split: "rgba(100, 116, 139, 0.13)",
        tooltipBg: "#ffffff",
        tooltipBorder: "#e3e8ef",
        tooltipText: "#172033",
        subText: "#5d6878",
        session: "#111827",
        sessionText: "#ffffff",
      };
}

function alpha(hex: string, opacity: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function tooltipBase(t: ChartTheme) {
  return {
    backgroundColor: t.tooltipBg,
    borderColor: t.tooltipBorder,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: t.tooltipText, fontSize: 12, fontFamily: FONT },
    extraCssText:
      "box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12); border-radius: 8px;",
  };
}

interface TooltipParam {
  dataIndex?: number;
  seriesName?: string;
  seriesType?: string;
  value?: unknown;
  data?: unknown;
  name?: string;
  color?: string;
}

function paramList(raw: unknown): TooltipParam[] {
  return (Array.isArray(raw) ? raw : [raw]) as TooltipParam[];
}

function numeric(value: unknown): number {
  if (Array.isArray(value)) return Number(value[value.length - 1]);
  return Number(value);
}

function dot(color: string | undefined): string {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${
    color ?? OVERALL_COLOR
  };margin-right:6px;"></span>`;
}

function axisText(t: ChartTheme) {
  return { color: t.axis, fontSize: 10, fontFamily: FONT };
}

function formatAxisPct(valuePct: number): string {
  const text = Math.abs(valuePct).toFixed(2).replace(/\.?0+$/, "");
  return `${valuePct < 0 ? "−" : ""}${text}%`;
}

export interface SessionMarker {
  /** 指标值，小数比例（0.012 表示 1.2%）。 */
  value: number;
  /** 图上标注文字，例如「当日」「最近」。 */
  label: string;
}

function sessionAxisValues(session: SessionMarker | null | undefined): number[] {
  if (!session || !Number.isFinite(session.value)) return [];
  if (session.value === 0) return [0];
  const pad = (Math.sign(session.value) * HISTOGRAM_BIN_WIDTH_PCT) / 100;
  return [session.value, session.value + pad];
}

function guideMarkLine(
  t: ChartTheme,
  session: SessionMarker | null | undefined,
  axis: DistributionAxis | null = null,
) {
  const data: Record<string, unknown>[] = [{ xAxis: 0 }];
  if (session && Number.isFinite(session.value)) {
    const pct = session.value * 100;
    const span = axis ? axis.maxPct - axis.minPct : 0;
    const relative = axis && span > 0 ? (pct - axis.minPct) / span : 0.5;
    data.push({
      xAxis: pct,
      lineStyle: { color: t.session, type: "solid", width: 1.5 },
      label: {
        show: true,
        position: "insideEndTop",
        distance: 3,
        rotate: 0,
        align: relative > 0.82 ? "right" : relative < 0.18 ? "left" : "center",
        formatter: `${session.label} ${formatAxisPct(pct)}`,
        color: t.sessionText,
        backgroundColor: t.session,
        padding: [2, 5],
        borderRadius: 4,
        fontSize: 9,
        fontWeight: 600,
        fontFamily: FONT,
      },
    });
  }
  return {
    silent: true,
    symbol: "none",
    animation: false,
    z2: 10,
    label: { show: false },
    lineStyle: { color: alpha(t.axis, 0.55), type: "dashed", width: 1 },
    data,
  };
}

function pctAxisLabel(t: ChartTheme) {
  return {
    ...axisText(t),
    formatter: formatAxisPct,
    hideOverlap: true,
    showMinLabel: true,
    showMaxLabel: true,
  };
}

function symmetricLabelInterval(
  axis: DistributionAxis,
  mode: DistributionAxisMode,
): number | undefined {
  if (mode !== "symmetric") return undefined;
  const divisions = axis.maxPct <= 1 ? 2 : 3;
  return (axis.maxPct - axis.minPct) / (divisions * 2);
}

function baseOption(t: ChartTheme) {
  return {
    animationDuration: 320,
    textStyle: { fontFamily: FONT, color: t.axis },
    grid: { left: 42, right: 14, top: 30, bottom: 28, containLabel: false },
    tooltip: { ...tooltipBase(t), confine: true },
  } satisfies EChartsCoreOption;
}

export function histogramOption(
  overall: number[],
  block: number[] | null,
  blockLabel: string,
  def: MetricDef,
  dark: boolean,
  blockColor: string = BLOCK_COLORS[0],
  session: SessionMarker | null = null,
): EChartsCoreOption {
  const t = theme(dark);
  const hasBlock = Boolean(block && block.length > 0);
  const combined = hasBlock ? [...overall, ...(block ?? [])] : overall;
  const mode = axisModeForMetric(def.key);
  const axis = distributionAxis(
    [...combined, ...sessionAxisValues(session)],
    mode,
  );
  const labelInterval = symmetricLabelInterval(axis, mode);
  if (axis.edgesPct.length < 2) return {};

  const edges = axis.edgesPct.map((value) => value / 100);
  const overallCounts = histogramWithEdges(overall, edges);
  const blockCounts = hasBlock ? histogramWithEdges(block ?? [], edges) : [];
  const centers = axis.edgesPct
    .slice(0, -1)
    .map((edge, index) => (edge + axis.edgesPct[index + 1]) / 2);
  const toShare = (counts: number[], total: number) =>
    counts.map((count) => (total > 0 ? count / total : 0));
  const overallShares = toShare(overallCounts, overall.length);
  const blockShares = hasBlock
    ? toShare(blockCounts, (block ?? []).length)
    : [];

  const series: Record<string, unknown>[] = [
    {
      name: `全区间 (n=${overall.length})`,
      type: "bar",
      data: centers.map((center, index) => [center, overallShares[index]]),
      barWidth: "90%",
      barGap: "-100%",
      itemStyle: {
        color: alpha(OVERALL_COLOR, 0.34),
        borderRadius: [3, 3, 0, 0],
      },
      emphasis: { itemStyle: { color: alpha(OVERALL_COLOR, 0.52) } },
    },
  ];
  if (hasBlock && block) {
    series.push({
      name: `${blockLabel} (n=${block.length})`,
      type: "bar",
      data: centers.map((center, index) => [center, blockShares[index]]),
      barWidth: "90%",
      barGap: "-100%",
      itemStyle: {
        color: alpha(blockColor, 0.72),
        borderRadius: [3, 3, 0, 0],
      },
      emphasis: { itemStyle: { color: blockColor } },
    });
  }
  series[series.length - 1].markLine = guideMarkLine(t, session, axis);

  return {
    ...baseOption(t),
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: t.subText, fontSize: 10, fontFamily: FONT },
    },
    grid: { left: 42, right: 14, top: 30, bottom: 28 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: alpha("#64748b", 0.07) },
      },
      formatter: (raw: unknown) => {
        const list = paramList(raw);
        const index = list[0]?.dataIndex ?? 0;
        const from = axis.edgesPct[index] ?? axis.minPct;
        const to = axis.edgesPct[index + 1] ?? axis.maxPct;
        const rows = list
          .map(
            (item) =>
              `${dot(item.color)}${item.seriesName ?? ""}：${pct(
                numeric(item.value),
                1,
                false,
              )}`,
          )
          .join("<br/>");
        return `<div style="font-weight:600;margin-bottom:4px;">${
          def.label
        } ∈ [${formatAxisPct(from)}, ${formatAxisPct(to)}]</div>${rows}`;
      },
    },
    xAxis: {
      type: "value",
      min: axis.minPct,
      max: axis.maxPct,
      splitNumber: 6,
      ...(labelInterval == null ? {} : { interval: labelInterval }),
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: pctAxisLabel(t),
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
    },
    series,
  };
}

function ecdfPointsForMode(
  values: number[],
  mode: DistributionAxisMode,
): Array<[number, number]> {
  return mode === "symmetric"
    ? twoSidedEcdfPoints(values)
    : ecdfPoints(values);
}

function ecdfStep(
  mode: DistributionAxisMode,
): Record<string, unknown> {
  return mode === "symmetric" ? {} : { step: "end" };
}

function ecdfTooltipCopy(
  mode: DistributionAxisMode,
  xPct: number,
): { relation: string; label: string } {
  if (mode === "symmetric") {
    if (xPct < 0) return { relation: "≤", label: "负侧累计" };
    if (xPct > 0) return { relation: "≥", label: "正侧累计" };
    return { relation: "=", label: "0 轴汇合" };
  }
  return { relation: "≤", label: "累计占比" };
}

export function ecdfOption(
  overall: number[],
  block: number[] | null,
  blockLabel: string,
  def: MetricDef,
  dark: boolean,
  blockColor: string = BLOCK_COLORS[0],
  session: SessionMarker | null = null,
): EChartsCoreOption {
  const t = theme(dark);
  const mode = axisModeForMetric(def.key);
  const combined =
    block && block.length > 0 ? [...overall, ...block] : overall;
  const axis = distributionAxis(
    [...combined, ...sessionAxisValues(session)],
    mode,
  );
  const labelInterval = symmetricLabelInterval(axis, mode);
  const overallPoints = ecdfPointsForMode(overall, mode).map(([x, y]) => [
    x * 100,
    y,
  ]);
  const blockPoints = block
    ? ecdfPointsForMode(block, mode).map(([x, y]) => [x * 100, y])
    : [];
  const series: Record<string, unknown>[] = [
    {
      name: `全区间 (n=${overall.length})`,
      type: "line",
      ...ecdfStep(mode),
      showSymbol: false,
      data: overallPoints,
      lineStyle: {
        width: 1.6,
        color: alpha(OVERALL_COLOR, 0.85),
        type: "dashed",
      },
      itemStyle: { color: OVERALL_COLOR },
    },
  ];
  if (block && block.length > 0) {
    series.push({
      name: `${blockLabel} (n=${block.length})`,
      type: "line",
      ...ecdfStep(mode),
      showSymbol: false,
      data: blockPoints,
      lineStyle: { width: 2, color: blockColor },
      itemStyle: { color: blockColor },
    });
  }
  series[series.length - 1].markLine = guideMarkLine(t, session, axis);

  return {
    ...baseOption(t),
    legend: {
      top: 0,
      right: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 2,
      textStyle: { color: t.subText, fontSize: 10, fontFamily: FONT },
    },
    grid: { left: 42, right: 14, top: 30, bottom: 28 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "item",
      formatter: (raw: unknown) => {
        const item = paramList(raw)[0];
        const value = item?.value;
        const x = Array.isArray(value) ? Number(value[0]) : 0;
        const y = Array.isArray(value) ? Number(value[1]) : 0;
        const copy = ecdfTooltipCopy(mode, x);
        return `${dot(item?.color)}${item?.seriesName ?? ""}<br/>${
          def.label
        } ${copy.relation} <b>${pp(x, 2, def.signed)}</b><br/>${
          copy.label
        } <b>${(y * 100).toFixed(1)}%</b>`;
      },
    },
    xAxis: {
      type: "value",
      min: axis.minPct,
      max: axis.maxPct,
      splitNumber: 6,
      ...(labelInterval == null ? {} : { interval: labelInterval }),
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: pctAxisLabel(t),
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      splitNumber: 4,
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
    },
    series,
  };
}

export interface BlockSeries {
  label: string;
  values: number[];
  color: string;
}

export function blockEcdfOption(
  overall: number[],
  blocks: BlockSeries[],
  def: MetricDef,
  dark: boolean,
): EChartsCoreOption {
  const t = theme(dark);
  const mode = axisModeForMetric(def.key);
  const axis = distributionAxis(
    [...overall, ...blocks.flatMap((block) => block.values)],
    mode,
  );
  const labelInterval = symmetricLabelInterval(axis, mode);
  const series: Record<string, unknown>[] = [
    {
      name: "全区间",
      type: "line",
      ...ecdfStep(mode),
      showSymbol: false,
      data: ecdfPointsForMode(overall, mode).map(([x, y]) => [x * 100, y]),
      lineStyle: {
        width: 1.5,
        color: alpha(OVERALL_COLOR, 0.8),
        type: "dashed",
      },
      itemStyle: { color: OVERALL_COLOR },
      z: 2,
    },
    ...blocks.map((block) => ({
      name: block.label,
      type: "line",
      ...ecdfStep(mode),
      showSymbol: false,
      data: ecdfPointsForMode(block.values, mode).map(([x, y]) => [
        x * 100,
        y,
      ]),
      lineStyle: { width: 2, color: block.color },
      itemStyle: { color: block.color },
      z: 3,
    })),
  ];
  series[series.length - 1].markLine = guideMarkLine(t, null);

  return {
    ...baseOption(t),
    legend: {
      top: 0,
      right: 0,
      type: "scroll",
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 2,
      textStyle: { color: t.subText, fontSize: 10, fontFamily: FONT },
    },
    grid: { left: 42, right: 14, top: 34, bottom: 28 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "item",
      formatter: (raw: unknown) => {
        const item = paramList(raw)[0];
        const value = item?.value;
        const x = Array.isArray(value) ? Number(value[0]) : 0;
        const y = Array.isArray(value) ? Number(value[1]) : 0;
        const copy = ecdfTooltipCopy(mode, x);
        return `${dot(item?.color)}${item?.seriesName ?? ""}<br/>${
          def.label
        } ${copy.relation} <b>${pp(x, 2, def.signed)}</b><br/>${
          copy.label
        } <b>${(y * 100).toFixed(1)}%</b>`;
      },
    },
    xAxis: {
      type: "value",
      min: axis.minPct,
      max: axis.maxPct,
      splitNumber: 6,
      ...(labelInterval == null ? {} : { interval: labelInterval }),
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: pctAxisLabel(t),
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      splitNumber: 4,
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${Math.round(value * 100)}%`,
      },
    },
    series,
  };
}

export function blockBoxOption(
  overall: number[],
  blocks: BlockSeries[],
  def: MetricDef,
  dark: boolean,
): EChartsCoreOption {
  const t = theme(dark);
  const entries = [
    { label: "全区间", values: overall, color: OVERALL_COLOR },
    ...blocks,
  ];
  const stats = entries.map((entry) => boxStats(entry.values));
  const boxData = entries.map((entry, index) => {
    const item = stats[index];
    return {
      value: [
        item.whiskerLow * 100,
        item.q1 * 100,
        item.median * 100,
        item.q3 * 100,
        item.whiskerHigh * 100,
      ],
      itemStyle: {
        color: alpha(entry.color, 0.16),
        borderColor: entry.color,
        borderWidth: 1.4,
      },
    };
  });
  const outliers = entries.flatMap((entry, index) =>
    stats[index].outliers.map((value) => ({
      value: [index, value * 100],
      itemStyle: { color: alpha(entry.color, 0.55) },
    })),
  );

  return {
    ...baseOption(t),
    grid: { left: 42, right: 14, top: 18, bottom: 28 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "item",
      formatter: (raw: unknown) => {
        const item = paramList(raw)[0];
        if (!item) return "";
        if (item.seriesName === "离群值") {
          const value = item.value;
          const y = Array.isArray(value) ? Number(value[1]) : Number(value);
          return `离群值：<b>${pp(y, 2, def.signed)}</b>`;
        }
        const rawData = item.data as { value?: number[] } | number[] | undefined;
        const values = Array.isArray(rawData) ? rawData : rawData?.value;
        if (!values || values.length < 5) return "";
        const category = item.name ?? "";
        return `<div style="font-weight:600;margin-bottom:4px;">${category} · ${
          def.label
        }</div>须线低 <b>${pp(values[0], 2, def.signed)}</b><br/>Q1 <b>${pp(
          values[1],
          2,
          def.signed,
        )}</b> · 中位数 <b>${pp(values[2], 2, def.signed)}</b><br/>Q3 <b>${pp(
          values[3],
          2,
          def.signed,
        )}</b> · 须线高 <b>${pp(values[4], 2, def.signed)}</b>`;
      },
    },
    xAxis: {
      type: "category",
      data: entries.map((entry) => entry.label),
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      axisLabel: { ...axisText(t), interval: 0 },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${value.toFixed(0)}%`,
      },
    },
    series: [
      {
        name: "分布",
        type: "boxplot",
        boxWidth: [18, 38],
        data: boxData,
        emphasis: {
          itemStyle: { borderWidth: 2, shadowBlur: 6, shadowColor: alpha("#0f172a", 0.16) },
        },
      },
      {
        name: "离群值",
        type: "scatter",
        data: outliers,
        symbolSize: 4,
        silent: false,
      },
    ],
  };
}

export function medianTrendOption(
  drift: MetricDrift,
  def: MetricDef,
  dark: boolean,
): EChartsCoreOption {
  const t = theme(dark);
  const labels = drift.blocks.map((block) => block.label);
  const medians = drift.blocks.map((block) => block.median * 100);
  const lows = drift.blocks.map((block) =>
    block.ci ? block.ci[0] * 100 : block.median * 100,
  );
  const highs = drift.blocks.map((block) =>
    block.ci ? block.ci[1] * 100 : block.median * 100,
  );
  const bands = highs.map((high, index) => Math.max(0, high - lows[index]));
  const accent =
    drift.globalQ != null && drift.globalQ < 0.05 ? "#e0574b" : BLOCK_COLORS[0];

  const series: Record<string, unknown>[] = [
    {
      name: "CI 下界",
      type: "line",
      stack: "ci",
      data: lows,
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
      tooltip: { show: false },
    },
    {
      name: "95% CI",
      type: "line",
      stack: "ci",
      data: bands,
      symbol: "none",
      lineStyle: { opacity: 0 },
      areaStyle: { color: alpha(accent, 0.14) },
      silent: true,
      tooltip: { show: false },
    },
    {
      name: "中位数",
      type: "line",
      data: medians,
      symbol: "circle",
      symbolSize: 7,
      lineStyle: { width: 2.2, color: accent },
      itemStyle: { color: accent, borderColor: t.tooltipBg, borderWidth: 2 },
      z: 5,
    },
  ];

  return {
    ...baseOption(t),
    grid: { left: 42, right: 16, top: 22, bottom: 30 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: alpha(accent, 0.4) } },
      formatter: (raw: unknown) => {
        const list = paramList(raw);
        const index = list[0]?.dataIndex ?? 0;
        const block = drift.blocks[index];
        if (!block) return "";
        const ci = block.ci;
        return `<div style="font-weight:600;margin-bottom:3px;">${
          block.label
        } · ${block.startDate} ~ ${block.endDate}</div>中位数 <b>${pp(
          block.median * 100,
          2,
          def.signed,
        )}</b>${ci ? `（95% CI ${pp(ci[0] * 100, 2, def.signed)} ~ ${pp(ci[1] * 100, 2, def.signed)}）` : ""}<br/>n = ${block.n} 日`;
      },
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      axisLabel: { ...axisText(t), fontSize: 11 },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${value.toFixed(1)}%`,
      },
    },
    series,
  };
}

export function timeSeriesOption(
  rows: DailyMetrics[],
  def: MetricDef,
  blocks: Array<{ startDate: string; endDate: string; label: string }>,
  dark: boolean,
): EChartsCoreOption {
  const t = theme(dark);
  const dates = rows.map((row) => row.date);
  const values = rows.map((row) => row[def.key] * 100);
  const multiYear =
    rows.length > 0 &&
    rows[0]?.date.slice(0, 4) !== rows[rows.length - 1]?.date.slice(0, 4);
  const markAreaData = blocks.map((block, index) => [
    {
      xAxis: block.startDate,
      itemStyle: {
        color:
          index % 2 === 0
            ? alpha(BLOCK_COLORS[0], 0.085)
            : alpha(BLOCK_COLORS[2], 0.07),
      },
    },
    { xAxis: block.endDate },
  ]);

  return {
    ...baseOption(t),
    animation: false,
    grid: { left: 42, right: 12, top: 12, bottom: 22 },
    tooltip: {
      ...tooltipBase(t),
      trigger: "axis",
      axisPointer: { type: "line", lineStyle: { color: alpha("#64748b", 0.4) } },
      formatter: (raw: unknown) => {
        const item = paramList(raw)[0];
        const y = numeric(item?.value);
        return `${item?.name ?? ""}<br/>${def.label}：<b>${pp(
          y,
          2,
          def.signed,
        )}</b>`;
      },
    },
    xAxis: {
      type: "category",
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: t.split } },
      axisTick: { show: false },
      axisLabel: {
        ...axisText(t),
        interval: "auto",
        formatter: (value: string) =>
          multiYear ? value.slice(2, 7) : value.slice(5),
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      scale: true,
      splitNumber: 3,
      splitLine: { lineStyle: { color: t.split } },
      axisLabel: {
        ...axisText(t),
        formatter: (value: number) => `${value.toFixed(1)}%`,
      },
    },
    series: [
      {
        name: def.label,
        type: "line",
        data: values,
        showSymbol: false,
        lineStyle: { width: 1.2, color: alpha(BLOCK_COLORS[0], 0.9) },
        itemStyle: { color: BLOCK_COLORS[0] },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: alpha(BLOCK_COLORS[0], 0.12) },
              { offset: 1, color: alpha(BLOCK_COLORS[0], 0.01) },
            ],
          },
        },
        markArea: {
          silent: true,
          label: { show: false },
          data: markAreaData,
        },
        markLine: def.signed
          ? {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: {
                color: alpha(t.axis, 0.4),
                type: "dashed",
                width: 1,
              },
              data: [{ yAxis: 0 }],
            }
          : undefined,
      },
    ],
  };
}
