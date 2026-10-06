const BUSINESS_DAY_CUTOFF_HOUR = 4;

type DateParts = { year: number; month: number; day: number; hour: number };

function localParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour") };
}

function timeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = localParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, Number(new Intl.DateTimeFormat("en-US", { timeZone, minute: "2-digit" }).format(date)));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function utcForLocal(year: number, month: number, day: number, timeZone: string, hour: number): Date {
  const localGuess = new Date(Date.UTC(year, month - 1, day, hour));
  const offset = timeZoneOffsetMinutes(localGuess, timeZone);
  return new Date(localGuess.getTime() - offset * 60_000);
}

function shiftCalendarDay(year: number, month: number, day: number, amount: number) {
  const shifted = new Date(Date.UTC(year, month - 1, day + amount));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

export function businessDayKey(date: Date, timeZone = "Asia/Bangkok"): string {
  const parts = localParts(date, timeZone);
  const calendarDay = parts.hour < BUSINESS_DAY_CUTOFF_HOUR
    ? shiftCalendarDay(parts.year, parts.month, parts.day, -1)
    : parts;
  return `${calendarDay.year}-${String(calendarDay.month).padStart(2, "0")}-${String(calendarDay.day).padStart(2, "0")}`;
}

export function businessDayBounds(key: string, timeZone = "Asia/Bangkok"): { start: Date; end: Date } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) throw new Error("INVALID_BUSINESS_DAY");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const endDay = new Date(Date.UTC(year, month - 1, day + 1));
  const start = utcForLocal(year, month, day, timeZone, BUSINESS_DAY_CUTOFF_HOUR);
  const end = utcForLocal(endDay.getUTCFullYear(), endDay.getUTCMonth() + 1, endDay.getUTCDate(), timeZone, BUSINESS_DAY_CUTOFF_HOUR);
  return { start, end };
}

export function currentBusinessDay(timeZone = "Asia/Bangkok") {
  const key = businessDayKey(new Date(), timeZone);
  return { key, ...businessDayBounds(key, timeZone) };
}
