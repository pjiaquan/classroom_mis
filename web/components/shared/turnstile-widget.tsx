"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light";
        },
      ) => string;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
};

export function TurnstileWidget({ siteKey }: TurnstileWidgetProps) {
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptId = useId();
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    if (
      !isScriptReady ||
      !window.turnstile ||
      !widgetContainerRef.current ||
      widgetIdRef.current
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(widgetContainerRef.current, {
      sitekey: siteKey,
      callback: (token) => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = token;
        }
      },
      "expired-callback": () => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = "";
        }
      },
      "error-callback": () => {
        if (hiddenInputRef.current) {
          hiddenInputRef.current.value = "";
        }
      },
      theme: "light",
    });
  }, [isScriptReady, siteKey]);

  return (
    <div className="grid gap-2">
      <Script
        id={`turnstile-script-${scriptId}`}
        onLoad={() => setIsScriptReady(true)}
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={widgetContainerRef} />
      <input name="turnstileToken" ref={hiddenInputRef} type="hidden" />
    </div>
  );
}
