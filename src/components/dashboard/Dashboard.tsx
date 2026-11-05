"use client";

import { useEffect, useMemo, useState } from "react";
import SymbolSearch from "./SymbolSearch";
import ControlPanel from "./ControlPanel";
import SummaryTiles from "./SummaryTiles";
import DistributionGrid from "./DistributionGrid";
import DriftSection from "./DriftSection";
import TimeSeriesGrid from "./TimeSeriesGrid";
import Methodology from "./Methodology";
import {
  DEMO_SYMBOL,
  RANGE_PRESETS,
  type RangePresetKey,
} from "@/lib/constants";
import { runAnalysis, type AnalysisResult } from "@/lib/analysis";
import { clearCache } from "@/lib/data/cache";
import {
  clearQuoteCache,
  fetchQuote,
  resolveSymbol,
} from "@/lib/data/tencent";
import type { FqMode, MetricKey, SymbolHit } from "@/lib/data/types";
import { addMonths, isValidDate, todayShanghai } from "@/lib/date";
import { buildMarketSnapshot, type MarketSnapshot } from "@/lib/session";
import { downloadCsv } from "@/lib/csv";
import { fmtInt, fmtRelativeTime } from "@/lib/format";

type ChartMode = "hist" | "ecdf";

function LoadingSkeleton() {
  return (
    <div className="loading-state" aria-live="polite">
      <div className="loading-copy">
        <span className="live-dot" />
        正在加载
      </div>
      <div className="tiles">
        {[0, 1, 2, 3, 4].map((index) => (
          <div className="tile" key={index}>
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line value" />
            <div className="skeleton skeleton-line" />
          </div>
        ))}
      </div>
      <div className="metric-grid">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div className="card metric-card" key={index}>
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-chart" />
            <div className="skeleton skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="warnings card" role="status">
      <span className="warn-icon" aria-hidden="true">
        !
      </span>
      <div>
        <strong>数据提示</strong>
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [today] = useState(() => todayShanghai());
  const [symbol, setSymbol] = useState<SymbolHit>(DEMO_SYMBOL);
  const [rangePreset, setRangePreset] = useState<RangePresetKey | "custom">(
    "1Y",
  );
  const [start, setStart] = useState(() => addMonths(today, -12));
  const [end, setEnd] = useState(today);
  const [p, setP] = useState(60);
  const [k, setK] = useState(4);
  const [fq, setFq] = useState<FqMode>("qfq");
  const [excludeZeroRange, setExcludeZeroRange] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("hist");
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("amplitude");
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(
    null,
  );
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [session, setSession] = useState<MarketSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [dark, setDark] = useState(false);
  const [urlReady, setUrlReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("market-dist-theme");
        const preferred =
          stored === "dark" || stored === "light"
            ? stored === "dark"
            : window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDark(preferred);
        document.documentElement.dataset.theme = preferred ? "dark" : "light";
      } catch {
        // localStorage 不可用时保持默认浅色。
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- URL 是外部状态，首次挂载时同步一次到 React 状态。 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      resolveSymbol(code)
        .then((hit) => {
          if (hit) {
            setLoading(true);
            setSymbol(hit);
          }
        })
        .catch(() => {
          // URL 标的解析失败时保留默认示例。
        })
        .finally(() => {
          setUrlReady(true);
        });
    } else {
      setUrlReady(true);
    }
    const nextStart = params.get("start");
    const nextEnd = params.get("end");
    let urlStart: string | null = null;
    let urlEnd: string | null = null;
    if (nextStart && isValidDate(nextStart)) urlStart = nextStart;
    if (nextEnd && isValidDate(nextEnd)) urlEnd = nextEnd;
    if (urlStart && urlEnd && urlStart <= urlEnd) {
      setStart(urlStart);
      setEnd(urlEnd);
      setRangePreset("custom");
    } else if (urlStart) {
      setStart(urlStart);
      setRangePreset("custom");
    } else if (urlEnd) {
      setEnd(urlEnd);
      setRangePreset("custom");
    }
    const urlP = Number.parseInt(params.get("p") ?? "", 10);
    if (Number.isFinite(urlP) && urlP >= 5 && urlP <= 500) setP(urlP);
    const urlK = Number.parseInt(params.get("k") ?? "", 10);
    if (Number.isFinite(urlK) && urlK >= 2 && urlK <= 6) setK(urlK);
    if (params.get("exclude") === "1") setExcludeZeroRange(true);
    if (params.get("fq") === "none") setFq("none");
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    params.set("code", symbol.symbol);
    params.set("start", start);
    params.set("end", end);
    params.set("p", String(p));
    params.set("k", String(k));
    if (excludeZeroRange) params.set("exclude", "1");
    if (fq === "none") params.set("fq", "none");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`,
    );
  }, [urlReady, symbol.symbol, start, end, p, k, excludeZeroRange, fq]);

  useEffect(() => {
    if (!urlReady) return;
    let cancelled = false;
    runAnalysis({ symbol, start, end, p, k, excludeZeroRange, fq })
      .then((result) => {
        if (cancelled) return;
        setAnalysis(result);
        setSelectedBlockIndex(
          result.blockResult.blocks[result.blockResult.blocks.length - 1]
            ?.index ?? null,
        );
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : "行情加载失败，请重试。",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    urlReady,
    symbol,
    start,
    end,
    p,
    k,
    excludeZeroRange,
    fq,
    refreshToken,
  ]);

  useEffect(() => {
    if (!urlReady) return;
    let cancelled = false;
    fetchQuote(symbol.symbol)
      .then((quote) => {
        if (cancelled) return;
        setSession(quote ? buildMarketSnapshot(quote) : null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [urlReady, symbol.symbol, refreshToken]);

  const sessionInRange = useMemo(() => {
    if (!session || !analysis) return null;
    return session.date >= analysis.options.start &&
      session.date <= analysis.options.end
      ? session
      : null;
  }, [analysis, session]);

  const selectedBlock = useMemo(() => {
    if (!analysis) return null;
    return (
      analysis.blockResult.blocks.find(
        (block) => block.index === selectedBlockIndex,
      ) ?? null
    );
  }, [analysis, selectedBlockIndex]);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem(
        "market-dist-theme",
        next ? "dark" : "light",
      );
    } catch {
      // ignore
    }
  };

  const markUpdating = () => {
    setLoading(true);
    setError(null);
  };

  const handlePreset = (key: RangePresetKey) => {
    const preset = RANGE_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    const anchor = todayShanghai();
    const nextStart = addMonths(anchor, -preset.months);
    if (nextStart === start && anchor === end && rangePreset === key) return;
    markUpdating();
    setEnd(anchor);
    setStart(nextStart);
    setRangePreset(key);
  };

  const handleStart = (value: string) => {
    if (!isValidDate(value)) return;
    const next = value > end ? end : value;
    if (next === start) return;
    markUpdating();
    setStart(next);
    setRangePreset("custom");
  };

  const handleEnd = (value: string) => {
    if (!isValidDate(value)) return;
    const latest = todayShanghai();
    const next = value > latest ? latest : value;
    if (next === end) return;
    markUpdating();
    if (next < start) setStart(next);
    setEnd(next);
    setRangePreset("custom");
  };

  const handleP = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(500, Math.max(5, Math.round(value)));
    if (next === p) return;
    markUpdating();
    setP(next);
  };

  const handleK = (value: number) => {
    if (!Number.isFinite(value)) return;
    const next = Math.min(6, Math.max(2, Math.round(value)));
    if (next === k) return;
    markUpdating();
    setK(next);
  };

  const handleFq = (value: FqMode) => {
    if (value === fq) return;
    markUpdating();
    setFq(value);
  };

  const handleExclude = (value: boolean) => {
    if (value === excludeZeroRange) return;
    markUpdating();
    setExcludeZeroRange(value);
  };

  const handleSelectSymbol = (hit: SymbolHit) => {
    if (hit.symbol === symbol.symbol) return;
    markUpdating();
    setSymbol(hit);
    setAnalysis(null);
    setSelectedBlockIndex(null);
    setSession(null);
  };

  const handleRefresh = () => {
    markUpdating();
    clearCache();
    clearQuoteCache();
    setRefreshToken((token) => token + 1);
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner page-shell">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 17.5 8.5 11l4 3.2L20.5 4.5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15.5 4.5h5v5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="brand-title">A股日内分布</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
            title={dark ? "切换到浅色模式" : "切换到深色模式"}
          >
            {dark ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main className="page-shell">
        <h1 className="sr-only">A股日内分布与漂移</h1>
        <section className="query-panel card" aria-label="查询条件">
          <SymbolSearch
            key={symbol.symbol}
            selected={symbol}
            onSelect={handleSelectSymbol}
          />
          <ControlPanel
            start={start}
            end={end}
            p={p}
            k={k}
            fq={fq}
            excludeZeroRange={excludeZeroRange}
            rangePreset={rangePreset}
            loading={loading}
            onStart={handleStart}
            onEnd={handleEnd}
            onPreset={handlePreset}
            onP={handleP}
            onK={handleK}
            onFq={handleFq}
            onExclude={handleExclude}
            onRefresh={handleRefresh}
          />
        </section>

        {error ? (
          <div className="error-banner card" role="alert">
            <div>
              <strong>行情加载失败</strong>
              <p>{error}</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleRefresh}
            >
              重试
            </button>
          </div>
        ) : null}

        {analysis ? <Warnings items={analysis.warnings} /> : null}

        {!analysis && loading ? <LoadingSkeleton /> : null}

        {!analysis && !loading && !error ? (
          <div className="card empty-block">
            <strong>暂无数据</strong>
            <p>调整日期区间后重试。</p>
          </div>
        ) : null}

        {analysis ? (
          <div className="workspace fade-in">
            <div className="workspace-toolbar">
              <div className="workspace-status">
                {loading ? (
                  <>
                    <span className="live-dot" />
                    正在更新
                  </>
                ) : (
                  <>
                    <span className="status-dot" />
                    {fmtInt(analysis.rangeMetrics.length)} 个交易日 ·{" "}
                    {analysis.blockResult.effectiveK} 段
                    {analysis.fromCache ? (
                      <span
                        className="cache-flag"
                        title={
                          analysis.staleCache
                            ? "行情接口请求失败，展示本地缓存"
                            : "浏览器本地缓存，6 小时内复用"
                        }
                      >
                        {analysis.staleCache ? "缓存兜底" : "本地缓存"}
                        {analysis.cacheAgeMs != null
                          ? ` · ${fmtRelativeTime(analysis.cacheAgeMs)}`
                          : ""}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => downloadCsv(analysis)}
              >
                导出 CSV
              </button>
            </div>

            <SummaryTiles
              analysis={analysis}
              selectedBlock={selectedBlock}
            />

            <DistributionGrid
              analysis={analysis}
              selectedBlock={selectedBlock}
              session={sessionInRange}
              selectedMetric={selectedMetric}
              chartMode={chartMode}
              dark={dark}
              onSelectMetric={setSelectedMetric}
              onChartMode={setChartMode}
            />

            <DriftSection
              analysis={analysis}
              selectedMetric={selectedMetric}
              selectedBlock={selectedBlock}
              dark={dark}
              onSelectMetric={setSelectedMetric}
              onSelectBlock={(block) =>
                setSelectedBlockIndex(block?.index ?? null)
              }
            />

            <TimeSeriesGrid analysis={analysis} dark={dark} />

            <Methodology />
          </div>
        ) : null}

        <footer className="footer">
          腾讯公开行情接口 · 浏览器本地计算 · 仅供研究，不构成投资建议
        </footer>
      </main>
    </>
  );
}
