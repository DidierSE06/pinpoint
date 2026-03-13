/* ============================================================
   list.js — Sidebar pin list: rendering, view modes, groups,
             and drag-and-drop reordering.
   ============================================================ */


/* ── List mode toggle ────────────────────────────────────── */

/**
 * Switch between 'custom' (drag + groups) and 'distance' (sorted by
 * proximity to the selected pin) views.
 */
function setListMode(mode) {
  listMode = mode;
  document.getElementById('btn-mode-custom').classList.toggle('active',   mode === 'custom');
  document.getElementById('btn-mode-distance').classList.toggle('active', mode === 'distance');
  renderPinList();
}


/* ── Main render function ────────────────────────────────── */

/** Re-render the entire pin list in the sidebar. */
function renderPinList() {
  const el = document.getElementById('pin-list');
  document.getElementById('pin-count').textContent = pins.length;

  // Only show the "New Group" button in custom mode when there are pins and nothing is selected
  document.getElementById('btn-add-group').style.display =
    (listMode === 'custom' && pins.length > 0 && selectedPinIds.size === 0) ? '' : 'none';

  if (!pins.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="icon">🗺️</div>
      <p>No pins yet.<br>Click the map to start!</p>
    </div>`;
    return;
  }

  // When a pin is selected, or the user explicitly picked 'distance' mode,
  // render a flat distance-sorted list instead of the drag/group view.
  if (listMode === 'distance' || selectedPinIds.size > 0) {
    renderDistanceList(el);
  } else {
    renderCustomList(el);
  }
}


/* ── Distance-sorted list ────────────────────────────────── */

function renderDistanceList(el) {
  let orderedPins = [...pins];
  let distMap     = {};

  const primaryId = selectedPinIds.size > 0
    ? [...selectedPinIds][selectedPinIds.size - 1]
    : null;

  if (primaryId) {
    const selPin = pins.find(p => p.id === primaryId);
    if (selPin) {
      // Sort unselected pins by distance from the primary
      const others = pins
        .filter(p => !selectedPinIds.has(p.id))
        .map(p => { const d = haversine(selPin.lat, selPin.lng, p.lat, p.lng); distMap[p.id] = d; return { pin: p, dist: d }; })
        .sort((a, b) => a.dist - b.dist);

      const selPins = [...selectedPinIds].map(id => pins.find(p => p.id === id)).filter(Boolean);
      orderedPins   = [...selPins, ...others.map(o => o.pin)];
    }
  }

  el.innerHTML = orderedPins.map((p, idx) => {
    const isSel      = selectedPinIds.has(p.id);
    const isClo      = p.id === closestPinId;
    const selCount   = selectedPinIds.size;
    const distText   = (primaryId && !isSel && distMap[p.id] !== undefined) ? fmt(distMap[p.id]) : '';
    const rankText   = (primaryId && !isSel && idx >= selCount) ? `#${idx - selCount + 1}` : '';

    return `<div class="pin-item ${isSel ? 'selected' : ''} ${isClo && !isSel ? 'closest-highlight' : ''}"
        onclick="handlePinRowClick(event,'${p.id}')">
      <div class="pin-dot"></div>
      <div class="pin-info">
        <div class="pin-name" title="${esc(p.name)}">${esc(p.name)}</div>
        <div class="pin-coords">${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}</div>
      </div>
      <span class="pin-rank ${rankText ? 'visible' : ''}">${rankText}</span>
      <span class="pin-dist-tag ${distText ? 'visible' : ''}">${distText}</span>
      <div class="pin-actions">
        <button class="pin-btn edit" onclick="event.stopPropagation();openEdit('${p.id}')" title="Edit">✎</button>
        <button class="pin-btn del"  onclick="event.stopPropagation();removePin('${p.id}')" title="Delete">✕</button>
      </div>
    </div>`;
  }).join('');
}


/* ── Custom order + groups list ──────────────────────────── */

function renderCustomList(el) {
  // Ensure pinOrder contains exactly the current pin IDs
  pins.forEach(p => { if (!pinOrder.includes(p.id)) pinOrder.push(p.id); });
  pinOrder = pinOrder.filter(id => pins.find(p => p.id === id));

  const groupedIds = new Set(groups.flatMap(g => g.pinIds));
  const ungrouped  = pinOrder.filter(id => !groupedIds.has(id));

  let html = '';

  // Render each group
  groups.forEach(g => {
    const gPins = g.pinIds.map(id => pins.find(p => p.id === id)).filter(Boolean);
    const allSel = gPins.length > 0 && gPins.every(p => selectedPinIds.has(p.id));
    const someSel = gPins.some(p => selectedPinIds.has(p.id));
    const groupSelClass = allSel ? 'group-all-selected' : someSel ? 'group-some-selected' : '';
    const selBtnClass   = allSel ? 'all' : someSel ? 'some' : '';
    const selBtnIcon    = allSel ? '✓' : someSel ? '–' : '✓';
    const selBtnTitle   = allSel ? 'Deselect all pins in group' : 'Select all pins in group';

    html += `<div class="pin-group ${g.collapsed ? 'collapsed' : ''} ${groupSelClass}"
        data-group-id="${g.id}"
        ondragover="onDragOverGroup(event,'${g.id}')"
        ondrop="onDropGroup(event,'${g.id}')">

      <div class="pin-group-header">
        <span class="pin-group-chevron"
          onclick="toggleGroupCollapse('${g.id}')" title="Collapse/expand">▾</span>
        <div class="pin-group-color"
          style="width:8px;height:8px;border-radius:50%;background:${g.color};flex-shrink:0"></div>
        <input class="pin-group-name-input"
          data-group-input="${g.id}"
          value="${esc(g.name)}"
          onclick="event.stopPropagation()"
          onblur="renameGroup('${g.id}',this.value)"
          onkeydown="if(event.key==='Enter')this.blur()"
          title="Click to rename" />
        <span class="pin-group-count">${gPins.length}</span>
        <button class="pin-group-select-btn ${selBtnClass}"
          onclick="selectGroup('${g.id}',event)"
          title="${selBtnTitle}">${selBtnIcon}</button>
        <button class="pin-group-del"
          onclick="event.stopPropagation();deleteGroup('${g.id}')"
          title="Delete group">✕</button>
      </div>

      <div class="pin-group-body"
        ondragover="event.preventDefault()"
        ondrop="onDropGroup(event,'${g.id}')">
        ${gPins.length === 0
          ? `<div class="pin-group-empty">Drop pins here</div>`
          : gPins.map(p => makePinRow(p, g.id)).join('')}
      </div>
    </div>`;
  });

  // Render ungrouped pins below the groups
  if (ungrouped.length) {
    if (groups.length > 0) html += `<div class="ungrouped-label">Ungrouped</div>`;
    html += ungrouped.map(id => {
      const p = pins.find(x => x.id === id);
      return p ? makePinRow(p, null) : '';
    }).join('');
  }

  el.innerHTML = html || `<div class="empty-state"><div class="icon">🗺️</div><p>No pins yet.</p></div>`;
}


/* ── Pin row HTML ────────────────────────────────────────── */

/**
 * Build the HTML for a single draggable pin row.
 * @param {object} p       — pin object
 * @param {string|null} groupId — group this pin belongs to (null = ungrouped)
 */
function makePinRow(p, groupId) {
  const isSel    = selectedPinIds.has(p.id);
  const isClo    = p.id === closestPinId;
  const isHidden = p.hidden || false;
  const gAttr    = groupId ? `data-pin-group="${groupId}"` : '';

  return `<div class="pin-item ${isSel ? 'selected' : ''} ${isClo && !isSel ? 'closest-highlight' : ''} ${isHidden ? 'pin-hidden' : ''}"
    data-pin-drag="${p.id}" ${gAttr}
    draggable="true"
    ondragstart="onDragStart(event,'${p.id}','${groupId || ''}')"
    ondragend="onDragEnd(event)"
    ondragover="onDragOverPin(event,'${p.id}')"
    ondrop="onDropPin(event,'${p.id}','${groupId || ''}')"
    onclick="handlePinRowClick(event,'${p.id}')">
    <div class="pin-drag-handle" title="Drag to reorder" onclick="event.stopPropagation()">⋮⋮</div>
    <div class="pin-dot"></div>
    <div class="pin-info">
      <div class="pin-name" title="${esc(p.name)}">${esc(p.name)}</div>
      <div class="pin-coords">${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}</div>
    </div>
    <div class="pin-actions">
      <button class="pin-btn visibility ${isHidden ? 'hidden-on' : ''}"
        onclick="event.stopPropagation();togglePinVisibility('${p.id}')"
        title="${isHidden ? 'Show pin' : 'Hide pin'}">${isHidden ? '👁‍🗨' : '👁'}</button>
      ${groupId ? `<button class="pin-btn ungroup" onclick="event.stopPropagation();removePinFromGroup('${p.id}','${groupId}')" title="Remove from group">⊖</button>` : ''}
      <button class="pin-btn edit" onclick="event.stopPropagation();openEdit('${p.id}')" title="Edit">✎</button>
      <button class="pin-btn del"  onclick="event.stopPropagation();removePin('${p.id}')" title="Delete">✕</button>
    </div>
  </div>`;
}

/**
 * Handle a click on a pin row in the sidebar.
 * Pans to the pin when single-selecting.
 */
function handlePinRowClick(e, pinId) {
  const additive = e.ctrlKey || e.metaKey || e.shiftKey;
  togglePin(pinId, additive);
  if (!additive && selectedPinIds.size === 1) {
    const p = pins.find(x => x.id === pinId);
    if (p) map.panTo([p.lat, p.lng], { animate: true, duration: 0.5 });
  }
}


/* ── Group management ────────────────────────────────────── */

/** Create a new group, optionally pre-populated with selected pins. */
function addGroup() {
  const usedColors = groups.map(g => g.color);
  const color  = GROUP_COLORS.find(c => !usedColors.includes(c))
               || GROUP_COLORS[groups.length % GROUP_COLORS.length];
  const initPinIds = [...selectedPinIds];

  const g = {
    id:        `g_${Date.now()}`,
    name:      `Group ${groups.length + 1}`,
    color,
    collapsed: false,
    pinIds:    initPinIds
  };
  groups.push(g);

  // Remove the grouped pins from any other group they were in
  if (initPinIds.length) {
    groups.forEach(og => {
      if (og.id !== g.id) og.pinIds = og.pinIds.filter(id => !initPinIds.includes(id));
    });
  }

  savePins();

  // Deselect everything so the custom list renders immediately and the
  // new group (pre-populated with any selected pins) is visible right away.
  deselectAll();

  // Focus the group name input so the user can rename it immediately
  setTimeout(() => {
    const inp = document.querySelector(`[data-group-input="${g.id}"]`);
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

function deleteGroup(gId) {
  groups = groups.filter(g => g.id !== gId);
  savePins();
  renderPinList();
}

/** Toggle a group's collapsed state directly in the DOM (no full re-render). */
function toggleGroupCollapse(gId) {
  const g = groups.find(x => x.id === gId);
  if (!g) return;
  g.collapsed = !g.collapsed;
  const el = document.querySelector(`[data-group-id="${gId}"]`);
  if (el) el.classList.toggle('collapsed', g.collapsed);
  savePins();
}

/** Click the group header's checkbox to select / deselect all its pins. */
function selectGroup(gId, e) {
  e.stopPropagation();
  const g = groups.find(x => x.id === gId);
  if (!g || !g.pinIds.length) return;

  const allSelected = g.pinIds.every(id => selectedPinIds.has(id));
  if (allSelected) {
    g.pinIds.forEach(id => selectedPinIds.delete(id));
    if (selectedPinIds.size === 0) deselectAll();
    else refreshSelection();
  } else {
    g.pinIds.forEach(id => selectedPinIds.add(id));
    refreshSelection();
  }
}

/** Persist a renamed group without triggering a full list re-render. */
function renameGroup(gId, val) {
  const g = groups.find(x => x.id === gId);
  if (!g) return;
  g.name = val.trim() || g.name;
  savePins();
  // Update the visible name span without re-rendering
  const el = document.querySelector(`[data-group-name="${gId}"]`);
  if (el) el.textContent = g.name;
}

/** Remove a pin from its group and move it back to ungrouped. */
function removePinFromGroup(pinId, gId) {
  const g = groups.find(x => x.id === gId);
  if (!g) return;
  g.pinIds = g.pinIds.filter(id => id !== pinId);
  savePins();
  renderPinList();
}


/* ── Drag & drop ─────────────────────────────────────────── */

function onDragStart(e, pinId, fromGroupId) {
  dragSrcId      = pinId;
  dragSrcGroupId = fromGroupId || null;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', pinId);
  // Defer adding the class so the drag image renders first
  setTimeout(() => {
    const el = document.querySelector(`[data-pin-drag="${pinId}"]`);
    if (el) el.classList.add('dragging');
  }, 0);
}

function onDragEnd() {
  document.querySelectorAll('.dragging,.drag-over-top,.drag-over-bottom,.drop-target,.drag-over')
    .forEach(el => el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom', 'drop-target', 'drag-over'));
  dragSrcId = null;
  dragSrcGroupId = null;
}

function onDragOverPin(e, targetPinId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (dragSrcId === targetPinId) return;

  const el = document.querySelector(`[data-pin-drag="${targetPinId}"]`);
  if (!el) return;

  document.querySelectorAll('.drag-over-top,.drag-over-bottom')
    .forEach(x => x.classList.remove('drag-over-top', 'drag-over-bottom'));

  const rect = el.getBoundingClientRect();
  el.classList.add(e.clientY < rect.top + rect.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
}

function onDropPin(e, targetPinId, targetGroupId) {
  e.preventDefault();
  e.stopPropagation();
  if (!dragSrcId || dragSrcId === targetPinId) return;

  const el     = document.querySelector(`[data-pin-drag="${targetPinId}"]`);
  const before = el && el.classList.contains('drag-over-top');

  // Move out of old group
  if (dragSrcGroupId) {
    const g = groups.find(x => x.id === dragSrcGroupId);
    if (g) g.pinIds = g.pinIds.filter(id => id !== dragSrcId);
  }

  // Move into new group
  if (targetGroupId) {
    const g = groups.find(x => x.id === targetGroupId);
    if (g && !g.pinIds.includes(dragSrcId)) {
      const tIdx = g.pinIds.indexOf(targetPinId);
      if (tIdx >= 0) g.pinIds.splice(before ? tIdx : tIdx + 1, 0, dragSrcId);
      else           g.pinIds.push(dragSrcId);
    }
  }

  // Reorder in the flat pinOrder array
  pinOrder = pinOrder.filter(id => id !== dragSrcId);
  const tIdx = pinOrder.indexOf(targetPinId);
  if (tIdx >= 0) pinOrder.splice(before ? tIdx : tIdx + 1, 0, dragSrcId);
  else           pinOrder.push(dragSrcId);

  savePins();
  renderPinList();
}

function onDragOverGroup(e, gId) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.pin-group').forEach(el => el.classList.remove('drag-over'));
  const el = document.querySelector(`[data-group-id="${gId}"]`);
  if (el) el.classList.add('drag-over');
}

function onDropGroup(e, gId) {
  e.preventDefault();
  if (!dragSrcId) return;
  const g = groups.find(x => x.id === gId);
  if (!g) return;

  // Remove from old group
  if (dragSrcGroupId) {
    const og = groups.find(x => x.id === dragSrcGroupId);
    if (og) og.pinIds = og.pinIds.filter(id => id !== dragSrcId);
  }

  if (!g.pinIds.includes(dragSrcId)) g.pinIds.push(dragSrcId);
  savePins();
  renderPinList();
}
