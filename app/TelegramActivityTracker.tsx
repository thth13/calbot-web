"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type ActivityEvent = {
  type: "visit" | "click" | "bottom";
  path: string;
  label?: string;
  referrer?: string;
  visitorId: string;
};

const CLICKABLE_SELECTOR =
  "button, [role='button'], a.primaryAction, a.secondaryAction, a.quickAction";

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

  return label.replace(/\s+/g, " ").trim().slice(0, 120) || "Без названия";
}

function sendActivity(event: ActivityEvent) {
  void fetch("/api/telegram/activity", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(event),
    keepalive: true
  }).catch(() => undefined);
}

export default function TelegramActivityTracker() {
  const pathname = usePathname();
  const visitorIdRef = useRef<string>("");
  const lastVisitedPathRef = useRef("");
  const reachedBottomRef = useRef(false);

  useEffect(() => {
    if (!visitorIdRef.current) {
      visitorIdRef.current = getVisitorId();
    }

    const currentPath = getCurrentPath();
    reachedBottomRef.current = false;
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

      const clickable = event.target.closest<HTMLElement>(CLICKABLE_SELECTOR);
      if (!clickable) {
        return;
      }

      sendActivity({
        type: "click",
        path: getCurrentPath(),
        label: getElementLabel(clickable),
        visitorId: visitorIdRef.current
      });
    }

    function handleScroll() {
      if (reachedBottomRef.current) {
        return;
      }

      const scrollBottom = window.scrollY + window.innerHeight;
      const pageHeight = document.documentElement.scrollHeight;
      if (scrollBottom < pageHeight - 8) {
        return;
      }

      reachedBottomRef.current = true;
      sendActivity({
        type: "bottom",
        path: getCurrentPath(),
        visitorId: visitorIdRef.current
      });
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [pathname]);

  return null;
}
