"use client";

import Link from "next/link";
import { type AdminFormSummary } from "@/lib/forms/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type AdminFormsShellProps = {
  forms: AdminFormSummary[];
};

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "內部管理",
    title: "表單管理介面",
    body: "這裡是內部表單管理入口。正式環境應以認證中介層或反向代理保護後再開放。",
    newForm: "新增表單",
    edit: "編輯",
  },
  en: {
    languageLabel: "Language",
    tag: "Admin",
    title: "Form Builder",
    body: "This is the internal form management entry. Protect it with authentication or a reverse proxy before exposing it in production.",
    newForm: "New Form",
    edit: "Edit",
  },
} as const;

export function AdminFormsShell({ forms }: AdminFormsShellProps) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  const t = copy[locale];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <header className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(240,253,250,0.92))] px-5 py-6 shadow-panel backdrop-blur sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
              {t.tag}
            </p>
            <h1 className="font-heading text-3xl font-bold leading-[1.25] tracking-[0.01em] text-stone-900 sm:text-4xl">
              {t.title}
            </h1>
            <p className="max-w-2xl text-[15px] leading-8 text-stone-700">
              {t.body}
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-emerald-800 bg-emerald-700 px-6 py-3 text-[15px] font-semibold tracking-[0.08em] text-white transition hover:bg-emerald-800"
            href="/admin/forms/new"
          >
            {t.newForm}
          </Link>
        </div>
      </header>

      <section className="grid gap-4">
        {forms.map((form) => (
          <article
            key={form.id}
            className="rounded-[28px] border border-amber-100 bg-white/95 px-5 py-5 shadow-panel sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1.5">
                <h2 className="font-heading text-2xl font-bold leading-[1.3] tracking-[0.01em] text-stone-900">
                  {form.name}
                </h2>
                <p className="text-sm leading-7 text-stone-500">
                  /forms/{form.slug} · {form.status}
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-amber-200 bg-amber-50/70 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-700 transition hover:bg-amber-100"
                href={`/admin/forms/${form.id}`}
              >
                {t.edit}
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
