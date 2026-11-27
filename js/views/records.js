/*
 * Ledger and Roles & permissions (reference pages every role can open).
 */
VIEWS.ledger = function (u, org) {
  const scopeText = {
    'Platform Admin': "Every organisation's activity and SA-NEST staff actions. Data details are hidden.",
    'Org Admin': 'Everyone in this organisation.',
    'CXO': 'Everyone in your organisation except Org Admins.',
    'Manager': 'Your own actions and Engineer activity in your assigned facilities.',
    'Engineer': 'Your own actions only.'
  }[u.role];
  return pageHead(u.role === 'Engineer' ? 'My activity' : 'Ledger', `Everything that happens, with who did it and when. Nobody can edit an entry. You see: ${scopeText}`,
    btn('Export CSV', 'exportLedger()'), org?.name || 'SA-NEST') +
    `<div class="card">${ledgerTable(u, ledgerVisibleTo(u, org?.id))}</div>`;
};

function exportLedger() {
  const u = currentUser();
  const hide = u.role === 'Platform Admin';
  const rows = ledgerVisibleTo(u, currentOrg()?.id).map(e => [e.at, userName(e.actorId), findUser(e.actorId)?.role, findOrg(e.orgId)?.name || 'SA-NEST', e.action, e.isData && hide ? '(hidden)' : e.detail]);
  download('SA-Nest-ledger.csv', [['time', 'who', 'role', 'organisation', 'action', 'detail'], ...rows].map(csvLine).join('\n'));
}

VIEWS.roles = function (u) {
  const mark = v => v === 'all' ? '✓' : v === 'own' ? 'Own' : '—';
  let group = '';
  const rows = [];
  PERMISSIONS.forEach(([g, , label, cells]) => {
    if (g !== group) { group = g; rows.push([`<b>${esc(g)}</b>`, '', '', '', '', '']); }
    rows.push([esc(label), ...cells.map((c, i) => `<span class="${ROLES[i] === u.role ? 'mine' : ''}">${mark(c)}</span>`)]);
  });
  return pageHead('Roles & permissions', 'From the V1 hierarchy document. ✓ means across the organisation, Own means assigned facilities only. Your column is highlighted.', '', 'Reference') +
    `<div class="card">${table(['Action', ...ROLES.map(r => r === u.role ? `<span class="mine">${r}</span>` : r)], rows)}</div>
    <div class="card section"><h2>Who creates whom</h2>${table(['Role', 'Created by', 'Sees', 'Main job'], [
      ['Platform Admin', 'SA-NEST', "Every organisation's plan, usage and status, never its data", 'Invites first Org Admin and sets plans'],
      ['Org Admin', 'Platform Admin (the first one); Org Admin (any more)', 'All organisations they administer', 'Creates every user and facility, assigns Managers and Engineers, and can do anything the other roles can'],
      ['CXO', 'Org Admin', 'Everything in the organisation, read-only', "Oversees every facility, Manager and Engineer, including each Manager's stats"],
      ['Manager', 'Org Admin', 'Assigned facilities', 'Views assigned facilities and follows Engineer progress'],
      ['Engineer', 'Org Admin', 'Assigned facilities', 'Uploads to assigned facilities; reports to exactly one Manager']
    ].map(r => r.map(esc)))}</div>`;
};
