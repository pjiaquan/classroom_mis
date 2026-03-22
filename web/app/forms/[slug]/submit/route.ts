import { NextRequest, NextResponse } from "next/server";
import {
  parsePublicFormPayload,
  submitPublicForm,
} from "@/lib/forms/service";
import { getPublishedFormBySlug } from "@/lib/forms/repository";
import { enforceSubmissionRateLimit } from "@/lib/security/submission-rate-limit";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const form = await getPublishedFormBySlug(slug);
  const ipAddress =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for") ??
    undefined;

  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404 });
  }

  const rateLimitResult = await enforceSubmissionRateLimit({
    slug,
    ipAddress,
  });

  if (!rateLimitResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: rateLimitResult.error,
      },
      {
        status: rateLimitResult.statusCode,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      },
    );
  }

  const formData = await request.formData();
  const { payload, uploadedFiles } = await parsePublicFormPayload({ form, formData });

  const result = await submitPublicForm({
    slug,
    payload,
    uploadedFiles,
    ipAddress,
    userAgent: request.headers.get("user-agent") ?? undefined,
    referer: request.headers.get("referer") ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        fieldErrors: result.fieldErrors,
      },
      { status: result.statusCode },
    );
  }

  return NextResponse.json({
    ok: true,
    submissionId: result.submissionId,
    leadId: result.leadId,
    redirectTo: `/submission-success?form=${encodeURIComponent(slug)}`,
  });
}
