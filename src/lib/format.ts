export function cx(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function pct(
  value: number | null | undefined,
  digits = 2,
  signed = false,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const number = value * 100;
  const text = Math.abs(number).toFixed(digits);
  if (signed) {
    if (number > 0) return `+${text}%`;
    if (number < 0) return `−${text}%`;
    return `${text}%`;
  }
  return `${number < 0 ? "−" : ""}${text}%`;
}

export function pp(
  value: number | null | undefined,
  digits = 2,
  signed = true,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const text = Math.abs(value).toFixed(digits);
  if (signed) {
    if (value > 0) return `+${text}pp`;
    if (value < 0) return `−${text}pp`;
    return `${text}pp`;
  }
  return `${text}pp`;
}

export function decimalToPp(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value * 100;
}

export function ratio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function fmtQ(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value < 0.001) return "<0.001";
  return value.toFixed(3);
}

export function fmtInt(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return Math.round(value).toLocaleString("zh-CN");
}

/** 将毫秒时长转成「刚刚 / N 分钟前 / N 小时前」这类简短文案。 */
export function fmtRelativeTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "未知";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function fmtNum(
  value: number | null | undefined,
  digits = 2,
): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function signedClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "";
  return value > 0 ? "up" : "down";
}

export function qClass(q: number | null | undefined): string {
  if (q == null || !Number.isFinite(q)) return "badge-muted";
  return q < 0.05 ? "badge-sig" : "badge-muted";
}

export function verdictText(
  q: number | null | undefined,
  deltaCi: [number, number] | null,
): string {
  if (q == null || !Number.isFinite(q)) return "样本不足";
  if (q >= 0.05) return "未检出显著漂移";
  if (deltaCi && deltaCi[0] > 0) return "显著上行漂移";
  if (deltaCi && deltaCi[1] < 0) return "显著下行漂移";
  return "显著但非中位数漂移";
}
