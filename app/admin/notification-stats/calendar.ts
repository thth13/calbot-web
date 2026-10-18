export type Period = "week" | "month";

export function calendarRange(anchor: string, period: "week" | "month", offset = 0) {
  const start = new Date(`${anchor}T00:00:00Z`);
  if (period === "week") {
    start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 + offset * 7);
  } else {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + offset);
  }
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 6);
  else { end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0); }
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export function calendarLabel(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

