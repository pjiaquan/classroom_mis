import { notFound } from "next/navigation";
import { AdminFormEditor } from "@/components/admin/admin-form-editor";
import { getAdminFormById } from "@/lib/forms/repository";

type AdminFormPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminFormPage({ params }: AdminFormPageProps) {
  const { id } = await params;
  const form = await getAdminFormById(Number(id));

  if (!form) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl px-6 py-12">
      <AdminFormEditor form={form} />
    </main>
  );
}
