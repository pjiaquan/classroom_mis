// Attendance types - no database dependencies

export type ClassSession = {
  id: number;
  class_id: number;
  class_name: string;
  class_code: string;
  teacher_name: string;
  teacher_id: number | null;
  session_date: Date;
  topic: string | null;
  status: "open" | "closed";
  notes: string | null;
};

export type StudentAttendance = {
  id: number;
  session_id: number;
  student_id: number;
  student_code: string;
  full_name: string;
  grade: string;
  status: "present" | "leave" | "absent";
  marked_at: Date;
  notes: string | null;
};

export type ClassWithSchedule = {
  id: number;
  class_code: string;
  class_name: string;
  teacher_name: string;
  teacher_id: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  capacity: number;
  max_capacity: number | null;
  status: string;
};

export type EnrollmentStudent = {
  student_id: number;
  student_code: string;
  full_name: string;
  grade: string;
  enrollment_id: number;
};

export type ClassDetails = {
  id: number;
  class_code: string;
  class_name: string;
  teacher_name: string;
  teacher_id: number | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  capacity: number;
  max_capacity: number | null;
  status: string;
};
