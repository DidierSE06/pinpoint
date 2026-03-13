/* ============================================================
   auth.js — Firebase Auth + Firestore cloud sync.

   Flow:
     • On load, show auth modal if not signed in.
     • On sign-in, pull cloud data → merge with any local pins.
     • On every savePins() call, also write to Firestore.
     • On sign-out, clear memory and revert to localStorage only.
   ============================================================ */

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged,
         createUserWithEmailAndPassword,
         signInWithEmailAndPassword,
         signInWithPopup, GoogleAuthProvider,
         signOut, updateProfile }                 from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, setDoc,
         getDoc, onSnapshot }                     from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';


/* ── Firebase config ─────────────────────────────────────── */
// Replace these values with your own Firebase project credentials.
// Create a free project at https://console.firebase.google.com
// then: Project Settings → Your apps → Add web app → copy config.
const FIREBASE_CONFIG = {
  apiKey:            "REPLACE_WITH_YOUR_API_KEY",
  authDomain:        "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId:         "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket:     "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId:             "REPLACE_WITH_YOUR_APP_ID"
};

const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

let currentUser    = null;
let cloudUnsubscribe = null; // Firestore real-time listener teardown


/* ── Firestore helpers ───────────────────────────────────── */

/** Reference to the current user's pin document. */
function userDoc() {
  return doc(db, 'users', currentUser.uid);
}

/**
 * Push current in-memory state to Firestore.
 * Called by the patched savePins() in storage.js.
 */
async function saveToCloud() {
  if (!currentUser) return;
  try {
    await setDoc(userDoc(), {
      pins:      pins.map(({ id, name, desc, lat, lng }) => ({ id, name, desc: desc || '', lat, lng })),
      pinOrder:  pinOrder,
      groups:    groups.map(({ id, name, color, collapsed, pinIds }) => ({ id, name, color, collapsed, pinIds })),
      theme:     isDark ? 'dark' : 'light',
      updatedAt: Date.now()
    });
  } catch (e) {
    console.warn('Cloud save failed:', e);
  }
}

/**
 * Pull data from Firestore once and load it into the app,
 * replacing any existing pins.
 */
async function loadFromCloud() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(userDoc());
    if (!snap.exists()) return; // first time — nothing to load
    applyCloudData(snap.data());
  } catch (e) {
    console.warn('Cloud load failed:', e);
  }
}

/**
 * Apply a raw Firestore data object to app state.
 * Clears the map first, then rebuilds from the cloud snapshot.
 */
function applyCloudData(data) {
  // Tear down all existing markers
  clearDistanceLines();
  pins.forEach(p => map.removeLayer(p.marker));
  pins = []; selectedPinIds.clear(); closestPinId = null;
  pinOrder = []; groups = [];

  // Re-create pins
  (data.pins || []).forEach(p => addPin(p.lat, p.lng, p.name, p.desc || '', p.id));
  pinOrder = (data.pinOrder || []).filter(id => pins.find(p => p.id === id));
  groups   = (data.groups   || []).map(g => ({ ...g, pinIds: g.pinIds.filter(id => pins.find(p => p.id === id)) }));
  pins.forEach(p => { if (!pinOrder.includes(p.id)) pinOrder.push(p.id); });

  // Sync theme
  if (data.theme && ((data.theme === 'light') !== !isDark)) toggleTheme();

  // Also write to localStorage as offline cache
  localStorage.setItem(STORAGE_KEY, JSON.stringify(
    pins.map(({ id, name, desc, lat, lng }) => ({ id, name, desc: desc || '', lat, lng }))
  ));
  localStorage.setItem('pinpoint_order',  JSON.stringify(pinOrder));
  localStorage.setItem('pinpoint_groups', JSON.stringify(groups));

  renderPinList();
  deselectAll();
}


/* ── Auth state observer ─────────────────────────────────── */

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    window.currentUser = user;  // expose for share.js and other modules
    closeAuthModal();
    updateAccountUI(user);
    loadFromCloud();

    // Subscribe to real-time updates (other devices pushing changes)
    if (cloudUnsubscribe) cloudUnsubscribe();
    cloudUnsubscribe = onSnapshot(userDoc(), snap => {
      if (snap.exists() && snap.metadata.hasPendingWrites === false) {
        applyCloudData(snap.data());
      }
    });
  } else {
    // Not signed in — update UI only, don't force the modal.
    // On first ever visit (no pinpoint_visited flag), show it once as a soft prompt.
    currentUser = null;
    window.currentUser = null;  // keep window in sync
    if (cloudUnsubscribe) { cloudUnsubscribe(); cloudUnsubscribe = null; }
    updateAccountUI(null);
    if (!localStorage.getItem('pinpoint_visited')) {
      // Small delay so the map finishes loading before the modal appears
      setTimeout(() => openAuthModal(), 600);
    }
  }
});


/* ── Sign-up / Sign-in / Sign-out ────────────────────────── */

async function authSignUp() {
  const name  = document.getElementById('auth-name').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!name)  return setAuthError('Please enter your name.');
  if (!email) return setAuthError('Please enter your email.');
  if (pass.length < 6) return setAuthError('Password must be at least 6 characters.');

  setAuthLoading(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
  } catch (e) {
    setAuthError(friendlyError(e.code));
  } finally {
    setAuthLoading(false);
  }
}

async function authSignIn() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-pass').value;
  if (!email) return setAuthError('Please enter your email.');
  if (!pass)  return setAuthError('Please enter your password.');

  setAuthLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    setAuthError(friendlyError(e.code));
  } finally {
    setAuthLoading(false);
  }
}

async function authGoogle() {
  setAuthError('');
  setAuthLoading(true);
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    // onAuthStateChanged will fire and close the modal
  } catch (e) {
    const msg = friendlyError(e.code);
    if (msg) setAuthError(msg); // silent for popup-closed-by-user
  } finally {
    setAuthLoading(false);
  }
}

async function authSignOut() {
  await signOut(auth);
  // Revert to localStorage-only mode
  clearDistanceLines();
  pins.forEach(p => map.removeLayer(p.marker));
  pins = []; selectedPinIds.clear(); closestPinId = null;
  pinOrder = []; groups = [];
  renderPinList();
  deselectAll();
}


/* ── Auth modal UI ───────────────────────────────────────── */

let authModalMode = 'signin'; // 'signin' | 'signup'

function openAuthModal() {
  document.getElementById('auth-overlay').classList.add('open');
  setAuthMode('signin');
}

function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('open');
  // Mark that the user has seen the prompt so we don't show it again automatically
  localStorage.setItem('pinpoint_visited', '1');
}

function setAuthMode(mode) {
  authModalMode = mode;
  const isSignUp = mode === 'signup';
  document.getElementById('auth-name-field').style.display = isSignUp ? '' : 'none';
  document.getElementById('auth-title').textContent        = isSignUp ? 'Create Account' : 'Welcome Back';
  document.getElementById('auth-submit-btn').textContent   = isSignUp ? 'Create Account' : 'Sign In';
  document.getElementById('auth-switch-text').innerHTML    = isSignUp
    ? 'Already have an account? <button onclick="setAuthMode(\'signin\')">Sign in</button>'
    : 'New to PinPoint? <button onclick="setAuthMode(\'signup\')">Create account</button>';
  document.getElementById('auth-error').textContent = '';
  document.getElementById('auth-name').value  = '';
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-pass').value  = '';
}

function setAuthError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

function setAuthLoading(on) {
  const btn = document.getElementById('auth-submit-btn');
  btn.disabled    = on;
  btn.textContent = on ? '…' : (authModalMode === 'signup' ? 'Create Account' : 'Sign In');
}

function friendlyError(code) {
  const msgs = {
    'auth/email-already-in-use':    'That email is already registered.',
    'auth/invalid-email':           'Please enter a valid email address.',
    'auth/wrong-password':          'Incorrect email or password.',
    'auth/user-not-found':          'No account found with that email.',
    'auth/weak-password':           'Password must be at least 6 characters.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/too-many-requests':       'Too many attempts — try again later.',
    'auth/popup-closed-by-user':    '',   // silent — user closed it themselves
    'auth/cancelled-popup-request': '',   // silent
    'auth/popup-blocked':           'Pop-up was blocked. Please allow pop-ups for this site, then try again.',
    'auth/unauthorized-domain':     'This domain isn\'t authorised in Firebase. Add it under Authentication → Settings → Authorised domains.',
    'auth/network-request-failed':  'Network error — check your connection.',
    'auth/operation-not-allowed':   'Google sign-in isn\'t enabled yet. Enable it in Firebase → Authentication → Sign-in providers.',
  };
  return msgs[code] ?? 'Something went wrong. Please try again.';
}

function updateAccountUI(user) {
  const btn = document.getElementById('account-btn');
  if (!btn) return;
  if (user) {
    const initial = (user.displayName || user.email || '?')[0].toUpperCase();
    btn.innerHTML = `<div class="account-avatar">${initial}</div>`;
    btn.title     = `Signed in as ${user.displayName || user.email}`;
  } else {
    btn.innerHTML = '👤';
    btn.title     = 'Sign in / Create account';
  }
}

function handleAccountBtn() {
  if (currentUser) {
    const existing = document.getElementById('account-dropdown');
    if (existing) { existing.remove(); return; }

    const d = document.createElement('div');
    d.id = 'account-dropdown';
    d.innerHTML = `
      <div class="acct-info">
        <div class="acct-name">${esc(currentUser.displayName || 'User')}</div>
        <div class="acct-email">${esc(currentUser.email || '')}</div>
      </div>
      <button class="acct-signout" onclick="authSignOut();this.closest('#account-dropdown').remove()">
        Sign Out
      </button>`;
    document.getElementById('account-btn').appendChild(d);

    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!d.contains(e.target) && e.target.id !== 'account-btn') {
        d.remove(); document.removeEventListener('click', h);
      }
    }), 0);
  } else {
    openAuthModal();
  }
}

/* Keyboard shortcuts inside auth modal */
document.addEventListener('keydown', e => {
  if (!document.getElementById('auth-overlay').classList.contains('open')) return;
  if (e.key === 'Escape') closeAuthModal();
  if (e.key === 'Enter')  authModalMode === 'signup' ? authSignUp() : authSignIn();
});

/* Clicking the backdrop closes the modal (same as skip) */
document.getElementById('auth-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('auth-overlay')) closeAuthModal();
});

/* ── Expose ALL functions to window immediately (before any async) ── */
/* This must run synchronously so inline onclick=""s work even if       */
/* the module hasn't fully resolved yet.                                */
window.authSignUp        = authSignUp;
window.authSignIn        = authSignIn;
window.authGoogle        = authGoogle;
window.authSignOut       = authSignOut;
window.openAuthModal     = openAuthModal;
window.closeAuthModal    = closeAuthModal;
window.setAuthMode       = setAuthMode;
window.handleAccountBtn  = handleAccountBtn;
window.saveToCloud       = saveToCloud;
