import { createRedisConnection } from "./connection";

async function main() {
  const connection = createRedisConnection();

  console.log("Workers starting...");
  console.log("Redis connected:", connection.status);

  // Workers will be registered here in Phase 2+
  console.log("No processors registered yet (Phase 1 — infrastructure only)");
  console.log("Workers idle, waiting for processor registration...");

  process.on("SIGTERM", async () => {
    console.log("Shutting down workers...");
    await connection.quit();
    process.exit(0);
  });
}

main().catch(console.error);
