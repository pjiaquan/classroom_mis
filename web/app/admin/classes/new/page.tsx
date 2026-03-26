import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { ClassFormShell } from "@/components/admin/class-form-shell";
import { getTeachers, getSubjects } from "@/lib/db/class";

export const dynamic = "force-dynamic";

export default async function NewClassPage() {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const [teachers, subjects] = await Promise.all([
    getTeachers(),
    getSubjects(),
  ]);

  return (
    <ClassFormShell
      mode="create"
      teachers={teachers}
      subjects={subjects}
    />
  );
}
