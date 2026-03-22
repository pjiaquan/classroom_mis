import { notFound } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";
import { getPublishedFormBySlug } from "@/lib/forms/repository";

type FormPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function FormPage({ params }: FormPageProps) {
  const { slug } = await params;
  const form = await getPublishedFormBySlug(slug);
  const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY ?? null;

  if (!form) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-3 py-4 sm:px-6 sm:py-10 lg:px-8">
      <FormRenderer form={form} turnstileSiteKey={turnstileSiteKey} />
    </main>
  );
}
