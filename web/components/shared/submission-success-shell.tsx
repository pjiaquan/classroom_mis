"use client";

import { usePreferredLocale } from "@/components/shared/use-preferred-locale";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "送出完成",
    title: "感謝您，表單已收到。",
    body: "我們已收到您的資料，將盡快由專人與您聯繫。",
    note: "若有補充需求，也可以透過原本的聯絡方式再告訴我們。",
  },
  en: {
    languageLabel: "Language",
    tag: "Submission Complete",
    title: "Thank you. Your form was received.",
    body: "We have received your information and will contact you soon.",
    note: "If you would like to add anything else, feel free to reach out through your original contact channel.",
  },
} as const;

export function SubmissionSuccessShell() {
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

      <section className="w-full rounded-[28px] border border-amber-100 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] p-6 shadow-panel sm:rounded-[32px] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
          {t.tag}
        </p>
        <h1 className="mt-4 font-heading text-3xl font-bold leading-[1.25] tracking-[0.01em] text-stone-950 sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-4 text-[15px] leading-8 text-stone-700">{t.body}</p>
        <p className="mt-3 text-sm leading-7 text-stone-500">{t.note}</p>
      </section>
    </main>
  );
}
