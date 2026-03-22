import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, context: RouteContext) {
  const { id } = await context.params;

  return NextResponse.json({
    ok: true,
    message:
      "Publish endpoint scaffolded. Wire this route to a real update statement after admin auth is in place.",
    formId: Number(id),
  });
}
