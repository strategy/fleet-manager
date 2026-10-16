import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm } from "./simulation";

// Testele rulează cu valorile implicite: 90 km/h, SIM_SPEEDUP=1.
test("într-un minut, la 90 km/h, mașina parcurge 1,5 km", () => {
  assert.equal(distanceKm(60), 1.5);
});

test("worker-ul local (10 s) și Lambda (60 s) ajung la aceeași distanță", () => {
  assert.equal(distanceKm(10) * 6, distanceKm(60));
});
