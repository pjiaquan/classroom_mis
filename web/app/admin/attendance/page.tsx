import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { AdminAttendanceShell } from "@/components/admin/admin-attendance-shell";
import { getClassesWithSchedule, formatDayOfWeek } from "@/lib/db/attendance";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage() {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const classes = await getClassesWithSchedule();

  return <AdminAttendanceShell classes={classes} formatDay={formatDayOfWeek} />;
}
