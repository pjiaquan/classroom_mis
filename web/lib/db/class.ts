import { query } from "@/lib/db/client";
import type { ClassWithSchedule } from "@/lib/db/types";

export type Class = {
  id: number;
  class_code: string;
  class_name: string;
  teacher_name: string;
  teacher_id: number | null;
  subject_id: number | null;
  schedule_text: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  capacity: number;
  max_capacity: number | null;
  status: string;
  start_date: Date | null;
  end_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export type Teacher = {
  id: number;
  teacher_code: string;
  full_name: string;
};

export type Subject = {
  id: number;
  subject_code: string;
  subject_name: string;
};

export type ClassFormData = {
  class_name: string;
  class_code: string;
  teacher_id: number | null;
  subject_id: number | null;
  schedule_text: string;
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  capacity: number;
  max_capacity: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
};

export async function getClasses(): Promise<Class[]> {
  const { rows } = await query<Class>(`
    SELECT
      c.id,
      c.class_code,
      c.class_name,
      c.teacher_name,
      c.teacher_id,
      c.subject_id,
      c.schedule_text,
      c.day_of_week,
      c.start_time::text,
      c.end_time::text,
      c.room,
      c.capacity,
      c.max_capacity,
      c.status,
      c.start_date,
      c.end_date,
      c.notes,
      c.created_at,
      c.updated_at
    FROM classes c
    ORDER BY c.day_of_week, c.start_time
  `);
  return rows;
}

export async function getClassById(id: number): Promise<Class | null> {
  const { rows } = await query<Class>(`
    SELECT
      c.id,
      c.class_code,
      c.class_name,
      c.teacher_name,
      c.teacher_id,
      c.subject_id,
      c.schedule_text,
      c.day_of_week,
      c.start_time::text,
      c.end_time::text,
      c.room,
      c.capacity,
      c.max_capacity,
      c.status,
      c.start_date,
      c.end_date,
      c.notes,
      c.created_at,
      c.updated_at
    FROM classes c
    WHERE c.id = $1
  `, [id]);
  return rows[0] ?? null;
}

export async function getTeachers(): Promise<Teacher[]> {
  const { rows } = await query<Teacher>(`
    SELECT id, teacher_code, full_name
    FROM teachers
    WHERE status = 'active'
    ORDER BY full_name
  `);
  return rows;
}

export async function getSubjects(): Promise<Subject[]> {
  const { rows } = await query<Subject>(`
    SELECT id, subject_code, subject_name
    FROM subjects
    WHERE status = 'active'
    ORDER BY subject_name
  `);
  return rows;
}

export async function createClass(data: ClassFormData): Promise<number> {
  const { rows } = await query<{ id: number }>(`
    INSERT INTO classes (
      class_code,
      class_name,
      teacher_name,
      teacher_id,
      subject_id,
      schedule_text,
      day_of_week,
      start_time,
      end_time,
      room,
      capacity,
      max_capacity,
      status,
      start_date,
      end_date,
      notes
    ) VALUES (
      $1, $2,
      (SELECT full_name FROM teachers WHERE id = $3),
      $3, $4,
      $5, $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15
    )
    RETURNING id
  `, [
    data.class_code,
    data.class_name,
    data.teacher_id,
    data.subject_id,
    data.schedule_text,
    data.day_of_week,
    data.start_time,
    data.end_time,
    data.room,
    data.capacity,
    data.max_capacity ?? data.capacity,
    data.status,
    data.start_date,
    data.end_date,
    data.notes,
  ]);
  return rows[0].id;
}

export async function updateClass(id: number, data: ClassFormData): Promise<void> {
  await query(`
    UPDATE classes SET
      class_code = $2,
      class_name = $3,
      teacher_name = (SELECT full_name FROM teachers WHERE id = $4),
      teacher_id = $4,
      subject_id = $5,
      schedule_text = $6,
      day_of_week = $7,
      start_time = $8,
      end_time = $9,
      room = $10,
      capacity = $11,
      max_capacity = $12,
      status = $13,
      start_date = $14,
      end_date = $15,
      notes = $16
    WHERE id = $1
  `, [
    id,
    data.class_code,
    data.class_name,
    data.teacher_id,
    data.subject_id,
    data.schedule_text,
    data.day_of_week,
    data.start_time,
    data.end_time,
    data.room,
    data.capacity,
    data.max_capacity ?? data.capacity,
    data.status,
    data.start_date,
    data.end_date,
    data.notes,
  ]);
}

export async function deleteClass(id: number): Promise<void> {
  await query(`DELETE FROM classes WHERE id = $1`, [id]);
}

export async function isClassCodeUnique(
  code: string,
  excludeId?: number,
): Promise<boolean> {
  const { rows } = await query<{ count: string }>(`
    SELECT COUNT(*) as count FROM classes
    WHERE class_code = $1 ${excludeId ? "AND id != $" + (2) : ""}
  `, excludeId ? [code, excludeId] : [code]);
  return parseInt(rows[0].count) === 0;
}
