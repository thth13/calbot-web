"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
};

type BodyMeasurement = {
  id: string;
  dateKey: string;
  date: string;
  weightKg?: number;
  heightCm?: number;
  bodyFatPercent?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  neckCm?: number;
  notes: string;
};

type BodyMeasurementData = {
  latest?: {
    date: string;
    weightKg?: number;
    bodyFatPercent?: number;
  };
  items: BodyMeasurement[];
};

type MeasurementDraft = {
  date: string;
  weightKg: string;
  heightCm: string;
  bodyFatPercent: string;
  waistCm: string;
  chestCm: string;
  hipsCm: string;
  neckCm: string;
  notes: string;
};

const emptyDraft: MeasurementDraft = {
  date: new Date().toISOString().slice(0, 10),
  weightKg: "",
  heightCm: "",
  bodyFatPercent: "",
  waistCm: "",
  chestCm: "",
  hipsCm: "",
  neckCm: "",
  notes: ""
};

const measurementFields = [
  ["weightKg", "Вага", "кг"],
  ["heightCm", "Зріст", "см"],
  ["bodyFatPercent", "Жирова маса", "%"],
  ["waistCm", "Талія", "см"],
  ["chestCm", "Груди", "см"],
  ["hipsCm", "Стегна", "см"],
  ["neckCm", "Шия", "см"]
] as const;

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

function formatValue(value: number | undefined, unit: string) {
  return value === undefined ? "-" : `${Number.isInteger(value) ? value : value.toFixed(1)} ${unit}`;
}

function toDraft(measurement: BodyMeasurement): MeasurementDraft {
  return {
    date: measurement.dateKey,
    weightKg: measurement.weightKg === undefined ? "" : String(measurement.weightKg),
    heightCm: measurement.heightCm === undefined ? "" : String(measurement.heightCm),
    bodyFatPercent: measurement.bodyFatPercent === undefined ? "" : String(measurement.bodyFatPercent),
    waistCm: measurement.waistCm === undefined ? "" : String(measurement.waistCm),
    chestCm: measurement.chestCm === undefined ? "" : String(measurement.chestCm),
    hipsCm: measurement.hipsCm === undefined ? "" : String(measurement.hipsCm),
    neckCm: measurement.neckCm === undefined ? "" : String(measurement.neckCm),
    notes: measurement.notes
  };
}

function MeasurementForm({
  draft,
  disabled,
  submitLabel,
  onChange,
  onSubmit,
  onCancel
}: {
  draft: MeasurementDraft;
  disabled: boolean;
  submitLabel: string;
  onChange: (draft: MeasurementDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="measurementForm"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        <span>Дата</span>
        <input
          required
          type="date"
          value={draft.date}
          onChange={(event) => onChange({ ...draft, date: event.target.value })}
        />
      </label>

      <div className="measurementEditGrid">
        {measurementFields.map(([key, label, unit]) => (
          <label key={key}>
            <span>
              {label}, {unit}
            </span>
            <input
              min="0"
              step="0.1"
              type="number"
              value={draft[key]}
              onChange={(event) => onChange({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
      </div>

      <label>
        <span>Нотатки</span>
        <input value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} />
      </label>

      <div className="measurementActions">
        <button disabled={disabled} type="submit">
          {submitLabel}
        </button>
        {onCancel ? (
          <button disabled={disabled} onClick={onCancel} type="button">
            Скасувати
          </button>
        ) : null}
      </div>
    </form>
  );
}

function BodyMeasurementContent({
  data,
  editingId,
  deletingId,
  pendingId,
  editDraft,
  newDraft,
  onChangeEditDraft,
  onChangeNewDraft,
  onCreate,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete
}: {
  data: BodyMeasurementData;
  editingId: string;
  deletingId: string;
  pendingId: string;
  editDraft: MeasurementDraft;
  newDraft: MeasurementDraft;
  onChangeEditDraft: (draft: MeasurementDraft) => void;
  onChangeNewDraft: (draft: MeasurementDraft) => void;
  onCreate: () => void;
  onStartEdit: (measurement: BodyMeasurement) => void;
  onCancelEdit: () => void;
  onSaveEdit: (measurementId: string) => void;
  onAskDelete: (measurementId: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (measurementId: string) => void;
}) {
  return (
    <>
      <section className="diaryHero">
        <div>
          <p className="eyebrow">Тіло</p>
          <h1 id="bodymeasurement-title">Вимірювання</h1>
        </div>
        <div className="diaryTotal">
          <span>Останнє</span>
          <strong>{formatValue(data.latest?.weightKg, "кг")}</strong>
        </div>
      </section>

      <section className="diaryDay">
        <header className="diaryDayHeader">
          <div>
            <span>Новий запис</span>
            <strong>Додати вимірювання</strong>
          </div>
        </header>
        <div className="dayFoodList">
          <MeasurementForm
            disabled={pendingId === "new"}
            draft={newDraft}
            submitLabel={pendingId === "new" ? "Збереження…" : "Додати"}
            onChange={onChangeNewDraft}
            onSubmit={onCreate}
          />
        </div>
      </section>

      {data.items.length ? (
        <div className="diaryDays">
          {data.items.map((measurement) => {
            const isEditing = editingId === measurement.id;
            const isDeleting = deletingId === measurement.id;
            const isPending = pendingId === measurement.id;

            return (
              <article className="measurementItem" key={measurement.id}>
                <header className="measurementItemHeader">
                  <div>
                    <span>{measurement.date}</span>
                    <strong>{formatValue(measurement.weightKg, "кг")}</strong>
                  </div>
                  <p>{formatValue(measurement.bodyFatPercent, "%")} жиру</p>
                </header>

                {isEditing ? (
                  <MeasurementForm
                    disabled={isPending}
                    draft={editDraft}
                    submitLabel={isPending ? "Збереження…" : "Зберегти"}
                    onCancel={onCancelEdit}
                    onChange={onChangeEditDraft}
                    onSubmit={() => onSaveEdit(measurement.id)}
                  />
                ) : (
                  <>
                    <div className="measurementGrid">
                      {measurementFields.map(([key, label, unit]) => (
                        <div className="measurementMetric" key={key}>
                          <span>{label}</span>
                          <strong>{formatValue(measurement[key], unit)}</strong>
                        </div>
                      ))}
                    </div>
                    {measurement.notes ? <p className="measurementNotes">{measurement.notes}</p> : null}
                    <div className="foodActions measurementRowActions" aria-label={`Дії для ${measurement.date}`}>
                      {isDeleting ? (
                        <>
                          <button disabled={isPending} onClick={() => onConfirmDelete(measurement.id)} type="button">
                            {isPending ? "Видалення…" : "Підтвердити"}
                          </button>
                          <button disabled={isPending} onClick={onCancelDelete} type="button">
                            Скасувати
                          </button>
                        </>
                      ) : (
                        <>
                          <button disabled={Boolean(pendingId)} onClick={() => onStartEdit(measurement)} type="button">
                            Редагувати
                          </button>
                          <button disabled={Boolean(pendingId)} onClick={() => onAskDelete(measurement.id)} type="button">
                            Видалити
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <section className="diaryDay" aria-live="polite">
          <header className="diaryDayHeader">
            <div>
              <span>Тіло</span>
              <strong>Вимірювань ще немає</strong>
            </div>
          </header>
        </section>
      )}
    </>
  );
}

function BodyMeasurementSkeleton() {
  return (
    <>
      <h1 className="srOnly" id="bodymeasurement-title">
        Завантаження вимірювань тіла
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
        {Array.from({ length: 2 }, (_, index) => (
          <article className="measurementItem skeletonCard" key={index}>
            <header className="measurementItemHeader">
              <div>
                <span className="skeletonLine skeletonEyebrow" />
                <strong className="skeletonLine skeletonHeading" />
              </div>
              <p className="skeletonLine skeletonHeaderMeta" />
            </header>
          </article>
        ))}
      </div>
    </>
  );
}

export default function BodyMeasurementClient() {
  const [measurementData, setMeasurementData] = useState<BodyMeasurementData | undefined>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [initData, setInitData] = useState("");
  const [editingId, setEditingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [actionError, setActionError] = useState("");
  const [editDraft, setEditDraft] = useState<MeasurementDraft>(emptyDraft);
  const [newDraft, setNewDraft] = useState<MeasurementDraft>(emptyDraft);

  async function fetchMeasurements(nextInitData: string) {
    const response = await fetch("/api/bodymeasurement", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ initData: nextInitData })
    });

    if (!response.ok) {
      throw new Error("Не вдалося завантажити вимірювання тіла");
    }

    return (await response.json()) as BodyMeasurementData;
  }

  async function reloadMeasurements(nextInitData = initData) {
    if (!nextInitData) {
      return;
    }

    setMeasurementData(await fetchMeasurements(nextInitData));
    setStatus("ready");
  }

  useEffect(() => {
    let isActive = true;

    async function loadMeasurements() {
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
        const data = await fetchMeasurements(webApp.initData);

        if (!isActive) {
          return;
        }

        setInitData(webApp.initData);
        setMeasurementData(data);
        setStatus("ready");
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    }

    loadMeasurements();

    return () => {
      isActive = false;
    };
  }, []);

  function startEdit(measurement: BodyMeasurement) {
    setActionError("");
    setDeletingId("");
    setEditingId(measurement.id);
    setEditDraft(toDraft(measurement));
  }

  async function createMeasurement() {
    if (!initData) {
      return;
    }

    setPendingId("new");
    setActionError("");

    try {
      const response = await fetch("/api/bodymeasurement", {
        method: "PUT",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ initData, ...newDraft })
      });

      if (!response.ok) {
        throw new Error("Не вдалося створити вимірювання тіла");
      }

      setNewDraft(emptyDraft);
      await reloadMeasurements();
    } catch {
      setActionError("Не вдалося додати це вимірювання тіла.");
    } finally {
      setPendingId("");
    }
  }

  async function saveEdit(measurementId: string) {
    if (!initData) {
      return;
    }

    setPendingId(measurementId);
    setActionError("");

    try {
      const response = await fetch(`/api/bodymeasurement/${measurementId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ initData, ...editDraft })
      });

      if (!response.ok) {
        throw new Error("Не вдалося зберегти вимірювання тіла");
      }

      setEditingId("");
      await reloadMeasurements();
    } catch {
      setActionError("Не вдалося зберегти це вимірювання тіла.");
    } finally {
      setPendingId("");
    }
  }

  async function confirmDelete(measurementId: string) {
    if (!initData) {
      return;
    }

    setPendingId(measurementId);
    setActionError("");

    try {
      const response = await fetch(`/api/bodymeasurement/${measurementId}`, {
        method: "DELETE",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ initData })
      });

      if (!response.ok) {
        throw new Error("Не вдалося видалити вимірювання тіла");
      }

      setDeletingId("");
      await reloadMeasurements();
    } catch {
      setActionError("Не вдалося видалити це вимірювання тіла.");
    } finally {
      setPendingId("");
    }
  }

  return (
    <main className="diaryPage">
      <section className="diaryShell" aria-labelledby="bodymeasurement-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <nav className="dashboardNav" aria-label="Навігація вимірюваннями тіла">
            <a href="/">← Назад</a>
          </nav>
        </header>

        {status === "loading" ? (
          <BodyMeasurementSkeleton />
        ) : status === "ready" && measurementData ? (
          <>
            {actionError ? <p className="diaryActionError">{actionError}</p> : null}
            <BodyMeasurementContent
              data={measurementData}
              deletingId={deletingId}
              editDraft={editDraft}
              editingId={editingId}
              newDraft={newDraft}
              pendingId={pendingId}
              onAskDelete={(measurementId) => {
                setActionError("");
                setEditingId("");
                setDeletingId(measurementId);
              }}
              onCancelDelete={() => setDeletingId("")}
              onCancelEdit={() => setEditingId("")}
              onChangeEditDraft={setEditDraft}
              onChangeNewDraft={setNewDraft}
              onConfirmDelete={confirmDelete}
              onCreate={createMeasurement}
              onSaveEdit={saveEdit}
              onStartEdit={startEdit}
            />
          </>
        ) : (
          <section className="diaryDay" aria-live="polite">
            <header className="diaryDayHeader">
              <div>
                <span>Тіло</span>
                <strong id="bodymeasurement-title">Вимірювання недоступні</strong>
              </div>
            </header>
            <div className="dayFoodList">
              <p>Відкрийте цю сторінку в Telegram, щоб завантажити вимірювання тіла.</p>
            </div>
          </section>
        )}

        <section className="quickActions statsActions" aria-label="Дії з вимірюваннями тіла">
          <a className="quickAction" href="/">
            ← Назад
          </a>
        </section>
      </section>
    </main>
  );
}
