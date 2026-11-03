"use client";

import { METRIC_DEFS } from "@/lib/constants";
import type { MetricKey } from "@/lib/data/types";

const FORMULAS: Record<MetricKey, string> = {
  openRet: "开盘价 / 前收盘价 − 1",
  highRet: "最高价 / 前收盘价 − 1",
  lowRet: "最低价 / 前收盘价 − 1",
  amplitude: "(最高价 − 最低价) / 前收盘价",
  highVsOpen: "最高价 / 开盘价 − 1",
  lowVsOpen: "最低价 / 开盘价 − 1",
};

export default function Methodology() {
  return (
    <details className="methodology card" id="methodology">
      <summary className="methodology-summary">
        <div>
          <span className="section-kicker">方法</span>
          <span className="methodology-title">口径、检验与局限</span>
        </div>
        <span className="methodology-cta">
          展开
          <span className="chev" aria-hidden="true">
            ▾
          </span>
        </span>
      </summary>

      <div className="methodology-body">
        <div className="methodology-grid">
          <div>
            <h4>指标口径</h4>
            <table className="method-table">
              <tbody>
                {METRIC_DEFS.map((def) => (
                  <tr key={def.key}>
                    <th>{def.label}</th>
                    <td className="mono">{FORMULAS[def.key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              全部使用日线 OHLC 计算；前收盘价取上一有效交易日的收盘价。停牌后的首个交易日会以停牌前收盘价为基准，涨跌幅因此可能是多日累计。
            </p>
          </div>

          <div>
            <h4>数据与清洗</h4>
            <ul>
              <li>
                行情来自腾讯公开行情接口，浏览器端直接请求；搜索与日线都优先走
                JSONP，日线失败时回退 fetch。
              </li>
              <li>
                日线每页最多 640 根，按结束日期向前翻页，直到覆盖所选区间；默认前复权，可切换不复权。
              </li>
              <li>
                丢弃字段异常、价格非正、成交量不大于 0 的记录；同一天重复记录以后出现的为准。
              </li>
              <li>
                不完整的当日 K 线会被剔除；数据截至最新完整交易日。缓存 6 小时，可用「刷新行情」强制重取。
              </li>
              <li>
                零振幅日指最高价与最低价几乎相同（OHLC 极差 ≤ 0.0005
                元）的交易日，常见于一字板或停牌后恢复交易；默认保留，可勾选剔除。
              </li>
            </ul>
          </div>

          <div>
            <h4>漂移检验</h4>
            <ol>
              <li>
                <strong>切块。</strong>取所选区间末尾的 K × P
                个交易日，从旧到新等分为 K 段；更早的交易日只用于整体分布，不参与漂移检验。区间不足时自动减少
                K，少于 2 段则不做检验。
              </li>
              <li>
                <strong>全局检验。</strong>每项指标计算 K
                段之间的最大两两 KS 距离 D。零假设是 K
                段来自同一分布；打乱段标签 999 次，得到最大 D
                的置换分布，p =（超过观测值的次数 + 1）/（999 + 1）。
              </li>
              <li>
                <strong>多重比较。</strong>六项指标一起做
                Benjamini–Hochberg FDR 校正，得到 q 值；q &lt; 0.05
                视为显著。相邻段的两两 KS 检验也做 BH 校正，但仅在全局显著时解读。
              </li>
              <li>
                <strong>效应量。</strong>报告各段中位数、末段减首段的中位数差 Δ，以及
                2000 次 bootstrap 的 95% 置信区间。p 值回答「是否有证据」，Δ 和 CI
                回答「变了多少」。
              </li>
            </ol>
          </div>

          <div>
            <h4>如何读结果</h4>
            <ul>
              <li>
                <strong>显著 ≠ 幅度大。</strong>大样本下很小的分布差异也可能显著；请优先看中位数差、CI
                和分布图是否重叠。
              </li>
              <li>
                <strong>不显著 ≠ 没变化。</strong>每段样本少时检验功效有限；样本少于 20
                日会给出低功效提示。
              </li>
              <li>
                <strong>KS 对分布形状敏感。</strong>中位数没变但尾部变厚、波动变大，也可能产生显著
                KS；这时「显著但非中位数漂移」是正常结果。
              </li>
              <li>
                <strong>CI 与 q 可能边缘不一致。</strong>bootstrap
                置信区间和置换检验基于不同的零假设与重采样方式，接近显著边界时可能出现「CI
                不含 0 但 q ≥ 0.05」或相反情况。是否显著以 q
                为准，CI 用来描述中位数变化的不确定性。
              </li>
              <li>
                <strong>图表坐标。</strong>
                涨跌幅类指标（开盘、最高、最低及对应 ECDF）的横轴以 0
                为中心左右对称；振幅、最高相对开盘从 0
                起，最低相对开盘到 0 止。直方图区间固定为 0.25
                个百分点，虚线标出 x = 0。
              </li>
              <li>
                周期切块是任意选择。换一个 P 或 K
                可能改变结论，建议对关键标的做敏感性检查。
              </li>
            </ul>
          </div>
        </div>

        <div className="methodology-limits">
          <h4>已知局限</h4>
          <p>
            日收益和日内指标存在波动率聚集与序列相关，置换检验把段内样本视为可交换，p
            值应理解为近似证据而非精确频率保证；相邻段检验是探索性定位，不构成因果推断。前复权价格会随分红送转调整，历史数值可能与当时看到的不同。行情接口为非官方公开接口，可能限流、变更或缺失。本工具仅用于研究与数据观察，不构成任何投资建议。
          </p>
        </div>
      </div>
    </details>
  );
}
