/* ============================================================
   state.js — Shared application state
   All mutable state lives here so every other module can
   import from a single source of truth.
   ============================================================ */

/* ── Persistence key ── */
const STORAGE_KEY = 'pinpoint_v3';

/* ── Pin data ──
   Each pin: { id, name, desc, lat, lng, marker }
   marker is a Leaflet marker instance (not persisted). */
let pins = [];

/* ── Selection state ──
   selectedPinIds: Set of pin IDs currently highlighted.
   closestPinId:   ID of the pin nearest to the primary selection. */
let selectedPinIds = new Set();
let closestPinId   = null;

/* ── Map overlay arrays ── */
let distanceLines  = [];   // Leaflet polylines drawn between pins
let distanceBadges = [];   // Leaflet markers carrying distance labels

/* ── Modal state ── */
let modalMode     = 'new'; // 'new' | 'edit'
let modalPinId    = null;  // ID of pin being edited
let pendingLatLng = null;  // Coordinates clicked on the map before modal opens

/* ── Custom order & groups ──
   pinOrder: array of pin IDs defining the user-defined sort order.
   groups:   [{id, name, color, collapsed, pinIds:[]}] */
let pinOrder = [];
let groups   = [];

/* Active list display mode */
let listMode = 'custom'; // 'custom' | 'distance'

/* Colour palette cycled when creating new groups */
const GROUP_COLORS = [
  '#e8ff47', '#ff6b35', '#4af0c4', '#a78bfa',
  '#f472b6', '#60a5fa', '#34d399', '#fb923c'
];

/* ── Drag & drop state ── */
let dragSrcId      = null; // pin ID being dragged
let dragSrcGroupId = null; // group it came from (null = ungrouped)

/* ── Undo state ── */
let deleteStack  = [];     // stack of deleted pin snapshots — supports multi-undo
const UNDO_DURATION = 5000; // ms before each undo toast expires

/* ── Theme ── */
let isDark = true;
