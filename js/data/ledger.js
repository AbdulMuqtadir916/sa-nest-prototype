/*
 * MOCK DATA: ledger (activity log).
 *
 * The ledger records everything that happens, with who did it and when. Entries are never edited.
 * Who sees which entry is decided in core/ledger.js, not here.
 *
 *   orgId       organisation the action happened in (null for SA-NEST staff actions with no organisation)
 *   facilityId  facility the action happened in, when there is one
 *   isData      true when the detail describes activity data. The Platform Admin sees that the action
 *               happened but never the detail.
 */
const MOCK_LEDGER = [
  { at: mockDate(-125), actorId: 'u-pa1', orgId: null, action: 'Invitation sent', detail: 'First Org Admin invited: Omar Haddad (Growth plan terms)' },
  { at: mockDate(-121), actorId: 'u-oa1', orgId: 'o1', action: 'Organisation created', detail: 'Qatar Hotel Group · Qatar' },
  { at: mockDate(-120), actorId: 'u-pa1', orgId: 'o1', action: 'Plan applied', detail: 'Growth plan applied to Qatar Hotel Group' },
  { at: mockDate(-115), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f1', action: 'Facility added', detail: 'Doha Hotel' },
  { at: mockDate(-115), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f2', action: 'Facility added', detail: 'Lusail Hotel' },
  { at: mockDate(-114), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f3', action: 'Facility added', detail: 'Al Wakrah Hotel' },
  { at: mockDate(-110), actorId: 'u-oa1', orgId: 'o1', action: 'Invitation sent', detail: 'Layla Nasser invited as CXO' },
  { at: mockDate(-110), actorId: 'u-oa1', orgId: 'o1', action: 'Invitation sent', detail: 'Ahmed Karim invited as Manager' },
  { at: mockDate(-108), actorId: 'u-oa1', orgId: 'o1', action: 'Manager assigned', detail: 'Ahmed Karim → Doha Hotel, Lusail Hotel' },
  { at: mockDate(-100), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f2', action: 'Manager assigned', detail: 'Fatima Rahman → Lusail Hotel' },
  { at: mockDate(-90), actorId: 'u-oa1', orgId: 'o1', action: 'Engineer assigned', detail: 'Yusuf Ali → Doha Hotel, Lusail Hotel · reports to Ahmed Karim' },
  { at: mockDate(-90), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f2', action: 'Engineer assigned', detail: 'Priya Menon → Lusail Hotel · reports to Fatima Rahman' },
  { at: mockDate(-61), actorId: 'u-oa1', orgId: 'o2', action: 'Organisation created', detail: 'Gulf Healthcare Group · Qatar' },
  { at: mockDate(-60), actorId: 'u-pa1', orgId: 'o2', action: 'Plan applied', detail: 'Starter plan applied to Gulf Healthcare Group' },
  { at: mockDate(-12), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f1', action: 'User deactivated', detail: 'Ravi Kumar (Engineer)' },
  { at: mockDate(-10), actorId: 'u-oa1', orgId: 'o1', action: 'Invitation sent', detail: 'Hana Saleh invited as Manager' },
  { at: mockDate(-3), actorId: 'u-e1', orgId: 'o1', action: 'Signed in', detail: '' },
  { at: mockDate(-3), actorId: 'u-e1', orgId: 'o1', facilityId: 'f1', action: 'Data uploaded', detail: 'Doha Hotel · Main electricity · 50,000 kWh', isData: true },
  { at: mockDate(-2), actorId: 'u-e2', orgId: 'o1', action: 'Signed in', detail: '' },
  { at: mockDate(-2), actorId: 'u-e2', orgId: 'o1', facilityId: 'f2', action: 'Data uploaded', detail: 'Lusail Hotel · Generator fuel · 400 L', isData: true },
  { at: mockDate(-2), actorId: 'u-oa1', orgId: 'o1', facilityId: 'f1', action: 'Invitation sent', detail: 'Daniel Costa invited as Engineer' },
  { at: mockDate(-1), actorId: 'u-m1', orgId: 'o1', action: 'Signed in', detail: '' },
  { at: mockDate(-1), actorId: 'u-oa1', orgId: 'o2', action: 'Upgrade requested', detail: 'Facility limit reached (2 of 2)' },
  { at: mockDate(-1), actorId: 'u-pa1', orgId: null, action: 'Invitation sent', detail: 'First Org Admin invited: Rania Aziz (Starter plan terms)' }
];
