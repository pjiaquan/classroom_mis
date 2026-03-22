"use client";

import Link from "next/link";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    heroTag: "Classroom MIS",
    title: "讓家長更容易留下資料，也讓招生流程更順。",
    body:
      "從填寫表單、留下聯絡方式，到後續整理與聯繫，都可以在同一套流程中完成，讓對外體驗更親切，對內作業也更清楚。",
    openForm: "開啟招生表單",
    openBuilder: "開啟管理介面",
  },
  en: {
    languageLabel: "Language",
    heroTag: "Classroom MIS",
    title:
      "Make it easier for families to leave their information and easier for staff to manage enrollment.",
    body:
      "From filling in a form and leaving contact details to organizing follow-up work, everything can stay in one clear flow with a friendlier public experience.",
    openForm: "Open Lead Form",
    openBuilder: "Open Builder",
  },
} as const;

export function HomeLanding() {
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  const t = copy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <section className="rounded-[30px] border border-amber-200/70 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(236,253,245,0.92))] px-5 py-7 shadow-panel sm:px-8 sm:py-10">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
            {t.heroTag}
          </p>
          <h1 className="font-heading text-4xl font-bold leading-[1.25] tracking-[0.01em] text-stone-900 sm:text-5xl">
            {t.title}
          </h1>
          <p className="text-base leading-8 text-stone-700 sm:text-lg">
            {t.body}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-emerald-800 bg-emerald-700 px-6 py-3 text-[15px] font-semibold tracking-[0.08em] text-white transition hover:bg-emerald-800"
            href="/forms/lead-intake"
          >
            {t.openForm}
          </Link>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-amber-300 bg-white/90 px-6 py-3 text-[15px] font-semibold tracking-[0.08em] text-stone-700 transition hover:bg-amber-50"
            href="/admin/forms"
          >
            {t.openBuilder}
          </Link>
        </div>
      </section>
    </main>
  );
}
