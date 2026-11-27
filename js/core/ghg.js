/*
 * GHG rules: what each person can see and change, and the emission calculations.
 *
 * From the permission matrix (core/permissions.js):
 *   data.view    Org Admin and CXO: the whole organisation, including organisation-level sources.
 *                Manager and Engineer: their assigned facilities only.
 *   data.upload  Org Admin: anywhere in the organisation. Engineer: assigned facilities only.
 *   reports.org  Org Admin and CXO.
 * V1 has no review step: data counts as soon as it is entered (decision 3 = C).
 * Past uploads stay with the facility and keep the uploader's name when access changes.
 */
let dataFacility = '';            // '' = everything I can see, 'org' = organisation-level only, or a facility id
let dataPeriod = CURRENT_PERIOD;
let dataScope = 1;

const factorOf = id => EMISSION_FACTORS.find(f => f.id === id);
const ghgSource = id => db.ghg.sources.find(s => s.id === id);
const ghgAsset = id => db.ghg.assets.find(a => a.id === id);
const currentVersion = r => r.versions.at(-1);
const scopeOfRecord = r => factorOf(ghgSource(r.sourceId).factorId).scope;
const co2 = (v, marketBased = false) => v.q * (marketBased ? v.mb : v.ef) / 1000;
const periodLabel = p => new Date(p + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });
const locationName = facilityId => facilityId ? facilityName(facilityId) : 'Organisation-level';

/* ---------- Visibility ---------- */

/* Facility ids this person can see data for (archived facilities excluded). */
const dataFacilityIds = (u, org) => facilitiesFor(u, org.id).filter(f => f.status !== 'Archived' && canAtFacility(u, 'data.view', f.id)).map(f => f.id);
const seesOrgLevel = u => permission(u, 'data.view') === 'all';

/* Does a location ('' = organisation-level) fall inside the current facility filter for this person? */
function inDataView(u, org, facilityId) {
  if (dataFacility === 'org') return facilityId === '' && seesOrgLevel(u);
  if (dataFacility) return facilityId === dataFacility && dataFacilityIds(u, org).includes(facilityId);
  return facilityId === '' ? seesOrgLevel(u) : dataFacilityIds(u, org).includes(facilityId);
}

const viewSources = (u, org) => db.ghg.sources.filter(s => s.orgId === org.id && s.active && inDataView(u, org, s.facilityId));
const viewRecords = (u, org, period = dataPeriod) => db.ghg.records.filter(r => r.orgId === org.id && r.period === period && inDataView(u, org, r.facilityId));

/* ---------- Editing ---------- */

const periodClosed = (orgId, period = dataPeriod) => db.ghg.closed.some(c => c.orgId === orgId && c.period === period);

/* Can this person enter data, add sources or equipment at this location? */
function canEditData(u, facilityId) {
  if (facilityId === '') return permission(u, 'data.upload') === 'all';
  return canAtFacility(u, 'data.upload', facilityId);
}

/* Locations offered in "add" forms: the ones this person may edit, within the current filter. */
function editableLocations(u, org) {
  const ids = dataFacilityIds(u, org).filter(id => canEditData(u, id) && (!dataFacility || dataFacility === id));
  if (canEditData(u, '') && (!dataFacility || dataFacility === 'org')) ids.unshift('');
  return ids;
}

/* Guard for every data change: organisation writable and period open. */
function ensureDataOpen(org = currentOrg()) {
  if (!requireWritable(org)) return false;
  if (periodClosed(org.id)) { toast('This reporting period is closed. The Org Admin can reopen it.'); return false; }
  return true;
}

/* ---------- Calculations ---------- */

function totals(records) {
  let s1 = 0, s2 = 0, mb = 0;
  for (const r of records) {
    const v = currentVersion(r);
    if (scopeOfRecord(r) === 1) s1 += co2(v); else { s2 += co2(v); mb += co2(v, true); }
  }
  return { s1, s2, mb, total: s1 + s2 };
}

/* Configured sources with no data this period. Missing is not zero. */
const missingSources = (sources, records) => sources.filter(s => !records.some(r => r.sourceId === s.id));

/* Categories with no source and no "not applicable" decision, for the locations in view. */
function unassessedCategories(u, org, sources) {
  const places = dataFacility === 'org' ? [''] : dataFacility ? [dataFacility] : (seesOrgLevel(u) ? [''] : []).concat(dataFacilityIds(u, org));
  const gaps = [];
  for (const place of places) for (const scope of [1, 2]) for (const cat of GHG_CATEGORIES[scope]) {
    if (!sources.some(s => s.facilityId === place && factorOf(s.factorId).category === cat) && !db.ghg.na[`${org.id}|${place}|${cat}`]) gaps.push({ place, cat });
  }
  return gaps;
}

/* ---------- Upload events, used by overviews and Manager stats ---------- */

/* Every saved version is an upload event: { record, facilityId, by, at, q, unit }. Newest first. */
function uploadEvents(filter) {
  return db.ghg.records.filter(filter).flatMap(r => r.versions.map(v => ({ record: r, facilityId: r.facilityId, by: v.by, at: v.at, q: v.q, unit: v.unit })))
    .sort((a, b) => b.at.localeCompare(a.at));
}
const uploadsInOrg = orgId => uploadEvents(r => r.orgId === orgId);
const uploadsAtFacility = facilityId => uploadEvents(r => r.facilityId === facilityId);
const uploadsByUser = userId => uploadEvents(() => true).filter(e => e.by === userId);
