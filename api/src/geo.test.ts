import { test } from "node:test";
import assert from "node:assert/strict";
import { CITIES } from "./cities";
import { ORADEA_PARKING, distanceKm, stepToward } from "./geo";

test("distanța Oradea – Cluj-Napoca este în jur de 120 km", () => {
  const km = distanceKm(ORADEA_PARKING, CITIES["Cluj-Napoca"]);
  assert.ok(km > 110 && km < 135, `distanță neașteptată: ${km}`);
});

test("stepToward avansează exact pasul cerut", () => {
  const next = stepToward(ORADEA_PARKING, CITIES["Cluj-Napoca"], 0.25);
  assert.equal(next.arrived, false);
  assert.ok(Math.abs(distanceKm(ORADEA_PARKING, next) - 0.25) < 0.01);
});

test("stepToward se oprește pe destinație", () => {
  const destination = CITIES["Arad"];
  const next = stepToward(ORADEA_PARKING, destination, 1000);
  assert.equal(next.arrived, true);
  assert.equal(next.lat, destination.lat);
  assert.equal(next.lng, destination.lng);
});
