import { Pool } from "pg";
import { createClient } from "redis";
import { config } from "./config";
import { stepToward } from "./geo";

const pool = new Pool(config.db);
const redis = createClient({ url: config.redisUrl });

// Distanța parcursă la 90 km/h într-un interval GPS (înmulțită cu SIM_SPEEDUP pentru demo).
const stepKm = (config.speedKmh * config.gpsPollSeconds * config.simSpeedup) / 3600;

// Doar mașinile în cursă trimit GPS; cele din parcare sau ajunse la destinație nu.
async function tick() {
  const { rows } = await pool.query(
    "SELECT plate, destination, lat, lng, dest_lat, dest_lng FROM vehicles WHERE status = 'en_route'",
  );
  for (const vehicle of rows) {
    const next = stepToward(
      { lat: vehicle.lat, lng: vehicle.lng },
      { lat: vehicle.dest_lat, lng: vehicle.dest_lng },
      stepKm,
    );
    const status = next.arrived ? "arrived" : "en_route";
    // Condiția pe status evită suprascrierea unei mașini trimise între timp în parcare.
    const result = await pool.query(
      "UPDATE vehicles SET lat = $2, lng = $3, status = $4 WHERE plate = $1 AND status = 'en_route'",
      [vehicle.plate, next.lat, next.lng, status],
    );
    if (result.rowCount === 0) continue;

    const position = {
      plate: vehicle.plate,
      destination: vehicle.destination,
      lat: next.lat,
      lng: next.lng,
      at: new Date().toISOString(),
    };
    await redis.lPush("positions", JSON.stringify(position));
    if (next.arrived) {
      console.log(`[worker] ${vehicle.plate} a ajuns la ${vehicle.destination}`);
    }
  }
  await redis.lTrim("positions", 0, 99);
  if (rows.length > 0) {
    console.log(`[worker] ${rows.length} poziții GPS trimise`);
  }
}

function runTick() {
  tick().catch((err) => console.error("[worker] eroare:", err.message));
}

async function main() {
  await redis.connect();
  console.log(
    `[worker] pornit: GPS la fiecare ${config.gpsPollSeconds}s, ${config.speedKmh} km/h, pas ${stepKm.toFixed(3)} km`,
  );
  runTick();
  setInterval(runTick, config.gpsPollSeconds * 1000);
}

main().catch((err) => {
  console.error("[worker] pornire eșuată:", err);
  process.exit(1);
});
