import { AdminFormsShell } from "@/components/admin/admin-forms-shell";
import { getAdminFormSummaries } from "@/lib/forms/repository";

export default async function AdminFormsPage() {
  const forms = await getAdminFormSummaries();

  return <AdminFormsShell forms={forms} />;
}
