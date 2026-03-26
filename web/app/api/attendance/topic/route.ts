import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { updateSessionTopic } from "@/lib/db/attendance";

export async function POST(request: Request) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, topic } = await request.json();

    if (typeof sessionId !== "number" || typeof topic !== "string") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await updateSessionTopic(sessionId, topic);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update topic:", error);
    return NextResponse.json(
      { error: "Failed to update topic" },
      { status: 500 },
    );
  }
}
