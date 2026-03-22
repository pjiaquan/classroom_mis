"use client";

import { type SupportedLocale } from "@/lib/forms/i18n";

type FloatingLocaleSwitcherProps = {
  locale: SupportedLocale;
  label: string;
  zhLabel: string;
  enLabel: string;
  onChange: (locale: SupportedLocale) => void;
};

export function FloatingLocaleSwitcher({
  locale,
  label,
  zhLabel,
  enLabel,
  onChange,
}: FloatingLocaleSwitcherProps) {
  return (
    <div className="pointer-events-auto fixed bottom-3 right-3 z-30 sm:bottom-6 sm:right-6">
      <div className="flex items-center gap-1 rounded-[18px] border border-amber-200/80 bg-white/95 p-1 shadow-panel backdrop-blur sm:rounded-[22px] sm:p-1.5">
        <span className="hidden px-2.5 text-[11px] font-semibold tracking-[0.12em] text-stone-500 sm:inline">
          {label}
        </span>
        <button
          className={`rounded-[14px] px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition sm:px-3.5 sm:py-2 sm:text-[12px] ${
            locale === "zh-TW"
              ? "bg-stone-900 text-white shadow-sm"
              : "text-stone-600 hover:bg-amber-50"
          }`}
          onClick={() => onChange("zh-TW")}
          type="button"
        >
          {zhLabel}
        </button>
        <button
          className={`rounded-[14px] px-2.5 py-1.5 text-[11px] font-semibold tracking-[0.08em] transition sm:px-3.5 sm:py-2 sm:text-[12px] ${
            locale === "en"
              ? "bg-stone-900 text-white shadow-sm"
              : "text-stone-600 hover:bg-amber-50"
          }`}
          onClick={() => onChange("en")}
          type="button"
        >
          {enLabel}
        </button>
      </div>
    </div>
  );
}
