import { query } from "@/lib/db/client";
import type {
  ClassSession,
  StudentAttendance,
  ClassWithSchedule,
  EnrollmentStudent,
  ClassDetails,
} from "@/lib/db/types";

// Re-export types
export type {
  ClassSession,
  StudentAttendance,
  ClassWithSchedule,
  EnrollmentStudent,
  ClassDetails,
};

const DAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

export function formatDayOfWeek(day: number): string {
  return DAY_NAMES[day] ?? `Day ${day}`;
}

export async function getClassesWithSchedule(): Promise<ClassWithSchedule[]> {
  const { rows } = await query<ClassWithSchedule>(`
    SELECT
      c.id,
      c.class_code,
      c.class_name,
      c.teacher_name,
      c.teacher_id,
      c.day_of_week,
      c.start_time::text,
      c.end_time::text,
      c.room,
      c.capacity,
      c.max_capacity,
      c.status
    FROM classes c
    WHERE c.status IN ('open', 'full')
    ORDER BY c.day_of_week, c.start_time
  `);
  return rows;
}

export async function getSessionsByClassId(
  classId: number,
): Promise<ClassSession[]> {
  const { rows } = await query<ClassSession>(`
    SELECT
      sess.id,
      sess.class_id,
      c.class_name,
      c.class_code,
      c.teacher_name,
      c.teacher_id,
      sess.session_date,
      sess.topic,
      sess.status,
      sess.notes
    FROM attendance_sessions sess
    JOIN classes c ON sess.class_id = c.id
    WHERE sess.class_id = $1
    ORDER BY sess.session_date DESC
  `, [classId]);
  return rows;
}

export async function getOrCreateTodaySession(
  classId: number,
  teacherId: number | null,
): Promise<ClassSession> {
  const today = new Date().toISOString().split("T")[0];

  const existing = await query<ClassSession>(`
    SELECT
      sess.id,
      sess.class_id,
      c.class_name,
      c.class_code,
      c.teacher_name,
      c.teacher_id,
      sess.session_date,
      sess.topic,
      sess.status,
      sess.notes
    FROM attendance_sessions sess
    JOIN classes c ON sess.class_id = c.id
    WHERE sess.class_id = $1 AND sess.session_date = $2
  `, [classId, today]);

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const { rows } = await query<ClassSession>(`
    INSERT INTO attendance_sessions (class_id, session_date, teacher_name, status)
    SELECT $1, $2, COALESCE(t.full_name, c.teacher_name), 'open'
    FROM classes c
    LEFT JOIN teachers t ON t.id = c.teacher_id
    WHERE c.id = $1
    RETURNING
      id,
      class_id,
      (SELECT class_name FROM classes WHERE id = $1) as class_name,
      (SELECT class_code FROM classes WHERE id = $1) as class_code,
      COALESCE((SELECT full_name FROM teachers WHERE id = $3), (SELECT teacher_name FROM classes WHERE id = $1)) as teacher_name,
      $3 as teacher_id,
      session_date,
      NULL::text as topic,
      status,
      NULL::text as notes
  `, [classId, today, teacherId]);

  return rows[0];
}

export async function getEnrolledStudentsForClass(
  classId: number,
): Promise<EnrollmentStudent[]> {
  const { rows } = await query<EnrollmentStudent>(`
    SELECT
      s.id as student_id,
      s.student_code,
      s.full_name,
      s.grade,
      e.id as enrollment_id
    FROM enrollments e
    JOIN students s ON e.student_id = s.id
    WHERE
      e.class_id = $1
      AND e.status = 'active'
      AND (e.end_date IS NULL OR e.end_date >= CURRENT_DATE)
    ORDER BY s.full_name
  `, [classId]);
  return rows;
}

export async function getAttendanceForSession(
  sessionId: number,
): Promise<StudentAttendance[]> {
  const { rows } = await query<StudentAttendance>(`
    SELECT
      a.id,
      a.session_id,
      a.student_id,
      s.student_code,
      s.full_name,
      s.grade,
      a.status,
      a.marked_at,
      a.notes
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.session_id = $1
    ORDER BY s.full_name
  `, [sessionId]);
  return rows;
}

export async function upsertAttendance(
  sessionId: number,
  studentId: number,
  status: "present" | "leave" | "absent",
  notes: string | null,
): Promise<void> {
  await query(`
    INSERT INTO attendance (session_id, student_id, status, notes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (session_id, student_id)
    DO UPDATE SET
      status = EXCLUDED.status,
      notes = EXCLUDED.notes,
      marked_at = NOW()
  `, [sessionId, studentId, status, notes]);
}

export async function closeSession(sessionId: number): Promise<void> {
  await query(`
    UPDATE attendance_sessions
    SET status = 'closed'
    WHERE id = $1
  `, [sessionId]);
}

export async function updateSessionTopic(
  sessionId: number,
  topic: string,
): Promise<void> {
  await query(`
    UPDATE attendance_sessions
    SET topic = $2
    WHERE id = $1
  `, [sessionId, topic]);
}

export async function getClassDetails(
  classId: number,
): Promise<ClassDetails | null> {
  const { rows } = await query<ClassDetails>(`
    SELECT
      c.id,
      c.class_code,
      c.class_name,
      c.teacher_name,
      c.teacher_id,
      c.day_of_week,
      c.start_time::text,
      c.end_time::text,
      c.room,
      c.capacity,
      c.max_capacity,
      c.status
    FROM classes c
    WHERE c.id = $1
  `, [classId]);
  return rows[0] ?? null;
}

export async function getSessionById(
  sessionId: number,
): Promise<ClassSession | null> {
  const { rows } = await query<ClassSession>(`
    SELECT
      sess.id,
      sess.class_id,
      c.class_name,
      c.class_code,
      c.teacher_name,
      c.teacher_id,
      sess.session_date,
      sess.topic,
      sess.status,
      sess.notes
    FROM attendance_sessions sess
    JOIN classes c ON sess.class_id = c.id
    WHERE sess.id = $1
  `, [sessionId]);
  return rows[0] ?? null;
}
