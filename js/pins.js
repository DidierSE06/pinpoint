/* ============================================================
   pins.js — Pin lifecycle: create, select, deselect, delete, undo.
   Also owns the sidebar info card that shows selection details.
   ============================================================ */


/* ── Popup content factory ───────────────────────────────── */

/**
 * Build the minimal HTML for a marker popup.
 * Shows pin name + Hide, Edit, and Delete buttons.
 */
function makePinPopup(pinId) {
  const p = pins.find(x => x.id === pinId);
  if (!p) return '';
  const isHidden = p.hidden || false;
  return `
    <div class="pin-popup-inner">
      <div class="pin-popup-name">${esc(p.name)}</div>
      <div class="pin-popup-actions">
        <button class="pin-popup-btn hide ${isHidden ? 'active' : ''}"
          onclick="togglePinVisibilityFromPopup('${pinId}')">
          ${isHidden ? '👁 Show' : '👁 Hide'}
        </button>
        <button class="pin-popup-btn edit"
          onclick="map.closePopup();openEdit('${pinId}')">✎ Edit</button>
        <button class="pin-popup-btn del"
          onclick="map.closePopup();removePin('${pinId}')">✕ Delete</button>
      </div>
    </div>`;
}


/* ── Add a pin to the map ────────────────────────────────── */

/**
 * Create a pin object, add a Leaflet marker to the map, bind a popup,
 * and wire up click / hover events.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {string} name
 * @param {string} desc
 * @param {string} [id]  — supply when restoring from storage
 * @returns {object} The new pin object
 */
function addPin(lat, lng, name, desc, id) {
  const pinId  = id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  const marker = L.marker([lat, lng], { icon: makeIcon('normal') }).addTo(map);

  // World-copy markers — duplicate the pin at ±360° so it appears on
  // every horizontal copy of the world when the user scrolls left/right.
  const copyOffsets = [-720, -360, 360, 720];
  const copyMarkers = copyOffsets.map(offset => {
    const cm = L.marker([lat, lng + offset], {
      icon: makeIcon('normal'),
      interactive: true,
      zIndexOffset: -1
    }).addTo(map);
    // Clicking a copy selects the real pin
    cm.on('click', e => {
      L.DomEvent.stopPropagation(e);
      const additive = e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey);
      togglePin(pinId, additive);
    });
    cm.on('mouseover', () => { overMarker = true;  setGhostVisible(false); });
    cm.on('mouseout',  () => { overMarker = false; if (selectedPinIds.size === 0 && !isDragging) setGhostVisible(true); });
    return cm;
  });

  // Hide the ghost pin when the cursor enters a marker
  marker.on('mouseover', () => { overMarker = true;  setGhostVisible(false); });
  // Restore ghost when cursor leaves (only if nothing is selected and not dragging)
  marker.on('mouseout',  () => { overMarker = false; if (selectedPinIds.size === 0 && !isDragging) setGhostVisible(true); });

  // Click selects the pin (Ctrl/Cmd = additive multi-select)
  // Then open a lean popup with name + Hide/Edit/Delete buttons
  marker.on('click', e => {
    L.DomEvent.stopPropagation(e);
    const additive = e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey);
    togglePin(pinId, additive);

    if (!additive) {
      marker.unbindPopup();
      marker.bindPopup(makePinPopup(pinId), {
        closeButton: false,
        className:   'pin-popup',
        offset:      [0, -30],
        autoPan:     false,
        maxWidth:    240,
      }).openPopup();
    }
  });

  const pin = { id: pinId, name, desc: desc || '', lat, lng, hidden: false, marker, copyMarkers };
  pins.push(pin);
  if (!pinOrder.includes(pinId)) pinOrder.push(pinId);
  return pin;
}


/* ── Selection ───────────────────────────────────────────── */

/**
 * Toggle a pin's selected state.
 * @param {boolean} additive — true when Ctrl/Cmd is held (multi-select)
 */
function togglePin(pinId, additive) {
  if (!additive) {
    // Single click on the only selected pin → deselect
    if (selectedPinIds.size === 1 && selectedPinIds.has(pinId)) {
      deselectAll();
      return;
    }
    selectedPinIds.clear();
    selectedPinIds.add(pinId);
  } else {
    // Additive: toggle membership in the selection set
    if (selectedPinIds.has(pinId)) selectedPinIds.delete(pinId);
    else selectedPinIds.add(pinId);
    if (selectedPinIds.size === 0) { deselectAll(); return; }
  }
  refreshSelection();
}

/** Set the icon on a pin's main marker and all its world-copy markers. */
function setPinIcon(pin, type) {
  const icon = makeIcon(type);
  pin.marker.setIcon(icon);
  (pin.copyMarkers || []).forEach(cm => cm.setIcon(icon));
}

/**
 * Recompute colours, lines, badges, and sidebar state after the
 * selection set changes.
 */
function refreshSelection() {
  clearDistanceLines();
  pins.forEach(p => setPinIcon(p, 'normal'));

  const selArray = [...selectedPinIds];
  if (!selArray.length) { deselectAll(); return; }

  // Highlight each selected marker
  selArray.forEach(id => {
    const p = pins.find(x => x.id === id);
    if (p) setPinIcon(p, 'selected');
  });

  // Use the last-clicked pin as the primary for distance calculations
  const primaryId = selArray[selArray.length - 1];
  const primary   = pins.find(p => p.id === primaryId);

  if (selectedPinIds.size === 1) {
    // Single selection: highlight nearest pin, draw all distance lines
    const cl = findClosest(primary);
    closestPinId = cl ? cl.pin.id : null;
    if (cl) setPinIcon(cl.pin, 'closest');
    redrawDistanceLines(primary);
    updateInfoCard(primary, cl);
  } else {
    // Multi-selection: draw lines between selected pins only
    closestPinId = null;
    redrawDistanceLinesMulti(selArray);
    updateInfoCardMulti(selArray);
  }

  // Update the map hint bar
  const hint = document.getElementById('map-hint');
  hint.textContent = selectedPinIds.size === 1
    ? `📍 ${primary.name} — click again to deselect, Ctrl+click to add more`
    : `📍 ${selectedPinIds.size} pins selected — Ctrl+click to toggle`;
  hint.classList.add('selecting');

  // Show the deselect hint below the info card
  const dh = document.getElementById('deselect-hint');
  dh.classList.add('visible');
  dh.textContent = selectedPinIds.size === 1
    ? '🔁 Click pin again · Ctrl+click to multi-select'
    : `✕ ${selectedPinIds.size} pins selected · click map to clear`;

  const others = pins.length - selectedPinIds.size;
  document.getElementById('sidebar-sub').textContent = selectedPinIds.size === 1
    ? `${others} distance${others !== 1 ? 's' : ''} shown`
    : `${selectedPinIds.size} pins selected`;

  document.getElementById('sort-badge').classList.add('visible');
  // Dim the list-mode toggle while distance sort is forced
  document.getElementById('list-mode-toggle').style.opacity       = '0.4';
  document.getElementById('list-mode-toggle').style.pointerEvents = 'none';

  renderPinList();
}

/** Clear the entire selection and reset all UI back to the idle state. */
function deselectAll() {
  map.closePopup();
  clearDistanceLines();
  selectedPinIds.clear();
  closestPinId = null;
  pins.forEach(p => setPinIcon(p, 'normal'));
  setGhostVisible(false); // ghost will reappear on next mousemove

  const card = document.getElementById('info-card');
  card.classList.remove('has-data');
  card.innerHTML = `<div class="info-label">Selected Pin</div>
    <div class="info-empty">Click any pin on the map to see distances to all others.</div>`;

  document.getElementById('deselect-hint').classList.remove('visible');
  const hint = document.getElementById('map-hint');
  hint.textContent = 'Click anywhere on the map to drop a pin';
  hint.classList.remove('selecting');
  document.getElementById('sidebar-sub').textContent = 'Click a pin to inspect';
  document.getElementById('sort-badge').classList.remove('visible');
  document.getElementById('list-mode-toggle').style.opacity       = '';
  document.getElementById('list-mode-toggle').style.pointerEvents = '';

  renderPinList();
}


/* ── Sidebar info card ───────────────────────────────────── */

/** Populate the sidebar info card for a single selected pin. */
function updateInfoCard(pin, cl) {
  const card = document.getElementById('info-card');
  card.classList.add('has-data');
  card.innerHTML = `
    <div class="info-label">Selected Pin</div>
    <div class="info-name">📍 ${esc(pin.name)}</div>
    ${pin.desc ? `<div class="info-desc">${esc(pin.desc)}</div>` : ''}
    <div class="info-coords">${fmtLL(pin.lat, pin.lng)}</div>
    ${cl
      ? `<div class="closest-info">
           <div class="closest-label">Nearest Pin</div>
           <div class="closest-name">◎ ${esc(cl.pin.name)}</div>
           <div class="closest-dist">${fmt(cl.dist)} away</div>
           <div style="font-size:10px;color:var(--muted);margin-top:4px">Ctrl+click to select multiple</div>
         </div>`
      : `<div class="closest-info" style="color:var(--muted);font-size:12px">No other pins to compare.</div>`
    }`;
}

/** Populate the sidebar info card for a multi-pin selection. */
function updateInfoCardMulti(selIds) {
  const card     = document.getElementById('info-card');
  card.classList.add('has-data');

  const selPins  = selIds.map(id => pins.find(p => p.id === id)).filter(Boolean);

  // Total path distance in selection order
  let totalDist = 0;
  for (let i = 0; i < selPins.length - 1; i++)
    totalDist += haversine(selPins[i].lat, selPins[i].lng, selPins[i + 1].lat, selPins[i + 1].lng);

  // Closest pair
  let minDist = Infinity, minA = null, minB = null;
  for (let i = 0; i < selPins.length; i++)
    for (let j = i + 1; j < selPins.length; j++) {
      const d = haversine(selPins[i].lat, selPins[i].lng, selPins[j].lat, selPins[j].lng);
      if (d < minDist) { minDist = d; minA = selPins[i]; minB = selPins[j]; }
    }

  card.innerHTML = `
    <div class="info-label">Multi Selection</div>
    <div class="info-name" style="font-size:14px">📍 ${selPins.length} pins selected</div>
    <div class="info-coords" style="margin-top:4px">${selPins.map(p => esc(p.name)).join(' → ')}</div>
    ${selPins.length >= 2
      ? `<div class="closest-info">
           <div class="closest-label">Path Distance</div>
           <div class="closest-name" style="font-size:13px">⇢ ${fmt(totalDist)}</div>
           <div class="closest-dist">Closest pair: ${esc(minA.name)} ↔ ${esc(minB.name)} · ${fmt(minDist)}</div>
         </div>`
      : ''}`;
}


/* ── Delete with undo ────────────────────────────────────── */

/**
 * Create and show an individual undo toast for one deleted pin.
 * Each deletion gets its own toast — they stack vertically.
 */
function showUndoToast(snapshot) {
  const stack = document.getElementById('undo-toast-stack');

  const toast = document.createElement('div');
  toast.className = 'undo-toast';
  toast.innerHTML = `
    <div class="undo-toast-msg">🗑 <span class="undo-toast-name">${snapshot.name}</span> deleted</div>
    <button class="undo-toast-btn">Undo</button>
    <div class="undo-toast-bar"></div>`;
  stack.appendChild(toast);

  // Wire the undo button to this specific snapshot
  toast.querySelector('.undo-toast-btn').addEventListener('click', () => {
    dismissToast(toast);
    // Remove this snapshot from the stack (it may not be the top one)
    const idx = deleteStack.findIndex(d => d.id === snapshot.id);
    if (idx !== -1) deleteStack.splice(idx, 1);
    restorePin(snapshot);
  });

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // Start progress bar
  const bar = toast.querySelector('.undo-toast-bar');
  bar.style.transition = 'none';
  bar.style.width = '100%';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bar.style.transition = `width ${UNDO_DURATION}ms linear`;
      bar.style.width = '0%';
    });
  });

  // Auto-dismiss after timeout
  snapshot._timer = setTimeout(() => {
    dismissToast(toast);
    const idx = deleteStack.findIndex(d => d.id === snapshot.id);
    if (idx !== -1) deleteStack.splice(idx, 1);
  }, UNDO_DURATION);

  snapshot._toast = toast;
}

/** Animate out and remove a toast element. */
function dismissToast(toast) {
  toast.classList.remove('show');
  toast.classList.add('hiding');
  setTimeout(() => toast.remove(), 300);
}

/** Hide all undo toasts and clear the stack. */
function hideUndoToast() {
  deleteStack.forEach(d => {
    clearTimeout(d._timer);
    if (d._toast) dismissToast(d._toast);
  });
  deleteStack = [];
}

/** Restore a single deleted pin snapshot back onto the map. */
function restorePin(d) {
  const pin = addPin(d.lat, d.lng, d.name, d.desc, d.id);
  savePins();
  renderPinList();
  if (d.wasSelected) {
    togglePin(pin.id, false);
    map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 5), { animate: true });
  }
}

/** Called by legacy onclick — restores the most recently deleted pin. */
function undoDelete() {
  if (!deleteStack.length) return;
  const d = deleteStack.pop();
  clearTimeout(d._timer);
  if (d._toast) dismissToast(d._toast);
  restorePin(d);
}

/**
 * Remove a pin from the map, state, and storage.
 * Pushes a snapshot onto the undo stack and shows its own toast.
 */
function removePin(pinId) {
  const p = pins.find(x => x.id === pinId);
  if (!p) return;

  const snapshot = {
    id:          p.id,
    name:        p.name,
    desc:        p.desc,
    lat:         p.lat,
    lng:         p.lng,
    wasSelected: selectedPinIds.has(pinId)
  };
  deleteStack.push(snapshot);

  map.removeLayer(p.marker);
  (p.copyMarkers || []).forEach(cm => map.removeLayer(cm));
  pins      = pins.filter(x => x.id !== pinId);
  pinOrder  = pinOrder.filter(id => id !== pinId);
  groups    = groups.map(g => ({ ...g, pinIds: g.pinIds.filter(id => id !== pinId) }));
  selectedPinIds.delete(pinId);

  if (selectedPinIds.size === 0) deselectAll();
  else refreshSelection();

  savePins();
  renderPinList();
  showUndoToast(snapshot);
}

/** Toggle a pin's hidden state — hides/shows its marker on the map. */
function togglePinVisibility(pinId) {
  const p = pins.find(x => x.id === pinId);
  if (!p) return;
  p.hidden = !p.hidden;
  const opacity = p.hidden ? 0.25 : 1;
  p.marker.setOpacity(opacity);
  (p.copyMarkers || []).forEach(cm => cm.setOpacity(opacity));
  savePins();

  // If anything is selected, recalculate distances so hidden pins are excluded
  if (selectedPinIds.size > 0) refreshSelection();
  else renderPinList();
}

/**
 * Toggle visibility from the popup — same as above but also
 * reopens the popup so the button label updates in place.
 */
function togglePinVisibilityFromPopup(pinId) {
  togglePinVisibility(pinId);
  const p = pins.find(x => x.id === pinId);
  if (!p) return;
  p.marker.unbindPopup();
  p.marker.bindPopup(makePinPopup(pinId), {
    closeButton: false,
    className:   'pin-popup',
    offset:      [0, -30],
    autoPan:     false,
    maxWidth:    240,
  }).openPopup();
}

/** Prompt the user and remove all pins if confirmed. */
function clearAll() {
  if (!pins.length) return;
  if (!confirm(`Remove all ${pins.length} pin${pins.length > 1 ? 's' : ''}?`)) return;

  hideUndoToast();
  deleteStack = [];

  clearDistanceLines();
  pins.forEach(p => {
    map.removeLayer(p.marker);
    (p.copyMarkers || []).forEach(cm => map.removeLayer(cm));
  });
  pins = []; selectedPinIds.clear(); closestPinId = null;
  pinOrder = []; groups = [];

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('pinpoint_order');
  localStorage.removeItem('pinpoint_groups');

  // Reset all UI back to idle state
  const card = document.getElementById('info-card');
  card.classList.remove('has-data');
  card.innerHTML = `<div class="info-label">Selected Pin</div>
    <div class="info-empty">Click any pin on the map to see distances to all others.</div>`;

  document.getElementById('deselect-hint').classList.remove('visible');
  document.getElementById('map-hint').classList.remove('selecting');
  document.getElementById('map-hint').textContent = 'Click anywhere on the map to drop a pin';
  document.getElementById('sidebar-sub').textContent = 'Click a pin to inspect';
  document.getElementById('sort-badge').classList.remove('visible');
  document.getElementById('list-mode-toggle').style.opacity       = '';
  document.getElementById('list-mode-toggle').style.pointerEvents = '';

  renderPinList();
}
