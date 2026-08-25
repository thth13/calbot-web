"use client";

import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";

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
        shareMessage?: (msgId: string, callback?: (sent: boolean) => void) => void;
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
    title: "Щомісяця",
    price: "$4.99",
    note: "Гнучкий доступ",
    priceId: process.env.NEXT_PUBLIC_PADDLE_MONTHLY_PRICE_ID
  },
  {
    id: "yearly",
    title: "Щороку",
    price: "$39.99",
    note: "Найвигідніше",
    priceId: process.env.NEXT_PUBLIC_PADDLE_YEARLY_PRICE_ID
  }
] as const;

const benefits = [
  "Продовжуйте сканувати після безкоштовного 14-денного пробного періоду",
  "Розширена статистика калорій і БЖВ",
  "Необмежена історія харчування"
];

export default function PremiumCheckout() {
  const [selectedPlanId, setSelectedPlanId] = useState<(typeof plans)[number]["id"]>("yearly");
  const [isPaddleReady, setIsPaddleReady] = useState(false);
  const [isTelegramSession, setIsTelegramSession] = useState(true);
  const [checkoutState, setCheckoutState] = useState<"idle" | "opening" | "completed">("idle");
  const [checkoutError, setCheckoutError] = useState("");
  const selectedPlanIdRef = useRef(selectedPlanId);
  const purchaseMessageSentRef = useRef(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? plans[0],
    [selectedPlanId]
  );

  const isConfigured = Boolean(paddleToken && selectedPlan.priceId);

  useEffect(() => {
    selectedPlanIdRef.current = selectedPlanId;
  }, [selectedPlanId]);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    const hasInitData = Boolean(webApp?.initData);

    setIsTelegramSession(hasInitData);
    if (!hasInitData) {
      setCheckoutError("Відкрийте цю сторінку з Telegram-бота CalBot, щоб придбати Premium.");
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
          void notifyTelegramPurchaseSuccess();
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
      throw new Error("Щоб продовжити, відкрийте цю сторінку з Telegram.");
    }

    const response = await fetch("/api/telegram/verify-init-data", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ initData })
    });

    if (!response.ok) {
      throw new Error("Не вдалося перевірити сеанс Telegram. Відкрийте сторінку з бота ще раз.");
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

  async function notifyTelegramPurchaseSuccess() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData || purchaseMessageSentRef.current) {
      return;
    }

    purchaseMessageSentRef.current = true;

    const response = await fetch("/api/telegram/purchase-success", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        initData,
        plan: selectedPlanIdRef.current
      })
    });

    if (!response.ok) {
      purchaseMessageSentRef.current = false;
      console.error("Could not send Telegram purchase message");
    }
  }

  async function openCheckout() {
    if (!window.Paddle || !selectedPlan.priceId) {
      setCheckoutError("Платіжну форму ще не налаштовано. Спробуйте пізніше.");
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
      setCheckoutError(error instanceof Error ? error.message : "Не вдалося пройти перевірку Telegram.");
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

        <div className="checkoutPanel" aria-label="Оформлення Premium">
          <div className="planToggle" role="radiogroup" aria-label="Період підписки">
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
            {checkoutState === "opening" ? "Відкриваємо Paddle…" : "Оформити підписку"}
          </button>

          {!isConfigured ? (
            <p className="checkoutNotice">
              Додайте змінні середовища Paddle із клієнтським токеном та ID ціни, щоб
              увімкнути платежі.
            </p>
          ) : null}

          {checkoutState === "completed" ? (
            <p className="checkoutSuccess">
              Оплату завершено. Premium активується після обробки вебхука Paddle.
            </p>
          ) : null}

          {checkoutError ? <p className="checkoutError">{checkoutError}</p> : null}
        </div>
      </section>
    </main>
  );
}
