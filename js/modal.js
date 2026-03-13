/* ============================================================
   modal.js — All modal dialogs:
     • Add Pin / Edit Pin modal
     • Go to Coordinates modal
     • Place-name geocoding (Nominatim forward search)
   ============================================================ */


/* ── Add / Edit Pin modal ────────────────────────────────── */

/**
 * Open the New Pin modal pre-filled with coordinates from a map click.
 * @param {{lat: number, lng: number}} ll
 */
function openNew(ll) {
  modalMode  = 'new';
  modalPinId = null;
  document.getElementById('modal-title').innerHTML   = 'New <span>Pin</span>';
  document.getElementById('modal-name').value        = '';
  document.getElementById('modal-name').placeholder  = autoName(ll);
  document.getElementById('modal-desc').value        = '';
  document.getElementById('modal-place-search').value = '';
  document.getElementById('place-search-hint').textContent = 'Search fills in coordinates automatically.';
  document.getElementById('place-search-hint').style.color = '';
  document.getElementById('modal-coords').value      = fmtLL(ll.lat, ll.lng);
  document.getElementById('modal-coords').classList.remove('error');
  document.getElementById('coords-hint').textContent = 'You can edit coordinates here to reposition the pin.';
  document.getElementById('coords-hint').classList.remove('err');
  document.getElementById('modal-save-btn').textContent = 'Drop Pin';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 80);
}

/**
 * Open the Add Pin modal with blank fields (via the sidebar button).
 * No coordinates are pre-filled; the user must search or type them.
 */
function openAddPin() {
  modalMode    = 'new';
  modalPinId   = null;
  pendingLatLng = null;
  document.getElementById('modal-title').innerHTML   = 'New <span>Pin</span>';
  document.getElementById('modal-name').value        = '';
  document.getElementById('modal-name').placeholder  = 'e.g. Eiffel Tower, Home…';
  document.getElementById('modal-desc').value        = '';
  document.getElementById('modal-place-search').value = '';
  document.getElementById('place-search-hint').textContent = 'Search fills in coordinates automatically.';
  document.getElementById('place-search-hint').style.color = '';
  document.getElementById('modal-coords').value      = '';
  document.getElementById('modal-coords').classList.remove('error');
  document.getElementById('coords-hint').textContent = 'Enter coordinates: lat, lng (e.g. 48.8566, 2.3522)';
  document.getElementById('coords-hint').classList.remove('err');
  document.getElementById('modal-save-btn').textContent = 'Drop Pin';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 80);
}

/**
 * Open the Edit modal pre-filled with the pin's existing data.
 */
function openEdit(pinId) {
  const p = pins.find(x => x.id === pinId);
  if (!p) return;
  modalMode  = 'edit';
  modalPinId = pinId;
  document.getElementById('modal-title').innerHTML   = 'Edit <span>Pin</span>';
  document.getElementById('modal-name').value        = p.name;
  document.getElementById('modal-name').placeholder  = '';
  document.getElementById('modal-desc').value        = p.desc || '';
  document.getElementById('modal-coords').value      = fmtLL(p.lat, p.lng);
  document.getElementById('modal-coords').classList.remove('error');
  document.getElementById('coords-hint').textContent = 'Edit coordinates to move this pin to a new location.';
  document.getElementById('coords-hint').classList.remove('err');
  document.getElementById('modal-save-btn').textContent = 'Save Changes';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('modal-name').focus(), 80);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  pendingLatLng = null;
  modalPinId    = null;
}

/**
 * Validate inputs, land-check if needed, then create or update the pin.
 */
async function saveModal() {
  const name      = document.getElementById('modal-name').value.trim();
  const desc      = document.getElementById('modal-desc').value.trim();
  const coordStr  = document.getElementById('modal-coords').value.trim();
  const coordsEl  = document.getElementById('modal-coords');
  const hintEl    = document.getElementById('coords-hint');

  let parsedCoords = null;

  if (coordStr) {
    parsedCoords = parseCoords(coordStr);
    if (!parsedCoords) {
      coordsEl.classList.add('error');
      hintEl.textContent = 'Invalid coordinates — use: lat, lng (e.g. 48.8566, 2.3522)';
      hintEl.classList.add('err');
      coordsEl.focus();
      return;
    }
  }

  coordsEl.classList.remove('error');
  hintEl.classList.remove('err');

  if (modalMode === 'new') {
    const ll = parsedCoords || pendingLatLng;

    if (!ll) {
      coordsEl.classList.add('error');
      hintEl.textContent = 'Please enter coordinates — lat, lng (e.g. 48.8566, 2.3522)';
      hintEl.classList.add('err');
      coordsEl.focus();
      return;
    }

    // Only re-check land for manually typed coordinates (not for map clicks
    // which were already verified before the modal opened)
    if (parsedCoords || !pendingLatLng) {
      hintEl.textContent = 'Checking location…';
      const land = await isOnLand(ll.lat, ll.lng);
      if (!land) {
        coordsEl.classList.add('error');
        hintEl.textContent = '🌊 Those coordinates are in the water — please use land coordinates.';
        hintEl.classList.add('err');
        coordsEl.focus();
        return;
      }
      hintEl.textContent = 'You can edit coordinates here to reposition the pin.';
    }

    const finalName = name || autoName(ll);
    const pin = addPin(ll.lat, ll.lng, finalName, desc);
    savePins();
    renderPinList();
    map.setView([ll.lat, ll.lng], Math.max(map.getZoom(), 5), { animate: true });
    // Auto-select the new pin if there are others to compare
    if (pins.length >= 2) togglePin(pin.id, false);

  } else {
    // Edit mode — update the existing pin in place
    const p = pins.find(x => x.id === modalPinId);
    if (p) {
      if (name) p.name = name;
      p.desc = desc;
      if (parsedCoords) {
        p.lat = parsedCoords.lat;
        p.lng = parsedCoords.lng;
        p.marker.setLatLng([p.lat, p.lng]);
        // Update all world-copy markers to the new position
        const offsets = [-720, -360, 360, 720];
        (p.copyMarkers || []).forEach((cm, i) => cm.setLatLng([p.lat, p.lng + offsets[i]]));
        map.setView([p.lat, p.lng], Math.max(map.getZoom(), 5), { animate: true });
      }
      savePins();
      renderPinList();
      if (selectedPinIds.has(modalPinId)) refreshSelection();
    }
  }

  closeModal();
}


/* ── Place-name search inside the modal ──────────────────── */

/**
 * Forward-geocode the text in #modal-place-search via Nominatim,
 * fill in the coordinates field, and pan the map.
 */
async function searchPlaceForPin() {
  const query  = document.getElementById('modal-place-search').value.trim();
  const hintEl = document.getElementById('place-search-hint');
  const btn    = document.getElementById('modal-place-btn');

  if (!query) {
    hintEl.textContent = 'Please enter a place name first.';
    hintEl.style.color = 'var(--accent2)';
    return;
  }

  btn.textContent = '…';
  btn.disabled    = true;
  hintEl.style.color    = 'var(--muted)';
  hintEl.textContent    = 'Searching…';

  try {
    const url  = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1&accept-language=en`;
    const res  = await fetch(url, { headers: { 'Accept-Language': 'en-GB,en;q=0.9' } });
    const data = await res.json();

    if (!data || !data[0]) {
      hintEl.textContent = `No results found for "${query}". Try a different name.`;
      hintEl.style.color = 'var(--accent2)';
      btn.textContent    = 'Search';
      btn.disabled       = false;
      return;
    }

    const result = data[0];
    const lat    = parseFloat(result.lat);
    const lng    = parseFloat(result.lon);

    // Reject water results
    const land = await isOnLand(lat, lng);
    if (!land) {
      hintEl.textContent = '🌊 That location is in the water — try a more specific name.';
      hintEl.style.color = 'var(--accent2)';
      btn.textContent    = 'Search';
      btn.disabled       = false;
      return;
    }

    // Fill in the coordinates field
    document.getElementById('modal-coords').value = fmtLL(lat, lng);
    document.getElementById('modal-coords').classList.remove('error');
    document.getElementById('coords-hint').textContent =
      `Found: ${result.display_name.split(',').slice(0, 3).join(', ')}`;
    document.getElementById('coords-hint').classList.remove('err');

    // Auto-fill the name field if still blank
    if (!document.getElementById('modal-name').value.trim())
      document.getElementById('modal-name').value = result.display_name.split(',')[0].trim();

    hintEl.textContent = '✓ Coordinates filled in below.';
    hintEl.style.color = 'var(--accent3)';

    map.flyTo([lat, lng], Math.max(map.getZoom(), 8), { animate: true, duration: 1.0 });

  } catch (e) {
    hintEl.textContent = 'Search failed — check your connection.';
    hintEl.style.color = 'var(--accent2)';
  }

  btn.textContent = 'Search';
  btn.disabled    = false;
}


/* ── Go to Coordinates modal ─────────────────────────────── */

function openGoto() {
  document.getElementById('goto-lat').value       = '';
  document.getElementById('goto-lng').value       = '';
  document.getElementById('goto-err').textContent = '';
  document.getElementById('goto-overlay').classList.add('open');
  setTimeout(() => document.getElementById('goto-lat').focus(), 80);
}

function closeGoto() {
  document.getElementById('goto-overlay').classList.remove('open');
}

/**
 * Fly the map to the entered coordinates.
 * @param {boolean} dropPin — if true, also open the new-pin modal
 */
function confirmGoto(dropPin) {
  const latStr  = document.getElementById('goto-lat').value.trim();
  const lngStr  = document.getElementById('goto-lng').value.trim();
  const errEl   = document.getElementById('goto-err');
  const combined = parseCoords(latStr + (lngStr ? ',' + lngStr : ''));

  if (!combined) {
    errEl.textContent = 'Invalid coordinates. Lat: −90 to 90, Lng: −180 to 180.';
    return;
  }

  errEl.textContent = '';
  closeGoto();
  map.setView([combined.lat, combined.lng], Math.max(map.getZoom(), 6), { animate: true });

  if (dropPin) {
    // Brief delay lets the fly animation start before the modal appears
    setTimeout(() => { pendingLatLng = combined; openNew(combined); }, 350);
  }
}


/* ── Keyboard shortcuts ──────────────────────────────────── */

document.addEventListener('keydown', e => {
  // Inside the pin modal
  if (document.getElementById('modal-overlay').classList.contains('open')) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') saveModal();
  }

  // Inside the goto modal — Enter = Fly & Drop
  if (document.getElementById('goto-overlay').classList.contains('open')) {
    if (e.key === 'Escape') closeGoto();
    if (e.key === 'Enter')  confirmGoto(true);
  }

  // Escape anywhere else deselects the current pin
  if (
    e.key === 'Escape' &&
    selectedPinIds.size > 0 &&
    !document.getElementById('modal-overlay').classList.contains('open') &&
    !document.getElementById('goto-overlay').classList.contains('open')
  ) {
    deselectAll();
  }
});

// Clicking the overlay backdrop closes the modal
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});
document.getElementById('goto-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('goto-overlay')) closeGoto();
});

// Enter in the place-search field triggers the search
document.getElementById('modal-place-search').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.stopPropagation(); searchPlaceForPin(); }
});
