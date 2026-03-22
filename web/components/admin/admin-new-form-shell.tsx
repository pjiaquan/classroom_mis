"use client";

import Link from "next/link";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "新增表單",
    title: "表單建立流程會放在這裡。",
    body:
      "目前先把路由與版面骨架建立好。下一步會接上可編輯的表單設定介面，包含欄位、選項、對應規則與發布狀態。",
    back: "返回表單列表",
  },
  en: {
    languageLabel: "Language",
    tag: "New Form",
    title: "Builder creation flow goes here.",
    body:
      "The routing surface and page shell are in place first. The next step is wiring the actual builder UI for metadata, fields, options, mapping, and publish state.",
    back: "Back to forms",
  },
} as const;

export function AdminNewFormShell() {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const t = copy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <section className="w-full rounded-[28px] border border-amber-100 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] p-6 shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
          {t.tag}
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold leading-[1.25] text-stone-950">
          {t.title}
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-8 text-stone-700">
          {t.body}
        </p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[16px] border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-700"
          href="/admin/forms"
        >
          {t.back}
        </Link>
      </section>
    </main>
  );
}
