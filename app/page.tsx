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
    label: "Белки",
    unit: "г",
    color: "#d7664f"
  },
  fat: {
    icon: "🥑",
    label: "Жиры",
    unit: "г",
    color: "#5aa469"
  },
  carbs: {
    icon: "🍚",
    label: "Углеводы",
    unit: "г",
    color: "#c89432"
  }
} as const;

const quickActions = [
  { id: "add_food", label: "+ Еда" },
  { id: "scan_food", label: "Сканировать" },
  { id: "open_history", label: "История" }
];

const BOT_URL = "https://t.me/caldetect_bot";

function percent(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((current / target) * 100));
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

  return (
    <main className="dashboardPage">
      <section className="dashboardShell" aria-labelledby="dashboard-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <a className="dashboardPremium" href="/premium">
            Premium
          </a>
        </header>

        <div className="dashboardHero">
          <div>
            <p className="eyebrow">Сегодня</p>
            <h1 id="dashboard-title">{userTitle}</h1>
          </div>
          <div className="mealCounter" aria-label="Количество приемов пищи">
            <strong>{day.meals}</strong>
            <span>приема пищи</span>
          </div>
        </div>

        <section className="caloriePanel" aria-label="Калории за сегодня">
          <div className="calorieSummary">
            <div>
              <span>🔥 Калории</span>
              <strong>
                {day.calories} / {day.calorieTarget} kcal
              </strong>
            </div>
            <div>
              <span>Остаток</span>
              <strong>{caloriesLeft} kcal</strong>
            </div>
          </div>

          <div className="progressTrack" aria-label={`Калории выполнены на ${calorieProgress}%`}>
            <span style={{ width: `${calorieProgress}%` }} />
          </div>
        </section>

        <section className="macroGrid" aria-label="Белки жиры углеводы">
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
                  aria-label={`${meta.label} выполнены на ${macroProgress}%`}
                >
                  <span style={{ width: `${macroProgress}%`, background: meta.color }} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="lastFoodPanel" aria-label="Последняя добавленная еда">
          <span>Последняя добавленная еда</span>
          <strong>{day.lastFood}</strong>
          <p>{day.lastFoodTime}</p>
        </section>

        <section className="quickActions" aria-label="Быстрые действия">
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
          <p className="dashboardHint">Действие отправлено: {lastAction}</p>
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
