"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { PublicField } from "@/components/fields/public-field";
import { type PublicFormDefinition } from "@/lib/forms/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";
import {
  getChromeMessages,
  getLocalizedField,
  getLocalizedFormName,
  type SupportedLocale,
} from "@/lib/forms/i18n";

type FormRendererProps = {
  form: PublicFormDefinition;
};

export function FormRenderer({ form }: FormRendererProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  const messages = getChromeMessages(locale);
  const localizedFields = useMemo(
    () => form.fields.map((field) => getLocalizedField(form, field, locale)),
    [form, locale],
  );
  const localizedTitle = getLocalizedFormName(form, locale);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const response = await fetch(`/forms/${form.slug}/submit`, {
        method: "POST",
        body: formData,
      });

      const result = (await response.json()) as {
        ok: boolean;
        error?: string;
        fieldErrors?: Record<string, string>;
        redirectTo?: string;
      };

      if (!result.ok) {
        setError(result.error ?? messages.errorFallback);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.push((result.redirectTo ?? "/submission-success") as Route);
    });
  }

  return (
    <section className="relative grid w-full gap-4 sm:gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <FloatingLocaleSwitcher
        enLabel={messages.enLabel}
        label={messages.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel={messages.zhLabel}
      />

      <div className="rounded-[28px] bg-[linear-gradient(160deg,#14532d,#1f2937)] px-5 py-6 text-white shadow-panel sm:rounded-[36px] sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-300">
          {form.theme.brandName}
        </p>
        <h1 className="mt-5 font-heading text-3xl font-bold leading-[1.25] tracking-[0.01em] sm:text-5xl">
          {localizedTitle}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
          {messages.brandIntro}
        </p>
      </div>

      <div className="rounded-[28px] border border-amber-100/80 bg-white/92 p-4 shadow-panel backdrop-blur sm:rounded-[36px] sm:p-8">
        <form
          action={handleSubmit}
          className="grid gap-4 sm:gap-5"
          encType="multipart/form-data"
        >
          {localizedFields.map((field) => (
            <PublicField
              key={field.id}
              chooseFileText={messages.chooseFile}
              chooseText={messages.choose}
              field={field}
              locale={locale}
              requiredText={messages.requiredMark}
              uploadHintText={messages.uploadHint}
              error={fieldErrors[field.fieldKey]}
            />
          ))}

          {error ? (
            <p className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            className="mt-3 min-h-12 rounded-[18px] border border-emerald-800 bg-emerald-700 px-6 py-3 text-[15px] font-semibold tracking-[0.08em] text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-14"
            disabled={isPending}
            type="submit"
          >
            {isPending ? messages.submitting : messages.submit}
          </button>
        </form>
      </div>
    </section>
  );
}
