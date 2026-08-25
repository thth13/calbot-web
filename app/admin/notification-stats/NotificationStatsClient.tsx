"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type EventType = "visit" | "click" | "bottom" | "bot_started" | "quiz_completed";
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
  visit: "Визит",
  click: "Нажатие",
  bottom: "До конца",
  bot_started: "Запуск бота",
  quiz_completed: "Квиз пройден"
};

const statusLabels: Record<DeliveryStatus, string> = {
  pending: "Отправляется",
  sent: "Доставлено",
  failed: "Ошибка"
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
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

  async function deleteEvent(item: ActivityEvent) {
    if (!window.confirm(`Удалить событие «${eventLabels[item.type]}»?`)) return;

    setDeletingId(item.id);
    try {
      const response = await fetch("/api/admin/notification-stats", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, source: item.source })
      });

      if (!response.ok) {
        window.alert("Не удалось удалить событие.");
        return;
      }

      if (data?.events.length === 1 && page > 1) {
        setPage((value) => value - 1);
      } else {
        setReloadKey((value) => value + 1);
      }
    } catch {
      window.alert("Не удалось удалить событие.");
    } finally {
      setDeletingId("");
    }
  }

  const emptyMessage = query || eventType !== "all" || activitySource !== "all"
    ? "По выбранным фильтрам событий нет."
    : "События появятся после первого действия посетителя.";

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
          <section className="adminSummary" aria-label="Сводная статистика">
            <article><span>Всего</span><strong>{data.summary.total}</strong></article>
            <article><span>Сегодня</span><strong>{data.summary.today}</strong></article>
            <article><span>За 7 дней</span><strong>{data.summary.lastSevenDays}</strong></article>
            <article><span>Посетители</span><strong>{data.summary.uniqueVisitors}</strong></article>
          </section>
        ) : null}

        <section className="adminActivityPanel" aria-live="polite">
          <div className="adminActivityHeader">
            <div>
              <h2>Журнал действий</h2>
              {data ? (
                <p>
                  Визиты: {data.summary.byType.visit ?? 0} · Нажатия: {data.summary.byType.click ?? 0} · До конца: {data.summary.byType.bottom ?? 0} · Запуски бота: {data.summary.byType.bot_started ?? 0} · Квизы: {data.summary.byType.quiz_completed ?? 0}
                </p>
              ) : null}
            </div>
            <form className="adminSearch" onSubmit={applySearch}>
              <input
                aria-label="Поиск по журналу"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Страница, пользователь, IP…"
                type="search"
                value={searchInput}
              />
              <button type="submit">Найти</button>
            </form>
          </div>

          <div className="adminFilters" aria-label="Фильтр типа события">
            {(["all", "visit", "click", "bottom", "bot_started", "quiz_completed"] as const).map((value) => (
              <button
                aria-pressed={eventType === value}
                key={value}
                onClick={() => changeType(value)}
                type="button"
              >
                {value === "all" ? "Все" : eventLabels[value]}
              </button>
            ))}
          </div>
          <div className="adminFilters" aria-label="Фильтр среды">
            {(["all", "browser", "telegram_webapp", "telegram_bot"] as const).map((value) => (
              <button
                aria-pressed={activitySource === value}
                key={value}
                onClick={() => changeSource(value)}
                type="button"
              >
                {value === "all" ? "Все среды" : getSourceLabel(value)}
              </button>
            ))}
          </div>

          {status === "error" ? (
            <div className="adminState adminStateError">
              <strong>Не удалось загрузить статистику</strong>
              <p>Проверьте подключение к базе и повторите попытку.</p>
            </div>
          ) : status === "loading" && !data ? (
            <div className="adminState"><strong>Загрузка…</strong></div>
          ) : data && data.events.length === 0 ? (
            <div className="adminState"><strong>{emptyMessage}</strong></div>
          ) : data ? (
            <>
              <div className={`adminTableWrap${status === "loading" ? " isLoading" : ""}`}>
                <table className="adminActivityTable">
                  <thead>
                    <tr>
                      <th>Время</th>
                      <th>Событие</th>
                      <th>Среда</th>
                      <th>Страница / действие</th>
                      <th>Посетитель</th>
                      <th>IP</th>
                      <th>Отправка</th>
                      <th aria-label="Действия" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((item) => (
                      <tr key={`${item.source}-${item.id}`}>
                        <td className="adminDateCell">{formatDate(item.createdAt)}</td>
                        <td><span className={`eventBadge ${item.type}`}>{eventLabels[item.type]}</span></td>
                        <td>{getSourceLabel(item.activitySource)}</td>
                        <td className="adminActionCell">
                          <strong>{item.path}</strong>
                          {item.label ? <span>{item.label}</span> : item.referrer ? <span>из {item.referrer}</span> : null}
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
                            disabled={deletingId === item.id}
                            onClick={() => void deleteEvent(item)}
                            type="button"
                          >
                            {deletingId === item.id ? "Удаление…" : "Удалить"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="adminPagination">
                <span>{data.pagination.total} событий · страница {data.pagination.page} из {data.pagination.pages}</span>
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
