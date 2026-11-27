/*
 * MOCK DATA: plan tiers.
 * A plan tier is a named template of limits set by SA-NEST staff.
 * The Platform Admin can override any value for one organisation (see organisations.js -> plan.limits).
 */
const MOCK_PLAN_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    limits: { facilities: 2, orgAdmins: 1, cxos: 1, managers: 2, engineersPerFacility: 2 }
  },
  {
    id: 'growth',
    name: 'Growth',
    limits: { facilities: 5, orgAdmins: 2, cxos: 2, managers: 5, engineersPerFacility: 4 }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    limits: { facilities: 25, orgAdmins: 5, cxos: 3, managers: 20, engineersPerFacility: 10 }
  }
];

/* Human labels for each limit key, used on every screen that shows a limit. */
const LIMIT_LABELS = {
  facilities: 'Facilities',
  orgAdmins: 'Org Admins',
  cxos: 'CXOs',
  managers: 'Managers',
  engineersPerFacility: 'Engineers per facility'
};
