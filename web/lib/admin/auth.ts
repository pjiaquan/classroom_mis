import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const ADMIN_SESSION_COOKIE = "classroom_mis_admin_session";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

type AdminCredentials = {
  username: string;
  password: string;
};

function getAdminCredentials(): AdminCredentials | null {
  const username = process.env.WEB_ADMIN_USER || process.env.NC_ADMIN_EMAIL;
  const password = process.env.WEB_ADMIN_PASSWORD || process.env.NC_ADMIN_PASSWORD;

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

function getAdminSessionSecret() {
  return (
    process.env.WEB_ADMIN_SESSION_SECRET ||
    process.env.WEB_ADMIN_PASSWORD ||
    process.env.NC_ADMIN_PASSWORD ||
    ""
  );
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getAdminSessionSecret())
    .update(payload)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAdminSessionCookieName() {
  return ADMIN_SESSION_COOKIE;
}

export function validateAdminCredentials(input: {
  username: string;
  password: string;
}) {
  const credentials = getAdminCredentials();
  if (!credentials) {
    return false;
  }

  return (
    safeEqual(input.username, credentials.username) &&
    safeEqual(input.password, credentials.password)
  );
}

export function createAdminSessionValue(username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = `${username}:${expiresAt}`;
  const signature = signSessionPayload(payload);
  return `${payload}:${signature}`;
}

export async function isAdminSessionAuthenticated() {
  const credentials = getAdminCredentials();
  if (!credentials || !getAdminSessionSecret()) {
    return false;
  }

  const cookieStore = await cookies();
  const rawValue = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!rawValue) {
    return false;
  }

  const raw = decodeURIComponent(rawValue);

  const [username, expiresAt, signature] = raw.split(":");

  if (!username || !expiresAt || !signature) {
    return false;
  }

  if (!safeEqual(username, credentials.username)) {
    return false;
  }

  const expiresAtNumber = Number(expiresAt);
  if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Date.now() / 1000) {
    return false;
  }

  const expectedSignature = signSessionPayload(`${username}:${expiresAt}`);
  return safeEqual(signature, expectedSignature);
}
