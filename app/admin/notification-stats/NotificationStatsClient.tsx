"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { AdminEventType } from "../../lib/admin-notifications";
import DailyStatsPanel from "./DailyStatsPanel";
import { calendarRange } from "./calendar";

type EventType = AdminEventType;
type DeliveryStatus = "pending" | "sent" | "failed";
type ActivitySource = "browser" | "telegram_webapp" | "telegram_bot" | "food_diary";

type ActivityEvent = {
  id: string;
  source: "web" | "bot" | "diary";
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
  visit: "Visits",
  click: "Clicks",
  bottom: "Reached bottom",
  section_view: "Reached “See your whole day”",
  bot_started: "Bot started",
  quiz_completed: "Quiz completed",
  meal_added: "Meals added"
};

const statusLabels: Record<DeliveryStatus, string> = {
  pending: "Sending",
  sent: "Delivered",
  failed: "Failed"
};

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
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
    String(item.telegramUserId ?? (item.visitorId || "—"))
  );
}

function getSourceLabel(source: ActivityEvent["activitySource"]) {
  if (source === "telegram_webapp") return "Telegram WebApp";
  if (source === "telegram_bot") return "Telegram bot";
  if (source === "food_diary") return "Food diary";
  return "Browser";
}

function getEventKey(item: Pick<ActivityEvent, "id" | "source">) {
  return `${item.source}:${item.id}`;
}

export default function NotificationStatsClient({ timeZone }: { timeZone: string }) {
  const [journalRange, setJournalRange] = useState<{ from: string; to: string }>();
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

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!fromInput || !toInput || fromInput > toInput || Date.parse(toInput) - Date.parse(fromInput) > 365 * 86400000) {
      setDateError("Select a start and end date: the period must be between 1 and 366 days.");
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
    if (item.source === "diary") return;
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

    const selectableEvents = data.events.filter((item) => item.source !== "diary");
    const allSelected = selectableEvents.every((item) => selectedItems[getEventKey(item)]);
    setSelectedItems((current) => {
      const next = { ...current };
      selectableEvents.forEach((item) => {
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
    if (!window.confirm(`Delete selected events (${selected.length})?`)) return;

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
        window.alert("Could not delete the selected events.");
        return;
      }

      setSelectedItems({});
      if (allCurrentPageSelected && page > 1) {
        setPage((value) => value - 1);
      } else {
        setReloadKey((value) => value + 1);
      }
    } catch {
      window.alert("Could not delete the selected events.");
    } finally {
      setDeletingSelected(false);
    }
  }

  async function deleteEvent(item: ActivityEvent) {
    if (item.source === "diary") return;
    if (!window.confirm(`Delete event “${eventLabels[item.type]}”?`)) return;

    setDeletingId(item.id);
    try {
      const response = await fetch("/api/admin/notification-stats", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, source: item.source })
      });

      if (!response.ok) {
        window.alert("Could not delete the event.");
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
      window.alert("Could not delete the event.");
    } finally {
      setDeletingId("");
    }
  }

  const emptyMessage = journalRange || query || eventType !== "all" || activitySource !== "all"
    ? "No events match the selected filters."
    : "Events will appear after the first visitor action.";

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
          <section className="adminSummary" aria-label="Summary statistics">
            <article><span>Selected period</span><strong>{data.summary.total}</strong></article>
            <article><span>Today within period</span><strong>{data.summary.today}</strong></article>
            <article><span>Last 7 days within period</span><strong>{data.summary.lastSevenDays}</strong></article>
            <article><span>Visitors</span><strong>{data.summary.uniqueVisitors}</strong></article>
          </section>
        ) : null}

        <DailyStatsPanel view="chart" timeZone={timeZone} reloadKey={reloadKey} />
        <DailyStatsPanel view="meals" timeZone={timeZone} />

        <section className="adminActivityPanel" aria-live="polite">
          <div className="adminActivityHeader">
            <div>
              <h2>Activity log</h2>
              {data && status === "ready" ? (
                <p>
                  Visits: {data.summary.byType.visit ?? 0} · Clicks: {data.summary.byType.click ?? 0} · Reached bottom: {data.summary.byType.bottom ?? 0} · Bot starts: {data.summary.byType.bot_started ?? 0} · Quizzes: {data.summary.byType.quiz_completed ?? 0} · Meals added: {data.summary.byType.meal_added ?? 0}
                </p>
              ) : null}
            </div>
            <form className="adminSearch" onSubmit={applySearch} noValidate>
              <input
                aria-label="Search activity log"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Page, user, IP…"
                type="search"
                value={searchInput}
              />
              <button type="submit">Search</button>
            </form>
          </div>

          <div className="adminJournalDates">
          <form className="adminDateFilters" onSubmit={applyDates} noValidate>
            <label>From<input type="date" value={fromInput} max={toInput || undefined} onChange={(event) => setFromInput(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "admin-date-error" : undefined} /></label>
            <label>To<input type="date" value={toInput} min={fromInput || undefined} onChange={(event) => setToInput(event.target.value)} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? "admin-date-error" : undefined} /></label>
            <button type="submit">Apply dates</button>
          </form>
          {dateError && <p id="admin-date-error" role="alert">{dateError}</p>}
          </div>

          <div className="adminFilters" aria-label="Event type filter">
            {(["all", "visit", "click", "bottom", "section_view", "bot_started", "quiz_completed", "meal_added"] as const).map((value) => (
              <button
                aria-pressed={eventType === value}
                key={value}
                onClick={() => changeType(value)}
                type="button"
              >
                {value === "all" ? "All" : eventLabels[value]}
              </button>
            ))}
          </div>
          <div className="adminFilters" aria-label="Source filter">
            {(["all", "browser", "telegram_webapp", "telegram_bot", "food_diary"] as const).map((value) => (
              <button
                aria-pressed={activitySource === value}
                key={value}
                onClick={() => changeSource(value)}
                type="button"
              >
                {value === "all" ? "All sources" : getSourceLabel(value)}
              </button>
            ))}
          </div>

          {Object.keys(selectedItems).length > 0 ? (
            <div className="adminSelectionToolbar">
              <span>Selected: {Object.keys(selectedItems).length}</span>
              <button
                disabled={deletingSelected}
                onClick={() => void deleteSelectedEvents()}
                type="button"
              >
                {deletingSelected ? "Deleting…" : "Delete selected"}
              </button>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="adminState adminStateError">
              <strong>Could not load statistics</strong>
              <p>Check the database connection and try again.</p>
            </div>
          ) : status === "loading" && !data ? (
            <div className="adminState"><strong>Loading…</strong></div>
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
                          aria-label="Select all events on this page"
                          checked={data.events.some((item) => item.source !== "diary") && data.events.filter((item) => item.source !== "diary").every((item) => selectedItems[getEventKey(item)])}
                          disabled={deletingSelected || status === "loading" || !data.events.some((item) => item.source !== "diary")}
                          onChange={toggleCurrentPage}
                          type="checkbox"
                        />
                      </th>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Source</th>
                      <th>Page / action</th>
                      <th>Visitor</th>
                      <th>IP</th>
                      <th>Delivery</th>
                      <th aria-label="Actions" />
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
                            aria-label={item.source === "diary" ? "Diary entries cannot be deleted from the activity log" : `Select event “${eventLabels[item.type]}”`}
                            checked={Boolean(selectedItems[getEventKey(item)])}
                            disabled={deletingSelected || item.source === "diary"}
                            onChange={() => toggleItem(item)}
                            type="checkbox"
                          />
                        </td>
                        <td className="adminDateCell">{formatDate(item.createdAt, timeZone)}</td>
                        <td><span className={`eventBadge ${item.type}`}>{eventLabels[item.type]}</span></td>
                        <td>{getSourceLabel(item.activitySource)}</td>
                        <td className="adminActionCell">
                          <strong>{item.path}</strong>
                          {item.label ? <span>{item.label}</span> : item.referrer ? <span>from {item.referrer}</span> : null}
                        </td>
                        <td title={String(item.telegramUserId ?? (item.visitorId || "—"))}>{getVisitorLabel(item)}</td>
                        <td>{item.ip}</td>
                        <td>
                          {item.deliveryStatus ? (
                            <span className={`deliveryBadge ${item.deliveryStatus}`}>
                              {statusLabels[item.deliveryStatus]}{item.delivered && item.delivered > 0 ? ` · ${item.delivered}` : ""}
                            </span>
                          ) : "—"}
                        </td>
                        <td>
                          {item.source === "diary" ? <span title="Diary entries cannot be deleted from the activity log">Read only</span> : <button
                            className="adminDeleteButton"
                            disabled={deletingSelected || deletingId === item.id}
                            onClick={() => void deleteEvent(item)}
                            type="button"
                          >
                            {deletingId === item.id ? "Deleting…" : "Delete"}
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="adminPagination">
                <span>{data.pagination.total} events · page {data.pagination.page} of {data.pagination.pages}</span>
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
