/*
 * MOCK DATA: people.
 *
 * Every person holds exactly one role:
 *   'Platform Admin' | 'Org Admin' | 'CXO' | 'Manager' | 'Engineer'
 *
 * Fields
 *   orgIds       Org Admin: every organisation they administer. Everyone else: exactly one organisation.
 *                Platform Admin: empty (SA-NEST staff sit above all organisations).
 *   facilityIds  Manager: facilities they oversee. Engineer: facilities they can upload to.
 *   managerId    Engineer only: the one Manager they report to.
 *   status       'Invited' | 'Active' | 'Deactivated'. 'Expired' is worked out from invitedAt (see core/people.js).
 *   pendingPlan  Only on a first Org Admin invited by the Platform Admin before their organisation exists.
 *
 * Every active demo account uses the password: demo1234
 */
const DEMO_PASSWORD = 'demo1234';

const MOCK_USERS = [
  // SA-NEST staff
  { id: 'u-pa1', name: 'Sara Al-Mansoori', email: 'sara@sa-nest.demo', role: 'Platform Admin', orgIds: [], facilityIds: [], status: 'Active', invitedAt: mockDate(-400) },

  // Org Admin of Qatar Hotel Group AND Gulf Healthcare Group (one person, several organisations)
  { id: 'u-oa1', name: 'Omar Haddad', email: 'omar@qhg.demo', role: 'Org Admin', orgIds: ['o1', 'o2'], facilityIds: [], status: 'Active', invitedBy: 'u-pa1', invitedAt: mockDate(-125) },

  // ---- Qatar Hotel Group (o1) ----
  { id: 'u-cxo1', name: 'Layla Nasser', email: 'layla@qhg.demo', role: 'CXO', orgIds: ['o1'], facilityIds: [], status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-110) },
  // Manager A oversees Facility 1 and 2; Manager B shares Facility 2
  { id: 'u-m1', name: 'Ahmed Karim', email: 'ahmed@qhg.demo', role: 'Manager', orgIds: ['o1'], facilityIds: ['f1', 'f2'], status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-110) },
  { id: 'u-m2', name: 'Fatima Rahman', email: 'fatima@qhg.demo', role: 'Manager', orgIds: ['o1'], facilityIds: ['f2'], status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-100) },
  // Engineer A reports to Manager A, uploads to Facility 1 and 2. Engineer B reports to Manager B, uploads to Facility 2.
  { id: 'u-e1', name: 'Yusuf Ali', email: 'yusuf@qhg.demo', role: 'Engineer', orgIds: ['o1'], facilityIds: ['f1', 'f2'], managerId: 'u-m1', status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-90) },
  { id: 'u-e2', name: 'Priya Menon', email: 'priya@qhg.demo', role: 'Engineer', orgIds: ['o1'], facilityIds: ['f2'], managerId: 'u-m2', status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-90) },
  // Edge cases
  { id: 'u-e3', name: 'Daniel Costa', email: 'daniel@qhg.demo', role: 'Engineer', orgIds: ['o1'], facilityIds: ['f1'], managerId: 'u-m1', status: 'Invited', invitedBy: 'u-oa1', invitedAt: mockDate(-2) },
  { id: 'u-m3', name: 'Hana Saleh', email: 'hana@qhg.demo', role: 'Manager', orgIds: ['o1'], facilityIds: ['f3'], status: 'Invited', invitedBy: 'u-oa1', invitedAt: mockDate(-10) },
  { id: 'u-e4', name: 'Ravi Kumar', email: 'ravi@qhg.demo', role: 'Engineer', orgIds: ['o1'], facilityIds: ['f1'], managerId: 'u-m1', status: 'Deactivated', invitedBy: 'u-oa1', invitedAt: mockDate(-80) },
  { id: 'u-e5', name: 'Maria Santos', email: 'maria@qhg.demo', role: 'Engineer', orgIds: ['o1'], facilityIds: [], managerId: 'u-m2', status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-30) },

  // ---- Gulf Healthcare Group (o2) ----
  { id: 'u-cxo2', name: 'Khalid Mahmoud', email: 'khalid@ghg.demo', role: 'CXO', orgIds: ['o2'], facilityIds: [], status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-55) },
  { id: 'u-m4', name: 'Noor Hassan', email: 'noor@ghg.demo', role: 'Manager', orgIds: ['o2'], facilityIds: ['f4', 'f5'], status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-55) },
  { id: 'u-e6', name: 'Sam Peters', email: 'sam@ghg.demo', role: 'Engineer', orgIds: ['o2'], facilityIds: ['f4', 'f5'], managerId: 'u-m4', status: 'Active', invitedBy: 'u-oa1', invitedAt: mockDate(-50) },

  // ---- Desert Bloom Retail (o3, plan ended, read-only) ----
  { id: 'u-oa3', name: 'Mona Fares', email: 'mona@dbr.demo', role: 'Org Admin', orgIds: ['o3'], facilityIds: [], status: 'Active', invitedBy: 'u-pa1', invitedAt: mockDate(-405) },

  // ---- Al Noor Logistics: first Org Admin invited by the Platform Admin, organisation not created yet ----
  {
    id: 'u-oa2', name: 'Rania Aziz', email: 'rania@alnoor.demo', role: 'Org Admin', orgIds: [], facilityIds: [],
    status: 'Invited', invitedBy: 'u-pa1', invitedAt: mockDate(-1),
    pendingPlan: { tierId: 'starter', limits: { facilities: 2, orgAdmins: 1, cxos: 1, managers: 2, engineersPerFacility: 2 }, start: mockDay(0), end: mockDay(365) }
  }
];

/* Set on the mock users above whose status is Active: they can sign in with DEMO_PASSWORD. */
MOCK_USERS.forEach(u => { if (u.status === 'Active') u.password = DEMO_PASSWORD; });
