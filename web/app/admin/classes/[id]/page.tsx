import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { ClassFormShell } from "@/components/admin/class-form-shell";
import { getClassById, getTeachers, getSubjects } from "@/lib/db/class";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditClassPage({ params }: Props) {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const { id } = await params;
  const classId = Number(id);

  if (isNaN(classId)) {
    redirect("/admin/classes");
  }

  const [cls, teachers, subjects] = await Promise.all([
    getClassById(classId),
    getTeachers(),
    getSubjects(),
  ]);

  if (!cls) {
    redirect("/admin/classes");
  }

  return (
    <ClassFormShell
      mode="edit"
      classId={classId}
      cls={cls}
      teachers={teachers}
      subjects={subjects}
    />
  );
}
