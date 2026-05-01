"use client";

import { useEffect, useState } from "react";

type TelegramWebApp = {
  ready?: () => void;
  expand?: () => void;
  initData?: string;
};

type StatsData = {
  calorieTarget: number;
  calorieDays: Array<{
    key: string;
    label: string;
    calories: number;
    status: "under" | "in-range" | "over";
  }>;
  averageCards: Array<{
    label: string;
    value: number;
    delta: string;
  }>;
  rangeCards: Array<{
    label: string;
    value: string;
    detail: string;
  }>;
  weekComparison: Array<{
    label: string;
    current: string;
    previous: string;
    trend: string;
  }>;
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

function getBarHeight(calories: number, calorieTarget: number) {
  const maxCalories = Math.max(calorieTarget * 1.25, calories, 1);
  return `${Math.max(4, Math.round((calories / maxCalories) * 100))}%`;
}

function getTargetLineBottom(calorieTarget: number, days: StatsData["calorieDays"]) {
  const maxCalories = Math.max(calorieTarget * 1.25, ...days.map((day) => day.calories), 1);
  return `${Math.min(100, Math.round((calorieTarget / maxCalories) * 100))}%`;
}

function StatsContent({ data }: { data: StatsData }) {
  const average7 = data.averageCards[0]?.value ?? 0;
  const inTarget = data.rangeCards[0]?.value ?? "0 / 7";

  return (
    <>
      <section className="statsHero">
        <div>
          <p className="eyebrow">Stats</p>
          <h1 id="stats-title">Calorie dynamics</h1>
        </div>
        <div className="statsTarget">
          <span>Goal</span>
          <strong>{data.calorieTarget} kcal</strong>
        </div>
      </section>

      <section className="statsChartPanel" aria-label="Daily calories chart">
        <div className="statsPanelHeader">
          <div>
            <span>Last 7 days</span>
            <strong>{average7} kcal average</strong>
          </div>
          <p>{inTarget} days in target</p>
        </div>

        <div className="calorieChart" role="img" aria-label="Calories by day for the last week">
          <span className="targetLine" style={{ bottom: getTargetLineBottom(data.calorieTarget, data.calorieDays) }} />
          {data.calorieDays.map((day) => (
            <div className="chartDay" key={day.key}>
              <div className="chartBarWrap">
                <span
                  className={`chartBar ${day.status}`}
                  style={{ height: getBarHeight(day.calories, data.calorieTarget) }}
                />
              </div>
              <strong>{day.calories}</strong>
              <span>{day.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="averageGrid" aria-label="Average calories">
        {data.averageCards.map((card) => (
          <article className="statCard" key={card.label}>
            <span>Average {card.label}</span>
            <strong>{card.value} kcal</strong>
            <p>{card.delta}</p>
          </article>
        ))}
      </section>

      <section className="rangeGrid" aria-label="Goal range summary">
        {data.rangeCards.map((card) => (
          <article className="rangeCard" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="comparisonPanel" aria-label="Comparison with previous week">
        <div className="statsPanelHeader">
          <div>
            <span>Compared with previous week</span>
            <strong>Weekly comparison</strong>
          </div>
        </div>

        <div className="comparisonRows">
          {data.weekComparison.map((row) => (
            <div className="comparisonRow" key={row.label}>
              <span>{row.label}</span>
              <strong>{row.current}</strong>
              <p>{row.previous}</p>
              <em>{row.trend}</em>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function StatsClient() {
  const [statsData, setStatsData] = useState<StatsData | undefined>();
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "error">("loading");

  useEffect(() => {
    let isActive = true;

    async function loadStats() {
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
        const response = await fetch("/api/stats", {
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
          setStatus("error");
          return;
        }

        setStatsData((await response.json()) as StatsData);
        setStatus("ready");
      } catch {
        if (isActive) {
          setStatus("error");
        }
      }
    }

    loadStats();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <main className="statsPage">
      <section className="statsShell" aria-labelledby="stats-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <nav className="dashboardNav" aria-label="Stats navigation">
            <a href="/">← Back</a>
          </nav>
        </header>

        {status === "ready" && statsData ? (
          <StatsContent data={statsData} />
        ) : (
          <section className="comparisonPanel" aria-live="polite">
            <div className="statsPanelHeader">
              <div>
                <span>Stats</span>
                <strong id="stats-title">
                  {status === "loading" ? "Loading stats" : "Stats unavailable"}
                </strong>
              </div>
            </div>
            <p>
              {status === "loading"
                ? "Fetching your calorie history."
                : "Open this page from the Telegram app to load your personal stats."}
            </p>
          </section>
        )}

        <section className="quickActions statsActions" aria-label="Stats actions">
          <a className="quickAction" href="/">
            ← Back
          </a>
        </section>
      </section>
    </main>
  );
}
