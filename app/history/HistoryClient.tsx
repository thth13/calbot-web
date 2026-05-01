"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
};

type HistoryItem = {
  id: string;
  time: string;
  name: string;
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
  name: string;
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
    name: item.name,
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
          <p className="eyebrow">History</p>
          <h1 id="history-title">Food by day</h1>
        </div>
        <div className="diaryTotal">
          <span>Today</span>
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
                              <span>Food</span>
                              <input
                                required
                                value={editDraft.name}
                                onChange={(event) => onChangeDraft({ ...editDraft, name: event.target.value })}
                              />
                            </label>
                            <div className="foodEditGrid">
                              <label>
                                <span>Kcal</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.kcal}
                                  onChange={(event) => onChangeDraft({ ...editDraft, kcal: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>P</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.protein}
                                  onChange={(event) => onChangeDraft({ ...editDraft, protein: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>F</span>
                                <input
                                  min="0"
                                  required
                                  type="number"
                                  value={editDraft.fat}
                                  onChange={(event) => onChangeDraft({ ...editDraft, fat: event.target.value })}
                                />
                              </label>
                              <label>
                                <span>C</span>
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
                            <strong>{item.name}</strong>
                            <p>
                              {item.kcal} kcal · P {item.protein} · F {item.fat} · C {item.carbs}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="foodActions" aria-label={`Actions for ${item.name}`}>
                        {isEditing ? (
                          <>
                            <button disabled={isPending} onClick={() => onSaveEdit(item.id)} type="button">
                              {isPending ? "Saving" : "Save"}
                            </button>
                            <button disabled={isPending} onClick={onCancelEdit} type="button">
                              Cancel
                            </button>
                          </>
                        ) : isDeleting ? (
                          <>
                            <button disabled={isPending} onClick={() => onConfirmDelete(item.id)} type="button">
                              {isPending ? "Deleting" : "Confirm"}
                            </button>
                            <button disabled={isPending} onClick={onCancelDelete} type="button">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button disabled={Boolean(pendingId)} onClick={() => onStartEdit(item)} type="button">
                              Edit
                            </button>
                            <button disabled={Boolean(pendingId)} onClick={() => onAskDelete(item.id)} type="button">
                              Delete
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
              <span>History</span>
              <strong>No food entries yet</strong>
            </div>
            <p>0 kcal</p>
          </header>
        </section>
      )}
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
    name: "",
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
      throw new Error("Failed to load history");
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
          foodDescription: editDraft.name,
          calories: editDraft.kcal,
          protein: editDraft.protein,
          fat: editDraft.fat,
          carbs: editDraft.carbs
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save food entry");
      }

      setEditingId("");
      await reloadHistory();
    } catch {
      setActionError("Could not save this food entry.");
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
        throw new Error("Failed to delete food entry");
      }

      setDeletingId("");
      await reloadHistory();
    } catch {
      setActionError("Could not delete this food entry.");
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
          <nav className="dashboardNav" aria-label="History navigation">
            <a href="/">← Back</a>
          </nav>
        </header>

        {status === "ready" && historyData ? (
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
                <span>History</span>
                <strong id="history-title">
                  {status === "loading" ? "Loading history" : "History unavailable"}
                </strong>
              </div>
              <p>0 kcal</p>
            </header>
            <div className="dayFoodList">
              <p>
                {status === "loading"
                  ? "Fetching your food entries."
                  : "Open this page from the Telegram app to load your history."}
              </p>
            </div>
          </section>
        )}

        <section className="quickActions statsActions" aria-label="History actions">
          <a className="quickAction" href="/">
            ← Back
          </a>
        </section>
      </section>
    </main>
  );
}
