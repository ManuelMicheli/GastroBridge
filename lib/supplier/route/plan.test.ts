import { test } from "node:test";
import assert from "node:assert/strict";
import { googleMapsRouteLegs, planRoute, type RouteStop } from "./plan.ts";

const stop = (id: string, lat: number | null, lng: number | null, extra: Partial<RouteStop> = {}): RouteStop => ({
  id,
  lat,
  lng,
  zone: null,
  zip: null,
  city: null,
  name: id,
  address: null,
  slotStart: null,
  ...extra,
});

test("nearest neighbour from the warehouse, stops without coordinates last by zone/CAP", () => {
  const origin = { lat: 45.0, lng: 9.0 };
  const stops = [
    stop("far", 45.3, 9.0),
    stop("near", 45.01, 9.0),
    stop("mid", 45.1, 9.0),
    stop("nogeo-b", null, null, { zone: "Nord", zip: "20100" }),
    stop("nogeo-a", null, null, { zone: "Nord", zip: "20090" }),
  ];
  assert.deepEqual(
    planRoute(stops, origin).map((s) => s.id),
    ["near", "mid", "far", "nogeo-a", "nogeo-b"],
  );
});

test("stops are kept within their delivery slot", () => {
  const origin = { lat: 45.0, lng: 9.0 };
  const stops = [stop("late-near", 45.01, 9.0, { slotStart: "11:00" }), stop("early-far", 45.3, 9.0, { slotStart: "07:00" })];
  assert.deepEqual(
    planRoute(stops, origin).map((s) => s.id),
    ["early-far", "late-near"],
  );
});

test("long routes are split into Google Maps legs of max 9 waypoints", () => {
  const stops = Array.from({ length: 23 }, (_, i) => stop(`s${i}`, 45 + i / 100, 9));
  const legs = googleMapsRouteLegs(stops, "45,9");
  assert.equal(legs.length, 3);
  assert.ok(legs[0]!.includes("origin=45%2C9"));
  const wp = new URL(legs[0]!).searchParams.get("waypoints")!.split("|");
  assert.equal(wp.length, 9);
});
