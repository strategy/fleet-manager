// Worker-ul în AWS / LocalStack: o funcție Lambda pornită de EventBridge o dată pe minut
// (vezi WorkerFunction în template.yaml). Un minut e intervalul minim al EventBridge.
// Pentru GPS mai des, funcția face câte un pas la fiecare GPS_POLL_SECONDS, până aproape de
// minutul următor, apoi se oprește. Cu GPS_POLL_SECONDS=60 face un singur pas.
import { setTimeout as sleep } from "node:timers/promises";
import { config } from "./config";
import { tick } from "./simulation";

// Se oprește chiar înainte de apelul din minutul următor (Timeout-ul funcției e 70 s). Dacă
// totuși două apeluri se suprapun, condiția pe updatedAt din moveVehicle le împiedică să mute
// aceeași mașină de două ori.
const RUN_FOR_MS = 59_000;

export async function handler() {
  const intervalMs = Math.max(1, config.gpsPollSeconds) * 1000;
  const started = Date.now();
  let sent = 0;
  for (let next = started; next - started < RUN_FOR_MS; next += intervalMs) {
    await sleep(Math.max(0, next - Date.now()));
    sent += await tick();
  }
  return { sent };
}
