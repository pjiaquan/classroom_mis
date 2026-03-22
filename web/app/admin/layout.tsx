import { redirect } from "next/navigation";
import type { Route } from "next";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const isAuthenticated = await isAdminSessionAuthenticated();

  if (!isAuthenticated) {
    redirect("/admin-auth" as Route);
  }

  return children;
}
