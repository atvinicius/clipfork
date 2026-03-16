import { PgBoss } from "pg-boss";

// Singleton pg-boss instance for the web app (serverless).
// Runs in lightweight mode — no scheduling, no worker polling.
// Only used to send (enqueue) jobs for workers to process.

let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is required for pg-boss");
    }
    boss = new PgBoss({
      connectionString,
      ssl: { rejectUnauthorized: false },
      schedule: false,
      supervise: false,
    });
    await boss.start();
  }
  return boss;
}

export async function sendJob(
  queue: string,
  data: object
): Promise<string | null> {
  const b = await getBoss();
  return b.send(queue, data);
}
