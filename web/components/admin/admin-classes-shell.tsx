"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Class } from "@/lib/db/class";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type Props = {
  classes: Class[];
};

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "內部管理",
    title: "班級管理",
    body: "管理所有班級資訊，包括老師、課表、教室等。",
    newClass: "新增班級",
    edit: "編輯",
    delete: "刪除",
    confirmDelete: "確定要刪除這個班級嗎？",
    noClasses: "目前沒有班級",
    className: "班級名稱",
    teacher: "老師",
    schedule: "時間",
    room: "教室",
    capacity: "人數",
    status: "狀態",
    open: "開放",
    full: "已額滿",
    closed: "已結束",
    dayOfWeek: "星期",
  },
  en: {
    languageLabel: "Language",
    tag: "Admin",
    title: "Class Management",
    body: "Manage all class information including teachers, schedules, and rooms.",
    newClass: "New Class",
    edit: "Edit",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this class?",
    noClasses: "No classes yet",
    className: "Class Name",
    teacher: "Teacher",
    schedule: "Time",
    room: "Room",
    capacity: "Capacity",
    status: "Status",
    open: "Open",
    full: "Full",
    closed: "Closed",
    dayOfWeek: "Day",
  },
} as const;

function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-emerald-100 text-emerald-700";
    case "full":
      return "bg-amber-100 text-amber-700";
    case "closed":
      return "bg-stone-100 text-stone-600";
    default:
      return "bg-stone-100 text-stone-600";
  }
}

export function AdminClassesShell({ classes }: Props) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const router = useRouter();
  const t = copy[locale];

  const handleDelete = async (id: number) => {
    if (!window.confirm(t.confirmDelete)) return;

    try {
      const res = await fetch(`/api/admin/classes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to delete class:", error);
    }
  };

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
            href="/admin/classes/new"
          >
            {t.newClass}
          </Link>
        </div>
      </header>

      {classes.length === 0 ? (
        <div className="rounded-[28px] border border-amber-100 bg-white/95 px-5 py-12 text-center shadow-panel">
          <p className="text-stone-500">{t.noClasses}</p>
        </div>
      ) : (
        <section className="overflow-hidden rounded-[28px] border border-amber-100 bg-white/95 shadow-panel">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/50">
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.className}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.dayOfWeek}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.schedule}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.teacher}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.room}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.capacity}
                </th>
                <th className="px-5 py-4 text-left text-sm font-semibold text-stone-600">
                  {t.status}
                </th>
                <th className="px-5 py-4 text-right text-sm font-semibold text-stone-600">
                  {t.edit}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {classes.map((cls) => (
                <tr key={cls.id} className="group">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-medium text-stone-800">{cls.class_name}</p>
                      <p className="text-sm text-stone-500">{cls.class_code}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {cls.day_of_week != null
                      ? DAY_NAMES[cls.day_of_week] ?? `Day ${cls.day_of_week}`
                      : "-"}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {cls.start_time && cls.end_time
                      ? `${cls.start_time.slice(0, 5)} - ${cls.end_time.slice(0, 5)}`
                      : cls.schedule_text}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {cls.teacher_name}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {cls.room || "-"}
                  </td>
                  <td className="px-5 py-4 text-sm text-stone-600">
                    {cls.capacity}
                    {cls.max_capacity && cls.max_capacity > cls.capacity && (
                      <span className="ml-1 text-stone-400">
                        (上限 {cls.max_capacity})
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(cls.status)}`}
                    >
                      {cls.status === "open"
                        ? t.open
                        : cls.status === "full"
                          ? t.full
                          : t.closed}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/classes/${cls.id}`}
                        className="inline-flex min-h-9 items-center justify-center rounded-[12px] border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs font-medium tracking-[0.06em] text-stone-600 transition hover:bg-amber-100"
                      >
                        {t.edit}
                      </Link>
                      <button
                        onClick={() => handleDelete(cls.id)}
                        className="inline-flex min-h-9 items-center justify-center rounded-[12px] border border-red-200 bg-red-50/70 px-4 py-2 text-xs font-medium tracking-[0.06em] text-red-600 transition hover:bg-red-100"
                      >
                        {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
