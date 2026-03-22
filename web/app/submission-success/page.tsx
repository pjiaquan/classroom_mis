import { SubmissionSuccessShell } from "@/components/shared/submission-success-shell";

type SubmissionSuccessPageProps = {
  searchParams: Promise<{
    form?: string;
  }>;
};

export default async function SubmissionSuccessPage({
  searchParams,
}: SubmissionSuccessPageProps) {
  await searchParams;

  return <SubmissionSuccessShell />;
}
