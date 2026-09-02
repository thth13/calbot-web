"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type TelegramWebApp = {
  initData?: string;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium") => void;
    notificationOccurred?: (type: "success" | "error") => void;
  };
};

const MAX_MESSAGE_LENGTH = 1500;

function getTelegramWebApp() {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

function MessageIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="19" viewBox="0 0 24 24" width="19">
      <path
        d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.7 8.7 0 0 1-3.36-.92L4 20l1.62-4.07A7.5 7.5 0 1 1 20 11.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

export default function SupportButton() {
  const pathname = usePathname();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [initData, setInitData] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    let attempts = 0;
    const readInitData = () => {
      const value = getTelegramWebApp()?.initData;
      if (value) {
        setInitData(value);
        return true;
      }

      return false;
    };

    if (readInitData()) {
      return;
    }

    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (readInitData() || attempts >= 20) {
        window.clearInterval(intervalId);
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    textareaRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status !== "sending") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, status]);

  if (
    !initData ||
    pathname.startsWith("/admin") ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/refund"
  ) {
    return null;
  }

  function openSupport() {
    setStatus("idle");
    setIsOpen(true);
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.("light");
  }

  function closeSupport() {
    if (status !== "sending") {
      setIsOpen(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanMessage = message.trim();
    if (!cleanMessage || status === "sending") {
      return;
    }

    setStatus("sending");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData, message: cleanMessage, path: pathname })
      });

      if (!response.ok) {
        throw new Error("Support request failed");
      }

      setMessage("");
      setStatus("sent");
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("success");
    } catch {
      setStatus("error");
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.("error");
    }
  }

  return (
    <>
      <button className="supportTrigger" onClick={openSupport} type="button">
        <MessageIcon />
        <span>Написати в підтримку</span>
      </button>

      {isOpen ? (
        <div className="supportBackdrop" onMouseDown={closeSupport} role="presentation">
          <section
            aria-labelledby="support-title"
            aria-modal="true"
            className="supportDialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="supportDialogHeader">
              <div>
                <p>CalBot</p>
                <h2 id="support-title">Написати в підтримку</h2>
              </div>
              <button
                aria-label="Закрити"
                disabled={status === "sending"}
                onClick={closeSupport}
                type="button"
              >
                ×
              </button>
            </div>

            {status === "sent" ? (
              <div className="supportSuccess">
                <span aria-hidden="true">✓</span>
                <strong>Повідомлення надіслано</strong>
                <p>Ми отримали ваше звернення. Дякуємо, що написали нам.</p>
                <button onClick={closeSupport} type="button">
                  Готово
                </button>
              </div>
            ) : (
              <form className="supportForm" onSubmit={handleSubmit}>
                <label htmlFor="support-message">Опишіть питання або проблему</label>
                <textarea
                  autoComplete="off"
                  id="support-message"
                  maxLength={MAX_MESSAGE_LENGTH}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  placeholder="Наприклад: не можу додати прийом їжі…"
                  ref={textareaRef}
                  rows={5}
                  value={message}
                />
                <div className="supportFormMeta">
                  <span>{message.length}/{MAX_MESSAGE_LENGTH}</span>
                  {status === "error" ? <p>Не вдалося надіслати. Спробуйте ще раз.</p> : null}
                </div>
                <button disabled={!message.trim() || status === "sending"} type="submit">
                  {status === "sending" ? "Надсилаємо…" : "Надіслати повідомлення"}
                </button>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
