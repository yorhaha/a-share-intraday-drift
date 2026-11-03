interface CacheEntry<T> {
  fetchedAt: number;
  data: T;
}

const memory = new Map<string, CacheEntry<unknown>>();
const PREFIX = "market-dist:v2:";

function storageKey(key: string): string {
  return `${PREFIX}${key}`;
}

export function readCache<T>(key: string, ttlMs: number): T | null {
  const now = Date.now();
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem && now - mem.fetchedAt <= ttlMs) return mem.data;
  if (mem) memory.delete(key);

  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.fetchedAt !== "number") return null;
    if (now - parsed.fetchedAt > ttlMs) {
      window.localStorage.removeItem(storageKey(key));
      return null;
    }
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { fetchedAt: Date.now(), data };
  memory.set(key, entry);
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // 存储空间不足或被禁用时静默降级为内存缓存。
  }
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
