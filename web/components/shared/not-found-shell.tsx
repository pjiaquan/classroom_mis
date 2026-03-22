"use client";

import Link from "next/link";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "找不到頁面",
    title: "目前找不到這份表單。",
    body: "請確認表單網址是否正確，或返回首頁重新開啟可用表單。",
    backHome: "返回首頁",
  },
  en: {
    languageLabel: "Language",
    tag: "Not Found",
    title: "This form does not exist.",
    body: "Check the form slug or go back home and open an available form.",
    backHome: "Back home",
  },
} as const;

export function NotFoundShell() {
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  const t = copy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6 sm:py-16">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <section className="w-full rounded-[28px] border border-amber-100 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] p-6 shadow-panel sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
          {t.tag}
        </p>
        <h1 className="mt-4 font-heading text-3xl font-bold leading-[1.25] text-stone-950 sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-4 text-[15px] leading-8 text-stone-700">{t.body}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[16px] border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-700"
          href="/"
        >
          {t.backHome}
        </Link>
      </section>
    </main>
  );
}
