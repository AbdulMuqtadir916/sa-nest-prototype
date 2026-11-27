/*
 * The in-browser "database".
 *
 * On first load it is built from the mock data files in js/data/. Every change is saved to
 * localStorage so the demo survives a page refresh. Reset demo puts the mock data back.
 * There is no server: swap load()/save() for API calls when a backend exists.
 */
const STORE_KEY = 'sanest-hierarchy-v2';
const SESSION_KEY = 'sanest-hierarchy-session-v1';

let db;          // all data, see seedDatabase() for its shape
let session;     // { userId, orgId } for whoever is signed in

function seedDatabase() {
  const copy = x => JSON.parse(JSON.stringify(x));
  return {
    planTiers: copy(MOCK_PLAN_TIERS),
    orgs: copy(MOCK_ORGANISATIONS),
    facilities: copy(MOCK_FACILITIES),
    users: copy(MOCK_USERS),
    upgradeRequests: copy(MOCK_UPGRADE_REQUESTS),
    ledger: copy(MOCK_LEDGER).map(e => ({ id: uid(), ...e })).reverse(), // newest first
    ghg: seedGhgData()
  };
}

function loadStore() {
  try { db = JSON.parse(localStorage.getItem(STORE_KEY)) || seedDatabase(); } catch { db = seedDatabase(); }
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { session = null; }
}

function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch { /* storage blocked: demo still works until refresh */ }
}

function saveSession() {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

function resetDemo() {
  if (!confirm('Reset every change and go back to the original mock data?')) return;
  db = seedDatabase();
  session = null;
  saveStore();
  saveSession();
  render();
  toast('Demo data reset');
}

/* ---------- Lookups ---------- */
const findUser = id => db.users.find(u => u.id === id);
const findOrg = id => db.orgs.find(o => o.id === id);
const findFacility = id => db.facilities.find(f => f.id === id);
const findTier = id => db.planTiers.find(t => t.id === id);
const userName = id => findUser(id)?.name || 'Unknown';
const facilityName = id => findFacility(id)?.name || 'Unknown facility';
