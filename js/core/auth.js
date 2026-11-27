/*
 * MOCK sign-in. Passwords are plain text in mock data and checked in the browser.
 * This is a simulation for the prototype only: it is not security.
 */
const currentUser = () => session ? findUser(session.userId) : null;
const currentOrg = () => session?.orgId ? findOrg(session.orgId) : null;

/* Returns '' on success, otherwise a message to show on the login form. */
function signIn(email, password) {
  const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u) return 'No account with that email.';
  const status = userStatus(u);
  if (status === 'Invited') return 'This invitation has not been accepted yet. Open it from the Mock inbox to set a password.';
  if (status === 'Expired') return 'This invitation expired. Ask the person who invited you to resend it.';
  if (status === 'Deactivated') return 'This account has been deactivated. Contact your Org Admin.';
  if (u.password !== password) return 'Wrong password. Every demo account uses ' + DEMO_PASSWORD + '.';
  startSession(u);
  return '';
}

function startSession(u) {
  session = { userId: u.id, orgId: u.orgIds[0] || null };
  saveSession();
  logAction('Signed in', '', { orgId: session.orgId });
  page = defaultPage(u);
  render();
}

function signOut() {
  session = null;
  saveSession();
  page = 'login';
  render();
}

/* Org Admins can switch between the organisations they administer. */
function switchOrg(orgId) {
  session.orgId = orgId;
  saveSession();
  render();
}

/* Accepting an invitation sets the password and makes the user Active (flow 1 step 2). */
function acceptInvitation(userId, password) {
  const u = findUser(userId);
  if (userStatus(u) !== 'Invited') return 'This invitation is no longer valid.';
  if (password.length < 8) return 'Use at least 8 characters.';
  u.status = 'Active';
  u.password = password;
  u.acceptedAt = nowIso();
  logAction('Invitation accepted', `${u.name} joined as ${u.role}`, { orgId: u.orgIds[0] || null, actorId: u.id });
  startSession(u);
  return '';
}
