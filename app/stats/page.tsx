import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CalBot Stats",
  description: "CalBot calorie trends, target hits, streaks, and weekly comparisons."
};

const calorieTarget = 2200;

const calorieDays = [
  { label: "Mon", calories: 2180, status: "in-range" },
  { label: "Tue", calories: 2240, status: "over" },
  { label: "Wed", calories: 2100, status: "in-range" },
  { label: "Thu", calories: 2190, status: "in-range" },
  { label: "Fri", calories: 2130, status: "in-range" },
  { label: "Sat", calories: 2010, status: "under" },
  { label: "Sun", calories: 2060, status: "in-range" }
] as const;

const averageCards = [
  { label: "7 days", value: 2130, delta: "-3% vs target" },
  { label: "14 days", value: 2165, delta: "-2% vs target" },
  { label: "30 days", value: 2210, delta: "+0.5% vs target" }
];

const rangeCards = [
  { label: "In target", value: "5 / 7", detail: "days within the goal range" },
  { label: "Over", value: "1", detail: "day above target" },
  { label: "Under", value: "1", detail: "day below target" },
  { label: "Best streak", value: "4", detail: "days in a row" }
];

const weekComparison = [
  { label: "Average calories", current: "2130", previous: "2260", trend: "-130 kcal" },
  { label: "Target hits", current: "5 days", previous: "3 days", trend: "+2 days" },
  { label: "Over target", current: "1 day", previous: "3 days", trend: "-2 days" }
];

function getBarHeight(calories: number) {
  return `${Math.max(18, Math.round((calories / 2500) * 100))}%`;
}

export default function StatsPage() {
  return (
    <main className="statsPage">
      <section className="statsShell" aria-labelledby="stats-title">
        <header className="dashboardTop">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <nav className="dashboardNav" aria-label="Stats navigation">
            <a href="/">Today</a>
            <a className="dashboardPremium" href="/premium">
              Premium
            </a>
          </nav>
        </header>

        <section className="statsHero">
          <div>
            <p className="eyebrow">Stats</p>
            <h1 id="stats-title">Calorie dynamics</h1>
          </div>
          <div className="statsTarget">
            <span>Goal</span>
            <strong>{calorieTarget} kcal</strong>
          </div>
        </section>

        <section className="statsChartPanel" aria-label="Daily calories chart">
          <div className="statsPanelHeader">
            <div>
              <span>Last 7 days</span>
              <strong>2130 kcal average</strong>
            </div>
            <p>5 of 7 days in target</p>
          </div>

          <div className="calorieChart" role="img" aria-label="Calories by day for the last week">
            <span className="targetLine" style={{ bottom: `${(calorieTarget / 2500) * 100}%` }} />
            {calorieDays.map((day) => (
              <div className="chartDay" key={day.label}>
                <div className="chartBarWrap">
                  <span
                    className={`chartBar ${day.status}`}
                    style={{ height: getBarHeight(day.calories) }}
                  />
                </div>
                <strong>{day.calories}</strong>
                <span>{day.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="averageGrid" aria-label="Average calories">
          {averageCards.map((card) => (
            <article className="statCard" key={card.label}>
              <span>Average {card.label}</span>
              <strong>{card.value} kcal</strong>
              <p>{card.delta}</p>
            </article>
          ))}
        </section>

        <section className="rangeGrid" aria-label="Goal range summary">
          {rangeCards.map((card) => (
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
              <strong>More stable tracking</strong>
            </div>
          </div>

          <div className="comparisonRows">
            {weekComparison.map((row) => (
              <div className="comparisonRow" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.current}</strong>
                <p>{row.previous}</p>
                <em>{row.trend}</em>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
