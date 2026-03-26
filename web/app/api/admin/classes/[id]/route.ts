import { NextResponse } from "next/server";
import { isAdminSessionAuthenticated } from "@/lib/admin/auth";
import { getClassById, getTeachers, getSubjects, updateClass, deleteClass, isClassCodeUnique } from "@/lib/db/class";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const classId = Number(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const [cls, teachers, subjects] = await Promise.all([
      getClassById(classId),
      getTeachers(),
      getSubjects(),
    ]);

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    return NextResponse.json({ class: cls, teachers, subjects });
  } catch (error) {
    console.error("Failed to fetch class:", error);
    return NextResponse.json(
      { error: "Failed to fetch class" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const classId = Number(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const { class_name, class_code, teacher_id, subject_id, schedule_text, day_of_week, start_time, end_time, room, capacity, max_capacity, status, start_date, end_date, notes } = body;

    // Validate required fields
    if (!class_name || !class_code || !schedule_text || !capacity) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check code uniqueness (excluding current class)
    const isUnique = await isClassCodeUnique(class_code, classId);
    if (!isUnique) {
      return NextResponse.json(
        { error: "Class code already exists" },
        { status: 400 },
      );
    }

    await updateClass(classId, {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update class:", error);
    return NextResponse.json(
      { error: "Failed to update class" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAdminSessionAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const classId = Number(id);
    if (isNaN(classId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    await deleteClass(classId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete class:", error);
    return NextResponse.json(
      { error: "Failed to delete class" },
      { status: 500 },
    );
  }
}
