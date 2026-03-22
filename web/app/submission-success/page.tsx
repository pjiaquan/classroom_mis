import { SubmissionSuccessShell } from "@/components/shared/submission-success-shell";

type SubmissionSuccessPageProps = {
  searchParams: Promise<{
    form?: string;
  }>;
};

export default async function SubmissionSuccessPage({
  searchParams,
}: SubmissionSuccessPageProps) {
  const { form } = await searchParams;

  return <SubmissionSuccessShell formSlug={form} />;
}
