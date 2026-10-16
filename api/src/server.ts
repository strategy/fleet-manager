import express from "express";
import { Pool } from "pg";
import { createClient } from "redis";
import swaggerUi from "swagger-ui-express";
import { CITIES } from "./cities";
import { config } from "./config";
import { ORADEA_PARKING } from "./geo";
import { openapiSpec } from "./openapi";

const pool = new Pool(config.db);
const redis = createClient({ url: config.redisUrl });

// status: parked (în parcare, Oradea) | en_route (în cursă) | arrived (a ajuns la destinație)
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      plate       TEXT PRIMARY KEY,
      model       TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'parked',
      destination TEXT,
      lat         DOUBLE PRECISION NOT NULL,
      lng         DOUBLE PRECISION NOT NULL,
      dest_lat    DOUBLE PRECISION,
      dest_lng    DOUBLE PRECISION,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Documentația interactivă: http://localhost:3000 → Swagger UI
app.get("/", (_req, res) => {
  res.redirect("/docs");
});
app.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: "FleetManager API" }));

app.get("/api/cities", (_req, res) => {
  res.json(Object.keys(CITIES));
});

app.get("/api/vehicles", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT plate, model, status, destination, lat, lng FROM vehicles ORDER BY created_at",
  );
  res.json(rows);
});

app.post("/api/vehicles", async (req, res) => {
  const plate = String(req.body?.plate ?? "").trim().toUpperCase();
  const model = String(req.body?.model ?? "").trim() || "Dacia Logan";
  if (!plate || plate.length > 20) {
    res.status(400).json({ error: "Numărul de înmatriculare este obligatoriu (max. 20 caractere)." });
    return;
  }
  const result = await pool.query(
    `INSERT INTO vehicles (plate, model, lat, lng) VALUES ($1, $2, $3, $4)
     ON CONFLICT (plate) DO NOTHING`,
    [plate, model, ORADEA_PARKING.lat, ORADEA_PARKING.lng],
  );
  if (result.rowCount === 0) {
    res.status(409).json({ error: `Mașina ${plate} există deja.` });
    return;
  }
  res.status(201).json({ plate, model, status: "parked" });
});

app.delete("/api/vehicles/:plate", async (req, res) => {
  const result = await pool.query("DELETE FROM vehicles WHERE plate = $1", [req.params.plate]);
  // Ștergem și istoricul GPS, ca o mașină nouă cu același număr să pornească fără el.
  const items = await redis.lRange("positions", 0, -1);
  for (const item of items) {
    if (JSON.parse(item).plate === req.params.plate) {
      await redis.lRem("positions", 0, item);
    }
  }
  res.status(result.rowCount ? 204 : 404).end();
});

app.post("/api/vehicles/:plate/trip", async (req, res) => {
  const city = String(req.body?.city ?? "");
  const destination = CITIES[city];
  if (!destination) {
    res.status(400).json({ error: "Alegeți o reședință de județ din listă." });
    return;
  }
  // Cursa pornește întotdeauna din parcarea din Oradea.
  const result = await pool.query(
    `UPDATE vehicles
     SET status = 'en_route', destination = $2, dest_lat = $3, dest_lng = $4, lat = $5, lng = $6
     WHERE plate = $1 AND status = 'parked'`,
    [req.params.plate, city, destination.lat, destination.lng, ORADEA_PARKING.lat, ORADEA_PARKING.lng],
  );
  if (result.rowCount === 0) {
    res.status(409).json({ error: "Mașina nu există sau nu este în parcare." });
    return;
  }
  res.json({ plate: req.params.plate, status: "en_route", destination: city });
});

app.post("/api/vehicles/:plate/park", async (req, res) => {
  const result = await pool.query(
    `UPDATE vehicles
     SET status = 'parked', destination = NULL, dest_lat = NULL, dest_lng = NULL, lat = $2, lng = $3
     WHERE plate = $1`,
    [req.params.plate, ORADEA_PARKING.lat, ORADEA_PARKING.lng],
  );
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Mașina nu există." });
    return;
  }
  res.json({ plate: req.params.plate, status: "parked" });
});

app.get("/api/positions", async (_req, res) => {
  const items = await redis.lRange("positions", 0, 9);
  res.json(items.map((item) => JSON.parse(item)));
});

async function main() {
  await redis.connect();
  await initDb();
  app.listen(config.port, () => {
    console.log(`[api] ascult pe portul ${config.port} (LOG_LEVEL=${config.logLevel})`);
  });
}

main().catch((err) => {
  console.error("[api] pornire eșuată:", err);
  process.exit(1);
});
