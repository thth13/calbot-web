"use client";

import Script from "next/script";
import { useEffect, useMemo, useState } from "react";

type PaddleEnvironment = "sandbox" | "production";
type PaddleEvent = {
  name?: string;
  data?: unknown;
};

type CheckoutItem = {
  priceId: string;
  quantity: number;
};

type PaddleGlobal = {
  Environment?: {
    set: (environment: PaddleEnvironment) => void;
  };
  Initialize: (options: {
    token: string;
    eventCallback?: (event: PaddleEvent) => void;
    checkout?: {
      settings?: {
        displayMode?: "overlay";
        theme?: "light" | "dark";
        variant?: "one-page" | "multi-page";
        successUrl?: string;
      };
    };
  }) => void;
  Checkout: {
    open: (options: {
      items: CheckoutItem[];
      customData?: Record<string, string>;
      settings?: {
        displayMode?: "overlay";
        theme?: "light" | "dark";
        variant?: "one-page" | "multi-page";
        successUrl?: string;
      };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
    Telegram?: {
      WebApp?: {
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        sendData?: (data: string) => void;
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy") => void;
        };
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id?: number;
            username?: string;
            first_name?: string;
            last_name?: string;
          };
        };
      };
    };
  }
}

const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const paddleEnvironment =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "production" ? "production" : "sandbox";

const plans = [
  {
    id: "monthly",
    title: "Monthly",
    price: "$9.99",
    note: "Flexible access",
    priceId: process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID
  },
  {
    id: "yearly",
    title: "Yearly",
    price: "$99",
    note: "2 months cheaper",
    priceId: process.env.NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID
  }
] as const;

const benefits = [
  "Unlimited food recognition",
  "Advanced calorie and macro stats",
  "Unlimited nutrition history"
];

export default function PremiumCheckout() {
  const [selectedPlanId, setSelectedPlanId] = useState<(typeof plans)[number]["id"]>("yearly");
  const [isPaddleReady, setIsPaddleReady] = useState(false);
  const [isTelegramSession, setIsTelegramSession] = useState(true);
  const [checkoutState, setCheckoutState] = useState<"idle" | "opening" | "completed">("idle");
  const [checkoutError, setCheckoutError] = useState("");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0],
    [selectedPlanId]
  );

  const isConfigured = Boolean(paddleToken && selectedPlan.priceId);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const hasInitData = Boolean(webApp?.initData);

    setIsTelegramSession(hasInitData);
    if (!hasInitData) {
      setCheckoutError("Open this page from the CalBot Telegram bot to buy Premium.");
      return;
    }

    webApp?.ready?.();
    webApp?.expand?.();
  }, []);

  function initializePaddle() {
    if (!window.Paddle || !paddleToken) {
      return;
    }

    if (paddleEnvironment === "sandbox") {
      window.Paddle.Environment?.set("sandbox");
    }

    window.Paddle.Initialize({
      token: paddleToken,
      eventCallback(event) {
        if (event.name === "checkout.completed") {
          setCheckoutState("completed");
        }
      },
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "light",
          variant: "one-page"
        }
      }
    });

    setIsPaddleReady(true);
  }

  async function verifyTelegramUser() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) {
      throw new Error("Open this page from Telegram to continue.");
    }

    const response = await fetch("/api/telegram/verify-init-data", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ initData })
    });

    if (!response.ok) {
      throw new Error("Could not verify your Telegram session. Please reopen the page from the bot.");
    }

    return (await response.json()) as {
      user: {
        id: number;
        username?: string;
        firstName?: string;
        lastName?: string;
      };
    };
  }

  async function openCheckout() {
    if (!window.Paddle || !selectedPlan.priceId) {
      setCheckoutError("The payment form is not configured yet. Please try again later.");
      return;
    }

    setCheckoutError("");
    setCheckoutState("opening");

    let telegramUser;
    try {
      const verified = await verifyTelegramUser();
      telegramUser = verified.user;
    } catch (error) {
      setCheckoutState("idle");
      setCheckoutError(error instanceof Error ? error.message : "Telegram verification failed.");
      return;
    }

    window.Paddle.Checkout.open({
      items: [
        {
          priceId: selectedPlan.priceId,
          quantity: 1
        }
      ],
      customData: {
        plan: selectedPlan.id,
        source: "telegram_webview",
        telegramUserId: String(telegramUser.id),
        ...(telegramUser.username ? { telegramUsername: telegramUser.username } : {})
      },
      settings: {
        displayMode: "overlay",
        theme: "light",
        variant: "one-page"
      }
    });

    setCheckoutState("idle");
  }

  return (
    <main className="premiumPage">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={initializePaddle}
      />

      <section className="premiumShell" aria-labelledby="premium-title">
        <header className="premiumHeader">
          <a className="brand" href="/" aria-label="CalBot">
            <span className="brandMark">C</span>
            <span>CalBot</span>
          </a>
          <span>Premium</span>
        </header>

        <div className="premiumBenefits">
          <h1 id="premium-title">CalBot Premium</h1>
          <ul className="planFeatures premiumFeatures">
            {benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>

        <div className="checkoutPanel" aria-label="Premium checkout">
          <div className="planToggle" role="radiogroup" aria-label="Subscription period">
            {plans.map((plan) => (
              <label className="checkoutPlan" key={plan.id}>
                <input
                  checked={selectedPlanId === plan.id}
                  name="premium-plan"
                  onChange={() => setSelectedPlanId(plan.id)}
                  type="radio"
                  value={plan.id}
                />
                <span>
                  <small>{plan.title}</small>
                  <strong>{plan.price}</strong>
                  <em>{plan.note}</em>
                </span>
              </label>
            ))}
          </div>

          <button
            className="primaryAction checkoutButton"
            disabled={!isTelegramSession || !isPaddleReady || !isConfigured || checkoutState === "opening"}
            onClick={openCheckout}
            type="button"
          >
            {checkoutState === "opening" ? "Opening Paddle..." : "Subscribe"}
          </button>

          {!isConfigured ? (
            <p className="checkoutNotice">
              Add Paddle environment variables with a client-side token and price ID to enable
              payments.
            </p>
          ) : null}

          {checkoutState === "completed" ? (
            <p className="checkoutSuccess">
              Payment complete. Premium will activate after the Paddle webhook is processed.
            </p>
          ) : null}

          {checkoutError ? <p className="checkoutError">{checkoutError}</p> : null}
        </div>
      </section>
    </main>
  );
}
