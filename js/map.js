/* ============================================================
   map.js — Map initialisation, theme, marker icons, ghost pin,
            land/water detection, and the main map-click handler.
   ============================================================ */


/* ── Map initialisation ──────────────────────────────────── */

const map = L.map('map', {
  center:             [20, 0],
  zoom:               2,
  zoomControl:        true,
  minZoom:            2,
  worldCopyJump:      true,  // markers re-appear on world copies
  maxBounds:          [[-90, -Infinity], [90, Infinity]], // lock vertical, free horizontal
  maxBoundsViscosity: 1.0    // hard stop at top/bottom — no rubber-band
});

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
};

function tileOpts() {
  return {
    attribution: '© OpenStreetMap © CARTO',
    subdomains:  'abcd',
    maxZoom:     19,
    noWrap:      false
  };
}

// Start in dark mode
let activeTile = L.tileLayer(TILES.dark, tileOpts()).addTo(map);

map.zoomControl.setPosition('bottomright');

// Re-draw distance badges on zoom because collision thresholds are screen-space
map.on('zoomend', () => {
  if (selectedPinIds.size === 1) {
    const p = pins.find(x => x.id === [...selectedPinIds][0]);
    if (p) redrawDistanceLines(p);
  }
});


/* ── Theme ───────────────────────────────────────────────── */

/** Toggle between dark and light mode, swap tile layers, persist preference. */
function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  document.getElementById('theme-icon').textContent = isDark ? '🌙' : '☀️';

  // Swap the tile layer
  map.removeLayer(activeTile);
  activeTile = L.tileLayer(isDark ? TILES.dark : TILES.light, tileOpts()).addTo(map);

  // Update ghost pin colour to match the placed-pin colour for this theme
  updateGhostPinColor();

  // Refresh all marker colours for the new palette
  updateAllMarkerIcons();

  // Re-draw distance lines so they pick up the correct highlight colour
  if (selectedPinIds.size > 0) {
    if (selectedPinIds.size === 1) {
      const p = pins.find(x => x.id === [...selectedPinIds][0]);
      if (p) redrawDistanceLines(p);
    } else {
      redrawDistanceLinesMulti([...selectedPinIds]);
    }
  }

  localStorage.setItem('pinpoint_theme', isDark ? 'dark' : 'light');
}

/** Re-apply the correct icon colour to every marker and its world copies after a theme change. */
function updateAllMarkerIcons() {
  pins.forEach(p => {
    const type = selectedPinIds.has(p.id) ? 'selected'
               : p.id === closestPinId    ? 'closest'
               : 'normal';
    const icon = makeIcon(type);
    p.marker.setIcon(icon);
    (p.copyMarkers || []).forEach(cm => cm.setIcon(icon));
  });
}

/** Sync the ghost-pin SVG fill and drop-shadow to the current theme's normal-pin colour. */
function updateGhostPinColor() {
  const color     = isDark ? '#e8ff47' : '#5c6bc0';
  const shadowRgb = isDark ? '232,255,71' : '92,107,192';
  const path = document.getElementById('ghost-pin-path');
  const svg  = document.querySelector('#ghost-pin svg');
  if (path) path.setAttribute('fill', color);
  if (svg)  svg.style.filter = `drop-shadow(0 2px 6px rgba(${shadowRgb},0.5))`;
}


/* ── Marker icons ────────────────────────────────────────── */

/**
 * Build a Leaflet divIcon containing an inline SVG pin shape.
 * @param {'normal'|'selected'|'closest'} type
 */
function makeIcon(type) {
  const dark  = { normal: '#e8ff47', selected: '#ff6b35', closest: '#4af0c4' };
  const light = { normal: '#5c6bc0', selected: '#ff6b35', closest: '#00897b' };
  const cols  = isDark ? dark : light;
  const fill  = cols[type] || cols.normal;
  const w = 26, h = 34;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 28 36">
    <path d="M14 2C8.48 2 4 6.48 4 12c0 7.5 10 22 10 22S24 19.5 24 12c0-5.52-4.48-10-10-10z" fill="${fill}" opacity="0.93"/>
    <circle cx="14" cy="12" r="4.5" fill="#0a0c10" opacity="0.6"/>
  </svg>`;

  return L.divIcon({
    html:         svg,
    className:    '',
    iconSize:     [w, h],
    iconAnchor:   [w / 2, h],
    popupAnchor:  [0, -(h + 4)]
  });
}


/* ── Ghost-pin cursor ────────────────────────────────────── */
// A semi-transparent pin SVG that follows the cursor while in "drop mode"
// (i.e. no pin is selected and the user can click to add a new pin).

const ghostPin = document.getElementById('ghost-pin');
let ghostVisible = false;
let overMarker   = false;  // true while the cursor is over an existing marker
let isDragging   = false;  // true while the user is panning the map

/** Show or hide the ghost pin. */
function setGhostVisible(v) {
  ghostVisible = v;
  ghostPin.classList.toggle('visible', v);
}

// Move ghost to cursor position
map.getContainer().addEventListener('mousemove', e => {
  // Hide ghost when a pin is selected, hovering a marker, or dragging
  if (selectedPinIds.size > 0 || overMarker || isDragging) {
    setGhostVisible(false);
    return;
  }

  const rect = map.getContainer().getBoundingClientRect();
  ghostPin.style.left = (e.clientX - rect.left) + 'px';
  ghostPin.style.top  = (e.clientY - rect.top)  + 'px';
  setGhostVisible(true);
});

// Hide when cursor leaves the map container
map.getContainer().addEventListener('mouseleave', () => setGhostVisible(false));

// Track map drag state for ghost pin suppression and grab cursor
map.on('dragstart', () => {
  isDragging = true;
  setGhostVisible(false);
  map.getContainer().classList.add('is-dragging');
});
map.on('dragend', () => {
  isDragging = false;
  map.getContainer().classList.remove('is-dragging');
});


/* ── Land / water detection ──────────────────────────────── */

/**
 * Ask Nominatim whether a coordinate is on land.
 * Returns true if the reverse geocode finds a country address,
 * false if it's open water, and true on network error (fail-open).
 */
async function isOnLand(lat, lng) {
  const nLng = normalizeLng(lng);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${nLng}&format=json&zoom=10&accept-language=en`,
      { headers: { 'Accept-Language': 'en-US,en;q=0.9' } }
    );
    const data = await res.json();
    return !!(data && data.address && data.address.country);
  } catch (e) {
    return true; // fail open — don't block the user on network issues
  }
}

/** Show the "🌊 Can't place a pin in the water" toast briefly. */
let waterToastTimer = null;
function showWaterToast() {
  const el = document.getElementById('water-toast');
  el.classList.add('show');
  clearTimeout(waterToastTimer);
  waterToastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}


/* ── Map click — the main entry point for dropping pins ──── */

map.on('click', async e => {
  // Deselect any active pins first, but don't bail out —
  // continue to drop a new pin so the user doesn't lose a click.
  if (selectedPinIds.size > 0) deselectAll();

  // Hide ghost while we do the async land check
  setGhostVisible(false);

  const lat = e.latlng.lat;
  const lng = normalizeLng(e.latlng.lng);

  const hint = document.getElementById('map-hint');
  hint.textContent = 'Checking location…';

  const onLand = await isOnLand(lat, lng);
  hint.textContent = 'Click anywhere on the map to drop a pin';

  if (!onLand) { showWaterToast(); return; }

  // Open the new-pin modal with the clicked coordinates pre-filled
  pendingLatLng = { lat, lng };
  openNew(pendingLatLng);
});
