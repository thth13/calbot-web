"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type ActivityEvent = {
  type: "visit" | "click";
  path: string;
  label?: string;
  referrer?: string;
  visitorId: string;
  target?: "open_bot";
};

const BOT_OPEN_SELECTOR = "[data-track-bot-open]";

function createVisitorId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getVisitorId() {
  const storageKey = "calbot-activity-visitor-id";

  try {
    const currentId = window.sessionStorage.getItem(storageKey);
    if (currentId) {
      return currentId;
    }

    const visitorId = createVisitorId();
    window.sessionStorage.setItem(storageKey, visitorId);
    return visitorId;
  } catch {
    return createVisitorId();
  }
}

function getCurrentPath() {
  return `${window.location.pathname}${window.location.search}`;
}

function getElementLabel(element: HTMLElement) {
  const label =
    element.dataset.trackLabel ??
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    element.textContent ??
    element.id ??
    element.tagName.toLowerCase();

  return label.replace(/\s+/g, " ").trim().slice(0, 120) || "Unnamed action";
}

function isLocalEnvironment() {
  const hostname = window.location.hostname;
  return (
    hostname === "localhost" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^10(?:\.\d{1,3}){3}$/.test(hostname) ||
    /^192\.168(?:\.\d{1,3}){2}$/.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}$/.test(hostname)
  );
}

function sendActivity(event: ActivityEvent) {
  if (isLocalEnvironment()) {
    return;
  }

  const initData = (window as Window & {
    Telegram?: { WebApp?: { initData?: string } };
  }).Telegram?.WebApp?.initData;

  void fetch("/api/telegram/activity", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...event,
      ...(initData ? { initData } : {})
    }),
    keepalive: true
  }).catch(() => undefined);
}

export default function TelegramActivityTracker() {
  const pathname = usePathname();
  const visitorIdRef = useRef<string>("");
  const lastVisitedPathRef = useRef("");

  useEffect(() => {
    if (pathname !== "/") {
      return;
    }

    if (!visitorIdRef.current) {
      visitorIdRef.current = getVisitorId();
    }

    const currentPath = getCurrentPath();
    if (lastVisitedPathRef.current !== currentPath) {
      lastVisitedPathRef.current = currentPath;
      sendActivity({
        type: "visit",
        path: currentPath,
        referrer: document.referrer,
        visitorId: visitorIdRef.current
      });
    }

    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const clickable = event.target.closest<HTMLElement>(BOT_OPEN_SELECTOR);
      if (!clickable) {
        return;
      }

      sendActivity({
        type: "click",
        path: getCurrentPath(),
        label: getElementLabel(clickable),
        visitorId: visitorIdRef.current,
        target: "open_bot"
      });
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  return null;
}
