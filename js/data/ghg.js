/*
 * MOCK DATA: GHG carbon accounting (Scope 1 and 2), carried over from the original prototype.
 *
 * Emission factors are invented demo values, NOT verified Qatar reporting factors.
 *
 * Shape of db.ghg (built by seedGhgData):
 *   assets    equipment and meters:   { id, orgId, facilityId, name, type, zone }
 *   sources   what is measured:       { id, orgId, facilityId, name, factorId, assetId, zone, active }
 *             facilityId '' means an organisation-level source (e.g. a central fleet).
 *   records   activity data, one per source + month + reference, with every version kept:
 *             { id, orgId, facilityId, sourceId, period, ref, versions: [{ id, q, unit, ef, mb, method, status, at, by, evidence, reason }] }
 *             V1 has no review step, so a version is 'Recorded' the moment it is saved and an older one becomes 'Superseded'.
 *   imports   spreadsheet uploads:    { orgId, facilityId, name, period, ok, bad, by, at }
 *   closed    closed periods:         { orgId, period, at, by }
 *   reports   saved report snapshots
 *   na        categories marked not applicable: { 'orgId|facilityId|category': reason }
 */
const EMISSION_FACTORS = [
  { id: 'diesel', scope: 1, category: 'Stationary combustion', name: 'Diesel', unit: 'L', ef: 2.68 },
  { id: 'lpg', scope: 1, category: 'Stationary combustion', name: 'LPG', unit: 'kg', ef: 3 },
  { id: 'gas', scope: 1, category: 'Stationary combustion', name: 'Natural gas', unit: 'm³', ef: 2 },
  { id: 'petrol', scope: 1, category: 'Mobile combustion', name: 'Petrol', unit: 'L', ef: 2.31 },
  { id: 'fleetdiesel', scope: 1, category: 'Mobile combustion', name: 'Diesel (fleet)', unit: 'L', ef: 2.68 },
  { id: 'r410a', scope: 1, category: 'Fugitive emissions', name: 'R-410A leakage', unit: 'kg', ef: 2088 },
  { id: 'r134a', scope: 1, category: 'Fugitive emissions', name: 'R-134a leakage', unit: 'kg', ef: 1430 },
  { id: 'co2', scope: 1, category: 'Process emissions', name: 'Direct measured CO₂', unit: 'kg', ef: 1 },
  { id: 'electric', scope: 2, category: 'Purchased electricity', name: 'Grid electricity', unit: 'kWh', ef: 0.45, mb: 0.39 },
  { id: 'cool', scope: 2, category: 'Purchased cooling', name: 'District cooling', unit: 'TRh', ef: 0.65 },
  { id: 'heat', scope: 2, category: 'Purchased heat', name: 'Purchased heat', unit: 'kWh thermal', ef: 0.20 },
  { id: 'steam', scope: 2, category: 'Purchased steam', name: 'Purchased steam', unit: 'kWh thermal', ef: 0.23 }
];

const GHG_CATEGORIES = {
  1: ['Stationary combustion', 'Mobile combustion', 'Fugitive emissions', 'Process emissions'],
  2: ['Purchased electricity', 'Purchased cooling', 'Purchased heat', 'Purchased steam']
};

/* Reporting periods: two months ahead down to three months back, as 'YYYY-MM'. Newest first. */
const PERIODS = [-2, -1, 0, 1, 2, 3].map(back => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - back);
  return d.toISOString().slice(0, 7);
});
const CURRENT_PERIOD = PERIODS[2];

function seedGhgData() {
  const x = { assets: [], sources: [], records: [], imports: [], closed: [], reports: [], na: {} };
  const [now, last] = [PERIODS[2], PERIODS[3]];

  // add(org, facility, source id, source name, factor, asset name, zone, [[period, quantity, uploaded by, days ago]])
  const add = (orgId, facilityId, id, name, factorId, assetName, zone, uploads) => {
    const f = EMISSION_FACTORS.find(e => e.id === factorId);
    if (assetName) x.assets.push({ id: 'a' + id, orgId, facilityId, name: assetName, zone, type: factorId === 'electric' ? 'Meter' : 'Equipment' });
    x.sources.push({ id, orgId, facilityId, name, factorId, assetId: assetName ? 'a' + id : '', zone, active: true });
    for (const [period, q, by, daysAgo] of uploads) {
      x.records.push({
        id: 'r' + id + period, orgId, facilityId, sourceId: id, period, ref: 'Monthly total',
        versions: [{ id: uid(), q, unit: f.unit, ef: f.ef, mb: f.mb ?? f.ef, method: 'Demo factor v1', status: 'Recorded', at: mockDate(-daysAgo), by, evidence: 'Sample consumption log', reason: 'Initial entry' }]
      });
    }
  };

  // Qatar Hotel Group
  add('o1', 'f1', 's1', 'Generator fuel', 'diesel', 'DG-001', 'Utility area', [[last, 450, 'u-e1', 33], [now, 500, 'u-e1', 3]]);
  add('o1', 'f1', 's2', 'Kitchen LPG', 'lpg', 'Kitchen burner', 'Kitchen', [[last, 280, 'u-e1', 33], [now, 300, 'u-e1', 3]]);
  add('o1', 'f1', 's3', 'Chiller refrigerant', 'r410a', 'CH-001', 'Utility area', [[last, 2, 'u-e1', 33], [now, 5, 'u-e1', 3]]);
  add('o1', 'f1', 's4', 'Main electricity', 'electric', 'MTR-001', 'Main building', [[last, 47000, 'u-e1', 33], [now, 50000, 'u-e1', 3]]);
  add('o1', 'f1', 's5', 'District cooling', 'cool', 'Cooling meter', 'Utility area', [[last, 10500, 'u-e4', 34]]); // uploaded by Ravi, since deactivated
  add('o1', 'f2', 's6', 'Generator fuel', 'diesel', 'DG-002', '', [[last, 380, 'u-e2', 32], [now, 400, 'u-e2', 2]]);
  add('o1', 'f2', 's7', 'Main electricity', 'electric', 'MTR-002', '', [[last, 36000, 'u-e2', 32], [now, 37000, 'u-e2', 2]]);
  add('o1', 'f3', 's8', 'Main electricity', 'electric', 'MTR-003', '', [[last, 30000, 'u-oa1', 31]]); // no Engineer here yet: entered by the Org Admin
  add('o1', '', 's9', 'Central fleet fuel', 'petrol', '', '', [[now, 200, 'u-oa1', 2]]); // organisation-level source

  // Gulf Healthcare Group
  add('o2', 'f4', 's10', 'Hospital electricity', 'electric', 'MTR-004', 'Plant room', [[last, 78000, 'u-e6', 30], [now, 80000, 'u-e6', 1]]);
  add('o2', 'f4', 's11', 'Backup generator', 'diesel', 'DG-004', 'Plant room', [[now, 800, 'u-e6', 1]]);
  add('o2', 'f5', 's12', 'Clinic electricity', 'electric', 'MTR-005', '', [[now, 9000, 'u-e6', 1]]);

  // Desert Bloom Retail (read-only)
  add('o3', 'f6', 's13', 'Store electricity', 'electric', 'MTR-006', '', [[last, 12000, 'u-oa3', 40]]);

  // A revised record, to show version history: Lusail generator fuel was corrected.
  const r = x.records.find(rec => rec.sourceId === 's6' && rec.period === now);
  r.versions[0].status = 'Superseded';
  r.versions.push({ ...r.versions[0], id: uid(), q: 420, status: 'Recorded', at: mockDate(-1), reason: 'Corrected after invoice arrived' });

  x.na['o1|f2|Fugitive emissions'] = 'No refrigerant equipment on site';
  x.imports.push({ orgId: 'o1', facilityId: 'f1', name: 'doha-hotel-october.csv', period: last, ok: 4, bad: 1, by: 'u-e1', at: mockDate(-33) });
  x.closed.push({ orgId: 'o3', period: last, at: mockDate(-25), by: 'u-oa3' });
  return x;
}
