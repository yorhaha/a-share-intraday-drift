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
    <section className="card control-panel fade-in" aria-label="分析参数">
      <div className="control-main">
        <div className="control-field control-field-range">
          <span className="control-label">日期区间</span>
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
          {rangePreset === "custom" ? (
            <span className="control-hint">自定义</span>
          ) : null}
        </div>

        <div className="control-field">
          <span className="control-label">周期长度</span>
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
            <span className="control-hint">交易日 ≈ {(p / 20).toFixed(1)} 个月</span>
          </div>
        </div>

        <div className="control-field control-field-compact">
          <span className="control-label">对比段数</span>
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
          <span className="control-label">复权方式</span>
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
            <span className={cx("refresh-icon", loading && "is-spinning")} aria-hidden="true">
              ↻
            </span>
            {loading ? "更新中" : "刷新行情"}
          </button>
        </div>
      </div>

      <p className="control-note">
        周期按交易日切块：取区间末尾的 K × P 个交易日，从旧到新切成 K 段；更早的交易日只作为分布背景。
        {excludeZeroRange
          ? " 已剔除最高价等于最低价的交易日，段边界不变。"
          : " 默认保留零振幅日（最高价 = 最低价）。"}
      </p>
    </section>
  );
}
