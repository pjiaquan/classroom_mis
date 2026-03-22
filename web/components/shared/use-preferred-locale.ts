"use client";

import { useEffect, useState } from "react";
import { type SupportedLocale } from "@/lib/forms/i18n";

const LOCALE_KEY = "form-locale";
const LOCALE_EXPLICIT_KEY = "form-locale-explicit";

export function usePreferredLocale(defaultLocale: SupportedLocale = "zh-TW") {
  const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale);

  useEffect(() => {
    const hasExplicitPreference =
      window.localStorage.getItem(LOCALE_EXPLICIT_KEY) === "1";

    if (!hasExplicitPreference) {
      return;
    }

    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored === "zh-TW" || stored === "en") {
      setLocaleState(stored);
    }
  }, []);

  function setLocale(locale: SupportedLocale) {
    setLocaleState(locale);
    window.localStorage.setItem(LOCALE_KEY, locale);
    window.localStorage.setItem(LOCALE_EXPLICIT_KEY, "1");
  }

  return {
    locale,
    setLocale,
  };
}
