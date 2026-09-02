"use client";

import { useEffect, useState } from "react";

type TelegramUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  sendData?: (data: string) => void;
  shareMessage?: (msgId: string, callback?: (sent: boolean) => void) => void;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy") => void;
  };
  initData?: string;
  initDataUnsafe?: {
    user?: TelegramUser;
  };
};

type DashboardData = {
  user: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  day: {
    dateKey: string;
    title: string;
    label: string;
    calories: number;
    calorieTarget: number;
    meals: number;
    lastFood: string;
    lastFoodTime: string;
  };
  macros: Array<{
    id: "protein" | "fat" | "carbs";
    current: number;
    target: number;
  }>;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const macroMeta = {
  protein: {
    icon: "🥩",
    label: "Білки",
    unit: "г",
    color: "#d7664f"
  },
  fat: {
    icon: "🥑",
    label: "Жири",
    unit: "г",
    color: "#5aa469"
  },
  carbs: {
    icon: "🍚",
    label: "Вуглеводи",
    unit: "г",
    color: "#c89432"
  }
} as const;

const BOT_URL = "https://t.me/caldetect_bot";

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey: string, deltaDays: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);

  return getLocalDateKey(date);
}

function ShareIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <path
        d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M12 15V4m0 0 4 4m-4-4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function percent(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((current / target) * 100));
}

function isGoalReached(current: number, target: number) {
  return target > 0 && current >= target;
}

function isCalorieOverLimit(current: number, target: number) {
  return target > 0 && current - target > 300;
}

function getOverAmount(current: number, target: number) {
  return Math.max(Math.round(current - target), 0);
}

function isMacroOverLimit(id: "protein" | "fat" | "carbs", current: number, target: number) {
  if (id === "protein" || target <= 0) {
    return false;
  }

  const caloriesPerGram = id === "fat" ? 9 : 4;
  return (current - target) * caloriesPerGram > 300;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawProgress(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  progress: number,
  color: string
) {
  context.fillStyle = "#ece6dc";
  roundRect(context, x, y, width, height, height / 2);
  context.fill();

  context.fillStyle = color;
  roundRect(context, x, y, Math.max(height, Math.round(width * (progress / 100))), height, height / 2);
  context.fill();
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Не вдалося створити зображення для поширення"));
    }, "image/png");
  });
}

async function createDashboardShareFile(data: DashboardData, userTitle: string) {
  const canvas = document.createElement("canvas");
  const scale = 2;
  const width = 1080;
  const height = 1350;
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas недоступний");
  }

  context.scale(scale, scale);
  context.fillStyle = "#f6f7f2";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#161412";
  context.font = "800 44px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText("CalBot", 72, 96);
  context.font = "700 26px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText(data.day.title, 72, 164);

  context.font = "850 66px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#161412";
  context.fillText(userTitle.slice(0, 24), 72, 245);

  context.fillStyle = "#fffaf0";
  roundRect(context, 72, 310, 936, 300, 18);
  context.fill();
  context.strokeStyle = "#d9d3cb";
  context.lineWidth = 2;
  context.stroke();

  context.font = "760 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText("Калорії", 112, 372);
  context.font = "850 76px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#161412";
  context.fillText(`${data.day.calories}`, 112, 468);
  context.font = "760 32px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText(`/ ${data.day.calorieTarget} ккал`, 112, 520);

  context.textAlign = "right";
  context.font = "760 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText("Залишилося", 968, 372);
  context.font = "850 48px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#5aa469";
  context.fillText(`${Math.max(data.day.calorieTarget - data.day.calories, 0)} ккал`, 968, 442);
  context.textAlign = "left";

  drawProgress(context, 112, 548, 856, 22, percent(data.day.calories, data.day.calorieTarget), "#161412");

  const macroY = 670;
  data.macros.forEach((macro, index) => {
    const meta = macroMeta[macro.id];
    const cardX = 72 + index * 320;
    context.fillStyle = "#ffffff";
    roundRect(context, cardX, macroY, 296, 220, 18);
    context.fill();
    context.strokeStyle = "#d9d3cb";
    context.lineWidth = 2;
    context.stroke();

    context.font = "760 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    context.fillStyle = "#161412";
    context.fillText(meta.label, cardX + 28, macroY + 56);
    context.font = "800 36px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    context.fillText(`${macro.current} / ${macro.target}${meta.unit}`, cardX + 28, macroY + 122);
    drawProgress(
      context,
      cardX + 28,
      macroY + 164,
      240,
      18,
      percent(macro.current, macro.target),
      meta.color
    );
  });

  context.fillStyle = "#ffffff";
  roundRect(context, 72, 950, 936, 190, 18);
  context.fill();
  context.strokeStyle = "#d9d3cb";
  context.lineWidth = 2;
  context.stroke();

  context.font = "760 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText("Остання додана страва", 112, 1015);
  context.font = "850 42px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#161412";
  context.fillText(data.day.lastFood.slice(0, 34), 112, 1080);
  context.font = "700 28px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText(data.day.lastFoodTime, 112, 1125);

  context.fillStyle = "#161412";
  roundRect(context, 72, 1204, 936, 74, 14);
  context.fill();
  context.font = "800 28px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.fillText(`${data.day.meals} прийомів їжі відстежено з CalBot`, width / 2, 1252);
  context.textAlign = "left";

  const blob = await canvasToBlob(canvas);
  return new File([blob], `calbot-${data.day.dateKey}.png`, { type: "image/png" });
}

function getDisplayName(user?: TelegramUser) {
  if (!user) {
    return "Ваш день";
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return fullName || (user.username ? `@${user.username}` : "Ваш день");
}

function waitForTelegramWebApp(timeoutMs = 1500) {
  return new Promise<TelegramWebApp | undefined>((resolve) => {
    const startedAt = Date.now();

    function check() {
      const webApp = window.Telegram?.WebApp;
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

function Landing() {
  return (
    <main className="landingPage">
      <header className="landingNav">
        <a className="brand" href="#top" aria-label="CalBot — на початок сторінки">
          <span className="brandMark">C</span>
          <span>CalBot</span>
        </a>
        <span className="landingTag">AI-трекер харчування</span>
      </header>

      <section className="landingHero" id="top">
        <div className="landingCopy">
          {/* <p className="eyebrow">Telegram-бот з AI</p> */}
          <h1>Харчування під контролем — без зайвих підрахунків</h1>
          <p className="landingLead">
            Надішліть фото страви й одразу отримайте калорії, БЖВ та зрозумілу
            статистику прогресу.
          </p>
          <a
            className="primaryAction landingAction"
            data-track-bot-open="true"
            data-track-label="Open Telegram bot"
            href={BOT_URL}
            target="_blank"
            rel="noreferrer"
          >
            Спробувати в Telegram
          </a>
        </div>

        <div className="landingScreens" aria-label="Інтерфейс CalBot">
          <figure className="landingPhone landingPhoneLeft">
            <img src="/phone-profile.webp" alt="Денна статистика калорій і макронутрієнтів у CalBot" />
          </figure>
          <figure className="landingPhone landingPhoneCenter">
            <img src="/phone-main.webp" alt="Аналіз страви за фото в Telegram-боті CalBot" />
          </figure>
          <figure className="landingPhone landingPhoneRight">
            <img src="/phone-stats.webp" alt="Тижнева статистика харчування в CalBot" />
          </figure>
        </div>
      </section>
    </main>
  );
}

function Dashboard({
  data,
  selectedDate,
  isLoading,
  error,
  onDateChange
}: {
  data: DashboardData;
  selectedDate: string;
  isLoading: boolean;
  error: string;
  onDateChange: (date: string) => void;
}) {
  const [lastAction, setLastAction] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "sent" | "saved" | "error">("idle");
  const [shareError, setShareError] = useState("");
  const day = data.day;
  const todayKey = getLocalDateKey();
  const canGoForward = selectedDate < todayKey;
  const caloriesLeft = Math.max(day.calorieTarget - day.calories, 0);
  const calorieProgress = percent(day.calories, day.calorieTarget);
  const calorieGoalReached = isGoalReached(day.calories, day.calorieTarget);
  const calorieOverLimit = isCalorieOverLimit(day.calories, day.calorieTarget);
  const calorieOverAmount = getOverAmount(day.calories, day.calorieTarget);
  const user = {
    id: data.user.id,
    username: data.user.username,
    first_name: data.user.firstName,
    last_name: data.user.lastName
  };
  const userTitle = getDisplayName(user);

  async function handleShare() {
    const webApp = window.Telegram?.WebApp;
    webApp?.HapticFeedback?.impactOccurred?.("light");
    setShareStatus("sharing");
    setShareError("");

    try {
      const file = await createDashboardShareFile(data, userTitle);

      if (webApp?.initData && webApp.shareMessage) {
        const formData = new FormData();
        formData.append("initData", webApp.initData);
        formData.append("photo", file);
        formData.append("userTitle", userTitle);
        formData.append("calories", String(day.calories));
        formData.append("calorieTarget", String(day.calorieTarget));
        formData.append("meals", String(day.meals));
        formData.append("dayTitle", day.title);

        const response = await fetch("/api/dashboard/share", {
          method: "POST",
          body: formData
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => undefined)) as
            | { detail?: string; error?: string }
            | undefined;
          throw new Error(errorBody?.detail || errorBody?.error || "Не вдалося поширити в Telegram");
        }

        const body = (await response.json()) as { preparedMessageId?: string };
        if (!body.preparedMessageId) {
          throw new Error("Підготовлене повідомлення Telegram відсутнє");
        }

        const wasSent = await new Promise<boolean>((resolve) => {
          webApp.shareMessage?.(body.preparedMessageId as string, resolve);
        });

        if (!wasSent) {
          setShareStatus("idle");
          return;
        }

        webApp.HapticFeedback?.impactOccurred?.("medium");
        setShareStatus("sent");
        window.setTimeout(() => {
          setShareStatus("idle");
        }, 3000);
        return;
      }

      const shareData = {
        files: [file],
        title: `CalBot ${day.title.toLowerCase()}`,
        text: `Мій CalBot — ${day.title.toLowerCase()}`
      };

      if (navigator.canShare?.(shareData) && navigator.share) {
        await navigator.share(shareData);
        setShareStatus("idle");
        return;
      }

      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShareStatus("saved");
    } catch (error) {
      if ((error as DOMException).name === "AbortError") {
        setShareStatus("idle");
        return;
      }

      setShareError(error instanceof Error ? error.message : "");
      setShareStatus("error");
    }
  }

  return (
    <main className="dashboardPage">
      <section className="dashboardShell" aria-labelledby="dashboard-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <button
            aria-label="Поділитися дашбордом"
            className="dashboardShareButton"
            disabled={shareStatus === "sharing"}
            onClick={handleShare}
            title="Поділитися"
            type="button"
          >
            <ShareIcon />
          </button>
        </header>

        <div className="dashboardHero">
          <div>
            <div className="daySwitcher" aria-label="Вибрати день дашборда">
              <button
                aria-label="Попередній день"
                disabled={isLoading}
                onClick={() => onDateChange(shiftDateKey(selectedDate, -1))}
                type="button"
              >
                ‹
              </button>
              <p className="eyebrow">{day.title}</p>
              <button
                aria-label="Наступний день"
                disabled={isLoading || !canGoForward}
                onClick={() => onDateChange(shiftDateKey(selectedDate, 1))}
                type="button"
              >
                ›
              </button>
            </div>
            <h1 id="dashboard-title">{userTitle}</h1>
          </div>
          <div className="mealCounter" aria-label="Кількість прийомів їжі">
            <strong>{day.meals}</strong>
            <span>прийомів їжі</span>
          </div>
        </div>

        <section
          className={`caloriePanel${calorieGoalReached ? " isGoalReached" : ""}${
            calorieOverLimit ? " isOverLimit" : ""
          }`}
          aria-label={`Калорії за ${day.title}`}
        >
          <div className="calorieSummary">
            <div>
              <span>🔥 Калорії</span>
              <strong>
                {day.calories} / {day.calorieTarget} ккал
              </strong>
            </div>
            <div>
              <span>{calorieGoalReached ? "Статус цілі" : "Залишилося"}</span>
              <strong
                className={
                  calorieOverLimit ? "statusBadge overLimitText" : calorieGoalReached ? "goalReachedText" : undefined
                }
              >
                {calorieOverLimit
                  ? `Перевищено на ${calorieOverAmount} ккал`
                  : calorieGoalReached
                    ? "Цілі досягнуто"
                    : `${caloriesLeft} ккал`}
              </strong>
            </div>
          </div>

          <div className="progressTrack" aria-label={`Ціль калорій виконано на ${calorieProgress}%`}>
            <span style={{ width: `${calorieProgress}%` }} />
          </div>
        </section>

        <section className="macroGrid" aria-label="Білки, жири та вуглеводи">
          {data.macros.map((macro) => {
            const meta = macroMeta[macro.id];
            const macroProgress = percent(macro.current, macro.target);
            const macroGoalReached = isGoalReached(macro.current, macro.target);
            const macroOverLimit = isMacroOverLimit(macro.id, macro.current, macro.target);
            const macroOverAmount = getOverAmount(macro.current, macro.target);

            return (
              <article
                className={`macroCard${macroGoalReached ? " isGoalReached" : ""}${
                  macroOverLimit ? " isOverLimit" : ""
                }`}
                key={macro.id}
              >
                <div className="macroCardTop">
                  <span>{meta.icon}</span>
                  <strong>{meta.label}</strong>
                </div>
                <p>
                  {macro.current} / {macro.target} {meta.unit}
                </p>
                {macroOverLimit ? (
                  <p className="goalReachedBadge overLimitText">
                    Перевищено на {macroOverAmount} {meta.unit}
                  </p>
                ) : macroGoalReached ? (
                  <p className="goalReachedBadge">Цілі досягнуто</p>
                ) : null}
                <div
                  className="progressTrack compactTrack"
                  aria-label={`${meta.label}: ціль виконано на ${macroProgress}%`}
                >
                  <span style={{ width: `${macroProgress}%`, background: meta.color }} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="lastFoodPanel" aria-label="Остання додана страва">
          <span>Остання додана страва</span>
          <strong>{day.lastFood}</strong>
          <p>{day.lastFoodTime}</p>
        </section>

        <section className="quickActions" aria-label="Швидкі дії">
          <a className="quickAction" href="/stats">
            Статистика
          </a>
          <a className="quickAction" href="/history">
            Історія
          </a>
        </section>

        {lastAction ? (
          <p className="dashboardHint">Дію надіслано: {lastAction}</p>
        ) : null}
        {isLoading ? (
          <p className="dashboardHint">Завантаження даних за {selectedDate}…</p>
        ) : null}
        {error ? (
          <p className="dashboardHint errorHint">{error}</p>
        ) : null}
        {shareStatus === "saved" ? (
          <p className="dashboardHint">Зображення збережено. Надішліть його в Telegram або Instagram.</p>
        ) : null}
        {shareStatus === "sent" ? (
          <p className="dashboardHint">Надіслано у ваш чат Telegram.</p>
        ) : null}
        {shareStatus === "error" ? (
          <p className="dashboardHint errorHint">
            {shareError || "Не вдалося надіслати в Telegram."}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<"checking" | "landing" | "dashboard">("checking");
  const [dashboardData, setDashboardData] = useState<DashboardData | undefined>();
  const [initData, setInitData] = useState("");
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");

  async function loadDashboardData(nextInitData: string, date: string) {
    const response = await fetch("/api/dashboard", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ initData: nextInitData, date })
    });

    if (!response.ok) {
      throw new Error("Не вдалося завантажити дашборд");
    }

    return (await response.json()) as DashboardData;
  }

  useEffect(() => {
    let isActive = true;

    async function resolveInitialView() {
      const webApp = await waitForTelegramWebApp();

      if (!webApp?.initData) {
        if (isActive) {
          setView("landing");
        }
        return;
      }

      webApp.ready?.();
      webApp.expand?.();
      setInitData(webApp.initData);

      try {
        const data = await loadDashboardData(webApp.initData, selectedDate);

        if (!isActive) {
          return;
        }

        setDashboardData(data);
        setView("dashboard");
      } catch {
        if (isActive) {
          setView("landing");
        }
      }
    }

    resolveInitialView();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleDateChange(date: string) {
    const todayKey = getLocalDateKey();
    const nextDate = date > todayKey ? todayKey : date;
    const previousDate = selectedDate;
    setSelectedDate(nextDate);

    if (!initData || nextDate === selectedDate) {
      return;
    }

    setIsDashboardLoading(true);
    setDashboardError("");
    try {
      setDashboardData(await loadDashboardData(initData, nextDate));
    } catch {
      setSelectedDate(previousDate);
      setDashboardError("Не вдалося завантажити дані за цей день.");
    } finally {
      setIsDashboardLoading(false);
    }
  }

  if (view === "checking") {
    return <main className="routeLoader" aria-label="Завантаження" />;
  }

  if (view === "dashboard" && dashboardData) {
    return (
      <Dashboard
        data={dashboardData}
        selectedDate={selectedDate}
        isLoading={isDashboardLoading}
        error={dashboardError}
        onDateChange={handleDateChange}
      />
    );
  }

  return <Landing />;
}
