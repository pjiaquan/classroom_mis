import { NextRequest, NextResponse } from "next/server";
import { createUploadIntent } from "@/lib/uploads/service";

export async function POST(request: NextRequest) {
  void request;
  const result = await createUploadIntent();

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.statusCode },
    );
  }

  return NextResponse.json(result);
}
