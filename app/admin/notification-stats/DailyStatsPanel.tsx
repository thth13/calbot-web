"use client";

import { useEffect, useState } from "react";
import { calendarLabel, calendarRange, type Period } from "./calendar";

type DailyStats = {
  days: Array<{ date: string; count: number }>;
  summary?: { total: number; meals: number; snacks: number };
};

export default function DailyStatsPanel({
  view,
  timeZone,
  reloadKey = 0
}: {
  view: "chart" | "meals";
  timeZone: string;
  reloadKey?: number;
}) {
  const [period, setPeriod] = useState<Period>("week");
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [data, setData] = useState<DailyStats>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retryKey, setRetryKey] = useState(0);
  const isMeals = view === "meals";
  const title = isMeals ? "Meals added" : "Daily events";
  const unit = isMeals ? "entries" : "events";
  const paramPrefix = isMeals ? "meal" : "chart";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).format(new Date());
    const from = params.get(`${paramPrefix}From`);
    const valid = from && /^\d{4}-\d{2}-\d{2}$/.test(from) &&
      Number.isFinite(Date.parse(from)) && new Date(from).toISOString().slice(0, 10) === from;
    const initialPeriod = params.get(`${paramPrefix}Period`) === "month" ? "month" : "week";
    setPeriod(initialPeriod);
    setRange(calendarRange(valid && from ? from : today, initialPeriod));
  }, [paramPrefix, timeZone]);

  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    let active = true;
    setStatus("loading");
    async function load() {
      try {
        const response = await fetch("/api/admin/notification-stats", {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ view, dateFrom: range?.from, dateTo: range?.to })
        });
        if (!response.ok) throw new Error("Could not load statistics");
        const result = await response.json() as DailyStats;
        if (active) { setData(result); setStatus("ready"); }
      } catch {
        if (active) setStatus("error");
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [range, reloadKey, retryKey, view]);

  function changeRange(next: { from: string; to: string }, mode: Period) {
    setStatus("loading");
    setPeriod(mode);
    setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set(`${paramPrefix}From`, next.from);
    url.searchParams.set(`${paramPrefix}Period`, mode);
    window.history.replaceState(null, "", url);
  }

  const total = data?.days.reduce((sum, day) => sum + day.count, 0) ?? 0;
  const maximum = Math.max(1, ...(data?.days.map((day) => day.count) ?? []));
  const numberFormat = new Intl.NumberFormat("en-US");

  return (
    <section className={`adminActivityPanel adminDailyPanel${isMeals ? " adminMealPanel" : ""}`} aria-label={title} aria-busy={status === "loading"}>
      <div className="adminChartHeader">
        <h2>{title}</h2>
        <div className="adminFilters" aria-label={`${title} period`}>
          {(["week", "month"] as const).map((mode) => (
            <button key={mode} type="button" aria-pressed={period === mode} disabled={!range}
              onClick={() => range && changeRange(calendarRange(range.from, mode), mode)}>
              {mode === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
        {range && <div className="adminPeriodNav">
          <button type="button" aria-label={`${title}: previous period`}
            onClick={() => changeRange(calendarRange(range.from, period, -1), period)}>←</button>
          <strong>{period === "month"
            ? calendarLabel(range.from, { month: "long", year: "numeric" })
            : `${calendarLabel(range.from, { day: "numeric", month: "short" })} — ${calendarLabel(range.to)}`}</strong>
          <button type="button" aria-label={`${title}: next period`}
            onClick={() => changeRange(calendarRange(range.from, period, 1), period)}>→</button>
        </div>}
      </div>
      {isMeals && <p>Saved diary entries by date added. Includes snacks; deleted entries are excluded.</p>}
      {status === "loading" ? <div className="adminState" role="status">Loading…</div> : status === "error" ? (
        <div className="adminState" role="alert">
          Could not load data. <button type="button" onClick={() => setRetryKey((value) => value + 1)}>Retry</button>
        </div>
      ) : data ? <>
        {isMeals && data.summary ? (
          <div className="adminSummary adminMealSummary" aria-label="Meal statistics for selected period">
            <article><span>Entries in period</span><strong>{numberFormat.format(data.summary.total)}</strong></article>
            <article><span>Meals</span><strong>{numberFormat.format(data.summary.meals)}</strong></article>
            <article><span>Snacks</span><strong>{numberFormat.format(data.summary.snacks)}</strong></article>
            <article><span>Average per day</span><strong>{new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(total / Math.max(1, data.days.length))}</strong></article>
          </div>
        ) : null}
        <p>{total === 0 ? `No ${unit} in the selected period.` : `Total for period: ${numberFormat.format(total)}`}</p>
        <div className="adminDailyScroll" tabIndex={0} aria-label={`${title} chart, scroll to view all dates`}>
          <div className="adminDailyChart" style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(34px, 1fr))` }}>
            {data.days.map((day) => (
              <div className="adminDailyDay" key={day.date} aria-label={`${calendarLabel(day.date)}: ${day.count} ${unit}`}>
                <div className="adminDailyTrack"><span style={{ height: `${day.count / maximum * 100}%` }} /></div>
                <strong>{numberFormat.format(day.count)}</strong>
                <span>{calendarLabel(day.date, { day: "2-digit", month: "2-digit" })}</span>
                <span>{calendarLabel(day.date, { weekday: "short" })}</span>
              </div>
            ))}
          </div>
        </div>
      </> : null}
    </section>
  );
}
