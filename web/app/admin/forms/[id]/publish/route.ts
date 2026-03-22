import { NextRequest, NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const isAuthenticated = await isAdminSessionAuthenticated();

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL("/admin-auth", request.url), {
      status: 303,
    });
  }

  const { id } = await context.params;

  return NextResponse.json({
    ok: true,
    message:
      "Publish endpoint scaffolded. Wire this route to a real update statement after admin auth is in place.",
    formId: Number(id),
  });
}
