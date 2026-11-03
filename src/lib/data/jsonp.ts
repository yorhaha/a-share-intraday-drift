type JsonpGlobal = Window & Record<string, unknown>;

function getWindow(): JsonpGlobal {
  if (typeof window === "undefined") {
    throw new Error("JSONP 只能在浏览器中调用");
  }
  return window as unknown as JsonpGlobal;
}

function loadScript(url: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("JSONP 只能在浏览器中调用"));
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    let settled = false;

    const cleanup = () => {
      if (script.parentNode) script.parentNode.removeChild(script);
      window.clearTimeout(timer);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("行情接口响应超时"));
    }, timeoutMs);

    script.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("行情接口加载失败"));
    };

    document.head.appendChild(script);
  });
}

export async function readGlobalJsonp<T>(
  url: string,
  globalName: string,
  timeoutMs = 10_000,
): Promise<T | undefined> {
  const win = getWindow();
  delete win[globalName];
  await loadScript(url, timeoutMs);
  const value = win[globalName] as T | undefined;
  delete win[globalName];
  return value;
}
