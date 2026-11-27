/*
 * MOCK DATA: GHG activity data (the "upload" side of the hierarchy).
 *
 * This is a deliberately small slice of the original prototype's carbon accounting features,
 * kept so the hierarchy can be demonstrated end to end: an Engineer uploads, Managers see and
 * review it, the CXO sees it organisation-wide. The full GHG features come later.
 *
 * Emission factors are invented demo values, NOT verified reporting factors.
 */
const EMISSION_FACTORS = [
  { id: 'diesel', scope: 1, category: 'Stationary combustion', name: 'Diesel', unit: 'L', ef: 2.68 },
  { id: 'lpg', scope: 1, category: 'Stationary combustion', name: 'LPG', unit: 'kg', ef: 3 },
  { id: 'gas', scope: 1, category: 'Stationary combustion', name: 'Natural gas', unit: 'm³', ef: 2 },
  { id: 'petrol', scope: 1, category: 'Mobile combustion', name: 'Petrol', unit: 'L', ef: 2.31 },
  { id: 'r410a', scope: 1, category: 'Fugitive emissions', name: 'R-410A leakage', unit: 'kg', ef: 2088 },
  { id: 'electric', scope: 2, category: 'Purchased electricity', name: 'Grid electricity', unit: 'kWh', ef: 0.45 },
  { id: 'cool', scope: 2, category: 'Purchased cooling', name: 'District cooling', unit: 'TRh', ef: 0.65 }
];

/* Reporting periods: the current month and the three before it, as 'YYYY-MM'. */
const PERIODS = [0, 1, 2, 3].map(back => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - back);
  return d.toISOString().slice(0, 7);
});

function seedGhgData() {
  const sources = [
    ['s1', 'o1', 'f1', 'Generator fuel', 'diesel'],
    ['s2', 'o1', 'f1', 'Kitchen LPG', 'lpg'],
    ['s3', 'o1', 'f1', 'Main electricity', 'electric'],
    ['s4', 'o1', 'f2', 'Generator fuel', 'diesel'],
    ['s5', 'o1', 'f2', 'Main electricity', 'electric'],
    ['s6', 'o1', 'f2', 'District cooling', 'cool'],
    ['s7', 'o1', 'f3', 'Main electricity', 'electric'],
    ['s8', 'o2', 'f4', 'Hospital electricity', 'electric'],
    ['s9', 'o2', 'f4', 'Backup generator', 'diesel'],
    ['s10', 'o2', 'f5', 'Clinic electricity', 'electric'],
    ['s11', 'o3', 'f6', 'Store electricity', 'electric']
  ].map(([id, orgId, facilityId, name, factorId]) => ({ id, orgId, facilityId, name, factorId }));

  const [now, last] = PERIODS;
  // [source, period, quantity, status, uploaded by, reviewed by, days ago]
  const uploads = [
    ['s1', last, 450, 'Approved', 'u-e1', 'u-m1', 30],
    ['s3', last, 47000, 'Approved', 'u-e1', 'u-m1', 30],
    ['s4', last, 380, 'Approved', 'u-e2', 'u-m2', 29],
    ['s5', last, 36000, 'Approved', 'u-e2', 'u-m1', 29],
    ['s3', now, 50000, 'Submitted', 'u-e1', null, 3],
    ['s2', now, 300, 'Returned', 'u-e1', 'u-m1', 4],
    ['s4', now, 400, 'Submitted', 'u-e2', null, 2],
    ['s5', now, 37000, 'Approved', 'u-e2', 'u-m2', 2],
    ['s8', last, 80000, 'Approved', 'u-e6', 'u-m4', 25],
    ['s9', now, 800, 'Submitted', 'u-e6', null, 1],
    ['s11', last, 12000, 'Approved', 'u-oa3', null, 40]
  ];

  const records = uploads.map(([sourceId, period, quantity, status, by, reviewer, daysAgo]) => {
    const s = sources.find(x => x.id === sourceId);
    const f = EMISSION_FACTORS.find(x => x.id === s.factorId);
    return {
      id: 'r-' + uid(), orgId: s.orgId, facilityId: s.facilityId, sourceId, period, quantity, unit: f.unit, ef: f.ef,
      status, by, at: mockDate(-daysAgo), evidence: 'Monthly meter / invoice reading',
      review: reviewer ? { by: reviewer, at: mockDate(-daysAgo + 1), note: status === 'Returned' ? 'Quantity looks high, please check the invoice.' : '' } : null
    };
  });
  return { sources, records };
}
