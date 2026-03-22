import { getRedisClient } from "@/lib/redis/client";

const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 5;

type SubmissionRateLimitResult =
  | { ok: true }
  | { ok: false; statusCode: number; error: string; retryAfterSeconds: number };

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9:._-]/g, "_");
}

export async function enforceSubmissionRateLimit(input: {
  slug: string;
  ipAddress?: string;
}): Promise<SubmissionRateLimitResult> {
  let client;
  try {
    client = await getRedisClient();
  } catch (error) {
    console.error("[rate-limit] unable to connect to redis", error);
    return { ok: true };
  }

  if (!client) {
    return { ok: true };
  }

  const ipPart = sanitizeKeyPart(input.ipAddress ?? "unknown");
  const slugPart = sanitizeKeyPart(input.slug);
  const key = `rate-limit:form-submit:${slugPart}:${ipPart}`;

  const currentCount = await client.incr(key);
  if (currentCount === 1) {
    await client.expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }

  if (currentCount > RATE_LIMIT_MAX_REQUESTS) {
    const ttl = await client.ttl(key);
    return {
      ok: false,
      statusCode: 429,
      error: "送出過於頻繁，請稍後再試。",
      retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  return { ok: true };
}
