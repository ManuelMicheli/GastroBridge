// Route planning without a paid maps API. Pure functions (no imports) so they
// are unit-testable with `node --test`.
//
// Order: nearest-neighbour from the departure warehouse on straight-line
// (haversine) distance for stops with coordinates — at 10–40 stops a day this
// is within a few percent of an optimal tour on real roads around a city —
// followed by stops without coordinates grouped by zone → CAP → city → name.

export type RouteStop = {
  id: string;
  lat: number | null;
  lng: number | null;
  zone: string | null;
  zip: string | null;
  city: string | null;
  name: string;
  address: string | null;
  /** Delivery slot start "HH:MM" — stops are planned slot by slot. */
  slotStart: string | null;
};

export type Point = { lat: number; lng: number };

const R_KM = 6371;

export function haversineKm(a: Point, b: Point): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hasCoords(s: RouteStop): s is RouteStop & { lat: number; lng: number } {
  return (
    typeof s.lat === "number" &&
    typeof s.lng === "number" &&
    Number.isFinite(s.lat) &&
    Number.isFinite(s.lng) &&
    !(s.lat === 0 && s.lng === 0)
  );
}

function nearestNeighbour(stops: Array<RouteStop & { lat: number; lng: number }>, origin: Point | null): RouteStop[] {
  const left = [...stops];
  const out: RouteStop[] = [];
  let cur: Point | null = origin;
  while (left.length > 0) {
    let best = 0;
    if (cur) {
      let bestD = Infinity;
      for (let i = 0; i < left.length; i++) {
        const d = haversineKm(cur, left[i]!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    const [next] = left.splice(best, 1);
    out.push(next!);
    cur = { lat: next!.lat, lng: next!.lng };
  }
  return out;
}

const cmp = (a: string | null, b: string | null) => (a ?? "~").localeCompare(b ?? "~", "it");

/** Suggested stop order. Stops are kept within their delivery slot. */
export function planRoute(stops: RouteStop[], origin: Point | null): RouteStop[] {
  const slots = [...new Set(stops.map((s) => s.slotStart ?? "~"))].sort();
  const out: RouteStop[] = [];
  let start = origin;
  for (const slot of slots) {
    const inSlot = stops.filter((s) => (s.slotStart ?? "~") === slot);
    const geo = inSlot.filter(hasCoords);
    const noGeo = inSlot
      .filter((s) => !hasCoords(s))
      .sort((a, b) => cmp(a.zone, b.zone) || cmp(a.zip, b.zip) || cmp(a.city, b.city) || a.name.localeCompare(b.name, "it"));
    const ordered = nearestNeighbour(geo, start);
    out.push(...ordered, ...noGeo);
    const last = ordered[ordered.length - 1];
    if (last && hasCoords(last)) start = { lat: last.lat, lng: last.lng };
  }
  return out;
}

/** Total straight-line km of a route (stops without coordinates skipped). */
export function routeKm(stops: RouteStop[], origin: Point | null): number {
  let km = 0;
  let cur = origin;
  for (const s of stops) {
    if (!hasCoords(s)) continue;
    if (cur) km += haversineKm(cur, s);
    cur = { lat: s.lat, lng: s.lng };
  }
  return Math.round(km * 10) / 10;
}

/** Text Google Maps / Waze understand for a stop. */
export function stopQuery(s: Pick<RouteStop, "lat" | "lng" | "address" | "city" | "zip" | "name">): string {
  if (typeof s.lat === "number" && typeof s.lng === "number" && !(s.lat === 0 && s.lng === 0)) {
    return `${s.lat},${s.lng}`;
  }
  return [s.address, s.zip, s.city].filter(Boolean).join(", ") || s.name;
}

export function googleMapsNavUrl(s: Parameters<typeof stopQuery>[0]): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stopQuery(s))}&travelmode=driving`;
}

export function wazeNavUrl(s: Parameters<typeof stopQuery>[0]): string {
  if (typeof s.lat === "number" && typeof s.lng === "number" && !(s.lat === 0 && s.lng === 0)) {
    return `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(stopQuery(s))}&navigate=yes`;
}

/**
 * Google Maps multi-stop links. The URL API accepts up to 9 waypoints, so
 * longer routes are split into consecutive legs (each leg starts where the
 * previous ended).
 */
export function googleMapsRouteLegs(
  stops: Array<Parameters<typeof stopQuery>[0]>,
  origin: string | null,
): string[] {
  const legs: string[] = [];
  if (stops.length === 0) return legs;
  const MAX_WAYPOINTS = 9;
  let from = origin;
  let i = 0;
  while (i < stops.length) {
    const chunk = stops.slice(i, i + MAX_WAYPOINTS + 1);
    const dest = chunk[chunk.length - 1]!;
    const waypoints = chunk.slice(0, -1).map(stopQuery);
    const params = new URLSearchParams({ api: "1", destination: stopQuery(dest), travelmode: "driving" });
    if (from) params.set("origin", from);
    if (waypoints.length > 0) params.set("waypoints", waypoints.join("|"));
    legs.push(`https://www.google.com/maps/dir/?${params.toString()}`);
    from = stopQuery(dest);
    i += chunk.length;
  }
  return legs;
}
