/*
 * Overview (home) for each role inside an organisation, and Manager stats.
 */
VIEWS.home = function (u, org) {
  if (!org) return pageHead(`Welcome, ${esc(u.name)}`, 'You are an Org Admin. Start by creating your organisation.', '', 'Org Admin') + noOrgYet();
  return { 'Org Admin': orgAdminHome, 'CXO': cxoHome, 'Manager': managerHome, 'Engineer': engineerHome }[u.role](u, org);
};

/* ---------- Org Admin: setup checklist following flows 2 and 3 ---------- */
function orgAdminHome(u, org) {
  const people = peopleInOrg(org.id);
  const has = role => people.some(p => p.role === role && usesSeat(p));
  const facilities = activeFacilities(org.id);
  const steps = [
    ['Create the organisation', true, 'orgs'],
    ['SA-NEST applies the plan', !!org.plan, 'plan'],
    ['Complete the organisation profile', !!org.profileCompleted, 'settings'],
    ['Add facilities', facilities.length > 0, 'facilities'],
    ['Invite the CXO', has('CXO'), 'people'],
    ['Invite Managers', has('Manager'), 'people'],
    ['Assign Managers to facilities', facilities.length > 0 && facilities.every(f => db.users.some(m => m.role === 'Manager' && usesSeat(m) && m.facilityIds.includes(f.id))), 'facilities'],
    ['Invite Engineers and assign facilities', people.some(p => p.role === 'Engineer' && usesSeat(p) && p.facilityIds.length), 'people']
  ];
  const done = steps.filter(s => s[1]).length;
  const unassigned = unassignedEngineers(org.id);
  return pageHead(esc(org.name), `${badge(orgState(org))} · You administer ${orgsFor(u).length} organisation${orgsFor(u).length > 1 ? 's' : ''}.`,
    btn('Add user', 'addUserModal()', 'primary') + btn('Add facility', 'facilityModal()'), 'Org Admin') +
    `<div class="grid">
      ${statCard('Facilities', facilities.length, org.plan ? 'of ' + limitsOf(org).facilities : 'active')}
      ${statCard('People', people.filter(usesSeat).length, 'with a seat')}
      ${statCard('Pending invitations', people.filter(p => userStatus(p) === 'Invited').length, 'invited')}
      ${statCard('Unassigned Engineers', unassigned.length, 'need a facility')}
    </div>
    <div class="two section">
      <div class="card"><div class="row between"><h2>Set up the organisation</h2><small>${done} of ${steps.length} done</small></div>
        <div class="bar mini" style="margin:12px 0"><i style="width:${done / steps.length * 100}%"></i></div>
        <div class="stack">${steps.map(([label, ok, target], i) => `<div class="step"><div class="stepnum ${ok ? 'done' : ''}">${ok ? '✓' : i + 1}</div><div><button class="link" onclick="go('${target}')">${esc(label)}</button></div></div>`).join('')}</div>
      </div>
      <div class="card"><h2>Plan & usage</h2>${org.plan ? usageTable(org) : `<p class="muted">${esc(readOnlyReason(org))}</p>`}
        ${unassigned.length ? `<div class="notice warn section">Unassigned: ${unassigned.map(e => esc(e.name)).join(', ')}</div>` : ''}
      </div>
    </div>
    ${dataSummaryCard(u, org)}`;
}

/* ---------- CXO: read-only across the organisation ---------- */
function cxoHome(u, org) {
  const people = peopleInOrg(org.id).filter(p => userStatus(p) === 'Active');
  return pageHead(esc(org.name), 'Everything in your organisation, read-only.', '', 'CXO') +
    `<div class="grid">
      ${statCard('Facilities', activeFacilities(org.id).length, 'active')}
      ${statCard('Managers', people.filter(p => p.role === 'Manager').length, 'active')}
      ${statCard('Engineers', people.filter(p => p.role === 'Engineer').length, 'active')}
      ${statCard('Uploads', uploadsInOrg(org.id).length, 'recorded')}
    </div>
    <div class="card section"><div class="row between"><h2>Manager stats</h2>${btn('Open', "go('manager-stats')", 'link')}</div>${managerStatsTable(org)}</div>
    ${dataSummaryCard(u, org)}`;
}

/* ---------- Manager: assigned facilities and Engineer progress ---------- */
function managerHome(u, org) {
  const facilities = facilitiesFor(u, org.id);
  const reports = directReports(u.id);
  return pageHead(`Hello, ${esc(u.name.split(' ')[0])}`, `You oversee ${facilities.length} facilit${facilities.length === 1 ? 'y' : 'ies'} and ${reports.length} Engineer${reports.length === 1 ? '' : 's'} report to you.`, '', 'Manager') +
    `<div class="grid">${facilities.map(f => facilityCard(u, org, f)).join('') || '<div class="card empty">No facilities assigned to you yet. Your Org Admin assigns them.</div>'}</div>
    <div class="card section"><h2>Engineer progress</h2>${engineerProgressTable(u, org)}</div>
    ${dataSummaryCard(u, org)}`;
}

function engineerProgressTable(manager, org) {
  const engineers = peopleVisibleTo(manager, org.id).filter(p => p.role === 'Engineer' && userStatus(p) !== 'Deactivated');
  return table(['Engineer', 'Reports to', 'Facilities', 'Uploads', 'Last upload', 'Status'], engineers.map(e => {
    const ups = uploadsByUser(e.id).filter(x => manager.facilityIds.includes(x.facilityId));
    return [esc(e.name) + (e.managerId === manager.id ? ' <span class="tag">Direct report</span>' : ''), esc(userName(e.managerId)),
      esc(e.facilityIds.filter(f => manager.facilityIds.includes(f)).map(facilityName).join(', ')), ups.length, ups[0] ? fmtDate(ups[0].at) : '—', badge(userStatus(e))];
  }), 'No Engineers at your facilities yet.');
}

/* ---------- Engineer: pick an assigned facility and upload ---------- */
function engineerHome(u, org) {
  const facilities = facilitiesFor(u, org.id);
  return pageHead(`Hello, ${esc(u.name.split(' ')[0])}`, `You report to ${esc(userName(u.managerId))}. Pick one of your facilities to upload activity data.`, '', 'Engineer') +
    (facilities.length ? `<div class="grid">${facilities.map(f => facilityCard(u, org, f)).join('')}</div>`
      : '<div class="card empty"><h2>No facility assigned yet</h2><p class="muted">Your Org Admin will assign you to one or more facilities. Until then you cannot upload.</p></div>') +
    dataSummaryCard(u, org);
}

/* ---------- Manager stats (Org Admin and CXO) ---------- */
VIEWS['manager-stats'] = function (u, org) {
  if (!org) return noOrgYet();
  return pageHead('Manager stats', 'Assigned facilities, direct reports and upload progress for each Manager. The exact measures come with the core GHG features.', '', org.name) +
    `<div class="card">${managerStatsTable(org)}</div>`;
};

function managerStatsTable(org) {
  const managers = db.users.filter(m => m.role === 'Manager' && m.orgIds.includes(org.id) && userStatus(m) !== 'Deactivated');
  return table(['Manager', 'Status', 'Facilities', 'Direct reports', 'Uploads at their facilities', 'Last upload'], managers.map(m => {
    const ups = uploadsInOrg(org.id).filter(x => m.facilityIds.includes(x.facilityId));
    return [esc(m.name), badge(userStatus(m)), esc(m.facilityIds.map(facilityName).join(', ') || 'None'),
      directReports(m.id).map(r => esc(r.name)).join(', ') || '0', ups.length, ups[0] ? fmtDate(ups[0].at) : '—'];
  }), 'No Managers yet.');
}
