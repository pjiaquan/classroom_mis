import { redirect } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { ClassHistoryShell } from "@/components/admin/class-history-shell";
import {
  getSessionsByClassId,
  getClassDetails,
} from "@/lib/db/attendance";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ classId: string }>;
};

export default async function ClassHistoryPage({ params }: Props) {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const { classId } = await params;
  const classIdNum = Number(classId);

  if (isNaN(classIdNum)) {
    redirect("/admin/attendance");
  }

  const [sessions, classDetails] = await Promise.all([
    getSessionsByClassId(classIdNum),
    getClassDetails(classIdNum),
  ]);

  if (!classDetails) {
    redirect("/admin/attendance");
  }

  return (
    <ClassHistoryShell
      sessions={sessions}
      classDetails={classDetails}
    />
  );
}
