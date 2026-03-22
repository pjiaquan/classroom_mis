"use client";

import Link from "next/link";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

export default function AdminAuthPage() {
  const { locale, setLocale } = usePreferredLocale("zh-TW");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6 sm:py-16">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label="語言"
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <section className="w-full rounded-[28px] border border-amber-100 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(255,255,255,0.94))] p-6 shadow-panel sm:rounded-[32px] sm:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
          內部登入
        </p>
        <h1 className="mt-4 font-heading text-3xl font-bold leading-[1.25] tracking-[0.01em] text-stone-950 sm:text-4xl">
          請先登入管理介面
        </h1>
        <p className="mt-4 text-[15px] leading-8 text-stone-700">
          這個入口僅供內部人員使用。請輸入管理帳號與密碼後再進入表單管理區。
        </p>

        <form
          action="/admin-auth/login"
          className="mt-8 grid gap-4"
          method="post"
        >
          <label className="grid gap-2 text-sm font-medium text-stone-800">
            管理帳號
            <input
              className="min-h-11 rounded-[16px] border border-amber-200 bg-white px-4 py-2 text-sm text-stone-900 outline-none ring-0 transition focus:border-emerald-500"
              name="username"
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-stone-800">
            管理密碼
            <input
              className="min-h-11 rounded-[16px] border border-amber-200 bg-white px-4 py-2 text-sm text-stone-900 outline-none ring-0 transition focus:border-emerald-500"
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-[16px] border border-emerald-800 bg-emerald-700 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-white transition hover:bg-emerald-800"
            type="submit"
          >
            登入管理介面
          </button>
        </form>

        <Link
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-[14px] border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-700"
          href="/"
        >
          返回首頁
        </Link>
      </section>
    </main>
  );
}
