/*
 * Organisation screens: My organisations, Organisation settings, Plan & usage, upgrade requests.
 */

/* Call before any change. Shows why and returns false when the organisation is read-only. */
function requireWritable(org = currentOrg(), allowAwaitingPlan = false) {
  const state = orgState(org);
  if (state === 'Active' || (allowAwaitingPlan && state === 'Awaiting plan')) return true;
  toast(readOnlyReason(org));
  return false;
}

/* Shown whenever a plan limit blocks an action (flow 7 step 1). */
function limitBlockedModal(message, limitKey) {
  const u = currentUser();
  openModal('Plan limit reached', `<div class="notice warn">${esc(message)}</div>
    <p>Adding stops at a limit, but nothing is ever deleted. ${u.role === 'Org Admin' ? 'You can ask SA-NEST to raise it.' : 'Ask your Org Admin.'}</p>
    <div class="modalfoot">${btn('Close', 'closeModal()')}${u.role === 'Org Admin' ? btn('Request upgrade', `upgradeModal('${limitKey}')`, 'primary') : ''}</div>`);
}

VIEWS.orgs = function (u) {
  const orgs = orgsFor(u);
  return pageHead('My organisations', 'Every organisation you administer. Each has its own facilities, people and plan limits.',
    btn('Create organisation', 'createOrgModal()', 'primary'), 'Org Admin') +
    `<div class="grid">${orgs.map(o => {
      const used = usage(o.id);
      return `<div class="card facility-card"><div class="row between"><div class="iconbox">▦</div>${badge(orgState(o))}</div>
        <h2>${esc(o.name)}</h2><small>${esc(o.industry || '—')} · ${esc(o.country)}</small>
        <p>${used.facilities} facilities · ${peopleInOrg(o.id).filter(usesSeat).length} people</p>
        <div class="row">${btn(session.orgId === o.id ? 'Selected' : 'Switch to this', `switchOrg('${o.id}');go('home')`, session.orgId === o.id ? '' : 'primary', session.orgId === o.id ? 'disabled' : '')}</div></div>`;
    }).join('') || '<div class="card empty">You have not created an organisation yet.</div>'}</div>`;
};

function createOrgModal() {
  const u = currentUser();
  openModal('Create organisation', `
    <p class="muted">SA-NEST applies the plan after you create it. Until then you can edit the profile only.</p>
    ${u.pendingPlan ? `<div class="notice">SA-NEST has proposed: ${esc(findTier(u.pendingPlan.tierId)?.name)} plan, ${fmtDate(u.pendingPlan.start)} to ${fmtDate(u.pendingPlan.end)}.</div>` : ''}
    <div class="formgrid">${field('Organisation name', inp('on'))}${field('Country', inp('oc', 'Qatar'))}${field('Industry (optional)', inp('oi'), 'full')}</div>
    ${modalFoot('Create organisation', 'saveOrg()')}`);
}

function saveOrg() {
  const u = currentUser();
  const name = value('on'), country = value('oc');
  if (!name || !country) return formError('Enter the organisation name and country.');
  if (db.orgs.some(o => o.name.toLowerCase() === name.toLowerCase())) return formError('An organisation with that name already exists.');
  const org = { id: 'o-' + uid(), name, country, industry: value('oi'), status: 'Awaiting plan', createdBy: u.id, createdAt: nowIso(), plan: null };
  if (u.pendingPlan) { org.pendingPlan = u.pendingPlan; delete u.pendingPlan; }
  db.orgs.push(org);
  u.orgIds.push(org.id);
  session.orgId = org.id;
  saveSession();
  logAction('Organisation created', `${name} · ${country}`, { orgId: org.id });
  closeModal();
  go('home');
  toast('Organisation created. SA-NEST will apply the plan.');
}

VIEWS.settings = function (u, org) {
  if (!org) return noOrgYet();
  const editable = orgState(org) !== 'Suspended' && orgState(org) !== 'Expired';
  return pageHead('Organisation settings', 'The organisation profile. Branding arrives in V2.', '', org.name) +
    `<div class="card"><div class="formgrid">
      ${field('Organisation name', inp('sn', org.name, editable ? '' : 'disabled'))}
      ${field('Country', inp('sc', org.country, editable ? '' : 'disabled'))}
      ${field('Industry', inp('si', org.industry || '', editable ? '' : 'disabled'))}
      ${field('Address', inp('sa', org.address || '', editable ? '' : 'disabled'))}
      ${field('Contact email', inp('se', org.contactEmail || '', editable ? 'type="email"' : 'disabled'))}
      ${field('Reporting year starts', sel('sy', ['January', 'April', 'July', 'October'].map(m => opt(m, m, org.yearStart || 'January')).join(''), editable ? '' : 'disabled'))}
    </div>${editable ? `<div id="formerr" class="err"></div>${btn('Save profile', 'saveSettings()', 'primary')}` : ''}</div>
    <div class="card section"><h2>Prototype data</h2><p class="muted">Changes are kept in this browser only.</p>
      <div class="row section">${btn('Export demo backup', "download('SA-Nest-demo-backup.json', JSON.stringify(db, null, 2), 'application/json')")}${btn('Reset demo', 'resetDemo()', 'danger')}</div></div>`;
};

function saveSettings() {
  const org = currentOrg();
  if (!requireWritable(org, true)) return;
  if (!value('sn') || !value('sc')) return formError('Name and country are required.');
  Object.assign(org, { name: value('sn'), country: value('sc'), industry: value('si'), address: value('sa'), contactEmail: value('se'), yearStart: value('sy'), profileCompleted: true });
  logAction('Organisation settings changed', org.name);
  render();
  toast('Profile saved');
}

VIEWS.plan = function (u, org) {
  if (!org) return noOrgYet();
  const requests = db.upgradeRequests.filter(r => r.orgId === org.id);
  return pageHead('Plan & usage', 'Set by SA-NEST. At a limit, adding stops, but nothing is ever deleted.',
    can(u, 'org.settings') && org.plan ? btn('Request upgrade', "upgradeModal('')", 'primary') : '', org.name) +
    `<div class="two"><div class="card"><h2>${org.plan ? esc(findTier(org.plan.tierId)?.name || 'Custom') + ' plan' : 'No plan yet'}</h2>
      ${org.plan ? `<p class="muted">${fmtDate(org.plan.start)} to ${fmtDate(org.plan.end)} · ${badge(orgState(org))}</p><div class="section">${usageTable(org)}</div>` : `<p class="muted">${esc(readOnlyReason(org))}</p>`}
      <p class="muted section">Pending invitations count toward their role's limit. Expired invitations, deactivated users and archived facilities do not. Engineers count at each facility they are assigned to.</p></div>
    <div class="card"><h2>Upgrade requests</h2>${table(['Sent', 'Limit', 'Status'], requests.map(r => [fmtDate(r.at), esc(LIMIT_LABELS[r.limitKey] || 'General'), badge(r.status)]), 'None sent.')}</div></div>`;
};

function upgradeModal(limitKey) {
  openModal('Request an upgrade', `
    <p class="muted">This goes to SA-NEST. When they raise the limit or change the plan, it applies at once.</p>
    ${field('Which limit?', sel('ul', opt('', 'General / not sure', limitKey) + Object.keys(LIMIT_LABELS).map(k => opt(k, LIMIT_LABELS[k], limitKey)).join('')))}
    ${field('Message', '<textarea id="um" rows="3"></textarea>')}
    ${modalFoot('Send request', 'saveUpgrade()')}`);
}

function saveUpgrade() {
  const org = currentOrg();
  if (!value('um')) return formError('Add a short message for SA-NEST.');
  db.upgradeRequests.unshift({ id: 'ur-' + uid(), orgId: org.id, requestedBy: session.userId, at: nowIso(), limitKey: value('ul'), message: value('um'), status: 'Open' });
  logAction('Upgrade requested', `${LIMIT_LABELS[value('ul')] || 'General'}: ${value('um')}`);
  closeModal();
  render();
  toast('Upgrade request sent to SA-NEST');
}

/* Shown to a new Org Admin who has not created an organisation yet. */
function noOrgYet() {
  return `<div class="card empty"><h2>Create your organisation first</h2><p class="muted">Then add facilities and invite your team.</p>
    <div class="section">${btn('Create organisation', 'createOrgModal()', 'primary')}</div></div>`;
}
