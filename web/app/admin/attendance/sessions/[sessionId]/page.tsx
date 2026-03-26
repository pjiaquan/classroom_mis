import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { SessionAttendanceShell } from "@/components/admin/session-attendance-shell";
import {
  getAttendanceForSession,
  getEnrolledStudentsForClass,
  getOrCreateTodaySession,
  getSessionById,
} from "@/lib/db/attendance";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ classId?: string }>;
};

export default async function SessionAttendancePage({
  params,
  searchParams,
}: Props) {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const { sessionId } = await params;
  const { classId: classIdStr } = await searchParams;
  const classId = classIdStr ? Number(classIdStr) : null;

  // If sessionId is "new", create or get today's session
  if (sessionId === "new") {
    if (!classId || isNaN(classId)) {
      redirect("/admin/attendance");
    }
    const session = await getOrCreateTodaySession(classId, null);
    const [enrolledStudents, attendance] = await Promise.all([
      getEnrolledStudentsForClass(classId),
      getAttendanceForSession(session.id),
    ]);

    const attendanceMap = new Map(
      attendance.map((a) => [a.student_id, a]),
    );

    const studentsWithAttendance = enrolledStudents.map((student) => ({
      ...student,
      attendance: attendanceMap.get(student.student_id) ?? null,
    }));

    return (
      <SessionAttendanceShell
        sessionId={session.id}
        session={session}
        students={studentsWithAttendance}
        backHref={`/admin/attendance/${classId}` as Route}
      />
    );
  }

  // Otherwise, view the specific session
  const targetSessionId = Number(sessionId);
  if (isNaN(targetSessionId)) {
    redirect("/admin/attendance");
  }

  const session = await getSessionById(targetSessionId);
  if (!session) {
    redirect("/admin/attendance");
  }

  const [enrolledStudents, attendance] = await Promise.all([
    getEnrolledStudentsForClass(session.class_id),
    getAttendanceForSession(targetSessionId),
  ]);

  const attendanceMap = new Map(
    attendance.map((a) => [a.student_id, a]),
  );

  const studentsWithAttendance = enrolledStudents.map((student) => ({
    ...student,
    attendance: attendanceMap.get(student.student_id) ?? null,
  }));

  return (
    <SessionAttendanceShell
      sessionId={targetSessionId}
      session={session}
      students={studentsWithAttendance}
      backHref={`/admin/attendance/${session.class_id}` as Route}
    />
  );
}
