// Worker-ul local (docker compose): rulează simularea la fiecare GPS_POLL_SECONDS.
// În AWS, același pas îl rulează worker-lambda.ts, pornit de EventBridge o dată pe minut.
import { config } from "./config";
import { createTablesIfMissing } from "./db";
import { tick } from "./simulation";

function runTick() {
  tick().catch((err) => console.error("[worker] eroare:", err.message));
}

async function main() {
  await createTablesIfMissing();
  console.log(
    `[worker] pornit: GPS la fiecare ${config.gpsPollSeconds}s, ${config.speedKmh} km/h, SIM_SPEEDUP=${config.simSpeedup}`,
  );
  runTick();
  setInterval(runTick, config.gpsPollSeconds * 1000);
}

main().catch((err) => {
  console.error("[worker] pornire eșuată:", err);
  process.exit(1);
});
