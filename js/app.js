/*
 * App shell: navigation per role and the render loop.
 *
 * NAVIGATION lists, for each role, the pages in the sidebar. Each page key maps to a view
 * function in VIEWS (defined in js/views/). To add a page: write a view function, add it to
 * VIEWS, and list its key under the roles that should see it.
 */
let page = 'login';

const NAVIGATION = {
  'Platform Admin': [
    ['SA-NEST console', [['pa-home', 'Overview', '⌂'], ['pa-orgs', 'Organisations', '▦'], ['pa-invites', 'Org Admin invitations', '✉'], ['pa-requests', 'Upgrade requests', '↑'], ['pa-tiers', 'Plan tiers', '◇']]],
    ['Records', [['ledger', 'Ledger', '◷'], ['roles', 'Roles & permissions', '⚑']]]
  ],
  'Org Admin': [
    ['Organisation', [['home', 'Overview', '⌂'], ['orgs', 'My organisations', '▦'], ['facilities', 'Facilities', '▣'], ['people', 'People', '☺'], ['manager-stats', 'Manager stats', '▥'], ['plan', 'Plan & usage', '◇'], ['settings', 'Organisation settings', '⚙']]],
    ['Data', 'DATA_PAGES'],
    ['Records', [['ledger', 'Ledger', '◷'], ['roles', 'Roles & permissions', '⚑']]]
  ],
  'CXO': [
    ['Organisation', [['home', 'Overview', '⌂'], ['facilities', 'Facilities', '▣'], ['people', 'People', '☺'], ['manager-stats', 'Manager stats', '▥'], ['plan', 'Plan & usage', '◇']]],
    ['Data', 'DATA_PAGES'],
    ['Records', [['ledger', 'Ledger', '◷'], ['roles', 'Roles & permissions', '⚑']]]
  ],
  'Manager': [
    ['My work', [['home', 'Overview', '⌂'], ['facilities', 'My facilities', '▣'], ['people', 'My team', '☺']]],
    ['Data', 'DATA_PAGES'],
    ['Records', [['ledger', 'Ledger', '◷'], ['roles', 'Roles & permissions', '⚑']]]
  ],
  'Engineer': [
    ['My work', [['home', 'Overview', '⌂'], ['facilities', 'My facilities', '▣']]],
    ['Data', 'DATA_PAGES'],
    ['Records', [['ledger', 'My activity', '◷'], ['roles', 'Roles & permissions', '⚑']]]
  ]
};

/* View functions by page key. Each returns an HTML string for the main area. */
const VIEWS = {};

/* Data pages are provided by js/views/ghg.js and differ per role. */
const dataNavFor = user => dataPagesFor(user);

function navFor(user) {
  return NAVIGATION[user.role].map(([label, items]) => [label, items === 'DATA_PAGES' ? dataNavFor(user) : items]).filter(([, items]) => items.length);
}

const defaultPage = user => user.role === 'Platform Admin' ? 'pa-home' : 'home';

function go(p) { page = p; render(); window.scrollTo(0, 0); }

function render() {
  const user = currentUser();
  // A deactivated user is signed out at once.
  if (user && userStatus(user) !== 'Active') { session = null; saveSession(); }

  if (!currentUser()) {
    document.body.classList.add('signed-out');
    $('side').innerHTML = '';
    $('top').innerHTML = '';
    $('body').innerHTML = (VIEWS[page] && page.startsWith('login') ? VIEWS[page] : VIEWS.login)();
    return;
  }
  document.body.classList.remove('signed-out');
  const u = currentUser();
  const allowed = navFor(u).flatMap(([, items]) => items.map(i => i[0]));
  if (!allowed.includes(page)) page = defaultPage(u);

  renderSidebar(u);
  renderTopbar(u);
  const org = currentOrg();
  const banner = org && !orgIsWritable(org) ? `<div class="notice warn">${esc(readOnlyReason(org))}</div>` : '';
  $('body').innerHTML = `<div class="notice">PROTOTYPE · Mock data and mock sign-in only. Nothing here is real or secure.</div>${banner}${VIEWS[page](u, org)}`;
}

function renderSidebar(u) {
  $('side').innerHTML = `<div class="brand"><div class="logo">◒</div><div>SA-Nest<small style="display:block;font-size:10px;letter-spacing:0">CARBON ACCOUNTING</small></div></div>` +
    navFor(u).map(([label, items]) => `<div class="navlabel">${esc(label)}</div>` +
      items.map(([key, text, icon]) => `<button class="nav ${page === key ? 'active' : ''}" onclick="go('${key}')"><span class="ni">${icon}</span>${esc(text)}</button>`).join('')
    ).join('') +
    `<div class="sidefoot">V1 USER HIERARCHY<br>Prototype · mock data</div>`;
}

function renderTopbar(u) {
  const orgs = orgsFor(u);
  const orgPicker = u.role === 'Org Admin' && orgs.length
    ? `<div class="workspace">Organisation</div><select aria-label="Organisation" onchange="switchOrg(this.value)">${orgs.map(o => opt(o.id, o.name, session.orgId)).join('')}</select>`
    : u.role === 'Platform Admin' ? `<div class="workspace">SA-NEST staff console</div>`
    : `<div class="workspace">${esc(currentOrg()?.name || '')}</div>`;
  $('top').innerHTML = `${orgPicker}<div class="grow"></div>` +
    `<div class="whoami"><b>${esc(u.name)}</b><small>${esc(u.role)} · ${esc(u.email)}</small></div>` +
    btn('Sign out', 'signOut()');
}

function boot() {
  loadStore();
  $('shade').addEventListener('click', e => { if (e.target === $('shade')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); trapModalFocus(e); });
  if (currentUser()) page = defaultPage(currentUser());
  render();
}
