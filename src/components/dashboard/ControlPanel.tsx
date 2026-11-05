"use client";

import {
  PERIOD_PRESETS,
  RANGE_PRESETS,
  type RangePresetKey,
} from "@/lib/constants";
import type { FqMode } from "@/lib/data/types";
import { cx } from "@/lib/format";

export interface ControlPanelProps {
  start: string;
  end: string;
  p: number;
  k: number;
  fq: FqMode;
  excludeZeroRange: boolean;
  rangePreset: RangePresetKey | "custom";
  loading: boolean;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  onPreset: (key: RangePresetKey) => void;
  onP: (value: number) => void;
  onK: (value: number) => void;
  onFq: (value: FqMode) => void;
  onExclude: (value: boolean) => void;
  onRefresh: () => void;
}

export default function ControlPanel({
  start,
  end,
  p,
  k,
  fq,
  excludeZeroRange,
  rangePreset,
  loading,
  onStart,
  onEnd,
  onPreset,
  onP,
  onK,
  onFq,
  onExclude,
  onRefresh,
}: ControlPanelProps) {
  return (
    <div className="control-panel" aria-label="分析参数">
      <div className="control-main">
        <div className="control-field control-field-range">
          <span className="control-label">日期</span>
          <div className="control-inline">
            <div className="seg control-seg">
              {RANGE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  data-active={rangePreset === preset.key}
                  onClick={() => onPreset(preset.key)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="date-range">
              <input
                className="input date-input"
                type="date"
                value={start}
                max={end}
                onChange={(event) => onStart(event.target.value)}
                aria-label="开始日期"
              />
              <span className="date-arrow">→</span>
              <input
                className="input date-input"
                type="date"
                value={end}
                min={start}
                onChange={(event) => onEnd(event.target.value)}
                aria-label="结束日期"
              />
            </div>
          </div>
        </div>

        <div className="control-field">
          <span className="control-label">周期</span>
          <div className="control-inline">
            <div className="seg control-seg">
              {PERIOD_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  type="button"
                  data-active={p === preset.days}
                  onClick={() => onP(preset.days)}
                >
                  {preset.days}日
                </button>
              ))}
            </div>
            <input
              className="input period-input num"
              type="number"
              min={5}
              max={500}
              step={1}
              value={p}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) onP(value);
              }}
              aria-label="每段交易日数"
            />
          </div>
        </div>

        <div className="control-field control-field-compact">
          <span className="control-label">对比</span>
          <select
            className="select k-select"
            value={k}
            onChange={(event) => onK(Number(event.target.value))}
            aria-label="对比周期段数"
          >
            {[2, 3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                最近 {value} 段
              </option>
            ))}
          </select>
        </div>

        <div className="control-field control-field-compact">
          <span className="control-label">复权</span>
          <div className="seg control-seg">
            <button
              type="button"
              data-active={fq === "qfq"}
              onClick={() => onFq("qfq")}
            >
              前复权
            </button>
            <button
              type="button"
              data-active={fq === "none"}
              onClick={() => onFq("none")}
            >
              不复权
            </button>
          </div>
        </div>

        <div className="control-field control-field-actions">
          <label className="check">
            <input
              type="checkbox"
              checked={excludeZeroRange}
              onChange={(event) => onExclude(event.target.checked)}
            />
            <span>剔除零振幅日</span>
          </label>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="清空本地行情缓存并重新请求"
          >
            <svg
              className={cx("icon", loading && "is-spinning")}
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M20 12a8 8 0 1 1-2.34-5.66"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M20 4v6h-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {loading ? "更新中" : "刷新"}
          </button>
        </div>
      </div>
    </div>
  );
}
