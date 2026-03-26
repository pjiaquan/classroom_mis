import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { upsertAttendance } from "@/lib/db/attendance";

export async function POST(request: Request) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { sessionId, studentId, status, notes } = await request.json();

    if (
      typeof sessionId !== "number" ||
      typeof studentId !== "number" ||
      !["present", "leave", "absent"].includes(status)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await upsertAttendance(sessionId, studentId, status, notes ?? null);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save attendance:", error);
    return NextResponse.json(
      { error: "Failed to save attendance" },
      { status: 500 },
    );
  }
}
