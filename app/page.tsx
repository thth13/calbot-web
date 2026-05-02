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

const features = [
  ["Photo or text", "Send a meal photo or describe what you ate in plain language."],
  ["Calories and macros", "Get calories, protein, fat, carbs, and the estimate confidence."],
  ["Stats", "Track nutrition trends and spot recurring habits faster."],
  ["Premium", "Unlimited scans and advanced analytics for consistent tracking."]
];

const steps = [
  "Open CalBot in Telegram",
  "Send a food photo or description",
  "Get the estimate and save your day"
];

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

const quickActions = [
  { id: "scan_food", label: "Scan" }
];

const BOT_URL = "https://t.me/caldetect_bot";

function percent(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((current / target) * 100));
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

      reject(new Error("Unable to generate share image"));
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
    throw new Error("Canvas is not available");
  }

  context.scale(scale, scale);
  context.fillStyle = "#f6f7f2";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#161412";
  context.font = "800 44px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillText("CalBot", 72, 96);
  context.font = "700 26px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
  context.fillStyle = "#756f66";
  context.fillText("Today", 72, 164);

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
  context.fillText("Last added food", 112, 1015);
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
  context.fillText(`${data.day.meals} meals tracked with CalBot`, width / 2, 1252);
  context.textAlign = "left";

  const blob = await canvasToBlob(canvas);
  return new File([blob], "calbot-today.png", { type: "image/png" });
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

function Landing() {
  return (
    <main>
      <header className="nav">
        <a className="brand" href="#top" aria-label="CalBot">
          <span className="brandMark">C</span>
          <span>CalBot</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#premium">Premium</a>
          <a href="#start">Start</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="heroCopy">
          <p className="eyebrow">Telegram bot · AI nutrition tracker</p>
          <h1>Count calories right in Telegram</h1>
          <p className="lead">
            CalBot analyzes food photos or text descriptions and returns a clear estimate:
            calories, protein, fat, carbs, and confidence.
          </p>
          <div className="actions">
            <a className="primaryAction" href={BOT_URL} target="_blank" rel="noreferrer">
              Open the bot
            </a>
            <a className="secondaryAction" href="#features">
              See features
            </a>
          </div>
        </div>

        <div className="heroVisual" aria-label="CalBot phone screenshot">
          <div className="phoneMockup">
            <div className="phoneSpeaker" aria-hidden="true" />
            <img
              src="/phone-screenshot.png"
              alt="CalBot Telegram bot screenshot on a phone"
            />
          </div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="sectionHeader">
          <p className="eyebrow">What the bot does</p>
          <h2>Less manual entry, more clarity</h2>
        </div>
        <div className="featureGrid">
          {features.map(([title, description]) => (
            <article className="feature" key={title}>
              <span className="dot" />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="splitSection" id="premium">
        <div>
          <p className="eyebrow">Premium</p>
          <h2>For people who track nutrition every day</h2>
          <p>
            Premium removes scan limits and unlocks advanced stats. It is built for regular
            meal logging when you want a clear day-by-day picture.
          </p>
        </div>
        <div className="pricing">
          <div className="priceRow">
            <span>Monthly</span>
            <strong>$9.99</strong>
          </div>
          <div className="priceRow highlighted">
            <span>Yearly</span>
            <strong>$99</strong>
          </div>
          <a className="primaryAction full" href={BOT_URL} target="_blank" rel="noreferrer">
            Choose a plan in Telegram
          </a>
        </div>
      </section>

      <section className="section compact" id="start">
        <div className="sectionHeader">
          <p className="eyebrow">How to start</p>
          <h2>Three quick steps</h2>
        </div>
        <ol className="steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <footer>
        <div>
          <span>CalBot</span>
          <span>AI calorie tracker for Telegram</span>
        </div>
        <nav aria-label="Legal links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="/refund">Refund</a>
        </nav>
      </footer>
    </main>
  );
}

function Dashboard({ data }: { data: DashboardData }) {
  const [lastAction, setLastAction] = useState("");
  const [shareStatus, setShareStatus] = useState<"idle" | "sharing" | "saved" | "error">("idle");
  const day = data.day;
  const caloriesLeft = Math.max(day.calorieTarget - day.calories, 0);
  const calorieProgress = percent(day.calories, day.calorieTarget);
  const user = {
    id: data.user.id,
    username: data.user.username,
    first_name: data.user.firstName,
    last_name: data.user.lastName
  };
  const userTitle = getDisplayName(user);

  function handleQuickAction(actionId: string) {
    const webApp = window.Telegram?.WebApp;

    webApp?.HapticFeedback?.impactOccurred?.("light");
    setLastAction(actionId);

    if (webApp?.initData && webApp.sendData) {
      webApp.sendData(JSON.stringify({ action: actionId }));
    }
  }

  async function handleShare() {
    const webApp = window.Telegram?.WebApp;
    webApp?.HapticFeedback?.impactOccurred?.("light");
    setShareStatus("sharing");

    try {
      const file = await createDashboardShareFile(data, userTitle);
      const shareData = {
        files: [file],
        title: "CalBot today",
        text: "My CalBot day"
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
        </header>

        <div className="dashboardHero">
          <div>
            <p className="eyebrow">Today</p>
            <h1 id="dashboard-title">{userTitle}</h1>
          </div>
          <div className="mealCounter" aria-label="Meal count">
            <strong>{day.meals}</strong>
            <span>meals</span>
          </div>
        </div>

        <section className="caloriePanel" aria-label="Calories for today">
          <div className="calorieSummary">
            <div>
              <span>🔥 Calories</span>
              <strong>
                {day.calories} / {day.calorieTarget} kcal
              </strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{caloriesLeft} kcal</strong>
            </div>
          </div>

          <div className="progressTrack" aria-label={`Calories completed at ${calorieProgress}%`}>
            <span style={{ width: `${calorieProgress}%` }} />
          </div>
        </section>

        <section className="macroGrid" aria-label="Protein fat carbs">
          {data.macros.map((macro) => {
            const meta = macroMeta[macro.id];
            const macroProgress = percent(macro.current, macro.target);

            return (
              <article className="macroCard" key={macro.id}>
                <div className="macroCardTop">
                  <span>{meta.icon}</span>
                  <strong>{meta.label}</strong>
                </div>
                <p>
                  {macro.current} / {macro.target} {meta.unit}
                </p>
                <div
                  className="progressTrack compactTrack"
                  aria-label={`${meta.label} completed at ${macroProgress}%`}
                >
                  <span style={{ width: `${macroProgress}%`, background: meta.color }} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="lastFoodPanel" aria-label="Last added food">
          <span>Last added food</span>
          <strong>{day.lastFood}</strong>
          <p>{day.lastFoodTime}</p>
        </section>

        <section className="quickActions" aria-label="Quick actions">
          <a className="quickAction" href="/stats">
            Stats
          </a>
          <a className="quickAction" href="/history">
            History
          </a>
          <button
            className="quickAction"
            disabled={shareStatus === "sharing"}
            onClick={handleShare}
            type="button"
          >
            {shareStatus === "sharing" ? "Creating" : "Share"}
          </button>
          {quickActions.map((action) => (
            <button
              className="quickAction"
              key={action.id}
              onClick={() => handleQuickAction(action.id)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </section>

        {lastAction ? (
          <p className="dashboardHint">Action sent: {lastAction}</p>
        ) : null}
        {shareStatus === "saved" ? (
          <p className="dashboardHint">Image saved. Send it in Telegram or Instagram.</p>
        ) : null}
        {shareStatus === "error" ? (
          <p className="dashboardHint errorHint">Could not create the share image.</p>
        ) : null}
      </section>
    </main>
  );
}

export default function Home() {
  const [view, setView] = useState<"checking" | "landing" | "dashboard">("checking");
  const [dashboardData, setDashboardData] = useState<DashboardData | undefined>();

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

      try {
        const response = await fetch("/api/dashboard", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ initData: webApp.initData })
        });

        if (!isActive) {
          return;
        }

        if (!response.ok) {
          setView("landing");
          return;
        }

        setDashboardData((await response.json()) as DashboardData);
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

  if (view === "checking") {
    return <main className="routeLoader" aria-label="Loading" />;
  }

  if (view === "dashboard" && dashboardData) {
    return <Dashboard data={dashboardData} />;
  }

  return <Landing />;
}
