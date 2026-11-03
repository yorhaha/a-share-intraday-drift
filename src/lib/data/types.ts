export type Market = "sh" | "sz" | "bj";

export type FqMode = "qfq" | "none";

export interface SymbolHit {
  symbol: string;
  market: Market;
  code: string;
  name: string;
  pinyin: string;
}

export interface DailyBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface DailyMetrics extends DailyBar {
  prevClose: number;
  openRet: number;
  highRet: number;
  lowRet: number;
  amplitude: number;
  highVsOpen: number;
  lowVsOpen: number;
  zeroRange: boolean;
  gapDays: number;
}

export type MetricKey =
  | "openRet"
  | "highRet"
  | "lowRet"
  | "amplitude"
  | "highVsOpen"
  | "lowVsOpen";

export interface MetricDef {
  key: MetricKey;
  label: string;
  short: string;
  description: string;
  signed: boolean;
  decimals: number;
}

export interface PeriodBlock {
  index: number;
  label: string;
  startDate: string;
  endDate: string;
  raw: DailyMetrics[];
  rows: DailyMetrics[];
  excludedCount: number;
}

export interface BlockBuildResult {
  blocks: PeriodBlock[];
  effectiveK: number;
  requestedK: number;
  effectiveP: number;
  leftover: DailyMetrics[];
  warnings: string[];
}
