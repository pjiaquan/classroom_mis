"use client";

import Link from "next/link";
import { type AdminFormDefinition } from "@/lib/forms/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type AdminFormEditorProps = {
  form: AdminFormDefinition;
};

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    metadata: "表單資訊",
    preview: "預覽",
    publish: "發布",
    fields: "欄位設定",
    required: "必填",
    optional: "選填",
    status: "狀態",
    slug: "代稱",
    intro:
      "這個頁面是表單欄位排序、對應規則、發布狀態與視覺設定的主編輯區。資料模型已經就位，接下來只差互動式 builder 寫入功能。",
    mapping: "對應欄位",
  },
  en: {
    languageLabel: "Language",
    metadata: "Metadata",
    preview: "Preview",
    publish: "Publish",
    fields: "Fields",
    required: "Required",
    optional: "Optional",
    status: "Status",
    slug: "Slug",
    intro:
      "This page is the main editing surface for field order, mapping rules, publish status, and visual settings. The data model is ready; the interactive builder write flow is the next step.",
    mapping: "Mapping",
  },
} as const;

export function AdminFormEditor({ form }: AdminFormEditorProps) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  const t = copy[locale];

  return (
    <section className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <aside className="rounded-[28px] bg-[linear-gradient(160deg,#14532d,#1f2937)] p-6 text-white shadow-panel sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">
          {t.metadata}
        </p>
        <h1 className="mt-5 font-heading text-3xl font-bold leading-[1.25] tracking-[0.01em]">
          {form.name}
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          {t.slug}: {form.slug}
        </p>
        <p className="mt-1 text-sm leading-7 text-slate-300">
          {t.status}: {form.status}
        </p>
        <p className="mt-6 text-sm leading-8 text-slate-300">
          {t.intro}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-[16px] bg-white px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-900"
            href={`/forms/${form.slug}`}
          >
            {t.preview}
          </Link>
          <form action={`/admin/forms/${form.id}/publish`} method="post">
            <button
              className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-amber-200/30 bg-white/5 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-white"
              type="submit"
            >
              {t.publish}
            </button>
          </form>
        </div>
      </aside>

      <div className="rounded-[28px] border border-amber-100 bg-white/95 p-6 shadow-panel sm:p-8">
        <h2 className="font-heading text-2xl font-bold leading-[1.3] tracking-[0.01em] text-slate-950">
          {t.fields}
        </h2>
        <div className="mt-6 grid gap-4">
          {form.fields.map((field) => (
            <article
              key={field.id}
              className="rounded-[22px] border border-slate-200 px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-heading text-xl font-bold leading-[1.35] tracking-[0.01em] text-slate-900">
                    {field.label}
                  </h3>
                  <p className="text-sm leading-7 text-slate-500">
                    {field.fieldKey} · {field.fieldType} · sort {field.sortOrder}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold tracking-[0.08em] text-stone-700">
                  {field.isRequired ? t.required : t.optional}
                </span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {t.mapping}: {field.mapping.target}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
