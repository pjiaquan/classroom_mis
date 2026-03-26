"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClassWithSchedule } from "@/lib/db/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type Props = {
  classes: ClassWithSchedule[];
  formatDay: (day: number) => string;
};

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    tag: "內部管理",
    title: "點名系統",
    body: "選擇班級進行點名或查看過往記錄。",
    takeAttendance: "今日點名",
    viewHistory: "查看記錄",
    noClasses: "目前沒有開放的班級",
    capacity: "人數",
    schedule: "時間",
    room: "教室",
    closed: "已結束",
    open: "報名中",
    full: "已額滿",
  },
  en: {
    languageLabel: "Language",
    tag: "Admin",
    title: "Attendance",
    body: "Select a class to take attendance or view history.",
    takeAttendance: "Take Attendance",
    viewHistory: "View History",
    noClasses: "No open classes",
    capacity: "Capacity",
    schedule: "Time",
    room: "Room",
    closed: "Closed",
    open: "Open",
    full: "Full",
  },
} as const;

export function AdminAttendanceShell({ classes, formatDay }: Props) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const router = useRouter();
  const t = copy[locale];

  const handleTakeAttendance = async (classId: number) => {
    router.push(`/admin/attendance/sessions/new?classId=${classId}`);
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
      </header>

      {classes.length === 0 ? (
        <div className="rounded-[28px] border border-amber-100 bg-white/95 px-5 py-12 text-center shadow-panel">
          <p className="text-stone-500">{t.noClasses}</p>
        </div>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <article
              key={cls.id}
              className="rounded-[28px] border border-amber-100 bg-white/95 p-5 shadow-panel sm:p-6"
            >
              <div className="mb-4 space-y-2">
                <div className="flex items-start justify-between">
                  <h2 className="font-heading text-xl font-bold leading-[1.3] tracking-[0.01em] text-stone-900">
                    {cls.class_name}
                  </h2>
                  <span
                    className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      cls.status === "open"
                        ? "bg-emerald-100 text-emerald-700"
                        : cls.status === "full"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {cls.status === "open"
                      ? t.open
                      : cls.status === "full"
                        ? t.full
                        : t.closed}
                  </span>
                </div>
                <p className="text-sm text-stone-500">{cls.class_code}</p>
              </div>

              <div className="mb-4 space-y-1.5 text-sm text-stone-600">
                <p className="flex items-center gap-2">
                  <span className="font-medium">{formatDay(cls.day_of_week)}</span>
                  <span>
                    {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                  </span>
                </p>
                {cls.room && (
                  <p>
                    {t.room}: {cls.room}
                  </p>
                )}
                <p>
                  {t.capacity}: {cls.capacity}
                  {cls.max_capacity && cls.max_capacity > cls.capacity && (
                    <span className="ml-1 text-stone-400">
                      (上限 {cls.max_capacity})
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleTakeAttendance(cls.id)}
                  className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-emerald-700 transition hover:bg-emerald-100"
                >
                  {t.takeAttendance}
                </button>
                <Link
                  href={`/admin/attendance/${cls.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-[16px] border border-amber-200 bg-amber-50/70 px-4 py-2 text-sm font-semibold tracking-[0.06em] text-stone-600 transition hover:bg-amber-100"
                >
                  {t.viewHistory}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
