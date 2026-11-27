/*
 * Organisation user panel (People).
 *
 * Org Admin: user count and list, plus Add user, assignments, role changes, deactivate/reactivate.
 * CXO: the same panel for their organisation, read-only.
 * Manager: their own list (direct reports and people at their assigned facilities), read-only.
 * Each user is counted once across their facility assignments.
 */
let peopleRoleFilter = 'All';

VIEWS.people = function (u, org) {
  if (!org) return noOrgYet();
  const manage = can(u, 'user.manage');
  const all = peopleVisibleTo(u, org.id);
  const shown = peopleRoleFilter === 'All' ? all : all.filter(p => p.role === peopleRoleFilter);
  const counts = s => all.filter(p => userStatus(p) === s).length;
  const unassigned = manage ? unassignedEngineers(org.id) : [];
  const title = u.role === 'Manager' ? 'My team' : 'People';
  const desc = manage ? 'Only the Org Admin creates users and assigns Managers and Engineers to facilities.'
    : u.role === 'CXO' ? 'Everyone in your organisation. Read-only: only the Org Admin can add users.'
    : 'Your direct reports and the people working at your facilities. Read-only.';

  return pageHead(title, desc, manage ? btn('Add user', 'addUserModal()', 'primary') : '', org.name) +
    `<div class="grid">
      ${statCard('Users', all.length, 'people', 'Each counted once')}
      ${statCard('Active', counts('Active'), 'can sign in')}
      ${statCard('Invited', counts('Invited'), 'pending', 'Pending invitations use a seat')}
      ${statCard('Expired or deactivated', counts('Expired') + counts('Deactivated'), 'people', 'No seat used')}
    </div>
    ${unassigned.length ? `<div class="notice warn section"><b>Unassigned:</b> ${unassigned.map(e => esc(e.name)).join(', ')} ${unassigned.length === 1 ? 'has' : 'have'} no facility. ${btn('Assign', `engineerModal('${unassigned[0].id}')`, 'link')}</div>` : ''}
    <div class="card section">
      <div class="tabs">${['All', ...ROLES.slice(1)].map(r => `<button class="${peopleRoleFilter === r ? 'active' : ''}" onclick="peopleRoleFilter='${r}';render()">${r === 'All' ? 'All roles' : r + 's'}</button>`).join('')}</div>
      ${table(['Person', 'Role', 'Facility access', 'Reporting Manager', 'Status', manage ? '' : null].filter(x => x !== null), shown.map(p => {
        const row = [
          `<b>${esc(p.name)}</b>${p.id === u.id ? ' <small>(you)</small>' : ''}<br><small>${esc(p.email)}</small>`,
          esc(p.role),
          esc(facilityAccessText(p)),
          p.role === 'Engineer' ? esc(userName(p.managerId)) : '<span class="muted">—</span>',
          badge(userStatus(p)) + (userStatus(p) === 'Invited' ? `<br><small>Expires ${fmtDate(inviteExpiresAt(p))}</small>` : '')
        ];
        if (manage) row.push(personActions(p));
        return row;
      }), 'Nobody here yet.')}
    </div>`;
};

function personActions(p) {
  const status = userStatus(p);
  const a = [];
  if (status === 'Deactivated') return btn('Reactivate', `reactivateUser('${p.id}')`);
  if (status === 'Expired') return btn('Resend', `resendInvite('${p.id}')`, 'primary');
  if (p.role === 'Manager') a.push(btn('Facilities', `managerModal('${p.id}')`));
  if (p.role === 'Engineer') a.push(btn('Access', `engineerModal('${p.id}')`));
  if (status === 'Invited') a.push(btn('Simulate expiry', `simulateExpiry('${p.id}')`));
  if (status === 'Active') a.push(btn('Role', `roleModal('${p.id}')`));
  if (p.id !== session.userId) a.push(btn('Deactivate', `deactivateModal('${p.id}')`, 'danger'));
  return `<div class="row">${a.join('')}</div>`;
}

/* ---------- Add user (flow 2 step 3, flow 3) ---------- */

function addUserModal() {
  const org = currentOrg();
  if (!requireWritable(org)) return;
  openModal('Add user · ' + org.name, `
    <p class="muted">They get an email invitation, valid for ${INVITE_VALID_DAYS} days. A pending invitation counts toward its role's limit.</p>
    <div class="formgrid section">
      ${field('Full name', inp('un'))}${field('Email', inp('ue', '', 'type="email"'))}
      ${field('Role', sel('ur', ['CXO', 'Manager', 'Engineer', 'Org Admin'].map(r => opt(r, r, 'Engineer')).join(''), 'onchange="userRoleFields()"'), 'full')}
    </div>
    <div id="rolefields"></div>
    ${modalFoot('Send invitation', 'saveNewUser()')}`);
  userRoleFields();
}

/* Shows the limit for the chosen role and the extra fields Managers and Engineers need. */
function userRoleFields() {
  const org = currentOrg(), role = value('ur');
  const facilities = activeFacilities(org.id).map(f => ({ id: f.id, label: `${f.name} (${engineersAtFacility(f.id).length}/${limitsOf(org).engineersPerFacility} engineers)` }));
  const block = roleLimitBlock(org, role);
  let html = block ? `<div class="notice warn">${esc(block)} ${btn('Request upgrade', `upgradeModal('${ROLE_LIMIT_KEY[role]}')`, 'link')}</div>` : '';
  if (role === 'Manager') html += field('Facilities they oversee (optional, can be set later)', checkboxes('uf', activeFacilities(org.id).map(f => ({ id: f.id, label: f.name }))));
  if (role === 'Engineer') {
    const managers = db.users.filter(m => m.role === 'Manager' && m.orgIds.includes(org.id) && usesSeat(m));
    html += field('Reporting Manager (exactly one)', sel('um', opt('', 'Choose a Manager') + managers.map(m => opt(m.id, m.name)).join('')));
    html += field('Facilities they upload to', checkboxes('uf', facilities));
    if (!managers.length) html += '<p class="err">Invite a Manager first: every Engineer reports to one.</p>';
  }
  $('rolefields').innerHTML = html;
}

function saveNewUser() {
  const org = currentOrg();
  const name = value('un'), email = value('ue').toLowerCase(), role = value('ur');
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return formError('Enter a name and a valid email.');
  const block = roleLimitBlock(org, role);
  if (block) return formError(block);
  const facilityIds = ['Manager', 'Engineer'].includes(role) ? checkedValues('uf') : [];
  const managerId = role === 'Engineer' ? value('um') : undefined;
  if (role === 'Engineer') {
    if (!managerId) return formError('Choose the Engineer\'s reporting Manager.');
    const eBlock = engineerLimitBlock(org, facilityIds);
    if (eBlock) return formError(eBlock);
  }

  const existing = db.users.find(x => x.email.toLowerCase() === email);
  if (existing) {
    // An existing Org Admin can be added to another organisation; everyone else holds one organisation.
    if (existing.role === 'Org Admin' && role === 'Org Admin' && !existing.orgIds.includes(org.id)) {
      existing.orgIds.push(org.id);
      logAction('Org Admin added', `${existing.name} now also administers ${org.name}`);
      closeModal(); render(); return toast(`${existing.name} now administers ${org.name}`);
    }
    return formError('Someone with that email already has an account. Each person holds one role.');
  }

  const user = { id: 'u-' + uid(), name, email, role, orgIds: [org.id], facilityIds, status: 'Invited', invitedBy: session.userId, invitedAt: nowIso() };
  if (managerId) user.managerId = managerId;
  db.users.push(user);
  logAction('Invitation sent', `${name} invited as ${role}`);
  if (role === 'Manager' && facilityIds.length) logAction('Manager assigned', `${name} → ${facilityIds.map(facilityName).join(', ')}`);
  if (role === 'Engineer') logAction('Engineer assigned', `${name} → ${facilityIds.map(facilityName).join(', ') || 'no facility'} · reports to ${userName(managerId)}`);
  closeModal();
  render();
  toast('Invitation sent. Open it from the Mock inbox on the sign-in page.');
}

/* ---------- Assignments (flow 5) ---------- */

function managerModal(id) {
  if (!requireWritable()) return;
  const m = findUser(id);
  openModal('Facilities · ' + m.name, `<p class="muted">Managers can oversee several facilities. Other Managers keep their assignments.</p>
    <div class="section">${checkboxes('mf', activeFacilities(m.orgIds[0]).map(f => ({ id: f.id, label: f.name })), m.facilityIds)}</div>
    ${modalFoot('Save', `saveManager('${id}')`)}`);
}

function saveManager(id) {
  const m = findUser(id);
  m.facilityIds = checkedValues('mf');
  logAction('Manager assignment changed', `${m.name} → ${m.facilityIds.map(facilityName).join(', ') || 'no facility'}`);
  closeModal(); render(); toast('Assignments saved. Access changes take effect immediately.');
}

function engineerModal(id) {
  if (!requireWritable()) return;
  const e = findUser(id);
  const org = findOrg(e.orgIds[0]);
  const managers = db.users.filter(m => m.role === 'Manager' && m.orgIds.includes(org.id) && usesSeat(m));
  openModal('Access · ' + e.name, `<p class="muted">Access changes take effect immediately. Past uploads stay with the facility and keep the uploader's name.</p>
    ${field('Reporting Manager', sel('em', managers.map(m => opt(m.id, m.name, e.managerId)).join('')))}
    ${field('Facilities they upload to', checkboxes('ef', activeFacilities(org.id).map(f => ({ id: f.id, label: `${f.name} (${engineersAtFacility(f.id).length}/${limitsOf(org).engineersPerFacility})` })), e.facilityIds))}
    ${modalFoot('Save access', `saveEngineer('${id}')`)}`);
}

function saveEngineer(id) {
  const e = findUser(id);
  const org = findOrg(e.orgIds[0]);
  const facilityIds = checkedValues('ef');
  const block = engineerLimitBlock(org, facilityIds.filter(f => !e.facilityIds.includes(f)), e.id);
  if (block) return formError(block);
  const managerChanged = e.managerId !== value('em');
  e.facilityIds = facilityIds;
  e.managerId = value('em');
  logAction('Engineer assignment changed', `${e.name} → ${facilityIds.map(facilityName).join(', ') || 'no facility'}${managerChanged ? ' · now reports to ' + userName(e.managerId) : ''}`);
  closeModal(); render(); toast('Access saved. It takes effect immediately.');
}

/* ---------- Role change ---------- */

function roleModal(id) {
  if (!requireWritable()) return;
  const p = findUser(id);
  openModal('Change role · ' + p.name, `<p class="muted">Each person holds one role. Facility assignments that do not fit the new role are cleared.</p>
    ${field('New role', sel('nr', ['Org Admin', 'CXO', 'Manager', 'Engineer'].filter(r => r !== p.role).map(r => opt(r, r)).join(''), 'onchange="roleChangeFields()"'))}
    <div id="rolefields"></div>
    ${modalFoot('Change role', `saveRole('${id}')`)}`);
  roleChangeFields();
}

function roleChangeFields() {
  const org = currentOrg();
  if (value('nr') !== 'Engineer') { $('rolefields').innerHTML = ''; return; }
  const managers = db.users.filter(m => m.role === 'Manager' && m.orgIds.includes(org.id) && usesSeat(m));
  $('rolefields').innerHTML = field('Reporting Manager', sel('um', managers.map(m => opt(m.id, m.name)).join('')));
}

function saveRole(id) {
  const p = findUser(id), org = currentOrg(), role = value('nr');
  if (p.role === 'Org Admin' && activeOrgAdmins(org.id).length <= 1) return formError('Each organisation keeps at least one active Org Admin.');
  if (p.role === 'Manager' && directReports(p.id).length) return formError(`${p.name} has direct reports. Move them to another Manager first.`);
  const block = roleLimitBlock(org, role);
  if (block) return formError(block);
  if (role === 'Engineer' && !value('um')) return formError('Choose a reporting Manager.');
  const old = p.role;
  p.role = role;
  p.orgIds = [org.id];
  if (role === 'Engineer') p.managerId = value('um'); else delete p.managerId;
  if (!['Manager', 'Engineer'].includes(role)) p.facilityIds = [];
  logAction('Role changed', `${p.name}: ${old} → ${role}`);
  closeModal(); render(); toast('Role changed');
}

/* ---------- Remove someone (flow 6) ---------- */

function deactivateModal(id) {
  if (!requireWritable()) return;
  const p = findUser(id), org = currentOrg();
  if (p.role === 'Org Admin' && userStatus(p) === 'Active' && activeOrgAdmins(org.id).length <= 1) return toast('The last active Org Admin cannot be deactivated.');
  const reports = p.role === 'Manager' ? directReports(p.id) : [];
  const others = db.users.filter(m => m.role === 'Manager' && m.id !== p.id && m.orgIds.includes(org.id) && usesSeat(m));
  openModal('Deactivate ' + p.name, `<p>They are signed out at once and their seat is freed. Their uploads and ledger history stay, still showing who did what.</p>
    ${reports.length ? `<div class="notice warn section">${reports.length} Engineer${reports.length > 1 ? 's report' : ' reports'} to ${esc(p.name)}: ${reports.map(r => esc(r.name)).join(', ')}. Choose a replacement Manager. Other Managers keep their facility access.</div>
      ${others.length ? field('Replacement Manager', sel('rm', others.map(m => opt(m.id, m.name)).join(''))) : '<p class="err">Invite another Manager first.</p>'}` : ''}
    <div id="formerr" class="err"></div><div class="modalfoot">${btn('Cancel', 'closeModal()')}${btn('Deactivate', `saveDeactivate('${id}')`, 'primary danger')}</div>`);
}

function saveDeactivate(id) {
  const p = findUser(id);
  const reports = p.role === 'Manager' ? directReports(p.id) : [];
  if (reports.length) {
    const replacement = value('rm');
    if (!replacement) return formError('Choose a replacement Manager.');
    reports.forEach(r => { r.managerId = replacement; });
    logAction('Direct reports reassigned', `${reports.map(r => r.name).join(', ')} → ${userName(replacement)}`);
  }
  const wasInvite = userStatus(p) === 'Invited';
  p.status = 'Deactivated';
  logAction(wasInvite ? 'Invitation cancelled' : 'User deactivated', `${p.name} (${p.role})`);
  closeModal(); render(); toast(`${p.name} deactivated. Their seat is free.`);
}

function reactivateUser(id) {
  const p = findUser(id), org = currentOrg();
  if (!requireWritable(org)) return;
  const block = roleLimitBlock(org, p.role) || (p.role === 'Engineer' ? engineerLimitBlock(org, p.facilityIds) : '');
  if (block) return limitBlockedModal(block, ROLE_LIMIT_KEY[p.role] || 'engineersPerFacility');
  if (p.role === 'Engineer' && userStatus(findUser(p.managerId) || {}) !== 'Active') p.managerId = '';
  p.status = p.password ? 'Active' : 'Invited';
  if (!p.password) p.invitedAt = nowIso();
  logAction('User reactivated', `${p.name} (${p.role})`);
  render();
  toast(p.managerId === '' ? `${p.name} reactivated. Choose a reporting Manager for them.` : `${p.name} reactivated`);
}
