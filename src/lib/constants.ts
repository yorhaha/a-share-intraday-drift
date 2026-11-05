import type { MetricDef, MetricKey, SymbolHit } from "./data/types";

export const METRIC_DEFS: MetricDef[] = [
  {
    key: "openRet",
    label: "开盘涨跌幅",
    short: "开盘",
    description: "开盘价相对前收盘价的涨跌幅，反映隔夜跳空。",
    signed: true,
    decimals: 2,
  },
  {
    key: "highRet",
    label: "最高涨跌幅",
    short: "最高",
    description: "当日最高价相对前收盘价的涨跌幅。",
    signed: true,
    decimals: 2,
  },
  {
    key: "lowRet",
    label: "最低涨跌幅",
    short: "最低",
    description: "当日最低价相对前收盘价的涨跌幅。",
    signed: true,
    decimals: 2,
  },
  {
    key: "amplitude",
    label: "振幅",
    short: "振幅",
    description: "(最高价 − 最低价) / 前收盘价，衡量当日价格波动范围。",
    signed: false,
    decimals: 2,
  },
  {
    key: "highVsOpen",
    label: "最高相对开盘",
    short: "最高/开盘",
    description: "最高价相对开盘价的涨跌幅，开盘后的向上 excursion。",
    signed: false,
    decimals: 2,
  },
  {
    key: "lowVsOpen",
    label: "最低相对开盘",
    short: "最低/开盘",
    description: "最低价相对开盘价的涨跌幅，通常为负，开盘后的向下 excursion。",
    signed: true,
    decimals: 2,
  },
];

export const METRIC_MAP: Record<
  MetricKey,
  MetricDef
> = Object.fromEntries(METRIC_DEFS.map((def) => [def.key, def])) as Record<
  MetricKey,
  MetricDef
>;

export const METRIC_KEYS: MetricKey[] = METRIC_DEFS.map((def) => def.key);

export const DEMO_SYMBOL: SymbolHit = {
  symbol: "sh601318",
  market: "sh",
  code: "601318",
  name: "中国平安",
  pinyin: "zgpa",
};

export const RANGE_PRESETS = [
  { key: "3M", label: "3M", months: 3 },
  { key: "6M", label: "6M", months: 6 },
  { key: "1Y", label: "1Y", months: 12 },
  { key: "3Y", label: "3Y", months: 36 },
  { key: "5Y", label: "5Y", months: 60 },
] as const;

export type RangePresetKey = (typeof RANGE_PRESETS)[number]["key"];

export const PERIOD_PRESETS = [
  { days: 20, label: "1个月 ≈ 20日" },
  { days: 60, label: "3个月 ≈ 60日" },
  { days: 120, label: "6个月 ≈ 120日" },
  { days: 240, label: "1年 ≈ 240日" },
] as const;

export const MIN_BLOCK_N = 10;
export const LOW_POWER_BLOCK_N = 20;
export const PERMUTATION_REPS = 999;
export const BOOTSTRAP_REPS = 2000;
export const ALPHA = 0.05;

export const BLOCK_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
  "#64748b",
];

export const OVERALL_COLOR = "#a1a1aa";
