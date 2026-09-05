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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("uk-UA", {
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

export default function NotificationStatsClient() {
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
    let active = true;

    async function loadStats() {
      setStatus("loading");

      try {
        const response = await fetch("/api/admin/notification-stats", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            page,
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

        setData((await response.json()) as StatsData);
        setStatus("ready");
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadStats();
    return () => {
      active = false;
    };
  }, [activitySource, eventType, page, query, reloadKey]);

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

  const emptyMessage = query || eventType !== "all" || activitySource !== "all"
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

        {data ? (
          <section className="adminSummary" aria-label="Зведена статистика">
            <article><span>Усього</span><strong>{data.summary.total}</strong></article>
            <article><span>Сьогодні</span><strong>{data.summary.today}</strong></article>
            <article><span>За 7 днів</span><strong>{data.summary.lastSevenDays}</strong></article>
            <article><span>Відвідувачі</span><strong>{data.summary.uniqueVisitors}</strong></article>
          </section>
        ) : null}

        <section className="adminActivityPanel" aria-live="polite">
          <div className="adminActivityHeader">
            <div>
              <h2>Журнал дій</h2>
              {data ? (
                <p>
                  Відвідування: {data.summary.byType.visit ?? 0} · Натискання: {data.summary.byType.click ?? 0} · До кінця: {data.summary.byType.bottom ?? 0} · Запуски бота: {data.summary.byType.bot_started ?? 0} · Квізи: {data.summary.byType.quiz_completed ?? 0}
                </p>
              ) : null}
            </div>
            <form className="adminSearch" onSubmit={applySearch}>
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
                        <td className="adminDateCell">{formatDate(item.createdAt)}</td>
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
