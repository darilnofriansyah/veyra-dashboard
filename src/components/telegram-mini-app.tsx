"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TelegramEvent =
  | "themeChanged"
  | "viewportChanged"
  | "safeAreaChanged"
  | "contentSafeAreaChanged";

interface TelegramInset {
  top?: number;
  bottom?: number;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(callback: () => void): void;
  offClick(callback: () => void): void;
}

interface TelegramWebApp {
  initData: string;
  colorScheme?: "light" | "dark";
  viewportHeight?: number;
  viewportStableHeight?: number;
  safeAreaInset?: TelegramInset;
  contentSafeAreaInset?: TelegramInset;
  ready(): void;
  expand(): void;
  disableVerticalSwipes?(): void;
  isVersionAtLeast?(version: string): boolean;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  BackButton: TelegramBackButton;
  onEvent(event: TelegramEvent, callback: () => void): void;
  offEvent(event: TelegramEvent, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type AuthState = "authenticating" | "denied" | "expired" | "unavailable" | null;

function telegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  const webApp = window.Telegram?.WebApp;
  if (!webApp) return null;
  if (!webApp.initData && !/(?:^|[#&])tgWebAppVersion=/.test(window.location.hash)) {
    return null;
  }
  return webApp;
}

const failureCopy: Record<Exclude<AuthState, "authenticating" | null>, string> = {
  denied: "This Telegram account does not have access to Veyra.",
  expired: "This Telegram launch is invalid or expired. Please close and reopen Veyra from Telegram.",
  unavailable: "Veyra is temporarily unavailable. Please try again."
};

export function TelegramMiniApp() {
  const pathname = usePathname();
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(null);
  const [retry, setRetry] = useState(0);
  const webApp = telegramWebApp();

  useEffect(() => {
    const webApp = telegramWebApp();
    if (!webApp) return;

    document.documentElement.dataset.telegramMiniApp = "true";
    const syncChrome = () => {
      const root = document.documentElement.style;
      root.setProperty(
        "--veyra-telegram-viewport-height",
        `${webApp.viewportHeight || window.innerHeight}px`
      );
      root.setProperty(
        "--veyra-telegram-stable-height",
        `${webApp.viewportStableHeight || webApp.viewportHeight || window.innerHeight}px`
      );
      root.setProperty(
        "--veyra-telegram-safe-top",
        `${webApp.contentSafeAreaInset?.top ?? webApp.safeAreaInset?.top ?? 0}px`
      );
      root.setProperty(
        "--veyra-telegram-safe-bottom",
        `${webApp.contentSafeAreaInset?.bottom ?? webApp.safeAreaInset?.bottom ?? 0}px`
      );
      webApp.setHeaderColor?.(webApp.colorScheme === "dark" ? "#121722" : "#ffffff");
      webApp.setBackgroundColor?.("#f6f8fb");
      if (webApp.isVersionAtLeast?.("7.10")) {
        webApp.setBottomBarColor?.("#ffffff");
      }
    };
    const goBack = () => {
      if (!window.dispatchEvent(new Event("veyra:before-navigation", { cancelable: true }))) return;
      router.replace("/dashboard");
    };
    const secondary = pathname === "/transactions" || pathname === "/pockets";
    const events: TelegramEvent[] = ["themeChanged", "viewportChanged"];
    if (webApp.isVersionAtLeast?.("8.0")) {
      events.push("safeAreaChanged", "contentSafeAreaChanged");
    }

    syncChrome();
    webApp.ready();
    webApp.expand();
    if (webApp.isVersionAtLeast?.("7.7")) webApp.disableVerticalSwipes?.();
    for (const event of events) webApp.onEvent(event, syncChrome);
    window.addEventListener("resize", syncChrome);
    if (secondary) {
      webApp.BackButton.show();
      webApp.BackButton.onClick(goBack);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      for (const event of events) webApp.offEvent(event, syncChrome);
      window.removeEventListener("resize", syncChrome);
      webApp.BackButton.offClick(goBack);
    };
  }, [pathname, router]);

  useEffect(() => {
    const webApp = telegramWebApp();
    if (!webApp || pathname !== "/") return;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7_000);
    let active = true;

    if (!webApp.initData) {
      setAuthState("expired");
    } else {
      setAuthState("authenticating");
      void fetch("/auth/telegram/mini-app", {
        method: "POST",
        body: webApp.initData,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal
      }).then(async (response) => {
        if (response.ok) {
          const payload: unknown = await response.json();
          if (typeof payload === "object" && payload !== null && "status" in payload && payload.status === "authorized") {
            window.location.replace("/dashboard");
            return;
          }
        }
        if (!active) return;
        setAuthState(response.status === 403 ? "denied" : response.status === 503 ? "unavailable" : "expired");
      }).catch(() => {
        if (active) setAuthState("unavailable");
      }).finally(() => window.clearTimeout(timeout));
    }

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [pathname, retry]);

  useEffect(() => {
    const loginPage = document.getElementById("login-page");
    if (!loginPage) return;
    loginPage.inert = authState === "authenticating";
    return () => {
      loginPage.inert = false;
    };
  }, [authState]);

  if (!webApp || pathname !== "/" || !authState) return null;

  const overlayClass = "fixed inset-0 z-50 grid place-items-center bg-white/95 p-6 text-veyra-ink";
  const cardClass = "w-full max-w-sm rounded-veyra border border-veyra-line bg-white p-6 text-center shadow-[0_18px_50px_rgba(18,23,34,0.12)]";
  const brandMark = <div className="mx-auto mb-4 size-3 rounded-full bg-veyra-cyan shadow-[0_0_0_6px_rgba(0,179,255,0.12)]" aria-hidden="true" />;
  if (authState === "authenticating") {
    return <section role="status" aria-live="polite" className={overlayClass}><div className={cardClass}>{brandMark}<p className="text-sm font-semibold">Opening Veyra…</p></div></section>;
  }
  return (
    <section role="alert" aria-live="polite" className={overlayClass}>
      <div className={cardClass}>
        {brandMark}
        <p className="text-sm font-semibold">{failureCopy[authState]}</p>
        <button type="button" className="mt-6 min-h-11 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 motion-reduce:transition-none" onClick={() => { setAuthState("authenticating"); setRetry((value) => value + 1); }}>Retry</button>
      </div>
    </section>
  );
}
