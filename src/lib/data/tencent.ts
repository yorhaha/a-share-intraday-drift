import type {
  DailyBar,
  FqMode,
  Market,
  SymbolHit,
} from "./types";
import { addDays, isIncompleteTodayBar, isValidDate } from "../date";
import { readCache, writeCache } from "./cache";
import { readGlobalJsonp } from "./jsonp";

const SEARCH_ENDPOINT = "https://smartbox.gtimg.cn/s3/";
const KLINE_ENDPOINT =
  "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get";
const MAX_BARS = 640;
const CACHE_TTL = 6 * 60 * 60 * 1000;
const SEARCH_TTL = 5 * 60 * 1000;

type TencentKlineEntry = {
  qfqday?: unknown[][];
  day?: unknown[][];
  hfqday?: unknown[][];
};

type TencentKlineResponse = {
  code?: number;
  msg?: string;
  data?: Record<string, TencentKlineEntry>;
};

export interface DailySeriesResult {
  bars: DailyBar[];
  dropped: number;
  fromCache: boolean;
}

const searchCache = new Map<
  string,
  { fetchedAt: number; hits: SymbolHit[] }
>();
const pending = new Map<string, Promise<DailySeriesResult>>();

function decodeJsonpString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return raw.replace(/\\u([0-9a-fA-F]{4})/g, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
  }
}

export function parseSmartboxResponse(text: string): SymbolHit[] {
  const match = /v_hint\s*=\s*"([\s\S]*?)"\s*;?/.exec(text);
  // readGlobalJsonp 拿到的是脚本执行后的全局值（已解码的 payload），
  // 而单测/原始响应可能是 v_hint="..." 形式；两种都接受。
  const decoded = match ? decodeJsonpString(match[1]) : text.trim();
  if (!decoded) return [];
  const hits: SymbolHit[] = [];
  const seen = new Set<string>();
  for (const item of decoded.split("^")) {
    const parts = item.split("~");
    if (parts.length < 5) continue;
    const [market, code, name, pinyin, type] = parts;
    if (!["sh", "sz", "bj"].includes(market)) continue;
    if (!(type === "GP-A" || type.startsWith("GP-A"))) continue;
    if (!/^\d{6}$/.test(code)) continue;
    const symbol = `${market}${code}`;
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    hits.push({
      symbol,
      market: market as Market,
      code,
      name,
      pinyin,
    });
  }
  return hits;
}

export async function searchSymbols(query: string): Promise<SymbolHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const cached = searchCache.get(trimmed);
  if (cached && Date.now() - cached.fetchedAt < SEARCH_TTL) {
    return cached.hits;
  }
  const url = `${SEARCH_ENDPOINT}?v=2&q=${encodeURIComponent(trimmed)}&t=gp`;
  try {
    const text = await readGlobalJsonp<string>(url, "v_hint", 8_000);
    const hits = typeof text === "string" ? parseSmartboxResponse(text) : [];
    searchCache.set(trimmed, { fetchedAt: Date.now(), hits });
    return hits;
  } catch {
    return [];
  }
}

function inferMarket(code: string): Market {
  if (/^6/.test(code)) return "sh";
  if (/^(0|3)/.test(code)) return "sz";
  if (/^(4|8|92)/.test(code)) return "bj";
  return "sh";
}

export async function resolveSymbol(raw: string): Promise<SymbolHit | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const prefixed = /^(sh|sz|bj)(\d{6})$/i.exec(trimmed);
  if (prefixed) {
    const code = prefixed[2];
    const hits = await searchSymbols(code);
    const exact = hits.find((hit) => hit.code === code);
    if (exact) return exact;
    const market = prefixed[1].toLowerCase() as Market;
    return {
      symbol: `${market}${code}`,
      market,
      code,
      name: code,
      pinyin: "",
    };
  }
  const digits = /^\d{6}$/.test(trimmed) ? trimmed : null;
  const hits = await searchSymbols(digits ?? trimmed);
  if (digits) {
    const exact = hits.find((hit) => hit.code === digits);
    if (exact) return exact;
    return {
      symbol: `${inferMarket(digits)}${digits}`,
      market: inferMarket(digits),
      code: digits,
      name: digits,
      pinyin: "",
    };
  }
  return hits[0] ?? null;
}

function klineUrl(symbol: string, end: string, fq: FqMode): string {
  const fqParam = fq === "qfq" ? "qfq" : "";
  return `${KLINE_ENDPOINT}?param=${symbol},day,1990-01-01,${end},${MAX_BARS},${fqParam}`;
}

function rowToBar(row: unknown[]): DailyBar | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const [date, open, close, high, low, volume] = row;
  if (typeof date !== "string" || !isValidDate(date)) return null;
  const numbers = [open, close, high, low, volume].map((value) =>
    typeof value === "number" ? value : Number(value),
  );
  if (numbers.some((value) => !Number.isFinite(value))) return null;
  return {
    date,
    open: numbers[0],
    close: numbers[1],
    high: numbers[2],
    low: numbers[3],
    volume: numbers[4],
  };
}

export function parseKlineRows(rows: unknown[][]): {
  bars: DailyBar[];
  dropped: number;
} {
  const byDate = new Map<string, DailyBar>();
  let dropped = 0;
  for (const row of rows) {
    const bar = rowToBar(row);
    if (!bar) {
      dropped += 1;
      continue;
    }
    if (bar.volume <= 0) {
      dropped += 1;
      continue;
    }
    byDate.set(bar.date, bar);
  }
  const bars = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  return { bars, dropped };
}

export function parseKlinePayload(
  payload: TencentKlineResponse,
  symbol: string,
): { bars: DailyBar[]; dropped: number } {
  if (!payload || payload.code !== 0 || !payload.data) {
    const message =
      payload && typeof payload.msg === "string" && payload.msg
        ? payload.msg
        : "行情接口返回异常";
    throw new Error(message);
  }
  const entry = payload.data[symbol];
  if (!entry) return { bars: [], dropped: 0 };
  const rows = entry.qfqday ?? entry.day ?? entry.hfqday ?? [];
  return parseKlineRows(rows);
}

async function fetchKlineChunk(
  symbol: string,
  end: string,
  fq: FqMode,
): Promise<{ bars: DailyBar[]; dropped: number }> {
  const url = klineUrl(symbol, end, fq);

  // 腾讯的 _var 返回的是「全局赋值」而不是函数调用，因此用 readGlobalJsonp
  // 读取执行后的全局变量。日线接口的 CORS 头在不同边缘节点上不稳定，
  // 静态页面优先走 JSONP，失败时再用 fetch 兜底。
  const globalName = `__market_dist_kline_${Date.now()}_${Math.floor(
    Math.random() * 1_000_000,
  )}`;
  try {
    const payload = await readGlobalJsonp<TencentKlineResponse>(
      `${url}&_var=${globalName}`,
      globalName,
      15_000,
    );
    if (!payload) throw new Error("行情接口返回为空");
    return parseKlinePayload(payload, symbol);
  } catch {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const payload = JSON.parse(text) as TencentKlineResponse;
      return parseKlinePayload(payload, symbol);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function fetchDailySeriesUncached(
  symbol: string,
  start: string,
  end: string,
  fq: FqMode,
): Promise<DailySeriesResult> {
  const merged = new Map<string, DailyBar>();
  let dropped = 0;
  let currentEnd = end;
  let iterations = 0;

  while (iterations < 20) {
    iterations += 1;
    const chunk = await fetchKlineChunk(symbol, currentEnd, fq);
    dropped += chunk.dropped;
    if (chunk.bars.length === 0) break;

    for (const bar of chunk.bars) {
      merged.set(bar.date, bar);
    }

    const earliest = chunk.bars[0].date;
    if (chunk.bars.length < MAX_BARS) break;
    if (earliest < start) break;

    const nextEnd = addDays(earliest, -1);
    if (nextEnd >= currentEnd) break;
    currentEnd = nextEnd;
  }

  const bars = [...merged.values()]
    .filter((bar) => bar.date <= end)
    .filter((bar) => !isIncompleteTodayBar(bar.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (bars.length === 0) {
    throw new Error("该区间内没有可用的日线数据");
  }

  return { bars, dropped, fromCache: false };
}

export async function fetchDailySeries(
  symbol: string,
  start: string,
  end: string,
  fq: FqMode,
  force = false,
): Promise<DailySeriesResult> {
  const key = `daily|${symbol}|${fq}|${start}|${end}`;
  if (!force) {
    const cached = readCache<{ bars: DailyBar[]; dropped: number }>(
      key,
      CACHE_TTL,
    );
    if (cached) {
      return { ...cached, fromCache: true };
    }
    const inflight = pending.get(key);
    if (inflight) return inflight;
  }

  const task = fetchDailySeriesUncached(symbol, start, end, fq)
    .then((result) => {
      writeCache(key, { bars: result.bars, dropped: result.dropped });
      return result;
    })
    .finally(() => {
      pending.delete(key);
    });

  pending.set(key, task);
  return task;
}

export function clearSearchCache(): void {
  searchCache.clear();
}
