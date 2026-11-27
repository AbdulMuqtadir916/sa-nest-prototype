/*
 * Plan rules: organisation state, limits and usage.
 *
 * From the document:
 *  - At a limit, adding a facility or inviting someone to that role is blocked and the limit is shown.
 *  - Pending invitations count toward their role's limit. Expired or cancelled invitations,
 *    deactivated users and archived facilities do not.
 *  - Lowering a limit below current use deletes nothing; the organisation just cannot add more.
 *  - After the plan's end date the organisation is read-only: people can sign in, view and export,
 *    but cannot add or change anything.
 *  - While waiting for a plan, or after SA-NEST stops the plan ('Suspended'), the same applies except
 *    that the Org Admin can still edit the organisation profile (decision 5).
 */

/* 'Awaiting plan' | 'Active' | 'Suspended' | 'Expired' */
function orgState(org) {
  if (!org) return 'Active';
  if (org.status === 'Awaiting plan' || !org.plan) return 'Awaiting plan';
  if (org.status === 'Suspended') return 'Suspended';
  if (org.plan.end && org.plan.end < mockDay(0)) return 'Expired';
  return 'Active';
}

/* True when people in this organisation can add or change things. */
const orgIsWritable = org => orgState(org) === 'Active';

function readOnlyReason(org) {
  const state = orgState(org);
  if (state === 'Suspended') return 'SA-NEST has stopped this organisation\'s plan. You can view, export and edit the profile; nothing else can be added or changed until the plan is restarted.';
  if (state === 'Expired') return `This organisation's plan ended on ${fmtDate(org.plan.end)}. You can view and export, but not add or change anything.`;
  if (state === 'Awaiting plan') return 'SA-NEST has not applied a plan to this organisation yet. You can edit the profile; facilities and invitations unlock once the plan is applied.';
  return '';
}

/* Invitations that are still pending and unexpired use a seat, as do active users. */
const usesSeat = u => ['Invited', 'Active'].includes(userStatus(u));

const ROLE_LIMIT_KEY = { 'Org Admin': 'orgAdmins', 'CXO': 'cxos', 'Manager': 'managers' };

function activeFacilities(orgId) {
  return db.facilities.filter(f => f.orgId === orgId && f.status !== 'Archived');
}

function seatHolders(orgId, role) {
  return db.users.filter(u => u.role === role && u.orgIds.includes(orgId) && usesSeat(u));
}

/* Engineers counted at one facility (an Engineer counts at each facility they are assigned to). */
function engineersAtFacility(facilityId) {
  return db.users.filter(u => u.role === 'Engineer' && u.facilityIds.includes(facilityId) && usesSeat(u));
}

/* Current use for every limit. engineersPerFacility reports the busiest facility. */
function usage(orgId) {
  const busiest = Math.max(0, ...activeFacilities(orgId).map(f => engineersAtFacility(f.id).length));
  return {
    facilities: activeFacilities(orgId).length,
    orgAdmins: seatHolders(orgId, 'Org Admin').length,
    cxos: seatHolders(orgId, 'CXO').length,
    managers: seatHolders(orgId, 'Manager').length,
    engineersPerFacility: busiest
  };
}

const limitsOf = org => org.plan?.limits || {};

/* Can one more facility be added? Returns '' when yes, otherwise the reason. */
function facilityLimitBlock(org) {
  const used = usage(org.id).facilities, limit = limitsOf(org).facilities;
  return used >= limit ? `Facility limit reached: ${used} of ${limit} active facilities.` : '';
}

/* Can one more person with this role be invited? Engineers are checked per facility instead. */
function roleLimitBlock(org, role) {
  const key = ROLE_LIMIT_KEY[role];
  if (!key) return '';
  const used = usage(org.id)[key], limit = limitsOf(org)[key];
  return used >= limit ? `${LIMIT_LABELS[key]} limit reached: ${used} of ${limit}.` : '';
}

/* Can these facilities take one more Engineer? ignoreUserId skips the Engineer being edited. */
function engineerLimitBlock(org, facilityIds, ignoreUserId = '') {
  const limit = limitsOf(org).engineersPerFacility;
  const full = facilityIds.filter(fid => engineersAtFacility(fid).filter(u => u.id !== ignoreUserId).length >= limit);
  return full.length ? `Engineer limit reached (${limit} per facility) at: ${full.map(facilityName).join(', ')}.` : '';
}

/* Usage bars used on the Platform Admin, Org Admin and CXO screens. */
function usageTable(org) {
  const used = usage(org.id), limits = limitsOf(org);
  return `<div class="stack">${Object.keys(LIMIT_LABELS).map(k => {
    const pct = limits[k] ? Math.min(100, used[k] / limits[k] * 100) : 0;
    const full = used[k] >= limits[k];
    return `<div class="chartrow"><span>${LIMIT_LABELS[k]}</span><div class="bar mini"><i style="width:${pct}%" class="${full ? 'full' : ''}"></i></div><b>${used[k]} / ${limits[k] ?? '—'}</b></div>`;
  }).join('')}</div>`;
}
