"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type EventType = "visit" | "click" | "bottom" | "section_view" | "bot_started" | "quiz_completed";
type DeliveryStatus = "pending" | "sent" | "failed";
type ActivitySource = "browser" | "telegram_webapp" | "telegram_bot";

type ActivityEvent = {
  id: string;
  source: "web" | "bot";
  type: EventType;
  path: string;
  label?: string;
  referrer?: string;
  visitorId: string;
  ip: string;
  createdAt: string;
  delivered?: number;
  deliveryStatus?: DeliveryStatus;
  activitySource: ActivitySource;
  telegramUserId?: number;
  username?: string;
  firstName?: string;
  lastName?: string;
};

type StatsData = {
  days: Array<{ date: string; count: number }>;
  timeZone: string;
  summary: {
    total: number;
    today: number;
    lastSevenDays: number;
    uniqueVisitors: number;
    byType: Partial<Record<EventType, number>>;
  };
  events: ActivityEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
};

const eventLabels: Record<EventType, string> = {
  visit: "Відвідування",
  click: "Натискання",
  bottom: "До кінця",
  section_view: "До блоку «Бачте свій день цілком»",
  bot_started: "Запуск бота",
  quiz_completed: "Квіз пройдено"
};

const statusLabels: Record<DeliveryStatus, string> = {
  pending: "Надсилається",
  sent: "Доставлено",
  failed: "Помилка"
};

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("uk-UA", {
    timeZone,
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date(value));
}

function getVisitorLabel(item: ActivityEvent) {
  if (item.activitySource === "browser") {
    return item.visitorId.slice(0, 8);
  }

  const name = [item.firstName, item.lastName].filter(Boolean).join(" ");
  const username = item.username ? `@${item.username}` : "";
  return (
    [name, username].filter(Boolean).join(" · ") ||
    String(item.telegramUserId ?? item.visitorId)
  );
}

function getSourceLabel(source: ActivityEvent["activitySource"]) {
  if (source === "telegram_webapp") return "Telegram WebApp";
  if (source === "telegram_bot") return "Telegram-бот";
  return "Браузер";
}

function getEventKey(item: Pick<ActivityEvent, "id" | "source">) {
  return `${item.source}:${item.id}`;
}

type Period = "week" | "month";

function calendarRange(anchor: string, period: "week" | "month", offset = 0) {
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

function calendarLabel(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("uk-UA", { ...options, timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default function NotificationStatsClient({ timeZone }: { timeZone: string }) {
  const [period, setPeriod] = useState<Period>("week");
  const [chartData, setChartData] = useState<Pick<StatsData, "days">>();
  const [chartStatus, setChartStatus] = useState<"loading" | "ready" | "error">("loading");
  const [chartReloadKey, setChartReloadKey] = useState(0);
  const [journalRange, setJournalRange] = useState<{ from: string; to: string }>();
  const [range, setRange] = useState<{ from: string; to: string }>();
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [dateError, setDateError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const initial = calendarRange(today, "week");
    const from = params.get("from");
    const to = params.get("to");
    const valid = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
    if (valid(from) && valid(to) && from <= to && Date.parse(to) - Date.parse(from) <= 365 * 86400000) {
      setJournalRange({ from, to }); setFromInput(from); setToInput(to);
    }
    else {
      setJournalRange(initial); setFromInput(initial.from); setToInput(initial.to);
    }
    const chartFrom = params.get("chartFrom");
    const chartPeriod = params.get("chartPeriod") === "month" ? "month" : "week";
    setPeriod(chartPeriod);
    setRange(calendarRange(valid(chartFrom) ? chartFrom : today, chartPeriod));
  }, [timeZone]);
  const [data, setData] = useState<StatsData>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [eventType, setEventType] = useState<EventType | "all">("all");
  const [activitySource, setActivitySource] = useState<ActivitySource | "all">("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState("");
  const [selectedItems, setSelectedItems] = useState<Record<string, ActivityEvent>>({});
  const [deletingSelected, setDeletingSelected] = useState(false);

  useEffect(() => {
    if (!journalRange) return;
    let active = true;
    const controller = new AbortController();

    async function loadStats() {
      setStatus("loading");

      try {
        const response = await fetch("/api/admin/notification-stats", {
          method: "POST",
          signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            page,
            dateFrom: journalRange?.from,
            dateTo: journalRange?.to,
            type: eventType === "all" ? undefined : eventType,
            activitySource: activitySource === "all" ? undefined : activitySource,
            query
          })
        });

        if (!active) return;
        if (!response.ok) {
          setStatus("error");
          return;
        }

        const result = (await response.json()) as StatsData;
        if (!active) return;
        setData(result);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadStats();
    return () => {
      active = false;
      controller.abort();
    };
  }, [activitySource, eventType, page, query, reloadKey, journalRange]);

  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    let active = true;
    setChartStatus("loading");
    async function loadChart() {
      try {
        const response = await fetch("/api/admin/notification-stats", {
          method: "POST", signal: controller.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ view: "chart", dateFrom: range?.from, dateTo: range?.to })
        });
        if (!response.ok) throw new Error("Could not load chart");
        const result = await response.json() as Pick<StatsData, "days">;
        if (active) { setChartData(result); setChartStatus("ready"); }
      } catch { if (active) setChartStatus("error"); }
    }
    void loadChart();
    return () => { active = false; controller.abort(); };
  }, [range, reloadKey, chartReloadKey]);

  function changeRange(next: { from: string; to: string }, mode: Period) {
    setPeriod(mode); setRange(next);
    const url = new URL(window.location.href);
    url.searchParams.set("chartFrom", next.from); url.searchParams.set("chartPeriod", mode);
    window.history.replaceState(null, "", url);
  }

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromInput || !toInput || fromInput > toInput || Date.parse(toInput) - Date.parse(fromInput) > 365 * 86400000) {
      setDateError("Оберіть початкову й кінцеву дати: період має бути від 1 до 366 днів.");
      return;
    }
    setJournalRange({ from: fromInput, to: toInput });
    setDateError(""); setPage(1); setSelectedItems({});
    const url = new URL(window.location.href);
    url.searchParams.set("from", fromInput); url.searchParams.set("to", toInput);
    url.searchParams.delete("period");
    window.history.replaceState(null, "", url);
  }

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(searchInput.trim());
  }

  function changeType(value: EventType | "all") {
    setPage(1);
    setEventType(value);
  }

  function changeSource(value: ActivitySource | "all") {
    setPage(1);
    setActivitySource(value);
  }

  function toggleItem(item: ActivityEvent) {
    const key = getEventKey(item);
    setSelectedItems((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = item;
      }
      return next;
    });
  }

  function toggleCurrentPage() {
    if (!data) return;

    const allSelected = data.events.every((item) => selectedItems[getEventKey(item)]);
    setSelectedItems((current) => {
      const next = { ...current };
      data.events.forEach((item) => {
        const key = getEventKey(item);
        if (allSelected) {
          delete next[key];
        } else {
          next[key] = item;
        }
      });
      return next;
    });
  }

  async function deleteSelectedEvents() {
    const selected = Object.values(selectedItems);
    if (selected.length === 0) return;
    if (!window.confirm(`Видалити вибрані події (${selected.length})?`)) return;

    const allCurrentPageSelected = Boolean(
      data?.events.length && data.events.every((item) => selectedItems[getEventKey(item)])
    );
    setDeletingSelected(true);
    try {
      const response = await fetch("/api/admin/notification-stats", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: selected.map((item) => ({ id: item.id, source: item.source }))
        })
      });

      if (!response.ok) {
        window.alert("Не вдалося видалити вибрані події.");
        return;
      }

      setSelectedItems({});
      if (allCurrentPageSelected && page > 1) {
        setPage((value) => value - 1);
      } else {
        setReloadKey((value) => value + 1);
      }
    } catch {
      window.alert("Не вдалося видалити вибрані події.");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function deleteEvent(item: ActivityEvent) {
    if (!window.confirm(`Видалити подію «${eventLabels[item.type]}»?`)) return;

    setDeletingId(item.id);
    try {
      const response = await fetch("/api/admin/notification-stats", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, source: item.source })
      });

      if (!response.ok) {
        window.alert("Не вдалося видалити подію.");
        return;
      }

      setSelectedItems((current) => {
        const next = { ...current };
        delete next[getEventKey(item)];
        return next;
      });

      if (data?.events.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setReloadKey((value) => value + 1);
      }
    } catch {
      window.alert("Не вдалося видалити подію.");
    } finally {
      setDeletingId("");
    }
  }

  const emptyMessage = journalRange || query || eventType !== "all" || activitySource !== "all"
    ? "За вибраними фільтрами подій немає."
    : "Події з’являться після першої дії відвідувача.";

  return (
    <main className="adminStatsPage">
      <div className="adminStatsShell">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
        </header>


        {data && status === "ready" ? (
          <section className="adminSummary" aria-label="Зведена статистика">
            <article><span>За вибраний період</span><strong>{data.summary.total}</strong></article>
            <article><span>Сьогодні в періоді</span><strong>{data.summary.today}</strong></article>
            <article><span>За останні 7 днів у періоді</span><strong>{data.summary.lastSevenDays}</strong></article>
            <article><span>Відвідувачі</span><strong>{data.summary.uniqueVisitors}</strong></article>
          </section>
        ) : null}

        <section className="adminActivityPanel adminDailyPanel" aria-label="Події за днями" aria-busy={chartStatus === "loading"}>
          <div className="adminChartHeader"><h2>Події за днями</h2>
          <div className="adminFilters">
            {(["week", "month"] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={period === mode} disabled={!range}
                onClick={() => range && changeRange(calendarRange(range.from, mode), mode)}>
                {mode === "week" ? "Тиждень" : "Місяць"}
              </button>
            ))}
          </div>
          {range && <div className="adminPeriodNav">
            <button type="button" aria-label="Попередній період"
              onClick={() => changeRange(calendarRange(range.from, period, -1), period)}>←</button>
            <strong>{period === "month" ? calendarLabel(range.from, { month: "long", year: "numeric" }) : `${calendarLabel(range.from, { day: "numeric", month: "short" })} — ${calendarLabel(range.to)}`}</strong>
            <button type="button" aria-label="Наступний період"
              onClick={() => changeRange(calendarRange(range.from, period, 1), period)}>→</button>
          </div>}
</div>
          {chartStatus === "loading" ? <div className="adminState" role="status">Завантаження…</div> : chartStatus === "error" ?
            <div className="adminState" role="alert">Не вдалося завантажити дані. <button type="button" onClick={() => setChartReloadKey((value) => value + 1)}>Повторити</button></div> : chartData ? <>
            <p>{chartData.days.reduce((total, day) => total + day.count, 0) === 0 ? "За вибраний період подій немає." : `Усього за період: ${chartData.days.reduce((total, day) => total + day.count, 0)}`}</p>
            <div className="adminDailyScroll" tabIndex={0} aria-label="Графік за днями, прокрутіть для перегляду всіх дат">
              <div className="adminDailyChart" style={{ gridTemplateColumns: `repeat(${chartData.days.length}, minmax(34px, 1fr))` }}>
                {chartData.days.map((day) => <div className="adminDailyDay" key={day.date} aria-label={`${calendarLabel(day.date)}: ${day.count} подій`}>
                  <div className="adminDailyTrack"><span style={{ height: `${day.count / Math.max(1, ...chartData.days.map((item) => item.count)) * 100}%` }} /></div>
                  <strong>{day.count}</strong>
                  <span>{calendarLabel(day.date, { day: "2-digit", month: "2-digit" })}</span>
                  <span>{calendarLabel(day.date, { weekday: "short" })}</span>
                </div>)}
              </div>
            </div>
          </> : null}
        </section>

        <section className="adminActivityPanel" aria-live="polite">
          <div className="adminActivityHeader">
            <div>
              <h2>Журнал дій</h2>
              {data && status === "ready" ? (
                <p>
                  Відвідування: {data.summary.byType.visit ?? 0} · Натискання: {data.summary.byType.click ?? 0} · До кінця: {data.summary.byType.bottom ?? 0} · Запуски бота: {data.summary.byType.bot_started ?? 0} · Квізи: {data.summary.byType.quiz_completed ?? 0}
                </p>
              ) : null}
            </div>
            <form className="adminSearch" onSubmit={applySearch} noValidate>
              <input
                aria-label="Пошук у журналі"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Сторінка, користувач, IP…"
                type="search"
                value={searchInput}
              />
              <button type="submit">Знайти</button>
            </form>
          </div>

          <div className="adminJournalDates">
          <form className="adminDateFilters" onSubmit={applyDates} noValidate>
            <label>Від<input type="date" value={fromInput} max={toInput || undefined} onChange={(event) => setFromInput(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "admin-date-error" : undefined} /></label>
            <label>До<input type="date" value={toInput} min={fromInput || undefined} onChange={(event) => setToInput(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "admin-date-error" : undefined} /></label>
            <button type="submit">Застосувати дати</button>
          </form>
          {dateError && <p id="admin-date-error" role="alert">{dateError}</p>}
          </div>

          <div className="adminFilters" aria-label="Фільтр типу події">
            {(["all", "visit", "click", "bottom", "section_view", "bot_started", "quiz_completed"] as const).map((value) => (
              <button
                aria-pressed={eventType === value}
                key={value}
                onClick={() => changeType(value)}
                type="button"
              >
                {value === "all" ? "Усі" : eventLabels[value]}
              </button>
            ))}
          </div>
          <div className="adminFilters" aria-label="Фільтр середовища">
            {(["all", "browser", "telegram_webapp", "telegram_bot"] as const).map((value) => (
              <button
                aria-pressed={activitySource === value}
                key={value}
                onClick={() => changeSource(value)}
                type="button"
              >
                {value === "all" ? "Усі середовища" : getSourceLabel(value)}
              </button>
            ))}
          </div>

          {Object.keys(selectedItems).length > 0 ? (
            <div className="adminSelectionToolbar">
              <span>Вибрано: {Object.keys(selectedItems).length}</span>
              <button
                disabled={deletingSelected}
                onClick={() => void deleteSelectedEvents()}
                type="button"
              >
                {deletingSelected ? "Видалення…" : "Видалити вибрані"}
              </button>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="adminState adminStateError">
              <strong>Не вдалося завантажити статистику</strong>
              <p>Перевірте підключення до бази та повторіть спробу.</p>
            </div>
          ) : status === "loading" && !data ? (
            <div className="adminState"><strong>Завантаження…</strong></div>
          ) : data && data.events.length === 0 ? (
            <div className="adminState"><strong>{emptyMessage}</strong></div>
          ) : data ? (
            <>
              <div className={`adminTableWrap${status === "loading" ? " isLoading" : ""}`}>
                <table className="adminActivityTable">
                  <thead>
                    <tr>
                      <th className="adminSelectCell">
                        <input
                          aria-label="Вибрати всі події на сторінці"
                          checked={data.events.length > 0 && data.events.every((item) => selectedItems[getEventKey(item)])}
                          disabled={deletingSelected || status === "loading"}
                          onChange={toggleCurrentPage}
                          type="checkbox"
                        />
                      </th>
                      <th>Час</th>
                      <th>Подія</th>
                      <th>Середовище</th>
                      <th>Сторінка / дія</th>
                      <th>Відвідувач</th>
                      <th>IP</th>
                      <th>Надсилання</th>
                      <th aria-label="Дії" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((item) => (
                      <tr
                        className={selectedItems[getEventKey(item)] ? "isSelected" : undefined}
                        key={`${item.source}-${item.id}`}
                      >
                        <td className="adminSelectCell">
                          <input
                            aria-label={`Вибрати подію «${eventLabels[item.type]}»`}
                            checked={Boolean(selectedItems[getEventKey(item)])}
                            disabled={deletingSelected}
                            onChange={() => toggleItem(item)}
                            type="checkbox"
                          />
                        </td>
                        <td className="adminDateCell">{formatDate(item.createdAt, timeZone)}</td>
                        <td><span className={`eventBadge ${item.type}`}>{eventLabels[item.type]}</span></td>
                        <td>{getSourceLabel(item.activitySource)}</td>
                        <td className="adminActionCell">
                          <strong>{item.path}</strong>
                          {item.label ? <span>{item.label}</span> : item.referrer ? <span>з {item.referrer}</span> : null}
                        </td>
                        <td title={String(item.telegramUserId ?? item.visitorId)}>{getVisitorLabel(item)}</td>
                        <td>{item.ip}</td>
                        <td>
                          {item.deliveryStatus ? (
                            <span className={`deliveryBadge ${item.deliveryStatus}`}>
                              {statusLabels[item.deliveryStatus]}{item.delivered && item.delivered > 0 ? ` · ${item.delivered}` : ""}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          <button
                            className="adminDeleteButton"
                            disabled={deletingSelected || deletingId === item.id}
                            onClick={() => void deleteEvent(item)}
                            type="button"
                          >
                            {deletingId === item.id ? "Видалення…" : "Видалити"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="adminPagination">
                <span>{data.pagination.total} подій · сторінка {data.pagination.page} з {data.pagination.pages}</span>
                <div>
                  <button disabled={page <= 1 || status === "loading"} onClick={() => setPage((value) => value - 1)} type="button">←</button>
                  <button disabled={page >= data.pagination.pages || status === "loading"} onClick={() => setPage((value) => value + 1)} type="button">→</button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
