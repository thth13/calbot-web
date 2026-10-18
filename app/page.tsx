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
    label: "Protein",
    unit: "g",
    color: "#d7664f"
  },
  fat: {
    icon: "🥑",
    label: "Fat",
    unit: "g",
    color: "#5aa469"
  },
  carbs: {
    icon: "🍚",
    label: "Carbs",
    unit: "g",
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

      reject(new Error("Could not create the image for sharing"));
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
    throw new Error("Canvas is unavailable");
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
  context.fillText("Calories", 112, 372);
  context.font = "850 76px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#161412";
  context.fillText(`${data.day.calories}`, 112, 468);
  context.font = "760 32px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText(`/ ${data.day.calorieTarget} kcal`, 112, 520);

  context.textAlign = "right";
  context.font = "760 30px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText("Remaining", 968, 372);
  context.font = "850 48px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#5aa469";
  context.fillText(`${Math.max(data.day.calorieTarget - data.day.calories, 0)} kcal`, 968, 442);
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
  context.fillText("Latest meal", 112, 1015);
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
  context.fillText(`${data.day.meals} ${data.day.meals === 1 ? "meal" : "meals"} tracked with CalBot`, width / 2, 1252);
  context.textAlign = "left";

  const blob = await canvasToBlob(canvas);
  return new File([blob], `calbot-${data.day.dateKey}.png`, { type: "image/png" });
}

function getDisplayName(user?: TelegramUser) {
  if (!user) {
    return "Your day";
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return fullName || (user.username ? `@${user.username}` : "Your day");
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

function LandingAction({ placement }: { placement: "hero" | "footer" }) {
  return (
    <div className="landingCta">
      <a
        className="primaryAction landingAction"
        data-track-bot-open="true"
        data-track-label={`Open Telegram bot — ${placement}`}
        href={BOT_URL}
        target="_blank"
        rel="noreferrer"
      >
        Try for free
      </a>
    </div>
  );
}

function Landing() {
  return (
    <main className="landingPage" id="top">
      <header className="landingNav">
        <a className="brand" href="#top" aria-label="CalBot — back to top">
          <span className="brandMark">C</span>
          <span>CalBot</span>
        </a>
        <span className="landingTag">Your food diary in Telegram</span>
      </header>

      <section className="landingHero" aria-labelledby="landing-title">
        <div className="landingCopy">
          <p className="landingEyebrow">Your meal. One photo. Calories and macros.</p>
          <h1 id="landing-title">Count calories from a photo, <span>without manual logging</span></h1>
          <p className="landingLead">
            Send a meal photo in Telegram — CalBot estimates calories and macros
            and saves the meal to your diary.
          </p>
          <LandingAction placement="hero" />
        </div>
        <figure className="landingExample">
          <div className="landingExamplePhone">
            <img
              src="/phone-main.webp"
              alt="Example of a CalBot reply to a meal photo: about 500 kcal, 25 g protein, 20 g fat and 50 g carbs. You can edit the result."
              width="853"
              height="1844"
              fetchPriority="high"
            />
          </div>
          <figcaption>A real example of meal analysis in CalBot</figcaption>
        </figure>
      </section>

      <section className="landingSection" aria-labelledby="landing-steps-title">
        <p className="landingEyebrow">Getting started</p>
        <h2 id="landing-steps-title">From photo to diary entry</h2>
        <ol className="landingSteps">
          <li><h3>Open CalBot</h3><p>Tap Start in Telegram and complete the initial setup.</p></li>
          <li><h3>Send a meal photo</h3><p>Take a photo of your breakfast, lunch or dinner and send it to the bot.</p></li>
          <li><h3>Get a calorie estimate</h3><p>CalBot shows calories and macros and adds the meal to your diary.</p></li>
        </ol>
      </section>

      <section className="landingSection landingProgress" aria-labelledby="landing-progress-title">
        <div className="landingSectionCopy">
          <p className="landingEyebrow">Beyond a single meal</p>
          <h2 id="landing-progress-title">See your whole day</h2>
          <p>See how much you have eaten, how much is left toward your daily goal and how your nutrition changes throughout the week — all in one place.</p>
          <p>Review your meal history and track calories, protein, fat and carbs.</p>
        </div>
        <div className="landingProgressExamples">
          <figure>
            <img src="/phone-profile.webp" alt="CalBot daily summary: calories, macros and remaining daily allowance" width="852" height="1847" loading="lazy" />
            <figcaption>Your day</figcaption>
          </figure>
          <figure>
            <img src="/phone-stats.webp" alt="Weekly calorie and macro chart in CalBot" width="852" height="1846" loading="lazy" />
            <figcaption>Your week</figcaption>
          </figure>
        </div>
      </section>

      <section className="landingSection landingFaq" aria-labelledby="landing-faq-title">
        <div>
          <p className="landingEyebrow">Before your first meal</p>
          <h2 id="landing-faq-title">Frequently asked questions</h2>
        </div>
        <div className="landingQuestions">
          <details open>
            <summary>How accurate is photo analysis?</summary>
            <p>CalBot provides an estimate. A photo cannot always reveal the exact portion weight, amount of oil or every ingredient. Check the result and edit the entry if needed.</p>
          </details>
          <details>
            <summary>Can I correct the result?</summary>
            <p>Yes. Use the Edit button in the bot reply to adjust your meal entry.</p>
          </details>
          <details>
            <summary>What happens after the 14 free days?</summary>
            <p>The first 14 days are a free trial. Premium is required to keep scanning meals afterward. See current plans on the <a href="/premium">Premium page</a>.</p>
          </details>
          <details>
            <summary>Do I need to install another app?</summary>
            <p>If you already have Telegram, there is nothing else to install. Open CalBot, tap Start and follow the bot instructions.</p>
          </details>
        </div>
      </section>

      <section className="landingClosing" aria-labelledby="landing-closing-title">
        <p className="landingEyebrow">Start with your next meal</p>
        <h2 id="landing-closing-title">Try it with your own meal</h2>
        <p>See the calories and macros in your meal.</p>
        <LandingAction placement="footer" />
      </section>
      <footer className="landingFooter">
        <a className="brand" href="#top">CalBot</a>
        <nav aria-label="Service information">
          <a href="/terms">Terms of Service</a>
          <a href="/privacy">Privacy</a>
        </nav>
      </footer>
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
          throw new Error(errorBody?.detail || errorBody?.error || "Could not share to Telegram");
        }

        const body = (await response.json()) as { preparedMessageId?: string };
        if (!body.preparedMessageId) {
          throw new Error("The prepared Telegram message is missing");
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
        text: `My CalBot — ${day.title.toLowerCase()}`
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
            aria-label="Share dashboard"
            className="dashboardShareButton"
            disabled={shareStatus === "sharing"}
            onClick={handleShare}
            title="Share"
            type="button"
          >
            <ShareIcon />
          </button>
        </header>

        <div className="dashboardHero">
          <div>
            <div className="daySwitcher" aria-label="Select dashboard day">
              <button
                aria-label="Previous day"
                disabled={isLoading}
                onClick={() => onDateChange(shiftDateKey(selectedDate, -1))}
                type="button"
              >
                ‹
              </button>
              <p className="eyebrow">{day.title}</p>
              <button
                aria-label="Next day"
                disabled={isLoading || !canGoForward}
                onClick={() => onDateChange(shiftDateKey(selectedDate, 1))}
                type="button"
              >
                ›
              </button>
            </div>
            <h1 id="dashboard-title">{userTitle}</h1>
          </div>
          <div className="mealCounter" aria-label="Meal count">
            <strong>{day.meals}</strong>
            <span>{day.meals === 1 ? "meal" : "meals"}</span>
          </div>
        </div>

        <section
          className={`caloriePanel${calorieGoalReached ? " isGoalReached" : ""}${
            calorieOverLimit ? " isOverLimit" : ""
          }`}
          aria-label={`Calories for ${day.title}`}
        >
          <div className="calorieSummary">
            <div>
              <span>🔥 Calories</span>
              <strong>
                {day.calories} / {day.calorieTarget} kcal
              </strong>
            </div>
            <div>
              <span>{calorieGoalReached ? "Goal status" : "Remaining"}</span>
              <strong
                className={
                  calorieOverLimit ? "statusBadge overLimitText" : calorieGoalReached ? "goalReachedText" : undefined
                }
              >
                {calorieOverLimit
                  ? `Over by ${calorieOverAmount} kcal`
                  : calorieGoalReached
                    ? "Goal reached"
                    : `${caloriesLeft} kcal`}
              </strong>
            </div>
          </div>

          <div className="progressTrack" aria-label={`Calorie goal progress: ${calorieProgress}%`}>
            <span style={{ width: `${calorieProgress}%` }} />
          </div>
        </section>

        <section className="macroGrid" aria-label="Protein, fat and carbs">
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
                    Over by {macroOverAmount} {meta.unit}
                  </p>
                ) : macroGoalReached ? (
                  <p className="goalReachedBadge">Goal reached</p>
                ) : null}
                <div
                  className="progressTrack compactTrack"
                  aria-label={`${meta.label}: goal progress: ${macroProgress}%`}
                >
                  <span style={{ width: `${macroProgress}%`, background: meta.color }} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="lastFoodPanel" aria-label="Latest meal">
          <span>Latest meal</span>
          <strong>{day.lastFood}</strong>
          <p>{day.lastFoodTime}</p>
        </section>

        <section className="quickActions" aria-label="Quick actions">
          <a className="quickAction" href="/stats">
            Statistics
          </a>
          <a className="quickAction" href="/history">
            History
          </a>
        </section>

        {lastAction ? (
          <p className="dashboardHint">Action sent: {lastAction}</p>
        ) : null}
        {isLoading ? (
          <p className="dashboardHint">Loading data for {selectedDate}…</p>
        ) : null}
        {error ? (
          <p className="dashboardHint errorHint">{error}</p>
        ) : null}
        {shareStatus === "saved" ? (
          <p className="dashboardHint">Image saved. Share it on Telegram or Instagram.</p>
        ) : null}
        {shareStatus === "sent" ? (
          <p className="dashboardHint">Sent to your Telegram chat.</p>
        ) : null}
        {shareStatus === "error" ? (
          <p className="dashboardHint errorHint">
            {shareError || "Could not send to Telegram."}
          </p>
        ) : null}
      </section>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<"checking" | "landing" | "dashboard">("landing");
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
      throw new Error("Could not load the dashboard");
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

      if (!isActive) {
        return;
      }

      setView("checking");
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
      setDashboardError("Could not load data for this day.");
    } finally {
      setIsDashboardLoading(false);
    }
  }

  if (view === "checking") {
    return <main className="routeLoader landingDashboardLoader" role="status">Loading your day…</main>;
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
