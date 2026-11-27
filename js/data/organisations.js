/*
 * MOCK DATA: organisations and facilities.
 *
 * Mirrors the example in the hierarchy document:
 *   Qatar Hotel Group  -> Manager A oversees Facilities 1 and 2, Manager B shares Facility 2.
 *   Gulf Healthcare    -> a second organisation run by the same Org Admin.
 * Plus two edge cases for the demo:
 *   Desert Bloom Retail -> plan ended, so the organisation is read-only.
 *   (Al Noor Logistics does not exist yet: its first Org Admin has a pending invitation, see users.js.)
 *
 * org.status is stored as 'Awaiting plan' | 'Active' | 'Suspended'.
 * 'Expired' is never stored: it is worked out from plan.end (see core/plans.js).
 */
const MOCK_ORGANISATIONS = [
  {
    id: 'o1',
    name: 'Qatar Hotel Group',
    country: 'Qatar',
    industry: 'Hospitality',
    boundary: 'Operational control',
    standard: 'GHG Protocol',
    dualScope2: true,
    status: 'Active',
    createdBy: 'u-oa1',
    createdAt: mockDate(-120),
    plan: {
      tierId: 'growth',
      limits: { facilities: 5, orgAdmins: 2, cxos: 2, managers: 5, engineersPerFacility: 4 },
      start: mockDay(-120),
      end: mockDay(245)
    }
  },
  {
    id: 'o2',
    name: 'Gulf Healthcare Group',
    country: 'Qatar',
    industry: 'Healthcare',
    boundary: 'Operational control',
    standard: 'GHG Protocol',
    dualScope2: false,
    status: 'Active',
    createdBy: 'u-oa1',
    createdAt: mockDate(-60),
    plan: {
      tierId: 'starter',
      limits: { facilities: 2, orgAdmins: 1, cxos: 1, managers: 2, engineersPerFacility: 2 },
      start: mockDay(-60),
      end: mockDay(305)
    }
  },
  {
    id: 'o3',
    name: 'Desert Bloom Retail',
    country: 'Qatar',
    industry: 'Retail',
    boundary: 'Operational control',
    standard: 'GHG Protocol',
    dualScope2: false,
    status: 'Active',
    createdBy: 'u-oa3',
    createdAt: mockDate(-400),
    plan: {
      tierId: 'starter',
      limits: { facilities: 2, orgAdmins: 1, cxos: 1, managers: 2, engineersPerFacility: 2 },
      start: mockDay(-400),
      end: mockDay(-20) // ended 20 days ago -> read-only
    }
  }
];

const FACILITY_TYPES = ['Hotel', 'Hospital', 'Clinic', 'Commercial office', 'Shopping mall', 'School', 'Factory', 'Warehouse', 'Other'];

/* zones are optional sub-areas used to place equipment and sources. area is floor area in m². */
const MOCK_FACILITIES = [
  { id: 'f1', orgId: 'o1', name: 'Doha Hotel', type: 'Hotel', city: 'Doha', address: 'West Bay', area: 25000, zones: ['Utility area', 'Kitchen', 'Main building'], status: 'Active' },
  { id: 'f2', orgId: 'o1', name: 'Lusail Hotel', type: 'Hotel', city: 'Lusail', address: 'Marina District', area: 18000, zones: [], status: 'Active' },
  { id: 'f3', orgId: 'o1', name: 'Al Wakrah Hotel', type: 'Hotel', city: 'Al Wakrah', address: 'Corniche Road', area: 14000, zones: [], status: 'Active' },
  { id: 'f4', orgId: 'o2', name: 'Doha Hospital', type: 'Hospital', city: 'Doha', address: 'Al Rayyan Road', area: 32000, zones: ['Plant room', 'Clinical wing'], status: 'Active' },
  { id: 'f5', orgId: 'o2', name: 'Al Khor Clinic', type: 'Clinic', city: 'Al Khor', address: 'Main Street', area: 2400, zones: [], status: 'Active' },
  { id: 'f6', orgId: 'o3', name: 'Villaggio Store', type: 'Shopping mall', city: 'Doha', address: 'Aspire Zone', area: 3100, zones: [], status: 'Active' }
];

/* Requests an Org Admin sends when a plan limit blocks them. */
const MOCK_UPGRADE_REQUESTS = [
  {
    id: 'ur1',
    orgId: 'o2',
    requestedBy: 'u-oa1',
    at: mockDate(-1),
    limitKey: 'facilities',
    message: 'We are opening a third clinic next month and need one more facility.',
    status: 'Open'
  }
];
