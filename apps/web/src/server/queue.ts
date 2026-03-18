import { prisma } from "@ugc/db";
import crypto from "node:crypto";

// Enqueue jobs by inserting directly into the pg-boss job table.
// This avoids holding session-mode pooler connections that pg-boss
// would normally require (LISTEN/NOTIFY, advisory locks, etc.).
// The workers on Railway use the full pg-boss client for processing.

export async function sendJob(
  queue: string,
  data: object
): Promise<string | null> {
  const id = crypto.randomUUID();

  await prisma.$executeRawUnsafe(
    `INSERT INTO pgboss.job (id, name, data, state, priority, start_after, expire_seconds, retry_limit, keep_until)
     VALUES ($1, $2, $3::jsonb, 'created', 0, now(), 900, 3, now() + interval '7 days')`,
    id,
    queue,
    JSON.stringify(data)
  );

  return id;
}
