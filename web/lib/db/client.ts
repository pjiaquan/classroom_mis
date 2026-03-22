import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import { getAppDatabaseConfig } from "@/lib/db/env";

declare global {
  // eslint-disable-next-line no-var
  var __classroomMisPgPool: Pool | undefined;
}

function getPool() {
  if (!global.__classroomMisPgPool) {
    global.__classroomMisPgPool = new Pool({
      ...getAppDatabaseConfig(),
      max: 10,
    });
  }

  return global.__classroomMisPgPool;
}

export async function query<T extends QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(sql, params);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
