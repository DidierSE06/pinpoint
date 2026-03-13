/* ============================================================
   distances.js — Distance lines and midpoint badges on the map.

   When a pin is selected, dashed polylines radiate from it to
   every other pin with a small distance label at each midpoint.
   The closest pin gets a brighter line and a highlighted badge.

   Collision avoidance ensures badges don't overlap at low zoom.
   ============================================================ */


/* ── Clear all overlays ──────────────────────────────────── */

/** Remove every distance line and badge currently on the map. */
function clearDistanceLines() {
  distanceLines.forEach(l => map.removeLayer(l));
  distanceBadges.forEach(b => map.removeLayer(b));
  distanceLines  = [];
  distanceBadges = [];
}


/* ── Badge icon factory ──────────────────────────────────── */

/**
 * Build the styled HTML label shown at the midpoint of each line.
 * The closest-pin badge is brighter and slightly larger.
 */
function makeBadgeIcon(distText, isClosest) {
  const borderColor = isClosest ? '#4af0c4' : 'rgba(74,240,196,0.35)';
  const textColor   = isClosest ? '#4af0c4' : 'rgba(74,240,196,0.55)';
  const fontSize    = isClosest ? 11 : 10;
  const padding     = isClosest ? '4px 11px' : '3px 8px';
  const shadow      = isClosest ? '0 2px 14px rgba(74,240,196,0.3)' : 'none';

  const html = `<div style="
    background: rgba(10,12,16,0.88);
    border: 1.5px solid ${borderColor};
    color: ${textColor};
    font-family: 'DM Mono', monospace;
    font-size: ${fontSize}px;
    font-weight: 500;
    padding: ${padding};
    border-radius: 20px;
    white-space: nowrap;
    box-shadow: ${shadow};
    backdrop-filter: blur(4px);
    transform: translate(-50%,-50%);
    display: inline-block;
  ">${distText}</div>`;

  return L.divIcon({
    html,
    className:  'dist-badge-wrap', // pointer-events: none set in CSS
    iconSize:   [0, 0],
    iconAnchor: [0, 0]
  });
}


/* ── Collision avoidance ─────────────────────────────────── */

/**
 * Returns true if two map positions (as L.LatLng) project to
 * screen pixels closer than `minPx`.
 */
function badgesTooClose(latLng1, latLng2, minPx) {
  const p1 = map.latLngToContainerPoint(latLng1);
  const p2 = map.latLngToContainerPoint(latLng2);
  return Math.hypot(p1.x - p2.x, p1.y - p2.y) < minPx;
}


/* ── Single-pin distance lines ───────────────────────────── */

/**
 * Draw lines from `pin` to every other pin, placing distance badges
 * at their midpoints. Badges are suppressed when they'd overlap.
 *
 * Badge count is also capped at low zoom levels to avoid visual noise:
 *   zoom ≤ 3 → max 3 badges
 *   zoom ≤ 5 → max 6 badges
 *   zoom  > 5 → all badges (with collision check)
 */
function redrawDistanceLines(pin) {
  clearDistanceLines();
  if (!pin) return;

  const distances = allDistances(pin);
  if (!distances.length) return;

  const closestId  = distances[0].pin.id;
  const zoom       = map.getZoom();
  const minBadgePx = 42; // pixels — minimum gap between badge centres
  const maxBadges  = zoom <= 3 ? 3 : zoom <= 5 ? 6 : distances.length;
  const shownMids  = []; // track placed badge positions for collision checks

  distances.forEach(({ pin: other, dist }, idx) => {
    const isClosest = other.id === closestId;

    // Draw the line
    const line = L.polyline(
      [[pin.lat, pin.lng], [other.lat, other.lng]],
      {
        color:     isClosest ? '#4af0c4' : 'rgba(74,240,196,0.22)',
        weight:    isClosest ? 2.5 : 1.2,
        dashArray: isClosest ? '7 4' : '4 6',
        opacity:   0.9,
        interactive: false
      }
    ).addTo(map);
    distanceLines.push(line);

    // Decide whether to place a badge at the midpoint
    if (idx >= maxBadges && !isClosest) return; // over cap

    const mid   = midpoint(pin.lat, pin.lng, other.lat, other.lng);
    const midLL = L.latLng(mid[0], mid[1]);

    // Skip if this badge would overlap an already-placed one
    const collides = shownMids.some(m => badgesTooClose(midLL, m, minBadgePx));
    if (collides && !isClosest) return;

    shownMids.push(midLL);

    const badge = L.marker(mid, {
      icon:         makeBadgeIcon(fmt(dist), isClosest),
      interactive:  false,
      zIndexOffset: isClosest ? 200 : 100
    }).addTo(map);
    distanceBadges.push(badge);
  });
}


/* ── Multi-pin distance lines ────────────────────────────── */

/**
 * When multiple pins are selected, draw lines between every pair.
 * The shortest pair gets a brighter line on top.
 */
function redrawDistanceLinesMulti(selIds) {
  clearDistanceLines();
  if (selIds.length < 2) return;

  let minDist = Infinity;
  let minPair = null;

  // First pass: draw all lines and badges, record the closest pair
  for (let i = 0; i < selIds.length; i++) {
    for (let j = i + 1; j < selIds.length; j++) {
      const a = pins.find(p => p.id === selIds[i]);
      const b = pins.find(p => p.id === selIds[j]);
      if (!a || !b) continue;

      const dist = haversine(a.lat, a.lng, b.lat, b.lng);
      if (dist < minDist) { minDist = dist; minPair = [a.id, b.id]; }

      const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: '#4af0c4', weight: 2, dashArray: '7 4', opacity: 0.7, interactive: false
      }).addTo(map);
      distanceLines.push(line);

      const mid   = midpoint(a.lat, a.lng, b.lat, b.lng);
      const badge = L.marker(mid, {
        icon: makeBadgeIcon(fmt(dist), false), interactive: false, zIndexOffset: 100
      }).addTo(map);
      distanceBadges.push(badge);
    }
  }

  // Second pass: redraw the closest pair's line brighter so it stands out
  if (minPair) {
    const a = pins.find(p => p.id === minPair[0]);
    const b = pins.find(p => p.id === minPair[1]);
    if (a && b) {
      const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], {
        color: '#4af0c4', weight: 3, dashArray: '7 4', opacity: 1, interactive: false
      }).addTo(map);
      distanceLines.push(line);
    }
  }
}
