"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClassSession, ClassDetails } from "@/lib/db/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
function formatDayOfWeek(day: number): string {
  return DAY_NAMES[day] ?? `Day ${day}`;
}

type Props = {
  sessions: ClassSession[];
  classDetails: ClassDetails;
};

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    back: "返回",
    title: "班級點名記錄",
    takeAttendance: "今日點名",
    sessionDate: "日期",
    topic: "主題",
    status: "狀態",
    attendance: "點名",
    viewAttendance: "查看",
    noSessions: "尚無點名記錄",
    closed: "已結束",
    open: "進行中",
  },
  en: {
    languageLabel: "Language",
    back: "Back",
    title: "Class Attendance History",
    takeAttendance: "Take Today's Attendance",
    sessionDate: "Date",
    topic: "Topic",
    status: "Status",
    attendance: "Attendance",
    viewAttendance: "View",
    noSessions: "No attendance sessions yet",
    closed: "Closed",
    open: "Open",
  },
} as const;

export function ClassHistoryShell({ sessions, classDetails }: Props) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const router = useRouter();
  const t = copy[locale];

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    });
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <FloatingLocaleSwitcher
        enLabel="EN"
        label={t.languageLabel}
        locale={locale}
        onChange={setLocale}
        zhLabel="繁中"
      />

      <div className="flex items-center justify-between">
        <Link
          href="/admin/attendance"
          className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium tracking-[0.06em] text-stone-600 transition hover:bg-stone-50"
        >
          ← {t.back}
        </Link>
      </div>

      <header className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(240,253,250,0.92))] px-5 py-6 shadow-panel backdrop-blur sm:px-8 sm:py-6">
        <div className="mb-4 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
            {t.title}
          </p>
          <h1 className="font-heading text-2xl font-bold leading-[1.25] tracking-[0.01em] text-stone-900 sm:text-3xl">
            {classDetails.class_name}
          </h1>
          <p className="text-sm text-stone-500">{classDetails.class_code}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
          <p>
            {formatDayOfWeek(classDetails.day_of_week)}{" "}
            {classDetails.start_time.slice(0, 5)} - {classDetails.end_time.slice(0, 5)}
          </p>
          {classDetails.room && <p>{classDetails.room}</p>}
          <p>
            {t.attendance}: {sessions.length} {t.sessionDate}
          </p>
        </div>

        <button
          onClick={() =>
            router.push(
              `/admin/attendance/sessions/new?classId=${classDetails.id}`,
            )
          }
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold tracking-[0.06em] text-emerald-700 transition hover:bg-emerald-100"
        >
          {t.takeAttendance}
        </button>
      </header>

      <section className="rounded-[28px] border border-amber-100 bg-white/95 p-5 shadow-panel sm:p-6">
        {sessions.length === 0 ? (
          <p className="py-8 text-center text-stone-500">{t.noSessions}</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-stone-100 bg-stone-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-800">
                    {formatDate(session.session_date)}
                  </p>
                  {session.topic && (
                    <p className="mt-0.5 text-sm text-stone-500">
                      {t.topic}: {session.topic}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      session.status === "closed"
                        ? "bg-stone-100 text-stone-600"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {session.status === "closed" ? t.closed : t.open}
                  </span>

                  <Link
                    href={`/admin/attendance/sessions/${session.id}?classId=${classDetails.id}`}
                    className="inline-flex min-h-9 items-center justify-center rounded-[12px] border border-amber-200 bg-amber-50/70 px-4 py-2 text-xs font-medium tracking-[0.06em] text-stone-600 transition hover:bg-amber-100"
                  >
                    {t.viewAttendance}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
