"use client";

import { type Ref, useEffect, useImperativeHandle, useRef } from "react";

type RenderOptions = {
  sitekey: string;
  action: string;
  appearance: "always" | "execute" | "interaction-only";
  theme: "auto" | "light" | "dark";
  "refresh-expired": "auto" | "manual" | "never";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": (code: string) => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: RenderOptions) => string | null | undefined;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const siteKey: string = import.meta.env.VITE_TURNSTILE_SITE_KEY;

let script: Promise<TurnstileApi> | undefined;

const loadTurnstile = () => {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    const element = document.createElement("script");
    element.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    element.addEventListener("load", () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load.")),
    );
    element.addEventListener("error", () => {
      element.remove();
      reject(new Error("Turnstile did not load."));
    });
    document.head.appendChild(element);
  }).catch((error: unknown) => {
    // Let the next widget try again instead of reusing the failure.
    script = undefined;
    throw error;
  });
  return script;
};

export type TurnstileHandle = {
  /** Resolves with a token once the visitor passes the check. */
  token: () => Promise<string>;
  /** Asks for a new token. Call it after each submission, because a token passes only once. */
  reset: () => void;
};

type Waiter = { resolve: (token: string) => void; reject: (error: Error) => void };

/**
 * Cloudflare Turnstile, rendered explicitly. The site key's settings choose the widget mode
 * (managed, non-interactive, or invisible). The widget takes space only when the visitor has to
 * interact with it.
 */
export function Turnstile({
  action,
  theme = "auto",
  ref,
}: {
  action: string;
  theme?: "auto" | "light" | "dark";
  ref: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const state = useRef<{
    api?: TurnstileApi;
    widgetId?: string;
    token?: string;
    error?: Error;
    waiters: Waiter[];
  }>({ waiters: [] });

  useImperativeHandle(ref, () => ({
    token: () => {
      const { token, error } = state.current;
      if (token) return Promise.resolve(token);
      if (error) return Promise.reject(error);
      return new Promise((resolve, reject) => state.current.waiters.push({ resolve, reject }));
    },
    reset: () => {
      const { api, widgetId } = state.current;
      // Without a widget there is nothing to retry, so a load error stays and fails the next token.
      if (!api || !widgetId) return;
      state.current.token = undefined;
      state.current.error = undefined;
      api.reset(widgetId);
    },
  }));

  useEffect(() => {
    const current = state.current;
    const settle = (outcome: { token: string } | { error: Error }) => {
      const waiters = current.waiters.splice(0);
      if ("token" in outcome) {
        current.token = outcome.token;
        for (const waiter of waiters) waiter.resolve(outcome.token);
      } else {
        current.error = outcome.error;
        for (const waiter of waiters) waiter.reject(outcome.error);
      }
    };

    let cancelled = false;
    loadTurnstile().then(
      (api) => {
        if (cancelled || !container.current) return;
        current.api = api;
        const options: RenderOptions = {
          sitekey: siteKey,
          action,
          appearance: "interaction-only",
          theme,
          "refresh-expired": "auto",
          callback: (token) => settle({ token }),
          "expired-callback": () => {
            current.token = undefined;
          },
          "error-callback": (code) =>
            settle({ error: new Error(`Turnstile failed with error ${code}.`) }),
        };
        try {
          current.widgetId = api.render(container.current, options) ?? undefined;
        } catch (error) {
          settle({
            error: error instanceof Error ? error : new Error("Turnstile did not render."),
          });
        }
      },
      (error: Error) => settle({ error }),
    );

    return () => {
      cancelled = true;
      if (current.api && current.widgetId) current.api.remove(current.widgetId);
      current.widgetId = undefined;
    };
  }, [action, theme]);

  return <div ref={container} className="empty:hidden" />;
}
