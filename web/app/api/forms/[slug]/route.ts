import { NextResponse } from "next/server";
import { getPublishedFormBySlug } from "@/lib/forms/repository";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { slug } = await context.params;
  const form = await getPublishedFormBySlug(slug);

  if (!form) {
    return NextResponse.json({ ok: false, error: "Form not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, form });
}
