/* ============================================================
   exportimport.js — JSON export and import of pins, order & groups.
   No dependencies beyond the shared app state.
   ============================================================ */


/* ── Export ──────────────────────────────────────────────── */

/**
 * Serialise the current pins, order, and groups to a JSON file
 * and trigger a browser download.
 */
function exportPins() {
  if (!pins.length) {
    showExportToast('No pins to export.', false);
    return;
  }

  const payload = {
    version:  1,
    exported: new Date().toISOString(),
    pins:     pins.map(({ id, name, desc, lat, lng, hidden }) => ({ id, name, desc: desc || '', lat, lng, hidden: hidden || false })),
    pinOrder,
    groups:   groups.map(({ id, name, color, collapsed, pinIds }) => ({ id, name, color, collapsed, pinIds }))
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pinpoint-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showExportToast(`Exported ${pins.length} pin${pins.length !== 1 ? 's' : ''}.`, true);
}


/* ── Import ──────────────────────────────────────────────── */

/** Open the hidden file input to pick a JSON file. */
function importPins() {
  document.getElementById('import-file-input').click();
}

/**
 * Handle the file chosen by the user.
 * Merges imported pins with existing ones (skips duplicates by ID).
 */
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Reset so the same file can be re-imported if needed
  e.target.value = '';

  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.pins || !Array.isArray(data.pins)) throw new Error('Invalid format');

      const existingIds = new Set(pins.map(p => p.id));
      let added = 0;

      data.pins.forEach(p => {
        if (!p.lat || !p.lng || !p.name) return;
        const id  = (p.id && !existingIds.has(p.id)) ? p.id : undefined;
        const pin = addPin(p.lat, p.lng, p.name, p.desc || '', id);
        if (p.hidden) {
          pin.hidden = true;
          pin.marker.setOpacity(0.25);
          (pin.copyMarkers || []).forEach(cm => cm.setOpacity(0.25));
        }
        added++;
      });

      // Merge order — append imported IDs that aren't already in pinOrder
      if (data.pinOrder) {
        data.pinOrder.forEach(id => {
          const match = pins.find(p => p.name === data.pins.find(dp => dp.id === id)?.name);
          if (match && !pinOrder.includes(match.id)) pinOrder.push(match.id);
        });
      }

      // Merge groups — import groups, remapping pin IDs to the newly created pins
      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach(g => {
          const alreadyExists = groups.find(eg => eg.id === g.id);
          if (!alreadyExists) {
            groups.push({
              id:        g.id,
              name:      g.name,
              color:     g.color,
              collapsed: g.collapsed || false,
              pinIds:    g.pinIds.filter(id => pins.find(p => p.id === id))
            });
          }
        });
      }

      savePins();
      renderPinList();
      showExportToast(`Imported ${added} pin${added !== 1 ? 's' : ''}.`, true);

    } catch (err) {
      showExportToast('Invalid file — please use a PinPoint JSON export.', false);
    }
  };
  reader.readAsText(file);
}


/* ── Toast ───────────────────────────────────────────────── */

let exportToastTimer = null;

function showExportToast(msg, success) {
  const el = document.getElementById('export-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'export-toast show ' + (success ? 'ok' : 'err');
  clearTimeout(exportToastTimer);
  exportToastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}
