/* ============================================================
   utils.js — Pure helper / math functions
   No DOM or Leaflet dependencies — safe to call from anywhere.
   ============================================================ */

/* ── Distance ── */

/**
 * Great-circle distance between two lat/lng points (Haversine formula).
 * @returns {number} Distance in kilometres.
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180;
  const a =
    Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) *
    Math.sin((lng2 - lng1) * r / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Returns the pin in `pins` closest to `pin` (excludes self and hidden pins). */
function findClosest(pin) {
  let best = null;
  pins.forEach(p => {
    if (p.id === pin.id || p.hidden) return;
    const d = haversine(pin.lat, pin.lng, p.lat, p.lng);
    if (!best || d < best.dist) best = { pin: p, dist: d };
  });
  return best;
}

/** Returns all other visible pins sorted by ascending distance from `pin`. */
function allDistances(pin) {
  return pins
    .filter(p => p.id !== pin.id && !p.hidden)
    .map(p => ({ pin: p, dist: haversine(pin.lat, pin.lng, p.lat, p.lng) }))
    .sort((a, b) => a.dist - b.dist);
}

/** Midpoint between two lat/lng pairs. */
function midpoint(lat1, lng1, lat2, lng2) {
  return [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
}


/* ── Formatting ── */

/** Human-readable distance: "1,234 km" or "500 m". */
function fmt(km) {
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : `${Math.round(km).toLocaleString()} km`;
}

/** Format a lat/lng pair as "48.85660, 2.35220". */
function fmtLL(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** HTML-escape a string (prevent XSS in innerHTML contexts). */
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Generate a fallback name like "Pin 48.8°N 2.4°E" from a LatLng object. */
function autoName(ll) {
  const ns = ll.lat > 0 ? 'N' : 'S';
  const ew = ll.lng > 0 ? 'E' : 'W';
  return `Pin ${Math.abs(ll.lat).toFixed(1)}°${ns} ${Math.abs(ll.lng).toFixed(1)}°${ew}`;
}

/**
 * Parse a coordinate string such as "48.8566, 2.3522" or "48.8566 2.3522".
 * @returns {{lat: number, lng: number}|null}
 */
function parseCoords(str) {
  const parts = str.trim().split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 2) return null;
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Wrap a longitude value back into the -180…180 range.
 * Needed because Leaflet can produce longitudes beyond ±180 on a
 * world-copy-jump map.
 */
function normalizeLng(lng) {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}
