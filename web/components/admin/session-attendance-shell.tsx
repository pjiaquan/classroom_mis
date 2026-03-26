"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import type { ClassSession, EnrollmentStudent, StudentAttendance } from "@/lib/db/types";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type StudentWithAttendance = EnrollmentStudent & {
  attendance: StudentAttendance | null;
};

type Props = {
  sessionId: number;
  session: ClassSession;
  students: StudentWithAttendance[];
  backHref: Route;
};

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    back: "返回",
    title: "點名",
    sessionDate: "日期",
    topic: "主題",
    topicPlaceholder: "輸入本次上課主題...",
    saveTopic: "儲存",
    student: "學生",
    grade: "年級",
    status: "狀態",
    present: "出席",
    leave: "請假",
    absent: "缺席",
    unmarked: "未點名",
    unmarkedHint: "點擊按鈕標記",
    saveAll: "儲存全部",
    saved: "已儲存",
    closeSession: "結束點名",
    closed: "已結束",
    open: "進行中",
    noStudents: "目前沒有學生報名此班級",
    closeConfirm: "結束點名後將無法再修改，確定要結束嗎？",
  },
  en: {
    languageLabel: "Language",
    back: "Back",
    title: "Attendance",
    sessionDate: "Date",
    topic: "Topic",
    topicPlaceholder: "Enter today's topic...",
    saveTopic: "Save",
    student: "Student",
    grade: "Grade",
    status: "Status",
    present: "Present",
    leave: "Leave",
    absent: "Absent",
    unmarked: "Unmarked",
    unmarkedHint: "Click to mark",
    saveAll: "Save All",
    saved: "Saved",
    closeSession: "Close Attendance",
    closed: "Closed",
    open: "Open",
    noStudents: "No students enrolled",
    closeConfirm: "Closing attendance will prevent further changes. Continue?",
  },
} as const;

type AttendanceStatus = "present" | "leave" | "absent";

function getStatusColor(status: AttendanceStatus | null): string {
  switch (status) {
    case "present":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "leave":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "absent":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-stone-100 text-stone-500 border-stone-200";
  }
}

export function SessionAttendanceShell({ sessionId, session, students, backHref }: Props) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const router = useRouter();
  const t = copy[locale];

  const [localStudents, setLocalStudents] = useState<StudentWithAttendance[]>(students);
  const [topic, setTopic] = useState(session.topic ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [closing, setClosing] = useState(false);

  const handleStatusChange = (
    studentId: number,
    status: AttendanceStatus,
  ) => {
    setLocalStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? {
              ...s,
              attendance: {
                id: s.attendance?.id ?? 0,
                session_id: sessionId,
                student_id: studentId,
                student_code: s.student_code,
                full_name: s.full_name,
                grade: s.grade,
                status,
                marked_at: new Date(),
                notes: s.attendance?.notes ?? null,
              },
            }
          : s,
      ),
    );
    setSaved(false);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      for (const student of localStudents) {
        if (student.attendance) {
          await fetch("/api/attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              studentId: student.student_id,
              status: student.attendance.status,
              notes: student.attendance.notes,
            }),
          });
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const saveTopic = async () => {
    await fetch("/api/attendance/topic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, topic }),
    });
  };

  const closeSession = async () => {
    if (!window.confirm(t.closeConfirm)) return;
    setClosing(true);
    try {
      await fetch("/api/attendance/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      router.push(`/admin/attendance/${session.class_id}`);
    } finally {
      setClosing(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
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
          href={backHref}
          className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium tracking-[0.06em] text-stone-600 transition hover:bg-stone-50"
        >
          ← {t.back}
        </Link>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              session.status === "closed"
                ? "bg-stone-100 text-stone-600"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {session.status === "closed" ? t.closed : t.open}
          </span>
        </div>
      </div>

      <header className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(240,253,250,0.92))] px-5 py-6 shadow-panel backdrop-blur sm:px-8 sm:py-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-800">
              {t.title}
            </p>
            <h1 className="font-heading text-2xl font-bold leading-[1.25] tracking-[0.01em] text-stone-900 sm:text-3xl">
              {session.class_name}
            </h1>
            <p className="mt-1 text-sm text-stone-500">{session.class_code}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
            <p>
              <span className="font-medium">{t.sessionDate}:</span>{" "}
              {formatDate(session.session_date)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="flex-1 rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <button
              onClick={saveTopic}
              className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium tracking-[0.06em] text-stone-600 transition hover:bg-stone-50"
            >
              {t.saveTopic}
            </button>
          </div>
        </div>
      </header>

      <section className="rounded-[28px] border border-amber-100 bg-white/95 p-5 shadow-panel sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-stone-800">
          {t.student} ({localStudents.length})
        </h2>

        {localStudents.length === 0 ? (
          <p className="py-8 text-center text-stone-500">{t.noStudents}</p>
        ) : (
          <div className="space-y-3">
            {localStudents.map((student) => (
              <div
                key={student.student_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-stone-100 bg-stone-50/50 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-stone-800">{student.full_name}</p>
                  <p className="text-sm text-stone-500">{student.grade}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleStatusChange(student.student_id, "present")
                    }
                    className={`min-h-10 shrink-0 rounded-[14px] border px-4 py-2 text-sm font-medium transition ${
                      student.attendance?.status === "present"
                        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-emerald-50"
                    }`}
                  >
                    {t.present}
                  </button>
                  <button
                    onClick={() => handleStatusChange(student.student_id, "leave")}
                    className={`min-h-10 shrink-0 rounded-[14px] border px-4 py-2 text-sm font-medium transition ${
                      student.attendance?.status === "leave"
                        ? "border-amber-300 bg-amber-100 text-amber-700"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-amber-50"
                    }`}
                  >
                    {t.leave}
                  </button>
                  <button
                    onClick={() =>
                      handleStatusChange(student.student_id, "absent")
                    }
                    className={`min-h-10 shrink-0 rounded-[14px] border px-4 py-2 text-sm font-medium transition ${
                      student.attendance?.status === "absent"
                        ? "border-red-300 bg-red-100 text-red-700"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-red-50"
                    }`}
                  >
                    {t.absent}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {session.status !== "closed" && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={saveAttendance}
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold tracking-[0.08em] text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {saving ? "..." : saved ? t.saved : t.saveAll}
          </button>

          <button
            onClick={closeSession}
            disabled={closing}
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-stone-300 bg-stone-100 px-6 py-3 text-sm font-semibold tracking-[0.08em] text-stone-600 transition hover:bg-stone-200 disabled:opacity-50"
          >
            {closing ? "..." : t.closeSession}
          </button>
        </div>
      )}
    </main>
  );
}
