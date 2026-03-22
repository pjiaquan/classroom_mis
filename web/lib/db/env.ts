function requireEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAppDatabaseConfig() {
  if (process.env.APP_DATABASE_URL) {
    return {
      connectionString: process.env.APP_DATABASE_URL,
    };
  }

  const user = requireEnv("POSTGRES_USER");
  const password = requireEnv("POSTGRES_PASSWORD");
  const database = requireEnv("APP_POSTGRES_DB");
  const host = requireEnv("APP_DB_HOST", process.env.POSTGRES_HOST);
  const port = requireEnv("APP_DB_PORT", process.env.POSTGRES_PORT ?? "5432");

  return {
    connectionString: `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`,
  };
}
