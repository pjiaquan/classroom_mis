import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSessionValue,
  getAdminSessionCookieName,
  validateAdminCredentials,
} from "@/lib/admin/auth";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const isSecureRequest =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  if (!validateAdminCredentials({ username, password })) {
    return NextResponse.redirect(new URL("/admin-auth", request.url), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL("/admin/forms", request.url), {
    status: 303,
  });

  response.cookies.set({
    name: getAdminSessionCookieName(),
    value: createAdminSessionValue(username),
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest,
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return response;
}
