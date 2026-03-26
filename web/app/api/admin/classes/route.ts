import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { getClasses, getTeachers, getSubjects, createClass, isClassCodeUnique } from "@/lib/db/class";

export async function GET() {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [classes, teachers, subjects] = await Promise.all([
      getClasses(),
      getTeachers(),
      getSubjects(),
    ]);
    return NextResponse.json({ classes, teachers, subjects });
  } catch (error) {
    console.error("Failed to fetch classes:", error);
    return NextResponse.json(
      { error: "Failed to fetch classes" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { class_name, class_code, teacher_id, subject_id, schedule_text, day_of_week, start_time, end_time, room, capacity, max_capacity, status, start_date, end_date, notes } = body;

    // Validate required fields
    if (!class_name || !class_code || !schedule_text || !capacity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check code uniqueness
    const isUnique = await isClassCodeUnique(class_code);
    if (!isUnique) {
      return NextResponse.json(
        { error: "Class code already exists" },
        { status: 400 },
      );
    }

    const id = await createClass({
      class_name,
      class_code,
      teacher_id: teacher_id || null,
      subject_id: subject_id || null,
      schedule_text,
      day_of_week: day_of_week ?? null,
      start_time: start_time || null,
      end_time: end_time || null,
      room: room || null,
      capacity,
      max_capacity: max_capacity ?? null,
      status: status || "open",
      start_date: start_date || null,
      end_date: end_date || null,
      notes: notes || null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Failed to create class:", error);
    return NextResponse.json(
      { error: "Failed to create class" },
      { status: 500 },
    );
  }
}
