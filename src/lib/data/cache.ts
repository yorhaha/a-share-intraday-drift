import type { DailyBar } from "./types";

interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}

export interface CacheRecord<T> {
  fetchedAt: number;
  data: T;
}

export interface DateCoverage {
  start: string;
  end: string;
}

const memory = new Map<string, CacheEntry<unknown>>();
const PREFIX = "market-dist:v2:";
const MAX_LOCAL_ENTRIES = 30;

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

function sortedEntries(): Array<{ key: string; fetchedAt: number }> {
  const entries: Array<{ key: string; fetchedAt: number }> = [];
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(PREFIX)) continue;
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as CacheEntry<unknown>;
        if (!parsed || typeof parsed.fetchedAt !== "number") {
          window.localStorage.removeItem(key);
          continue;
        }
        entries.push({ key, fetchedAt: parsed.fetchedAt });
      } catch {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage 不可用时只保留内存缓存。
  }
  return entries.sort((a, b) => a.fetchedAt - b.fetchedAt);
}

/** 控制本地缓存规模，避免多个标的无限堆积占满 localStorage。 */
function pruneLocalStorage(keepKey?: string): void {
  const entries = sortedEntries();
  const removable = entries.filter((entry) => entry.key !== keepKey);
  const excess = entries.length - MAX_LOCAL_ENTRIES;
  if (excess <= 0) return;
  for (const entry of removable.slice(0, excess)) {
    try {
      window.localStorage.removeItem(entry.key);
    } catch {
      // ignore
    }
  }
}

function pruneMemory(keepKey?: string): void {
  if (memory.size <= MAX_LOCAL_ENTRIES) return;
  const entries = [...memory.entries()]
    .filter(([key]) => key !== keepKey)
    .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
  const excess = memory.size - MAX_LOCAL_ENTRIES;
  for (const [key] of entries.slice(0, excess)) {
    memory.delete(key);
  }
}

/**
 * 读取缓存及其写入时间。ttlMs 传 Number.POSITIVE_INFINITY 时可以取到过期缓存，
 * 用于网络失败时的兜底展示。
 */
export function readCacheWithMeta<T>(
  key: string,
  ttlMs: number,
): CacheRecord<T> | null {
  const now = Date.now();
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem) {
    if (now - mem.fetchedAt <= ttlMs) {
      return { fetchedAt: mem.fetchedAt, data: mem.data };
    }
    memory.delete(key);
  }

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    if (now - parsed.fetchedAt > ttlMs) return null;
    memory.set(key, parsed);
    return { fetchedAt: parsed.fetchedAt, data: parsed.data };
  } catch {
    return null;
  }
}

export function readCache<T>(key: string, ttlMs: number): T | null {
  return readCacheWithMeta<T>(key, ttlMs)?.data ?? null;
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
  memory.set(key, entry);
  pruneMemory(key);
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
    pruneLocalStorage(storageKey(key));
  } catch {
    // 存储空间不足时先清掉最旧条目，再尝试写入一次。
    pruneLocalStorage(storageKey(key));
    try {
      window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
    } catch {
      // 仍失败时静默降级为内存缓存。
    }
  }
}

export function mergeCoverage(
  coverage: DateCoverage[],
  next: DateCoverage,
): DateCoverage[] {
  const all = [...coverage, next]
    .filter((range) => range.start <= range.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const merged: DateCoverage[] = [];
  for (const range of all) {
    const last = merged[merged.length - 1];
    if (!last || range.start > addOneDay(last.end)) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > last.end) last.end = range.end;
  }
  return merged;
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function coversRange(
  coverage: DateCoverage[],
  start: string,
  end: string,
): boolean {
  return coverage.some(
    (range) => range.start <= start && range.end >= end,
  );
}

export function mergeBars(
  existing: DailyBar[],
  incoming: DailyBar[],
): DailyBar[] {
  const byDate = new Map<string, DailyBar>();
  for (const bar of existing) byDate.set(bar.date, bar);
  for (const bar of incoming) byDate.set(bar.date, bar);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function clearCache(): void {
  memory.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // ignore
  }
}
