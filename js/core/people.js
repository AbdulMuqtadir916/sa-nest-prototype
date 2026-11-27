/*
 * People rules: user status and what each person can see.
 *
 * User status (from the document):
 *   Invited      invitation sent; cannot sign in; uses a seat
 *   Active       accepted and set a password; can sign in; uses a seat
 *   Expired      did not accept in time; the inviter can resend; no seat
 *   Deactivated  turned off by the Org Admin; can be reactivated; no seat
 */
const INVITE_VALID_DAYS = 7; // open question in the document; 7 days is the demo assumption

function userStatus(u) {
  if (u.status === 'Invited' && Date.now() - new Date(u.invitedAt).getTime() > INVITE_VALID_DAYS * DAY_MS) return 'Expired';
  return u.status;
}

const inviteExpiresAt = u => new Date(new Date(u.invitedAt).getTime() + INVITE_VALID_DAYS * DAY_MS).toISOString();

/* Organisations this person works in. The Platform Admin sees every organisation's plan, never its data. */
function orgsFor(user) {
  if (user.role === 'Platform Admin') return db.orgs;
  return db.orgs.filter(o => user.orgIds.includes(o.id));
}

/* Facilities this person can see in one organisation (archived ones only for the Org Admin). */
function facilitiesFor(user, orgId) {
  const inOrg = db.facilities.filter(f => f.orgId === orgId);
  if (user.role === 'Org Admin') return inOrg;
  if (user.role === 'CXO') return inOrg.filter(f => f.status !== 'Archived');
  return inOrg.filter(f => f.status !== 'Archived' && user.facilityIds.includes(f.id));
}

/* Everyone in one organisation, Org Admins included. */
const peopleInOrg = orgId => db.users.filter(u => u.orgIds.includes(orgId));

/*
 * The people list each role may see ("View the people list": Org Admin and CXO everyone, Manager own).
 * A Manager's "own" list: their direct reports plus Engineers and Managers at their assigned facilities.
 */
function peopleVisibleTo(user, orgId) {
  const level = permission(user, 'people.view');
  if (level === 'all') return peopleInOrg(orgId);
  if (level === 'own') {
    return peopleInOrg(orgId).filter(u =>
      u.id === user.id ||
      u.managerId === user.id ||
      (['Engineer', 'Manager'].includes(u.role) && u.facilityIds.some(f => user.facilityIds.includes(f))));
  }
  return [];
}

const directReports = managerId => db.users.filter(u => u.role === 'Engineer' && u.managerId === managerId && userStatus(u) !== 'Deactivated');

/* Engineers who are active but have no facility: the Org Admin's "Unassigned" list. */
const unassignedEngineers = orgId => db.users.filter(u => u.role === 'Engineer' && u.orgIds.includes(orgId) && userStatus(u) === 'Active' && !u.facilityIds.length);

/* Each organisation keeps at least one active Org Admin. */
const activeOrgAdmins = orgId => db.users.filter(u => u.role === 'Org Admin' && u.orgIds.includes(orgId) && userStatus(u) === 'Active');

/* "Facility access" column of the people panel. */
function facilityAccessText(u) {
  if (u.role === 'Org Admin' || u.role === 'CXO') return 'All facilities';
  return u.facilityIds.length ? u.facilityIds.map(facilityName).join(', ') : 'None';
}
