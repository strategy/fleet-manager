import { config } from "./config";
import { addPosition, listVehiclesEnRoute, moveVehicle } from "./db";
import { stepToward } from "./geo";

// Distanța parcursă în secundele scurse de la ultima poziție (înmulțită cu SIM_SPEEDUP pentru demo).
// Worker-ul rulează la fiecare GPS_POLL_SECONDS, local și în Lambda (vezi worker-lambda.ts).
// Pentru că pasul depinde de timpul scurs, mașina merge la fel de repede oricare ar fi intervalul.
export function distanceKm(elapsedSeconds: number): number {
  return (config.speedKmh * elapsedSeconds * config.simSpeedup) / 3600;
}

// Un pas al simulării: doar mașinile în cursă trimit GPS; cele din parcare sau ajunse la destinație nu.
export async function tick(now = new Date()): Promise<number> {
  const vehicles = await listVehiclesEnRoute();
  let sent = 0;
  for (const vehicle of vehicles) {
    const elapsedSeconds = Math.max(0, (now.getTime() - Date.parse(vehicle.updatedAt)) / 1000);
    // Dacă rulează mai multe worker-e deodată (ex. două apeluri Lambda suprapuse), primul mută
    // mașina, iar celelalte o găsesc mutată de prea puțin timp și o lasă în pace.
    if (elapsedSeconds < config.gpsPollSeconds * 0.8) continue;
    const next = stepToward(
      { lat: vehicle.lat, lng: vehicle.lng },
      { lat: vehicle.destLat!, lng: vehicle.destLng! },
      distanceKm(elapsedSeconds),
    );
    const at = now.toISOString();
    const status = next.arrived ? "arrived" : "en_route";
    const moved = await moveVehicle(vehicle.plate, next, status, at, vehicle.updatedAt);
    if (!moved) continue;

    await addPosition({ plate: vehicle.plate, destination: vehicle.destination!, lat: next.lat, lng: next.lng, at });
    sent++;
    if (next.arrived) {
      console.log(`[worker] ${vehicle.plate} a ajuns la ${vehicle.destination}`);
    }
  }
  if (sent > 0) {
    console.log(`[worker] ${sent} poziții GPS trimise`);
  }
  return sent;
}
