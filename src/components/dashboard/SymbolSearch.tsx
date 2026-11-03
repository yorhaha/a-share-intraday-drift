"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SymbolHit } from "@/lib/data/types";
import { resolveSymbol, searchSymbols } from "@/lib/data/tencent";
import { cx } from "@/lib/format";

interface SymbolSearchProps {
  selected: SymbolHit;
  onSelect: (hit: SymbolHit) => void;
}

function display(hit: SymbolHit): string {
  return `${hit.name} ${hit.code}`;
}

export default function SymbolSearch({ selected, onSelect }: SymbolSearchProps) {
  const [query, setQuery] = useState(() => display(selected));
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipNext = useRef(false);
  const requestId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const trimmed = query.trim();
    const id = requestId.current + 1;
    requestId.current = id;
    if (!trimmed || trimmed === display(selected)) return;
    const timer = window.setTimeout(async () => {
      setBusy(true);
      const results = await searchSymbols(trimmed);
      if (requestId.current !== id) return;
      setBusy(false);
      setHits(results);
      setActive(results.length > 0 ? 0 : -1);
      setOpen(results.length > 0);
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, selected]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const choose = (hit: SymbolHit) => {
    skipNext.current = true;
    requestId.current += 1;
    setQuery(display(hit));
    setHits([]);
    setOpen(false);
    setActive(-1);
    setBusy(false);
    setError(null);
    onSelect(hit);
  };

  const submit = async () => {
    if (open && active >= 0 && hits[active]) {
      choose(hits[active]);
      return;
    }
    const raw = query.trim();
    if (!raw) return;
    setBusy(true);
    setError(null);
    const hit = await resolveSymbol(raw);
    setBusy(false);
    if (hit) {
      choose(hit);
    } else {
      setOpen(false);
      setError("未找到匹配的 A 股标的，请换一个代码或名称。");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (hits.length === 0) return;
      setOpen(true);
      setActive((index) => (index + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (hits.length === 0) return;
      setOpen(true);
      setActive((index) => (index - 1 + hits.length) % hits.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      void submit();
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="symbol-search" ref={wrapperRef}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="symbol-input-wrap">
          <svg
            className="symbol-search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path
              d="m16.5 16.5 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            className="input symbol-input"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setError(null);
              const trimmed = value.trim();
              if (!trimmed || trimmed === display(selected)) {
                requestId.current += 1;
                setHits([]);
                setOpen(false);
                setBusy(false);
              }
            }}
            onFocus={() => {
              if (hits.length > 0) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="输入代码、名称或拼音，如 601318 / 中国平安 / zgpa"
            aria-label="搜索 A 股标的"
            role="combobox"
            aria-expanded={open}
            aria-controls="symbol-search-results"
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
          {busy ? <span className="symbol-spinner" aria-hidden="true" /> : null}
          <button className="btn btn-primary btn-sm symbol-submit" type="submit">
            查询
          </button>
        </div>
      </form>

      {open && hits.length > 0 ? (
        <div className="symbol-results" id="symbol-search-results" role="listbox">
          {hits.map((hit, index) => (
            <button
              key={hit.symbol}
              type="button"
              role="option"
              aria-selected={index === active}
              className={cx("symbol-hit", index === active && "is-active")}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(hit)}
            >
              <span className="symbol-hit-main">
                <span className="symbol-hit-name">{hit.name}</span>
                <span className="symbol-hit-code mono">{hit.code}</span>
              </span>
              <span className="symbol-hit-market">
                {hit.market.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="symbol-error">{error}</p> : null}
    </div>
  );
}
