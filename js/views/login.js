/*
 * Signed-out screens: sign-in, demo accounts and the mock inbox for invitations.
 */
VIEWS.login = function () {
  const active = db.users.filter(u => userStatus(u) === 'Active');
  const groups = [['SA-NEST staff', active.filter(u => u.role === 'Platform Admin')]]
    .concat(db.orgs.map(o => [o.name, active.filter(u => u.role !== 'Platform Admin' && u.orgIds.includes(o.id))]))
    .filter(([, list]) => list.length);
  const invites = db.users.filter(u => u.status === 'Invited');

  return `<div class="login">
    <div class="login-brand"><div class="logo">◒</div><div><b>SA-Nest</b><small>Carbon accounting · V1 user hierarchy prototype</small></div></div>
    <div class="two">
      <div class="card">
        <h2>Sign in</h2>
        <p class="muted">Every demo account uses the password <b class="mono">${DEMO_PASSWORD}</b>.</p>
        <form class="section" onsubmit="event.preventDefault(); submitLogin()">
          ${field('Email', inp('le', '', 'type="email" autocomplete="username"'))}
          ${field('Password', inp('lp', '', 'type="password" autocomplete="current-password"'))}
          <div id="formerr" class="err" role="alert"></div>
          <button class="primary" type="submit">Sign in</button>
        </form>
        <div class="section">
          <h3>Mock inbox</h3>
          <p class="muted">Invitations are emailed in the real product. Here they land in this inbox.</p>
          ${table(['To', 'Role', 'Organisation', 'Status', ''], invites.map(u => [
            `${esc(u.name)}<br><small>${esc(u.email)}</small>`,
            esc(u.role),
            esc(findOrg(u.orgIds[0])?.name || 'New organisation'),
            userStatus(u) === 'Expired' ? badge('Expired') : `${badge('Invited')}<br><small>Expires ${fmtDate(inviteExpiresAt(u))}</small>`,
            userStatus(u) === 'Invited' ? btn('Open', `inviteModal('${u.id}')`, 'primary') : '<small>Inviter must resend</small>'
          ]), 'No invitations waiting.')}
        </div>
      </div>
      <div class="card">
        <h2>Demo accounts</h2>
        <p class="muted">Sign in as any role in one click.</p>
        ${groups.map(([label, list]) => `<div class="section"><div class="eyebrow">${esc(label)}</div>${list.map(u =>
          `<button class="account" onclick="quickSignIn('${u.id}')"><b>${esc(u.name)}</b><span>${esc(u.role)}${u.role === 'Manager' || u.role === 'Engineer' ? ' · ' + esc(facilityAccessText(u)) : ''}</span></button>`
        ).join('')}</div>`).join('')}
      </div>
    </div>
    <div class="card section">
      <h2>Walk through the V1 setup flow</h2>
      <div class="grid section">${DEMO_STORY.map(([n, who, what]) => `<div class="step"><div class="stepnum">${n}</div><div><b>${esc(who)}</b><p class="muted">${esc(what)}</p></div></div>`).join('')}</div>
      <div class="row section">${btn('Reset demo data', 'resetDemo()', 'danger')}</div>
    </div>
  </div>`;
};

/* The story the document tells, as a guide for whoever demos the prototype. */
const DEMO_STORY = [
  ['1', 'Platform Admin (Sara)', 'Set plan terms and invite the first Org Admin by email.'],
  ['2', 'New Org Admin', 'Open the invitation in the Mock inbox and set a password.'],
  ['3', 'Org Admin', 'Create the organisation with its name and country.'],
  ['4', 'Platform Admin', 'Apply the plan, limits and dates. The organisation is now active.'],
  ['5', 'Org Admin', 'Complete the profile and add facilities up to the limit.'],
  ['6', 'Org Admin', 'Invite the CXO and Managers, and link Managers to facilities.'],
  ['7', 'Org Admin', 'Invite Engineers, choose one reporting Manager and assign facilities.'],
  ['8', 'Engineer', 'Accept the invitation, pick an assigned facility and upload data.'],
  ['9', 'Manager', 'See uploads for assigned facilities and follow Engineer progress.'],
  ['10', 'CXO', 'Read everything across the organisation, including Manager stats.']
];

function submitLogin() {
  const error = signIn(value('le'), $('lp').value);
  if (error) formError(error);
}

function quickSignIn(userId) {
  const u = findUser(userId);
  signIn(u.email, u.password);
}

function inviteModal(userId) {
  const u = findUser(userId);
  const org = findOrg(u.orgIds[0]);
  const plan = u.pendingPlan;
  openModal('Invitation to SA-Nest', `
    <div class="notice">From ${esc(userName(u.invitedBy))} · sent ${fmtDate(u.invitedAt)} · valid until ${fmtDate(inviteExpiresAt(u))}</div>
    <p>Hello ${esc(u.name)}, you have been invited to SA-Nest as <b>${esc(u.role)}</b>${org ? ` in <b>${esc(org.name)}</b>` : ''}.</p>
    ${plan ? `<p class="muted section">You will create your organisation after signing in. SA-NEST has set these plan terms: ${esc(findTier(plan.tierId)?.name)} plan, ${fmtDate(plan.start)} to ${fmtDate(plan.end)}.</p>` : ''}
    ${u.role === 'Engineer' ? `<p class="muted section">Reporting Manager: ${esc(userName(u.managerId))} · Facilities: ${esc(facilityAccessText(u))}</p>` : ''}
    <div class="section">${field('Email', inp('ie', u.email, 'readonly'))}${field('Set a password', inp('ip', '', 'type="password" autocomplete="new-password"'))}</div>
    ${modalFoot('Accept and sign in', `submitInvite('${u.id}')`)}`);
}

function submitInvite(userId) {
  const error = acceptInvitation(userId, $('ip').value);
  if (error) return formError(error);
  closeModal();
  toast('Invitation accepted. Welcome to SA-Nest.');
}
