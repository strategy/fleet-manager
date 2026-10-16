// Toată configurarea vine din variabile de mediu (compose, template.yaml, CI), nu din cod.
export const config = {
  port: Number(process.env.PORT ?? 3000),
  logLevel: process.env.LOG_LEVEL ?? "info",
  gpsPollSeconds: Number(process.env.GPS_POLL_SECONDS ?? 10),
  speedKmh: Number(process.env.SPEED_KMH ?? 90),
  // 1 = timp real; 60 = un minut de demo înseamnă o oră de drum
  simSpeedup: Number(process.env.SIM_SPEEDUP ?? 1),
  dynamodb: {
    // Setat doar local (DynamoDB Local din compose). În AWS și LocalStack rămâne gol:
    // SDK-ul alege singur adresa serviciului din regiune.
    endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
    vehiclesTable: process.env.VEHICLES_TABLE ?? "fleet-vehicles",
    positionsTable: process.env.POSITIONS_TABLE ?? "fleet-positions",
  },
};
