import { NextRequest, NextResponse } from "next/server";
import {
  parsePublicFormPayload,
  submitPublicForm,
} from "@/lib/forms/service";
import { getPublishedFormBySlug } from "@/lib/forms/repository";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  const form = await getPublishedFormBySlug(slug);

  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404 });
  }

  const formData = await request.formData();
  const payload = await parsePublicFormPayload({ form, formData });

  const result = await submitPublicForm({
    slug,
    payload,
    ipAddress:
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for") ??
      undefined,
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
