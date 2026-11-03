import type {
  DailyBar,
  FqMode,
  Market,
  SymbolHit,
} from "./types";
import { addDays, isIncompleteTodayBar, isValidDate } from "../date";
import {
  coversRange,
  mergeBars,
  mergeCoverage,
  readCacheWithMeta,
  writeCache,
  type CacheRecord,
  type DateCoverage,
} from "./cache";
import { readGlobalJsonp } from "./jsonp";

const SEARCH_ENDPOINT = "https://smartbox.gtimg.cn/s3/";
const KLINE_ENDPOINTS = [
  "https://web.ifzq.gtimg.cn/appstock/app/fqkline/get",
  "https://ifzq.gtimg.cn/appstock/app/fqkline/get",
  "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get",
] as const;
const QUOTE_ENDPOINT = "https://qt.gtimg.cn/q=";
const MAX_BARS = 640;
const CACHE_TTL = 6 * 60 * 60 * 1000;
const SEARCH_TTL = 5 * 60 * 1000;
const QUOTE_TTL = 20 * 1000;

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
  /** 网络失败时回退到过期缓存。 */
  stale: boolean;
  /** 缓存写入时间；实时请求为 null。 */
  cachedAt: number | null;
}

interface CachedDailySeries {
  bars: DailyBar[];
  dropped: number;
  coverage: DateCoverage[];
}

export interface QuoteSnapshot extends DailyBar {
  prevClose: number;
  /** 行情时间（Asia/Shanghai），HH:mm。 */
  time: string;
}

const searchCache = new Map<
  string,
  { fetchedAt: number; hits: SymbolHit[] }
>();
const pending = new Map<string, Promise<DailySeriesResult>>();
const quoteCache = new Map<
  string,
  { fetchedAt: number; quote: QuoteSnapshot | null }
>();
const quotePending = new Map<string, Promise<QuoteSnapshot | null>>();

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

function klineUrl(
  endpoint: string,
  symbol: string,
  start: string,
  end: string,
  fq: FqMode,
): string {
  const fqParam = fq === "qfq" ? "qfq" : "";
  return `${endpoint}?param=${symbol},day,${start},${end},${MAX_BARS},${fqParam}`;
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

export function parseQuotePayload(
  text: string,
  expectedSymbol?: string,
): QuoteSnapshot | null {
  const trimmed = text.trim();
  const firstQuote = trimmed.indexOf('"');
  const lastQuote = trimmed.lastIndexOf('"');
  const payload =
    firstQuote >= 0 && lastQuote > firstQuote
      ? trimmed.slice(firstQuote + 1, lastQuote)
      : trimmed;
  if (!payload) return null;

  const parts = payload.split("~");
  if (parts.length < 35) return null;
  if (expectedSymbol && parts[2] !== expectedSymbol.slice(-6)) return null;

  const rawTime = parts[30] ?? "";
  if (!/^\d{14}$/.test(rawTime)) return null;
  const date = `${rawTime.slice(0, 4)}-${rawTime.slice(4, 6)}-${rawTime.slice(6, 8)}`;
  if (!isValidDate(date)) return null;

  const open = Number(parts[5]);
  const close = Number(parts[3]);
  const high = Number(parts[33]);
  const low = Number(parts[34]);
  const prevClose = Number(parts[4]);
  const volume = Number(parts[6]);
  const values = [open, close, high, low, prevClose, volume];
  if (!values.every((value) => Number.isFinite(value))) return null;
  if (!(open > 0 && close > 0 && high > 0 && low > 0 && prevClose > 0)) {
    return null;
  }
  if (volume < 0) return null;
  const eps = 1e-6;
  if (high < low - eps) return null;
  if (high < Math.max(open, close) - eps) return null;
  if (low > Math.min(open, close) + eps) return null;

  return {
    date,
    open,
    close,
    high,
    low,
    volume,
    prevClose,
    time: `${rawTime.slice(8, 10)}:${rawTime.slice(10, 12)}`,
  };
}

async function fetchQuoteUncached(
  symbol: string,
): Promise<QuoteSnapshot | null> {
  const url = `${QUOTE_ENDPOINT}${symbol}&r=${Date.now()}`;
  const globalName = `v_${symbol}`;

  // 腾讯实时行情返回 GBK 脚本赋值；优先用 JSONP 让浏览器完成解码。
  try {
    const value = await readGlobalJsonp<unknown>(url, globalName, 8_000);
    if (typeof value === "string") return parseQuotePayload(value, symbol);
  } catch {
    // 某些网络环境会拦截脚本加载，继续走 fetch 兜底。
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return parseQuotePayload(await response.text(), symbol);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchQuote(
  symbol: string,
  force = false,
): Promise<QuoteSnapshot | null> {
  if (!force) {
    const cached = quoteCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < QUOTE_TTL) {
      return cached.quote;
    }
    const inflight = quotePending.get(symbol);
    if (inflight) return inflight;
  }

  const task = fetchQuoteUncached(symbol)
    .then((quote) => {
      quoteCache.set(symbol, { fetchedAt: Date.now(), quote });
      return quote;
    })
    .finally(() => {
      quotePending.delete(symbol);
    });

  quotePending.set(symbol, task);
  return task;
}

export function clearQuoteCache(): void {
  quoteCache.clear();
}

async function fetchKlineChunk(
  symbol: string,
  start: string,
  end: string,
  fq: FqMode,
): Promise<{ bars: DailyBar[]; dropped: number }> {
  // 腾讯的 _var 返回的是「全局赋值」而不是函数调用，因此用 readGlobalJsonp
  // 读取执行后的全局变量。日线接口的边缘节点偶尔返回 501，且错误响应不带
  // CORS 头；先依次尝试多个腾讯域名，都失败后再用 fetch 兜底。
  let lastError: unknown = null;

  for (const endpoint of KLINE_ENDPOINTS) {
    const url = klineUrl(endpoint, symbol, start, end, fq);
    const globalName = `__market_dist_kline_${Date.now()}_${Math.floor(
      Math.random() * 1_000_000,
    )}`;
    try {
      const payload = await readGlobalJsonp<TencentKlineResponse>(
        `${url}&_var=${globalName}`,
        globalName,
        12_000,
      );
      if (!payload) throw new Error("行情接口返回为空");
      return parseKlinePayload(payload, symbol);
    } catch (reason) {
      lastError = reason;
    }
  }

  for (const endpoint of KLINE_ENDPOINTS) {
    const url = klineUrl(endpoint, symbol, start, end, fq);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const payload = JSON.parse(text) as TencentKlineResponse;
      return parseKlinePayload(payload, symbol);
    } catch (reason) {
      lastError = reason;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("行情接口请求失败");
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
  // 多取一段缓冲，保证区间首日仍能拿到上一交易日收盘价；
  // 同时避免向接口请求 1990 年至今的整段数据。
  const requestStart = addDays(start, -20);

  while (iterations < 20) {
    iterations += 1;
    const chunk = await fetchKlineChunk(
      symbol,
      requestStart,
      currentEnd,
      fq,
    );
    dropped += chunk.dropped;
    if (chunk.bars.length === 0) break;

    for (const bar of chunk.bars) {
      merged.set(bar.date, bar);
    }

    const earliest = chunk.bars[0].date;
    if (chunk.bars.length < MAX_BARS) break;
    if (earliest < requestStart) break;

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

  return {
    bars,
    dropped,
    fromCache: false,
    stale: false,
    cachedAt: null,
  };
}

function cachedSeriesResult(
  record: CacheRecord<CachedDailySeries>,
  end: string,
  stale: boolean,
): DailySeriesResult {
  return {
    bars: record.data.bars.filter((bar) => bar.date <= end),
    dropped: record.data.dropped,
    fromCache: true,
    stale,
    cachedAt: record.fetchedAt,
  };
}

export async function fetchDailySeries(
  symbol: string,
  start: string,
  end: string,
  fq: FqMode,
  force = false,
): Promise<DailySeriesResult> {
  const key = `daily|${symbol}|${fq}`;
  const pendingKey = `${key}|${start}|${end}`;

  // 按「标的 + 复权方式」保存一份可复用行情，切日期、P、K 时不再重复请求。
  // 读取时不先删除过期条目，网络失败时还能回退到旧缓存。
  const cached = force
    ? null
    : readCacheWithMeta<CachedDailySeries>(key, Number.POSITIVE_INFINITY);
  if (cached) {
    const fresh = Date.now() - cached.fetchedAt <= CACHE_TTL;
    if (
      fresh &&
      cached.data.bars.length > 0 &&
      coversRange(cached.data.coverage, start, end)
    ) {
      return cachedSeriesResult(cached, end, false);
    }
  }
  const inflight = pending.get(pendingKey);
  if (inflight) return inflight;

  const task = fetchDailySeriesUncached(symbol, start, end, fq)
    .then((result) => {
      const existing = force
        ? null
        : readCacheWithMeta<CachedDailySeries>(
            key,
            Number.POSITIVE_INFINITY,
          );
      // 前复权历史价格会随分红送转变化，过期缓存不再与新数据混用。
      const mergeable =
        existing && Date.now() - existing.fetchedAt <= CACHE_TTL
          ? existing.data
          : null;
      const entry: CachedDailySeries = {
        bars: mergeBars(mergeable?.bars ?? [], result.bars),
        dropped: result.dropped,
        coverage: mergeCoverage(mergeable?.coverage ?? [], { start, end }),
      };
      writeCache(key, entry);
      return result;
    })
    .catch((reason: unknown) => {
      if (cached && coversRange(cached.data.coverage, start, end)) {
        return cachedSeriesResult(cached, end, true);
      }
      throw reason;
    })
    .finally(() => {
      pending.delete(pendingKey);
    });

  pending.set(pendingKey, task);
  return task;
}

export function clearSearchCache(): void {
  searchCache.clear();
}
