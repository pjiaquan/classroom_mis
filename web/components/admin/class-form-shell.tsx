"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Class, Teacher, Subject } from "@/lib/db/class";
import { FloatingLocaleSwitcher } from "@/components/shared/floating-locale-switcher";
import { usePreferredLocale } from "@/components/shared/use-preferred-locale";

type Props =
  | {
      mode: "create";
      teachers: Teacher[];
      subjects: Subject[];
      classId?: never;
      cls?: never;
    }
  | {
      mode: "edit";
      classId: number;
      cls: Class;
      teachers: Teacher[];
      subjects: Subject[];
    };

const DAY_OPTIONS = [
  { value: 0, label: "週日 (星期日)" },
  { value: 1, label: "週一 (星期一)" },
  { value: 2, label: "週二 (星期二)" },
  { value: 3, label: "週三 (星期三)" },
  { value: 4, label: "週四 (星期四)" },
  { value: 5, label: "週五 (星期五)" },
  { value: 6, label: "週六 (星期六)" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "開放 (Open)" },
  { value: "full", label: "已額滿 (Full)" },
  { value: "closed", label: "已結束 (Closed)" },
];

const copy = {
  "zh-TW": {
    languageLabel: "語言",
    back: "返回",
    createTitle: "新增班級",
    editTitle: "編輯班級",
    classCode: "班級代碼",
    classCodePlaceholder: "例如: CLS-001",
    className: "班級名稱",
    classNamePlaceholder: "例如: 國小數學培訓班",
    teacher: "老師",
    selectTeacher: "選擇老師",
    noTeacher: "無",
    subject: "科目",
    selectSubject: "選擇科目",
    noSubject: "無",
    dayOfWeek: "上課日",
    selectDay: "選擇星期",
    startTime: "開始時間",
    endTime: "結束時間",
    room: "教室",
    roomPlaceholder: "例如: Room A",
    capacity: "目前人數上限",
    maxCapacity: "最大容納人數",
    scheduleText: "課表文字",
    scheduleTextPlaceholder: "例如: Tue 19:00-21:00",
    status: "狀態",
    startDate: "開始日期",
    endDate: "結束日期",
    notes: "備註",
    notesPlaceholder: "額外說明...",
    save: "儲存",
    saving: "儲存中...",
    saved: "已儲存",
    cancel: "取消",
    codeRequired: "班級代碼必填",
    nameRequired: "班級名稱必填",
    scheduleRequired: "課表文字必填",
    capacityRequired: "人數必填",
    capacityPositive: "人數必須大於 0",
    codeExists: "此代碼已存在",
  },
  en: {
    languageLabel: "Language",
    back: "Back",
    createTitle: "Create Class",
    editTitle: "Edit Class",
    classCode: "Class Code",
    classCodePlaceholder: "e.g., CLS-001",
    className: "Class Name",
    classNamePlaceholder: "e.g., Primary Math Class",
    teacher: "Teacher",
    selectTeacher: "Select Teacher",
    noTeacher: "None",
    subject: "Subject",
    selectSubject: "Select Subject",
    noSubject: "None",
    dayOfWeek: "Day of Week",
    selectDay: "Select Day",
    startTime: "Start Time",
    endTime: "End Time",
    room: "Room",
    roomPlaceholder: "e.g., Room A",
    capacity: "Capacity",
    maxCapacity: "Max Capacity",
    scheduleText: "Schedule Text",
    scheduleTextPlaceholder: "e.g., Tue 19:00-21:00",
    status: "Status",
    startDate: "Start Date",
    endDate: "End Date",
    notes: "Notes",
    notesPlaceholder: "Additional notes...",
    save: "Save",
    saving: "Saving...",
    saved: "Saved",
    cancel: "Cancel",
    codeRequired: "Class code is required",
    nameRequired: "Class name is required",
    scheduleRequired: "Schedule text is required",
    capacityRequired: "Capacity is required",
    capacityPositive: "Capacity must be greater than 0",
    codeExists: "This code already exists",
  },
} as const;

export function ClassFormShell(props: Props) {
  const { locale, setLocale } = usePreferredLocale("zh-TW");
  const router = useRouter();
  const t = copy[locale];

  const isEdit = props.mode === "edit";

  const [formData, setFormData] = useState({
    class_code: isEdit ? props.cls.class_code : "",
    class_name: isEdit ? props.cls.class_name : "",
    teacher_id: isEdit ? props.cls.teacher_id : null,
    subject_id: isEdit ? props.cls.subject_id : null,
    day_of_week: isEdit ? props.cls.day_of_week : null,
    start_time: isEdit && props.cls.start_time ? props.cls.start_time.slice(0, 5) : "",
    end_time: isEdit && props.cls.end_time ? props.cls.end_time.slice(0, 5) : "",
    room: isEdit ? (props.cls.room ?? "") : "",
    capacity: isEdit ? props.cls.capacity : 10,
    max_capacity: isEdit && props.cls.max_capacity ? props.cls.max_capacity : null as number | null,
    schedule_text: isEdit ? props.cls.schedule_text : "",
    status: isEdit ? props.cls.status : "open",
    start_date: isEdit && props.cls.start_date
      ? new Date(props.cls.start_date).toISOString().split("T")[0]
      : "",
    end_date: isEdit && props.cls.end_date
      ? new Date(props.cls.end_date).toISOString().split("T")[0]
      : "",
    notes: isEdit ? (props.cls.notes ?? "") : "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.class_code.trim()) {
      newErrors.class_code = t.codeRequired;
    }
    if (!formData.class_name.trim()) {
      newErrors.class_name = t.nameRequired;
    }
    if (!formData.schedule_text.trim()) {
      newErrors.schedule_text = t.scheduleRequired;
    }
    if (!formData.capacity || formData.capacity <= 0) {
      newErrors.capacity = t.capacityPositive;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/classes/${props.classId}`
        : "/api/admin/classes";

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => {
          router.push("/admin/classes");
        }, 1000);
      } else if (res.status === 400) {
        const data = await res.json();
        if (data.error === "Class code already exists") {
          setErrors({ class_code: t.codeExists });
        } else {
          setErrors({ submit: data.error });
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof typeof formData>(
    field: K,
    value: (typeof formData)[K],
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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
          href="/admin/classes"
          className="inline-flex min-h-10 items-center justify-center rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2 text-sm font-medium tracking-[0.06em] text-stone-600 transition hover:bg-stone-50"
        >
          ← {t.back}
        </Link>
      </div>

      <header className="rounded-[28px] border border-amber-200/80 bg-[linear-gradient(145deg,rgba(255,251,235,0.96),rgba(240,253,250,0.92))] px-5 py-6 shadow-panel backdrop-blur sm:px-8 sm:py-6">
        <h1 className="font-heading text-2xl font-bold leading-[1.25] tracking-[0.01em] text-stone-900 sm:text-3xl">
          {isEdit ? t.editTitle : t.createTitle}
        </h1>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-amber-100 bg-white/95 p-5 shadow-panel sm:p-8"
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Class Code */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.classCode} *
            </label>
            <input
              type="text"
              value={formData.class_code}
              onChange={(e) => updateField("class_code", e.target.value)}
              placeholder={t.classCodePlaceholder}
              className={`w-full rounded-[14px] border bg-white/80 px-4 py-2.5 text-sm transition ${
                errors.class_code
                  ? "border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  : "border-stone-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              }`}
            />
            {errors.class_code && (
              <p className="mt-1 text-xs text-red-600">{errors.class_code}</p>
            )}
          </div>

          {/* Class Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.className} *
            </label>
            <input
              type="text"
              value={formData.class_name}
              onChange={(e) => updateField("class_name", e.target.value)}
              placeholder={t.classNamePlaceholder}
              className={`w-full rounded-[14px] border bg-white/80 px-4 py-2.5 text-sm transition ${
                errors.class_name
                  ? "border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  : "border-stone-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              }`}
            />
            {errors.class_name && (
              <p className="mt-1 text-xs text-red-600">{errors.class_name}</p>
            )}
          </div>

          {/* Teacher */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.teacher}
            </label>
            <select
              value={formData.teacher_id ?? ""}
              onChange={(e) =>
                updateField("teacher_id", e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">{t.noTeacher}</option>
              {props.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.subject}
            </label>
            <select
              value={formData.subject_id ?? ""}
              onChange={(e) =>
                updateField("subject_id", e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">{t.noSubject}</option>
              {props.subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.subject_name}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.dayOfWeek}
            </label>
            <select
              value={formData.day_of_week ?? ""}
              onChange={(e) =>
                updateField("day_of_week", e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">{t.selectDay}</option>
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.status}
            </label>
            <select
              value={formData.status}
              onChange={(e) => updateField("status", e.target.value)}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.startTime}
            </label>
            <input
              type="time"
              value={formData.start_time}
              onChange={(e) => updateField("start_time", e.target.value)}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.endTime}
            </label>
            <input
              type="time"
              value={formData.end_time}
              onChange={(e) => updateField("end_time", e.target.value)}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Room */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.room}
            </label>
            <input
              type="text"
              value={formData.room}
              onChange={(e) => updateField("room", e.target.value)}
              placeholder={t.roomPlaceholder}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Capacity */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.capacity} *
            </label>
            <input
              type="number"
              min="1"
              value={formData.capacity}
              onChange={(e) => updateField("capacity", Number(e.target.value))}
              className={`w-full rounded-[14px] border bg-white/80 px-4 py-2.5 text-sm transition ${
                errors.capacity
                  ? "border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                  : "border-stone-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              }`}
            />
            {errors.capacity && (
              <p className="mt-1 text-xs text-red-600">{errors.capacity}</p>
            )}
          </div>

          {/* Max Capacity */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.maxCapacity}
            </label>
            <input
              type="number"
              min="1"
              value={formData.max_capacity ?? ""}
              onChange={(e) =>
                updateField("max_capacity", e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.startDate}
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField("start_date", e.target.value)}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              {t.endDate}
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => updateField("end_date", e.target.value)}
              className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        {/* Schedule Text - full width */}
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            {t.scheduleText} *
          </label>
          <input
            type="text"
            value={formData.schedule_text}
            onChange={(e) => updateField("schedule_text", e.target.value)}
            placeholder={t.scheduleTextPlaceholder}
            className={`w-full rounded-[14px] border bg-white/80 px-4 py-2.5 text-sm transition ${
              errors.schedule_text
                ? "border-red-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                : "border-stone-200 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            }`}
          />
          {errors.schedule_text && (
            <p className="mt-1 text-xs text-red-600">{errors.schedule_text}</p>
          )}
        </div>

        {/* Notes - full width */}
        <div className="mt-6">
          <label className="mb-1.5 block text-sm font-medium text-stone-700">
            {t.notes}
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder={t.notesPlaceholder}
            rows={3}
            className="w-full rounded-[14px] border border-stone-200 bg-white/80 px-4 py-2.5 text-sm transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {errors.submit && (
          <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errors.submit}
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-4">
          <Link
            href="/admin/classes"
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-stone-200 bg-white/80 px-6 py-3 text-sm font-medium tracking-[0.08em] text-stone-600 transition hover:bg-stone-50"
          >
            {t.cancel}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold tracking-[0.08em] text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
          >
            {saving ? t.saving : saved ? t.saved : t.save}
          </button>
        </div>
      </form>
    </main>
  );
}
