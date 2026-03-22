"use client";

import { useId, useState } from "react";
import { type PublicFormField } from "@/lib/forms/types";
import { type SupportedLocale } from "@/lib/forms/i18n";

type PublicFieldProps = {
  field: PublicFormField;
  locale: SupportedLocale;
  chooseText: string;
  chooseFileText: string;
  uploadHintText: string;
  requiredText: string;
  error?: string;
};

export function PublicField({
  field,
  locale,
  chooseText,
  chooseFileText,
  uploadHintText,
  requiredText,
  error,
}: PublicFieldProps) {
  const id = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const baseClassName =
    "w-full min-h-12 rounded-[18px] border border-amber-150 bg-white px-4 py-3 text-[15px] text-stone-900 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 sm:min-h-[54px]";

  return (
    <div className="grid gap-2.5">
      <label
        className="flex flex-wrap items-center gap-2 text-[15px] font-semibold tracking-[0.01em] text-slate-800"
        htmlFor={id}
      >
        {field.label}
        {field.isRequired ? (
          <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-rose-700">
            {requiredText}
          </span>
        ) : null}
      </label>

      {field.fieldType === "textarea" ? (
        <textarea
          className={baseClassName}
          defaultValue={field.defaultValue ?? ""}
          id={id}
          name={field.fieldKey}
          placeholder={field.placeholder ?? ""}
          rows={Number(field.ui.rows ?? 4)}
        />
      ) : null}

      {field.fieldType === "select" ? (
        <select
          className={baseClassName}
          defaultValue={field.defaultValue ?? ""}
          id={id}
          lang={locale}
          name={field.fieldKey}
        >
          <option value="">{chooseText}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}

      {field.fieldType === "radio" ? (
        <div className="grid gap-2">
          {field.options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-3 rounded-[18px] border border-amber-150 px-4 py-3 text-[15px] text-stone-700 transition hover:border-emerald-200 hover:bg-emerald-50/40"
            >
              <input
                defaultChecked={field.defaultValue === option.value}
                name={field.fieldKey}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}

      {field.fieldType === "image" || field.fieldType === "file" ? (
        <label className="grid cursor-pointer gap-3 rounded-[22px] border border-dashed border-amber-300 bg-amber-50/40 px-4 py-5 text-sm text-stone-600 transition hover:border-emerald-300 hover:bg-emerald-50/50">
          <input
            accept={typeof field.ui.accept === "string" ? field.ui.accept : undefined}
            className="hidden"
            id={id}
            name={field.fieldKey}
            onChange={(event) =>
              setFileName(event.currentTarget.files?.[0]?.name ?? null)
            }
            type="file"
          />
          <span className="text-[15px] font-semibold tracking-[0.01em] text-slate-800">
            {fileName ?? chooseFileText}
          </span>
          <span>{uploadHintText}</span>
        </label>
      ) : null}

      {field.fieldType !== "textarea" &&
      field.fieldType !== "select" &&
      field.fieldType !== "radio" &&
      field.fieldType !== "image" &&
      field.fieldType !== "file" ? (
        <input
          className={baseClassName}
          defaultValue={field.defaultValue ?? ""}
          id={id}
          name={field.fieldKey}
          placeholder={field.placeholder ?? ""}
          type={
            field.fieldType === "phone"
              ? "tel"
              : field.fieldType === "checkbox"
                ? "checkbox"
                : field.fieldType
          }
        />
      ) : null}

      {field.helpText ? (
        <p className="text-sm leading-7 text-slate-500">{field.helpText}</p>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
