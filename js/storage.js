/* ============================================================
   storage.js — localStorage persistence
   Saves/loads pins, custom order, groups, and theme preference.
   ============================================================ */

/**
 * Persist the current pin list, order, and groups to localStorage.
 * Called after any mutation (add, edit, delete, drag, group change).
 */
function savePins() {
  // Only serialise plain data — the Leaflet marker is excluded
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(pins.map(({ id, name, desc, lat, lng, hidden }) => ({ id, name, desc: desc || '', lat, lng, hidden: hidden || false })))
  );
  localStorage.setItem('pinpoint_order',  JSON.stringify(pinOrder));
  localStorage.setItem('pinpoint_groups', JSON.stringify(
    groups.map(({ id, name, color, collapsed, pinIds }) => ({ id, name, color, collapsed, pinIds }))
  ));


}

/**
 * Restore pins, order, and groups from localStorage on page load.
 * Stale IDs (pins that no longer exist) are cleaned up automatically.
 */
function loadPins() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    // Recreate each pin's marker on the map
    JSON.parse(raw).forEach(p => {
      const pin = addPin(p.lat, p.lng, p.name, p.desc || '', p.id);
      if (p.hidden) {
        pin.hidden = true;
        pin.marker.setOpacity(0.25);
        (pin.copyMarkers || []).forEach(cm => cm.setOpacity(0.25));
      }
    });

    // Restore custom order
    const ord = localStorage.getItem('pinpoint_order');
    if (ord) pinOrder = JSON.parse(ord);

    // Restore groups
    const grp = localStorage.getItem('pinpoint_groups');
    if (grp) groups = JSON.parse(grp);

    // Remove any IDs that no longer have a corresponding pin
    const allIds = new Set(pins.map(p => p.id));
    pinOrder = pinOrder.filter(id => allIds.has(id));
    groups   = groups.map(g => ({ ...g, pinIds: g.pinIds.filter(id => allIds.has(id)) }));

    // Ensure every pin appears in the order array
    pins.forEach(p => { if (!pinOrder.includes(p.id)) pinOrder.push(p.id); });

  } catch (e) {
    // Silently swallow parse errors — bad data in localStorage shouldn't crash the app
  }
}
