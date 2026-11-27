/*
 * The permission matrix from the hierarchy document, as data.
 *
 *   'all'  a tick: allowed across the organisation (or every organisation, for the Platform Admin)
 *   'own'  allowed only for the person's assigned facilities
 *   null   unavailable
 *
 * Every button and screen asks can(user, action). Change a rule here and the whole app follows.
 * The Roles & permissions screen renders this same table, so it always matches the code.
 */
const ROLES = ['Platform Admin', 'Org Admin', 'CXO', 'Manager', 'Engineer'];

const PERMISSIONS = [
  // group, action key, label, [Platform Admin, Org Admin, CXO, Manager, Engineer]
  ['Organisation and plan', 'org.create', 'Create an organization', [null, 'all', null, null, null]],
  ['Organisation and plan', 'plan.manage', 'Set or change a plan, suspend or reactivate an organization', ['all', null, null, null, null]],
  ['Organisation and plan', 'plan.view', 'View plan and usage', ['all', 'all', 'all', null, null]],
  ['Organisation and plan', 'org.settings', 'Edit organisation settings', [null, 'all', null, null, null]],
  ['Organisation and plan', 'facility.manage', 'Add, edit or archive facilities', [null, 'all', null, null, null]],

  ['People', 'invite.firstOrgAdmin', 'Invite the first Org Admin', ['all', null, null, null, null]],
  ['People', 'invite.staff', 'Invite Org Admins, CXOs and Managers', [null, 'all', null, null, null]],
  ['People', 'invite.engineer', 'Invite Engineers', [null, 'all', null, null, null]],
  ['People', 'assign.manager', 'Assign Managers to facilities', [null, 'all', null, null, null]],
  ['People', 'assign.engineer', 'Assign or unassign Engineers', [null, 'all', null, null, null]],
  ['People', 'user.manage', 'Change a role; deactivate or reactivate a user', [null, 'all', null, null, null]],
  ['People', 'people.view', 'View the people list', [null, 'all', 'all', 'own', null]],

  ['Data (detailed with the core features)', 'data.upload', 'Upload or enter activity data', [null, 'all', null, null, 'own']],
  ['Data (detailed with the core features)', 'data.view', 'View data and dashboards', [null, 'all', 'all', 'own', 'own']],
  ['Data (detailed with the core features)', 'stats.managers', "View every Manager's stats", [null, 'all', 'all', null, null]],
  ['Data (detailed with the core features)', 'reports.org', 'View and download organisation reports', [null, 'all', 'all', null, null]]
];

/* Returns 'all', 'own' or null for this user and action. */
function permission(user, action) {
  const row = PERMISSIONS.find(p => p[1] === action);
  if (!row || !user) return null;
  return row[3][ROLES.indexOf(user.role)] ?? null;
}

/* True when the user may do the action at all (in any scope). */
function can(user, action) { return permission(user, action) !== null; }

/*
 * True when the user may do the action at one facility.
 * 'all' covers every facility in the user's organisations; 'own' covers assigned facilities only.
 */
function canAtFacility(user, action, facilityId) {
  const level = permission(user, action);
  if (level === 'all') return true;
  if (level === 'own') return user.facilityIds.includes(facilityId);
  return false;
}
