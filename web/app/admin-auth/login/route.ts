import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSessionValue,
  getAdminSessionCookieName,
  validateAdminCredentials,
} from "@/lib/admin/auth";

function getBaseUrl(request: NextRequest): string {
  // Check for forwarded host header first (when behind proxy)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    return `${protocol}://${forwardedHost}`;
  }

  // Fallback to request URL's host
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const isSecureRequest =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  const baseUrl = getBaseUrl(request);

  if (!validateAdminCredentials({ username, password })) {
    return NextResponse.redirect(new URL("/admin-auth", baseUrl), {
      status: 303,
    });
  }

  const response = NextResponse.redirect(new URL("/admin/forms", baseUrl), {
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
