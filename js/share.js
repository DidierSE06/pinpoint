/* ============================================================
   share.js — Map sharing feature.

   Two modes:
     OWNER  — Authenticated user creates a public share link.
              Share data is written to Firestore: shares/{shareId}
              The link embeds ?share=<shareId> in the URL.
              Owner can revoke (delete) the share at any time.

     VIEWER — Anyone opening the URL with ?share=<shareId> sees
              the map in read-only mode. No auth required.
              A banner across the top labels it as a shared view.
   ============================================================ */

import { getFirestore, doc, setDoc,
         getDoc, deleteDoc }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getApp }             from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

const db = getFirestore(getApp());

/* ── State ───────────────────────────────────────────────── */
let activeShareId    = null;  // share ID currently owned by this user
let isViewingShare   = false; // true when in read-only viewer mode
let shareCheckTimer  = null;


/* ═══════════════════════════════════════════════════════════
   VIEWER MODE — triggered on page load if ?share= is present
   ═══════════════════════════════════════════════════════════ */

/**
 * Called from bootstrap. Checks for ?share= in the URL and
 * loads that share in read-only mode if found.
 * Returns true if a share was loaded (so bootstrap can skip
 * normal localStorage load).
 */
async function checkShareParam() {
  const shareId = new URLSearchParams(window.location.search).get('share');
  if (!shareId) return false;

  isViewingShare = true;

  // Show a loading state
  showShareViewerBanner('⏳ Loading shared map…', false);

  try {
    const snap = await getDoc(doc(db, 'shares', shareId));
    if (!snap.exists()) {
      showShareViewerBanner('❌ This share link has expired or been removed.', false);
      return true;
    }

    const data = snap.data();

    // Load the shared pins (read-only — no auth, no saving)
    clearDistanceLines();
    pins.forEach(p => map.removeLayer(p.marker));
    pins = []; selectedPinIds.clear(); closestPinId = null;
    pinOrder = []; groups = [];

    (data.pins || []).forEach(p => addPin(p.lat, p.lng, p.name, p.desc || '', p.id));
    pinOrder = (data.pinOrder || []).filter(id => pins.find(p => p.id === id));
    groups   = (data.groups   || []).map(g => ({
      ...g, pinIds: g.pinIds.filter(id => pins.find(p => p.id === id))
    }));
    pins.forEach(p => { if (!pinOrder.includes(p.id)) pinOrder.push(p.id); });

    renderPinList();
    deselectAll();

    // Fit the map to all pins
    if (pins.length > 0) {
      const lats = pins.map(p => p.lat), lngs = pins.map(p => p.lng);
      const bounds = L.latLngBounds(
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)]
      );
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10, animate: true });
    }

    const ownerName = data.ownerName || 'Someone';
    const pinCount  = (data.pins || []).length;
    showShareViewerBanner(
      `👁 Viewing <strong>${esc(ownerName)}'s</strong> map — ${pinCount} pin${pinCount !== 1 ? 's' : ''}`,
      true
    );

    // Lock out all editing UI
    lockReadOnlyUI();

    return true;
  } catch (e) {
    showShareViewerBanner('❌ Could not load shared map. Check your connection.', false);
    return true;
  }
}

/** Show the read-only viewer banner at the top of the map. */
function showShareViewerBanner(html, showImportBtn) {
  let banner = document.getElementById('share-viewer-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'share-viewer-banner';
    document.querySelector('.main').prepend(banner);
  }
  banner.innerHTML = `
    <span>${html}</span>
    <div style="display:flex;gap:8px;align-items:center;">
      ${showImportBtn ? `<button class="share-banner-btn primary" onclick="importSharedPins()">⊕ Import to my map</button>` : ''}
      <button class="share-banner-btn" onclick="exitShareView()">✕ Exit</button>
    </div>`;
  banner.classList.add('visible');
}

/** Disable all editing controls when viewing a shared map. */
function lockReadOnlyUI() {
  // Hide add/edit/delete controls
  document.querySelectorAll(
    '.btn-sidebar-action, .btn-clear, .btn-add-group, #btn-add-group, #account-btn'
  ).forEach(el => el.style.display = 'none');

  // Show a "read only" chip in the sidebar header
  const sub = document.getElementById('sidebar-sub');
  if (sub) sub.innerHTML = '<span class="readonly-chip">Read only</span>';

  // Disable map click (can't drop pins)
  map.off('click');
}

/** Strip the ?share= param and reload so the user gets their own map back. */
function exitShareView() {
  window.location.href = window.location.pathname;
}

/**
 * Copy all pins from the shared view into the viewer's own account/localStorage.
 * Works whether or not the viewer is signed in.
 */
async function importSharedPins() {
  const count = pins.length;
  if (!count) return;

  const existing = [...pins]; // already on map from share load

  // Persist them
  savePins();

  const banner = document.getElementById('share-viewer-banner');
  if (banner) {
    banner.querySelector('span').innerHTML =
      `✓ Imported ${count} pin${count !== 1 ? 's' : ''} to your map!`;
    banner.querySelector('.share-banner-btn.primary').remove();
  }

  // Unlock the UI and remove read-only restrictions
  isViewingShare = false;
  unlockUI();

  // Strip the share param without a page reload
  const url = new URL(window.location);
  url.searchParams.delete('share');
  window.history.replaceState({}, '', url);
}

function unlockUI() {
  document.querySelectorAll(
    '.btn-sidebar-action, .btn-clear, #account-btn'
  ).forEach(el => el.style.display = '');
  const sub = document.getElementById('sidebar-sub');
  if (sub) sub.textContent = 'Click a pin to inspect';

  // Re-attach map click handler
  map.on('click', async e => {
    if (selectedPinIds.size > 0) { deselectAll(); return; }
    setGhostVisible(false);
    const lat = e.latlng.lat, lng = normalizeLng(e.latlng.lng);
    const hint = document.getElementById('map-hint');
    hint.textContent = 'Checking location…';
    const onLand = await isOnLand(lat, lng);
    hint.textContent = 'Click anywhere on the map to drop a pin';
    if (!onLand) { showWaterToast(); return; }
    pendingLatLng = { lat, lng };
    openNew(pendingLatLng);
  });
}


/* ═══════════════════════════════════════════════════════════
   OWNER MODE — create / copy / revoke share links
   ═══════════════════════════════════════════════════════════ */

/** Open the Share modal. Populate it based on whether a share exists. */
async function openShareModal() {
  if (!pins.length) {
    showShareToast('Add some pins first!', false);
    return;
  }

  document.getElementById('share-overlay').classList.add('open');
  setShareModalState('loading');

  // Check for an existing share by looking up the user's stored shareId
  try {
    const storedId = window.currentUser
      ? (await getDoc(doc(db, 'users', window.currentUser?.uid))).data()?.shareId
      : localStorage.getItem('pinpoint_shareId');

    if (storedId) {
      const snap = await getDoc(doc(db, 'shares', storedId));
      if (snap.exists()) {
        activeShareId = storedId;
        const link = buildShareLink(storedId);
        setShareModalState('active', link);
        return;
      }
    }
    // No active share
    activeShareId = null;

    // Show a preview of which pins will be shared
    const preview = document.getElementById('share-pin-preview');
    if (preview) {
      const shown = pins.slice(0, 5);
      const extra = pins.length - shown.length;
      preview.innerHTML = shown.map(p =>
        `<div class="share-pin-chip">📍 ${esc(p.name)}</div>`
      ).join('') + (extra > 0 ? `<div class="share-pin-chip muted">+${extra} more</div>` : '');
    }

    setShareModalState('idle');
  } catch (e) {
    setShareModalState('idle');
  }
}

function closeShareModal() {
  document.getElementById('share-overlay').classList.remove('open');
}

/** Create a new share document in Firestore and show the link. */
async function createShare() {
  setShareModalState('loading');

  const shareId = generateShareId();
  const ownerName = window.currentUser?.displayName || window.currentUser?.email || 'Anonymous';

  const shareData = {
    pins:      pins.map(({ id, name, desc, lat, lng }) => ({ id, name, desc: desc || '', lat, lng })),
    pinOrder,
    groups:    groups.map(({ id, name, color, collapsed, pinIds }) => ({ id, name, color, collapsed, pinIds })),
    ownerName,
    ownerId:   window.currentUser?.uid || null,
    createdAt: Date.now()
  };

  try {
    await setDoc(doc(db, 'shares', shareId), shareData);

    // Store the shareId against the user so they can revoke it later
    if (window.currentUser) {
      await setDoc(doc(db, 'users', window.currentUser?.uid), { shareId }, { merge: true });
    } else {
      localStorage.setItem('pinpoint_shareId', shareId);
    }

    activeShareId = shareId;
    const link = buildShareLink(shareId);
    setShareModalState('active', link);
    showShareToast('Share link created!', true);
  } catch (e) {
    console.error('createShare failed:', e);
    setShareModalState('idle');
    showShareToast(
      e.code === 'permission-denied'
        ? 'Permission denied — check your Firestore rules allow writes to the shares collection.'
        : 'Failed to create share link. Check console for details.',
      false
    );
  }
}

/** Delete the share document, making the link dead. */
async function revokeShare() {
  if (!activeShareId) return;
  setShareModalState('loading');

  try {
    await deleteDoc(doc(db, 'shares', activeShareId));

    if (window.currentUser) {
      await setDoc(doc(db, 'users', window.currentUser?.uid), { shareId: null }, { merge: true });
    } else {
      localStorage.removeItem('pinpoint_shareId');
    }

    activeShareId = null;
    setShareModalState('idle');
    showShareToast('Share link revoked.', false);
  } catch (e) {
    showShareToast('Could not revoke link. Try again.', false);
    setShareModalState('active', buildShareLink(activeShareId));
  }
}

/**
 * Refresh the share with the current pin state (call after savePins
 * if the user has an active share so it stays up to date).
 */
async function refreshShareIfActive() {
  if (!activeShareId) return;
  try {
    const ownerName = window.currentUser?.displayName || window.currentUser?.email || 'Anonymous';
    await setDoc(doc(db, 'shares', activeShareId), {
      pins:      pins.map(({ id, name, desc, lat, lng }) => ({ id, name, desc: desc || '', lat, lng })),
      pinOrder,
      groups:    groups.map(({ id, name, color, collapsed, pinIds }) => ({ id, name, color, collapsed, pinIds })),
      ownerName,
      ownerId:   window.currentUser?.uid || null,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (e) {
    console.warn('Share refresh failed:', e);
  }
}

/** Copy the share link to clipboard and flash the button. */
async function copyShareLink() {
  const link = document.getElementById('share-link-input').value;
  try {
    await navigator.clipboard.writeText(link);
    const btn = document.getElementById('share-copy-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = 'var(--accent3)';
    btn.style.color = '#0a0c10';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.color = '';
    }, 2000);
  } catch (e) {
    // Fallback: select the input text
    document.getElementById('share-link-input').select();
  }
}


/* ── Share modal state machine ───────────────────────────── */

function setShareModalState(state, link) {
  const idle    = document.getElementById('share-state-idle');
  const active  = document.getElementById('share-state-active');
  const loading = document.getElementById('share-state-loading');

  idle.style.display    = state === 'idle'    ? '' : 'none';
  active.style.display  = state === 'active'  ? '' : 'none';
  loading.style.display = state === 'loading' ? '' : 'none';

  if (state === 'active' && link) {
    document.getElementById('share-link-input').value = link;
  }
}


/* ── Helpers ─────────────────────────────────────────────── */

function buildShareLink(shareId) {
  return `${window.location.origin}${window.location.pathname}?share=${shareId}`;
}

function generateShareId() {
  // 10-char alphanumeric ID — short enough for URLs, hard enough to guess
  return Array.from(crypto.getRandomValues(new Uint8Array(7)))
    .map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36])
    .join('');
}

/** Small toast for share actions (different from the undo toast). */
let shareToastTimer = null;
function showShareToast(msg, success) {
  const el = document.getElementById('share-toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'share-toast show ' + (success ? 'ok' : 'err');
  clearTimeout(shareToastTimer);
  shareToastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}


/* ── Expose to global scope (called from non-module scripts) ── */
window.openShareModal    = openShareModal;
window.closeShareModal   = closeShareModal;
window.createShare       = createShare;
window.revokeShare       = revokeShare;
window.copyShareLink     = copyShareLink;
window.importSharedPins  = importSharedPins;
window.exitShareView     = exitShareView;
window.checkShareParam   = checkShareParam;
window.refreshShareIfActive = refreshShareIfActive;
