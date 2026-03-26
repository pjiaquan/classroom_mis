import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { AdminClassesShell } from "@/components/admin/admin-classes-shell";
import { getClasses } from "@/lib/db/class";

export const dynamic = "force-dynamic";

export default async function AdminClassesPage() {
  const isAuthenticated = await isAdminSessionAuthenticated();
  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  const classes = await getClasses();

  return <AdminClassesShell classes={classes} />;
}
