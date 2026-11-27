/*
 * Platform Admin (SA-NEST staff) screens.
 * Sees every organisation's plan, usage and status, never its data.
 * Main job: invite the first Org Admin and set plans (flow 1, and flow 7 for upgrade requests).
 */

VIEWS['pa-home'] = function (u) {
  const states = db.orgs.map(orgState);
  const waiting = db.orgs.filter(o => orgState(o) === 'Awaiting plan');
  const requests = db.upgradeRequests.filter(r => r.status === 'Open');
  const invites = firstAdminInvites().filter(x => userStatus(x) === 'Invited');
  return pageHead('SA-NEST console', 'Plans, usage and status for every organisation. Organisation data is never shown here.',
    btn('Invite first Org Admin', 'firstAdminModal()', 'primary'), 'Platform Admin') +
    `<div class="grid">
      ${statCard('Organisations', db.orgs.length, 'total')}
      ${statCard('Active', states.filter(s => s === 'Active').length, 'organisations')}
      ${statCard('Awaiting plan', waiting.length, 'organisations')}
      ${statCard('Stopped or expired', states.filter(s => s === 'Suspended' || s === 'Expired').length, 'organisations')}
    </div>
    <div class="two section">
      <div class="card"><h2>Needs a plan</h2><p class="muted">Organisations created by an Org Admin and waiting for you to apply plan terms.</p>
        ${table(['Organisation', 'Created by', 'Proposed terms', ''], waiting.map(o => [
          esc(o.name), esc(userName(o.createdBy)),
          o.pendingPlan ? esc(findTier(o.pendingPlan.tierId)?.name) + ' plan' : '<span class="muted">None</span>',
          btn('Apply plan', `planModal('${o.id}')`, 'primary')
        ]), 'Nothing waiting.')}</div>
      <div class="card"><h2>Open upgrade requests</h2>
        ${table(['Organisation', 'Limit', 'Message', ''], requests.map(r => [
          esc(findOrg(r.orgId)?.name), esc(LIMIT_LABELS[r.limitKey] || r.limitKey), esc(r.message),
          btn('Review', `planModal('${r.orgId}','${r.id}')`, 'primary')
        ]), 'No open requests.')}</div>
    </div>
    <div class="card section"><h2>First Org Admin invitations waiting</h2>
      ${table(['Name', 'Email', 'Plan terms', 'Expires'], invites.map(x => [esc(x.name), esc(x.email), esc(findTier(x.pendingPlan?.tierId)?.name || '—'), fmtDate(inviteExpiresAt(x))]), 'No invitations waiting.')}
    </div>`;
};

VIEWS['pa-orgs'] = function () {
  return pageHead('Organisations', 'Set or change a plan, or stop and restart it. Changes apply at once. A stopped organisation keeps its data and can only edit its profile.', '', 'Platform Admin') +
    `<div class="card">${table(['Organisation', 'Org Admins', 'Plan', 'Runs', 'Facilities', 'People', 'Status', ''], db.orgs.map(o => {
      const used = usage(o.id), lim = limitsOf(o), state = orgState(o);
      const people = peopleInOrg(o.id).filter(usesSeat).length;
      return [
        `<b>${esc(o.name)}</b><br><small>${esc(o.country)}</small>`,
        esc(seatHolders(o.id, 'Org Admin').map(x => x.name).join(', ') || '—'),
        o.plan ? esc(findTier(o.plan.tierId)?.name || 'Custom') : '—',
        o.plan ? `${fmtDate(o.plan.start)}<br><small>to ${fmtDate(o.plan.end)}</small>` : '—',
        o.plan ? `${used.facilities} / ${lim.facilities}` : used.facilities,
        people,
        badge(state),
        btn(o.plan ? 'Plan & limits' : 'Apply plan', `planModal('${o.id}')`, o.plan ? '' : 'primary') +
          (o.plan ? btn(o.status === 'Suspended' ? 'Restart plan' : 'Stop plan', `toggleSuspend('${o.id}')`, o.status === 'Suspended' ? '' : 'danger') : '') +
          btn('Usage', `usageModal('${o.id}')`)
      ];
    }))}</div>`;
};

VIEWS['pa-invites'] = function () {
  return pageHead('First Org Admin invitations', 'Each new customer starts here. The Org Admin accepts, then creates their organisation.',
    btn('Invite first Org Admin', 'firstAdminModal()', 'primary'), 'Platform Admin') +
    `<div class="card">${table(['Name', 'Email', 'Plan terms', 'Sent', 'Status', ''], firstAdminInvites().map(x => {
      const status = userStatus(x);
      return [esc(x.name), esc(x.email),
        x.pendingPlan ? esc(findTier(x.pendingPlan.tierId)?.name) : '—',
        fmtDate(x.invitedAt), badge(status),
        status === 'Expired' ? btn('Resend', `resendInvite('${x.id}')`, 'primary')
          : status === 'Invited' ? btn('Simulate expiry', `simulateExpiry('${x.id}')`) : ''];
    }))}</div>`;
};

VIEWS['pa-requests'] = function () {
  return pageHead('Upgrade requests', 'Sent by an Org Admin when a plan limit blocks them. Raise the limit or change the plan; it applies at once.', '', 'Platform Admin') +
    `<div class="card">${table(['Received', 'Organisation', 'From', 'Limit', 'Message', 'Status', ''], db.upgradeRequests.map(r => [
      fmtDate(r.at), esc(findOrg(r.orgId)?.name), esc(userName(r.requestedBy)), esc(LIMIT_LABELS[r.limitKey] || r.limitKey), esc(r.message), badge(r.status),
      r.status === 'Open' ? btn('Review', `planModal('${r.orgId}','${r.id}')`, 'primary') : ''
    ]), 'No upgrade requests yet.')}</div>`;
};

VIEWS['pa-tiers'] = function () {
  return pageHead('Plan tiers', 'Named templates set by SA-NEST. Any value can be overridden for one organisation.', '', 'Platform Admin') +
    `<div class="card">${table(['Tier', ...Object.values(LIMIT_LABELS)], db.planTiers.map(t => [esc(t.name), ...Object.keys(LIMIT_LABELS).map(k => t.limits[k])]))}</div>`;
};

/* People the Platform Admin invited (each is the first Org Admin of a customer). */
const firstAdminInvites = () => db.users.filter(u => u.role === 'Org Admin' && findUser(u.invitedBy)?.role === 'Platform Admin');

/* ---------- Plan form, shared by invite and apply/change ---------- */

function planFields(plan) {
  const tierId = plan?.tierId || 'starter';
  const limits = plan?.limits || findTier(tierId).limits;
  return `<div class="formgrid">
    ${field('Plan tier', sel('pt', db.planTiers.map(t => opt(t.id, t.name, tierId)).join(''), 'onchange="fillTierLimits()"'), 'full')}
    ${Object.keys(LIMIT_LABELS).map(k => field(LIMIT_LABELS[k], inp('pl-' + k, limits[k], 'type="number" min="0"'))).join('')}
    ${field('Start date', inp('ps', plan?.start || mockDay(0), 'type="date"'))}
    ${field('End date', inp('pe', plan?.end || mockDay(365), 'type="date"'))}
  </div><small>Changing a value overrides the tier for this organisation only.</small>`;
}

function fillTierLimits() {
  const t = findTier(value('pt'));
  Object.keys(LIMIT_LABELS).forEach(k => { $('pl-' + k).value = t.limits[k]; });
}

/* Reads the plan form. Returns { plan } or { error }. */
function readPlanFields() {
  const limits = {};
  for (const k of Object.keys(LIMIT_LABELS)) {
    const n = Number(value('pl-' + k));
    if (!Number.isInteger(n) || n < 0) return { error: `Enter a whole number for ${LIMIT_LABELS[k]}.` };
    limits[k] = n;
  }
  if (limits.orgAdmins < 1) return { error: 'Each organisation keeps at least one Org Admin, so that limit must be at least 1.' };
  const start = value('ps'), end = value('pe');
  if (!start || !end || end < start) return { error: 'Enter a start date and an end date after it.' };
  return { plan: { tierId: value('pt'), limits, start, end } };
}

function firstAdminModal() {
  openModal('Invite the first Org Admin', `
    <p class="muted">Set the plan terms, then invite the person who will run this customer's account. They create the organisation after accepting.</p>
    <div class="formgrid section">${field('Full name', inp('fn'))}${field('Email', inp('fe', '', 'type="email"'))}</div>
    ${planFields(null)}
    ${modalFoot('Send invitation', 'saveFirstAdmin()')}`);
}

function saveFirstAdmin() {
  const name = value('fn'), email = value('fe').toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return formError('Enter a name and a valid email.');
  if (db.users.some(x => x.email.toLowerCase() === email)) return formError('Someone with that email already has an account or invitation.');
  const { plan, error } = readPlanFields();
  if (error) return formError(error);
  db.users.push({ id: 'u-' + uid(), name, email, role: 'Org Admin', orgIds: [], facilityIds: [], status: 'Invited', invitedBy: session.userId, invitedAt: nowIso(), pendingPlan: plan });
  logAction('Invitation sent', `First Org Admin invited: ${name} (${findTier(plan.tierId).name} plan terms)`, { orgId: null });
  closeModal();
  go('pa-invites');
  toast('Invitation sent. It is waiting in the Mock inbox on the sign-in page.');
}

function planModal(orgId, requestId = '') {
  const o = findOrg(orgId);
  const request = db.upgradeRequests.find(r => r.id === requestId);
  const starting = o.plan || o.pendingPlan || null;
  openModal((o.plan ? 'Change plan · ' : 'Apply plan · ') + o.name, `
    ${request ? `<div class="notice">Upgrade request from ${esc(userName(request.requestedBy))}: “${esc(request.message)}”</div>` : ''}
    ${o.plan ? `<div class="section"><h3>Current use</h3>${usageTable(o)}</div>` : ''}
    <div class="section">${planFields(starting)}</div>
    <p class="muted section">Lowering a limit below current use deletes nothing. The organisation just cannot add more until it is under the limit.</p>
    ${modalFoot(o.plan ? 'Save plan' : 'Apply plan', `savePlan('${orgId}','${requestId}')`)}`);
}

function savePlan(orgId, requestId) {
  const o = findOrg(orgId);
  const { plan, error } = readPlanFields();
  if (error) return formError(error);
  const first = !o.plan;
  o.plan = plan;
  delete o.pendingPlan;
  if (o.status === 'Awaiting plan') o.status = 'Active';
  const request = db.upgradeRequests.find(r => r.id === requestId);
  if (request) { request.status = 'Resolved'; request.resolvedAt = nowIso(); }
  logAction(first ? 'Plan applied' : 'Plan changed', `${findTier(plan.tierId).name} plan · ${fmtDate(plan.start)} to ${fmtDate(plan.end)}`, { orgId });
  saveStore();
  closeModal();
  render();
  toast(first ? `${o.name} is now active.` : 'Plan updated. It applies at once.');
}

function toggleSuspend(orgId) {
  const o = findOrg(orgId);
  const suspending = o.status !== 'Suspended';
  if (suspending && !confirm(`Stop the plan for ${o.name}? Its people can still sign in, view, export and edit the profile, but cannot add or change anything else.`)) return;
  o.status = suspending ? 'Suspended' : 'Active';
  logAction(suspending ? 'Plan stopped' : 'Plan restarted', o.name, { orgId });
  render();
}

function usageModal(orgId) {
  const o = findOrg(orgId);
  openModal('Plan & usage · ' + o.name, `${o.plan ? usageTable(o) : '<p class="muted">No plan applied yet.</p>'}
    <p class="muted section">Counts include pending invitations. Expired invitations, deactivated users and archived facilities are not counted.</p>
    <div class="modalfoot">${btn('Close', 'closeModal()')}</div>`);
}

function resendInvite(userId) {
  const u = findUser(userId);
  u.status = 'Invited';
  u.invitedAt = nowIso();
  logAction('Invitation resent', `${u.name} (${u.role})`, { orgId: u.orgIds[0] || null });
  render();
  toast('Invitation resent. It is valid for another ' + INVITE_VALID_DAYS + ' days.');
}

/* Demo helper: move an invitation's sent date back so it shows as Expired. */
function simulateExpiry(userId) {
  findUser(userId).invitedAt = mockDate(-(INVITE_VALID_DAYS + 1));
  saveStore();
  render();
  toast('Invitation moved past its ' + INVITE_VALID_DAYS + '-day limit.');
}
