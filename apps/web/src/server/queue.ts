import { prisma } from "@ugc/db";

// Enqueue jobs by inserting directly into the pg-boss job table.
// This avoids holding session-mode pooler connections that pg-boss
// would normally require (LISTEN/NOTIFY, advisory locks, etc.).
// The workers on Railway use the full pg-boss client for processing.

export async function sendJob(
  queue: string,
  data: object
): Promise<string | null> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `INSERT INTO pgboss.job (name, data) VALUES ($1, $2::jsonb) RETURNING id`,
    queue,
    JSON.stringify(data)
  );

  return rows[0]?.id ?? null;
}
