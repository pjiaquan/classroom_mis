import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { closeSession } from "@/lib/db/attendance";

export async function POST(request: Request) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId } = await request.json();

    if (typeof sessionId !== "number") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await closeSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to close session:", error);
    return NextResponse.json(
      { error: "Failed to close session" },
      { status: 500 },
    );
  }
}
