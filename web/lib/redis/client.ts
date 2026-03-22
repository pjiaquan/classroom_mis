import { createClient } from "redis";

type ClassroomMisRedisClient = ReturnType<typeof createClient>;

declare global {
  // eslint-disable-next-line no-var
  var __classroomMisRedisClient: ClassroomMisRedisClient | undefined;
}

function getRedisUrl() {
  if (process.env.APP_REDIS_URL) {
    return process.env.APP_REDIS_URL;
  }

  const password = process.env.REDIS_PASSWORD;
  const host = process.env.APP_REDIS_HOST ?? "127.0.0.1";
  const port = process.env.APP_REDIS_PORT ?? "6379";

  if (!password) {
    return null;
  }

  return `redis://:${encodeURIComponent(password)}@${host}:${port}/0`;
}

export async function getRedisClient() {
  const url = getRedisUrl();

  if (!url) {
    return null;
  }

  if (!global.__classroomMisRedisClient) {
    const client = createClient({ url });
    client.on("error", (error) => {
      console.error("[redis] client error", error);
    });
    global.__classroomMisRedisClient = client;
  }

  const client = global.__classroomMisRedisClient;

  if (!client) {
    return null;
  }

  if (!client.isOpen) {
    await client.connect();
  }

  return client;
}
