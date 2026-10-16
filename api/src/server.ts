// Pornirea locală (docker compose): un server HTTP obișnuit pe portul 3000.
// În AWS / LocalStack nu se folosește: acolo intră prin lambda.ts.
import { app } from "./app";
import { config } from "./config";
import { createTablesIfMissing } from "./db";

async function main() {
  await createTablesIfMissing();
  app.listen(config.port, () => {
    console.log(`[api] ascult pe portul ${config.port} (LOG_LEVEL=${config.logLevel})`);
  });
}

main().catch((err) => {
  console.error("[api] pornire eșuată:", err);
  process.exit(1);
});
