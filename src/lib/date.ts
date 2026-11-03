const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateUTC(value: string): Date {
  const match = DATE_RE.exec(value);
  if (!match) return new Date(NaN);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = parseDateUTC(value);
  return !Number.isNaN(date.getTime()) && formatDateUTC(date) === value;
}

export function addDays(value: string, days: number): string {
  const date = parseDateUTC(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateUTC(date);
}

export function addMonths(value: string, months: number): string {
  const date = parseDateUTC(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const daysInTarget = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, daysInTarget));
  return formatDateUTC(date);
}

export function diffCalendarDays(from: string, to: string): number {
  const a = parseDateUTC(from);
  const b = parseDateUTC(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function clampDate(value: string, min: string, max: string): string {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

export function todayShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function shanghaiClock(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function isIncompleteTodayBar(date: string): boolean {
  const clock = shanghaiClock();
  return date === clock.date && clock.minutes < 15 * 60 + 5;
}

export function formatDateShort(value: string): string {
  if (!isValidDate(value)) return value;
  return value.slice(5);
}

export function formatDateCn(value: string): string {
  if (!isValidDate(value)) return value;
  const [y, m, d] = value.split("-");
  return `${y}/${m}/${d}`;
}
