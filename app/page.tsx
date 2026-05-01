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

export default function Home() {
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
            <a className="primaryAction" href="https://t.me/" target="_blank" rel="noreferrer">
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
          <a className="primaryAction full" href="https://t.me/" target="_blank" rel="noreferrer">
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
