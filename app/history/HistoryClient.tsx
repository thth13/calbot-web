"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
};

type HistoryItem = {
  id: string;
  dateKey: string;
  time: string;
  name: string;
  mealType: "meal" | "snack";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  confidence: "low" | "medium" | "high";
};

type HistoryData = {
  todayTotal: string;
  days: Array<{
    id: string;
    title: string;
    date: string;
    total: string;
    items: HistoryItem[];
  }>;
};

type EditDraft = {
  date: string;
  name: string;
  mealType: "meal" | "snack";
  kcal: string;
  protein: string;
  fat: string;
  carbs: string;
};

function waitForTelegramWebApp(timeoutMs = 1500) {
  return new Promise<TelegramWebApp | undefined>((resolve) => {
    const startedAt = Date.now();

    function check() {
      const webApp = (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
      if (webApp || Date.now() - startedAt >= timeoutMs) {
        resolve(webApp);
        return;
      }

      window.setTimeout(check, 50);
    }

    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", check, { once: true });
      return;
    }

    check();
  });
}

function toDraft(item: HistoryItem): EditDraft {
  return {
    date: item.dateKey,
    name: item.name,
    mealType: item.mealType,
    kcal: String(item.kcal),
    protein: String(item.protein),
    fat: String(item.fat),
    carbs: String(item.carbs)
  };
}

function HistoryContent({
  data,
  editingId,
  deletingId,
  pendingId,
  editDraft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
  onSaveEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete
}: {
  data: HistoryData;
  editingId: string;
  deletingId: string;
  pendingId: string;
  editDraft: EditDraft;
  onStartEdit: (item: HistoryItem) => void;
  onCancelEdit: () => void;
  onChangeDraft: (draft: EditDraft) => void;
  onSaveEdit: (itemId: string) => void;
  onAskDelete: (itemId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (itemId: string) => void;
}) {
  return (
    <>
      <section className="diaryHero">
        <div>
          <p className="eyebrow">Історія</p>
          <h1 id="history-title">Харчування за днями</h1>
        </div>
        <div className="diaryTotal">
          <span>Сьогодні</span>
          <strong>{data.todayTotal}</strong>
        </div>
      </section>

      {data.days.length ? (
        <div className="diaryDays">
          {data.days.map((day) => (
            <article className="diaryDay" key={day.id}>
              <header className="diaryDayHeader">
                <div>
                  <span>{day.date}</span>
                  <strong>{day.title}</strong>
                </div>
                <p>{day.total}</p>
              </header>

              <div className="foodList dayFoodList">
                {day.items.map((item) => {
                  const isEditing = editingId === item.id;
                  const isDeleting = deletingId === item.id;
                  const isPending = pendingId === item.id;

                  return (
                    <article className={`foodItem ${isEditing ? "editing" : ""}`} key={item.id}>
                      <time className="foodTime" dateTime={item.time}>
                        {item.time}
                      </time>

                      <div className="foodInfo">
                        {isEditing ? (
                          <form
                            className="foodEditForm"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onSaveEdit(item.id);
                            }}
                          >
                            <label>
                              <span>Страва</span>
                              <input
                                required
                                value={editDraft.name}
                                onChange={(event) => onChangeDraft({ ...editDraft, name: event.target.value })}
                              />
                            </label>
                            <label>
                              <span>Дата</span>
                              <input
                                required
                                type="date"
                                value={editDraft.date}
                                onChange={(event) => onChangeDraft({ ...editDraft, date: event.target.value })}
                              />
                            </label>
                            <fieldset className="foodTypeToggle">
                              <legend>Тип</legend>
                              <label>
                                <input
                                  checked={editDraft.mealType === "meal"}
                                  name={`meal-type-${item.id}`}
                                  type="radio"
                                  value="meal"
                                  onChange={() => onChangeDraft({ ...editDraft, mealType: "meal" })}
                                />
                                <span>Прийом їжі</span>
                              </label>
                              <label>
                                <input
                                  checked={editDraft.mealType === "snack"}
                                  name={`meal-type-${item.id}`}
                                  type="radio"
                                  value="snack"
                                  onChange={() => onChangeDraft({ ...editDraft, mealType: "snack" })}
                                />
                                <span>Перекус</span>
                              </label>
                            </fieldset>
                            <div className="foodEditGrid">
                              <label>
                                <span>Ккал</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.kcal}
                                  onChange={(event) => onChangeDraft({ ...editDraft, kcal: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Б</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.protein}
                                  onChange={(event) => onChangeDraft({ ...editDraft, protein: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>Ж</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.fat}
                                  onChange={(event) => onChangeDraft({ ...editDraft, fat: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>В</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.carbs}
                                  onChange={(event) => onChangeDraft({ ...editDraft, carbs: event.target.value })}
                                />
                              </label>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="foodTitleRow">
                              <strong>{item.name}</strong>
                              <span className={`foodTypeBadge ${item.mealType}`}>
                                {item.mealType === "snack" ? "перекус" : "прийом їжі"}
                              </span>
                            </div>
                            <p>
                              {item.kcal} ккал · Б {item.protein} · Ж {item.fat} · В {item.carbs}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="foodActions" aria-label={`Дії для ${item.name}`}>
                        {isEditing ? (
                          <>
                            <button disabled={isPending} onClick={() => onSaveEdit(item.id)} type="button">
                              {isPending ? "Збереження…" : "Зберегти"}
                            </button>
                            <button disabled={isPending} onClick={onCancelEdit} type="button">
                              Скасувати
                            </button>
                          </>
                        ) : isDeleting ? (
                          <>
                            <button disabled={isPending} onClick={() => onConfirmDelete(item.id)} type="button">
                              {isPending ? "Видалення…" : "Підтвердити"}
                            </button>
                            <button disabled={isPending} onClick={onCancelDelete} type="button">
                              Скасувати
                            </button>
                          </>
                        ) : (
                          <>
                            <button disabled={Boolean(pendingId)} onClick={() => onStartEdit(item)} type="button">
                              Редагувати
                            </button>
                            <button disabled={Boolean(pendingId)} onClick={() => onAskDelete(item.id)} type="button">
                              Видалити
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="diaryDay" aria-live="polite">
          <header className="diaryDayHeader">
            <div>
              <span>Історія</span>
              <strong>Записів про їжу ще немає</strong>
            </div>
            <p>0 ккал</p>
          </header>
        </section>
      )}
    </>
  );
}

function HistorySkeleton() {
  return (
    <>
      <h1 className="srOnly" id="history-title">
        Завантаження історії
      </h1>
      <section className="diaryHero" aria-hidden="true">
        <div>
          <span className="skeletonLine skeletonEyebrow" />
          <span className="skeletonLine skeletonTitle" />
        </div>
        <div className="diaryTotal skeletonTarget">
          <span className="skeletonLine" />
          <strong className="skeletonLine" />
        </div>
      </section>

      <div className="diaryDays" aria-hidden="true">
        {Array.from({ length: 2 }, (_, dayIndex) => (
          <article className="diaryDay" key={dayIndex}>
            <header className="diaryDayHeader">
              <div>
                <span className="skeletonLine skeletonEyebrow" />
                <strong className="skeletonLine skeletonHeading" />
              </div>
              <p className="skeletonLine skeletonHeaderMeta" />
            </header>

            <div className="foodList dayFoodList">
              {Array.from({ length: dayIndex === 0 ? 3 : 2 }, (_, itemIndex) => (
                <article className="foodItem skeletonFoodItem" key={itemIndex}>
                  <span className="foodTime skeletonLine" />
                  <div className="foodInfo">
                    <div className="foodTitleRow">
                      <strong className="skeletonLine" />
                      <span className="foodTypeBadge skeletonLine" />
                    </div>
                    <p className="skeletonLine" />
                  </div>
                  <div className="foodActions">
                    <span className="skeletonLine" />
                    <span className="skeletonLine" />
                  </div>
                </article>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export default function HistoryClient() {
  const [historyData, setHistoryData] = useState<HistoryData | undefined>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [initData, setInitData] = useState("");
  const [editingId, setEditingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [editDraft, setEditDraft] = useState<EditDraft>({
    date: "",
    name: "",
    mealType: "meal",
    kcal: "",
    protein: "",
    fat: "",
    carbs: ""
  });

  async function fetchHistory(nextInitData: string) {
    const response = await fetch("/api/history", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ initData: nextInitData })
    });

    if (!response.ok) {
      throw new Error("Не вдалося завантажити історію");
    }

    return (await response.json()) as HistoryData;
  }

  async function reloadHistory(nextInitData = initData) {
    if (!nextInitData) {
      return;
    }

    setHistoryData(await fetchHistory(nextInitData));
    setStatus("ready");
  }

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      const webApp = await waitForTelegramWebApp();

      if (!webApp?.initData) {
        if (isActive) {
          setStatus("unavailable");
        }
        return;
      }

      webApp.ready?.();
      webApp.expand?.();

      try {
        const data = await fetchHistory(webApp.initData);

        if (!isActive) {
          return;
        }

        setInitData(webApp.initData);
        setHistoryData(data);
        setStatus("ready");
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    }

    loadHistory();

    return () => {
      isActive = false;
    };
  }, []);

  function startEdit(item: HistoryItem) {
    setActionError("");
    setDeletingId("");
    setEditingId(item.id);
    setEditDraft(toDraft(item));
  }

  async function saveEdit(itemId: string) {
    if (!initData) {
      return;
    }

    setPendingId(itemId);
    setActionError("");

    try {
      const response = await fetch(`/api/history/${itemId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          initData,
          date: editDraft.date,
          foodDescription: editDraft.name,
          mealType: editDraft.mealType,
          calories: editDraft.kcal,
          protein: editDraft.protein,
          fat: editDraft.fat,
          carbs: editDraft.carbs
        })
      });

      if (!response.ok) {
        throw new Error("Не вдалося зберегти запис про їжу");
      }

      setEditingId("");
      await reloadHistory();
    } catch {
      setActionError("Не вдалося зберегти цей запис про їжу.");
    } finally {
      setPendingId("");
    }
  }

  async function confirmDelete(itemId: string) {
    if (!initData) {
      return;
    }

    setPendingId(itemId);
    setActionError("");

    try {
      const response = await fetch(`/api/history/${itemId}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ initData })
      });

      if (!response.ok) {
        throw new Error("Не вдалося видалити запис про їжу");
      }

      setDeletingId("");
      await reloadHistory();
    } catch {
      setActionError("Не вдалося видалити цей запис про їжу.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <main className="diaryPage">
      <section className="diaryShell" aria-labelledby="history-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <nav className="dashboardNav" aria-label="Навігація історією">
            <a href="/">← Назад</a>
          </nav>
        </header>

        {status === "loading" ? (
          <HistorySkeleton />
        ) : status === "ready" && historyData ? (
          <>
            {actionError ? <p className="diaryActionError">{actionError}</p> : null}
            <HistoryContent
              data={historyData}
              deletingId={deletingId}
              editDraft={editDraft}
              editingId={editingId}
              pendingId={pendingId}
              onAskDelete={(itemId) => {
                setActionError("");
                setEditingId("");
                setDeletingId(itemId);
              }}
              onCancelDelete={() => setDeletingId("")}
              onCancelEdit={() => setEditingId("")}
              onChangeDraft={setEditDraft}
              onConfirmDelete={confirmDelete}
              onSaveEdit={saveEdit}
              onStartEdit={startEdit}
            />
          </>
        ) : (
          <section className="diaryDay" aria-live="polite">
            <header className="diaryDayHeader">
              <div>
                <span>Історія</span>
                <strong id="history-title">Історія недоступна</strong>
              </div>
              <p>0 ккал</p>
            </header>
            <div className="dayFoodList">
              <p>Відкрийте цю сторінку в Telegram, щоб завантажити свою історію.</p>
            </div>
          </section>
        )}

        <section className="quickActions statsActions" aria-label="Дії з історією">
          <a className="quickAction" href="/">
            ← Назад
          </a>
        </section>
      </section>
    </main>
  );
}
