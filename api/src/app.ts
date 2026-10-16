// Aplicația Express, aceeași peste tot:
// - local (docker compose) o pornește server.ts, cu app.listen;
// - în AWS / LocalStack o pornește lambda.ts, prin Lambda Function URL.
import express from "express";
import { CITIES } from "./cities";
import * as db from "./db";
import { openapiSpec } from "./openapi";

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Documentația interactivă: / → /docs (Swagger UI încărcat de pe CDN, ca să meargă și în Lambda).
app.get("/", (_req, res) => {
  res.redirect("docs");
});
app.get("/openapi.json", (_req, res) => {
  res.json(openapiSpec);
});
app.get("/docs", (_req, res) => {
  const ui = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";
  res.type("html").send(`<!doctype html>
<html lang="ro">
<head>
  <meta charset="utf-8">
  <title>FleetManager API</title>
  <link rel="stylesheet" href="${ui}/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${ui}/swagger-ui-bundle.js"></script>
  <script>SwaggerUIBundle({ url: "openapi.json", dom_id: "#swagger-ui" });</script>
</body>
</html>`);
});

app.get("/api/cities", (_req, res) => {
  res.json(Object.keys(CITIES));
});

app.get("/api/vehicles", async (_req, res) => {
  const vehicles = await db.listVehicles();
  res.json(
    vehicles.map(({ plate, model, status, destination, lat, lng }) => ({
      plate,
      model,
      status,
      destination: destination ?? null,
      lat,
      lng,
    })),
  );
});

app.post("/api/vehicles", async (req, res) => {
  const plate = String(req.body?.plate ?? "").trim().toUpperCase();
  const model = String(req.body?.model ?? "").trim() || "Dacia Logan";
  if (!plate || plate.length > 20) {
    res.status(400).json({ error: "Numărul de înmatriculare este obligatoriu (max. 20 caractere)." });
    return;
  }
  if (!(await db.addVehicle(plate, model))) {
    res.status(409).json({ error: `Mașina ${plate} există deja.` });
    return;
  }
  res.status(201).json({ plate, model, status: "parked" });
});

app.delete("/api/vehicles/:plate", async (req, res) => {
  const deleted = await db.deleteVehicle(String(req.params.plate));
  res.status(deleted ? 204 : 404).end();
});

app.post("/api/vehicles/:plate/trip", async (req, res) => {
  const plate = String(req.params.plate);
  const city = String(req.body?.city ?? "");
  const destination = CITIES[city];
  if (!destination) {
    res.status(400).json({ error: "Alegeți o reședință de județ din listă." });
    return;
  }
  if (!(await db.startTrip(plate, city, destination))) {
    res.status(409).json({ error: "Mașina nu există sau nu este în parcare." });
    return;
  }
  res.json({ plate, status: "en_route", destination: city });
});

app.post("/api/vehicles/:plate/park", async (req, res) => {
  const plate = String(req.params.plate);
  if (!(await db.parkVehicle(plate))) {
    res.status(404).json({ error: "Mașina nu există." });
    return;
  }
  res.json({ plate, status: "parked" });
});

app.get("/api/positions", async (_req, res) => {
  res.json(await db.latestPositions(10));
});

// Express 5 trimite aici și erorile aruncate în rutele async.
app.use(((err, _req, res, _next) => {
  console.error("[api] eroare:", err);
  res.status(500).json({ error: "Eroare internă. Vedeți logurile API-ului." });
}) as express.ErrorRequestHandler);
