/*
 * GHG screens, carried over from the original prototype and scoped by role:
 * Equipment & meters, Emission sources, Data collection, GHG inventory, History, Reports, Factor library.
 * Rules live in js/core/ghg.js. The audit trail is the Ledger.
 */
let historyTab = 'Calculation history';
let pendingImport = null;

/* Sidebar entries under "Data" for each person. */
function dataPagesFor(user) {
  const pages = [];
  if (can(user, 'data.view')) {
    pages.push(['ghg-equipment', 'Equipment & meters', '⚙'], ['ghg-sources', 'Emission sources', '◈']);
    if (can(user, 'data.upload')) pages.push(['ghg-collect', 'Data collection', '▤']);
    pages.push(['ghg-inventory', 'GHG inventory', '◉'], ['ghg-history', 'History', '◷']);
  }
  if (can(user, 'reports.org')) pages.push(['reports', 'Reports', '▧']);
  if (can(user, 'data.view')) pages.push(['factors', 'Factor library', '◇']);
  return pages;
}

/* Facility cards' "Upload data" button. */
function startUpload(facilityId) { dataFacility = facilityId; go('ghg-collect'); }

/* ---------- Shared pieces ---------- */

/* Page header plus the facility and period filters every GHG page uses. */
function ghgHead(u, org, title, description, actions = '') {
  const facilityOptions = opt('', seesOrgLevel(u) ? 'All facilities' : 'All my facilities', dataFacility) +
    (seesOrgLevel(u) ? opt('org', 'Organisation-level', dataFacility) : '') +
    dataFacilityIds(u, org).map(id => opt(id, facilityName(id), dataFacility)).join('');
  return pageHead(title, description, actions, org.name) +
    `<div class="card filters"><div class="row">
      <label class="inline">Facility ${sel('gf', facilityOptions, 'onchange="dataFacility=this.value;render()"')}</label>
      <label class="inline">Period ${sel('gp', PERIODS.map(p => opt(p, periodLabel(p), dataPeriod)).join(''), 'onchange="dataPeriod=this.value;render()"')}</label>
      ${periodClosed(org.id) ? badge('Closed') + ' <small>Period closed: read-only until the Org Admin reopens it.</small>' : ''}
    </div></div>`;
}

function scopeTabs() {
  return `<div class="tabs">${[1, 2].map(s => `<button class="${dataScope === s ? 'active' : ''}" onclick="dataScope=${s};render()">Scope ${s} · ${s === 1 ? 'Direct' : 'Purchased energy'}</button>`).join('')}</div>`;
}

function locationOptions(ids, selected) { return ids.map(id => opt(id, locationName(id), selected)).join(''); }

/* ---------- Equipment & meters ---------- */
VIEWS['ghg-equipment'] = function (u, org) {
  if (!org) return noOrgYet();
  const assets = db.ghg.assets.filter(a => a.orgId === org.id && inDataView(u, org, a.facilityId));
  return ghgHead(u, org, 'Equipment & meters', 'A shared asset register. Link equipment to sources; aggregate sources do not need an asset.',
    editableLocations(u, org).length ? btn('Add equipment or meter', 'assetModal()', 'primary') : '') +
    `<div class="card section">${table(['Asset', 'Type', 'Location', 'Zone', 'Linked sources'], assets.map(a => [
      esc(a.name), esc(a.type), esc(locationName(a.facilityId)), esc(a.zone || '—'), db.ghg.sources.filter(s => s.assetId === a.id).length
    ]), 'No equipment registered here.')}</div>`;
};

function assetModal() {
  const u = currentUser(), org = currentOrg();
  if (!requireWritable(org)) return;
  const locs = editableLocations(u, org);
  openModal('Add equipment or meter', `${field('Asset name / code', inp('an'))}
    ${field('Type', sel('at', opt('Equipment', 'Equipment') + opt('Meter', 'Meter')))}
    ${field('Location', sel('af', locationOptions(locs, locs[0]), 'onchange="zoneOptions(\'af\',\'az\')"'))}
    ${field('Zone', sel('az', opt('', 'No zone')))}
    ${modalFoot('Save asset', 'saveAsset()')}`);
  zoneOptions('af', 'az');
}

function zoneOptions(locationId, zoneId) {
  $(zoneId).innerHTML = opt('', 'No zone') + (findFacility(value(locationId))?.zones || []).map(z => opt(z, z)).join('');
}

function saveAsset() {
  const org = currentOrg(), name = value('an'), facilityId = value('af');
  if (!name) return formError('Enter an asset name.');
  if (!canEditData(currentUser(), facilityId)) return formError('You cannot add equipment here.');
  if (db.ghg.assets.some(a => a.orgId === org.id && a.facilityId === facilityId && a.name.toLowerCase() === name.toLowerCase())) return formError('That asset already exists here.');
  db.ghg.assets.push({ id: 'a-' + uid(), orgId: org.id, facilityId, name, type: value('at'), zone: value('az') });
  logAction('Asset created', `${locationName(facilityId)} · ${name}`, { facilityId: facilityId || null, isData: true });
  closeModal(); render();
}

/* ---------- Emission sources ---------- */
VIEWS['ghg-sources'] = function (u, org) {
  if (!org) return noOrgYet();
  return ghgHead(u, org, 'Emission sources', 'Register what needs measuring, or mark a category as not applicable. Missing is not zero.',
    editableLocations(u, org).length ? btn('Add emission source', 'sourceModal()', 'primary') : '') + scopeTabs() + categoryBoxes(u, org, false);
};

/* Category boxes used by both Emission sources and Data collection. */
function categoryBoxes(u, org, collecting) {
  const sources = viewSources(u, org), records = viewRecords(u, org);
  const closed = periodClosed(org.id), writable = orgIsWritable(org) && !closed;
  const naPlace = dataFacility === 'org' ? '' : dataFacility; // N/A applies to one location, so a single facility (or org-level) must be selected
  const canNA = (dataFacility !== '') && canEditData(u, naPlace) && writable;
  return GHG_CATEGORIES[dataScope].map(cat => {
    const items = sources.filter(s => factorOf(s.factorId).category === cat);
    const naKey = `${org.id}|${naPlace}|${cat}`, na = dataFacility !== '' ? db.ghg.na[naKey] : null;
    const canAdd = writable && editableLocations(u, org).length;
    const headerButtons = (canAdd ? btn('+ Add emission source', `sourceModal('${cat}',${collecting})`) : '') +
      (canNA && !items.some(s => s.facilityId === naPlace) ? btn(na ? 'Clear N/A' : 'Mark not applicable', `toggleNA('${cat}')`) : '');
    const rows = items.map(s => {
      const rs = records.filter(r => r.sourceId === s.id);
      const loc = esc(locationName(s.facilityId) + (s.zone ? ' / ' + s.zone : ''));
      if (collecting) return [esc(s.name), loc, rs.length ? rs.map(r => badge(currentVersion(r).status)).join(' ') : badge('Data pending'),
        writable && canEditData(u, s.facilityId) ? btn('Add activity', `entryModal('${s.id}')`) : ''];
      return [esc(s.name), loc, esc(ghgAsset(s.assetId)?.name || 'Aggregate'), esc(factorOf(s.factorId).name),
        canEditData(u, s.facilityId) && can(u, 'data.upload') ? btn('Collect', `dataFacility='${s.facilityId || 'org'}';dataScope=${dataScope};go('ghg-collect')`) : ''];
    });
    return `<div class="scopebox"><div class="scopehead"><div><h3>${cat}</h3><small>${items.length} sources configured${na ? ' · Not applicable' : ''}</small></div><div class="row">${headerButtons}</div></div>
      <div class="scopebody">${items.length ? table(collecting ? ['Source', 'Location / zone', 'Activity status', ''] : ['Source', 'Location / zone', 'Equipment', 'Activity type', ''], rows)
        : `<p class="muted">${na ? 'Not applicable · ' + esc(na) : 'Not assessed / not configured. Missing is not zero.'}${dataFacility === '' && !na ? ' Pick one facility to mark it not applicable.' : ''}</p>`}</div></div>`;
  }).join('');
}

function toggleNA(cat) {
  const org = currentOrg();
  if (!ensureDataOpen(org)) return;
  const place = dataFacility === 'org' ? '' : dataFacility, key = `${org.id}|${place}|${cat}`;
  if (db.ghg.na[key]) delete db.ghg.na[key];
  else {
    const reason = prompt(`Why is ${cat} not applicable to ${locationName(place)}?`);
    if (!reason?.trim()) return;
    db.ghg.na[key] = reason.trim();
  }
  logAction('Applicability updated', `${locationName(place)} · ${cat}`, { facilityId: place || null, isData: true });
  render();
}

function sourceModal(cat = GHG_CATEGORIES[dataScope][0], collecting = false) {
  const u = currentUser(), org = currentOrg();
  if (!ensureDataOpen(org)) return;
  const locs = editableLocations(u, org);
  openModal('Add emission source', `<p class="muted" style="margin-bottom:12px">Register a source and optionally link or create equipment without leaving this workflow.</p>
    ${field('Source name', inp('sn'))}
    ${field('Location', sel('sf', locationOptions(locs, locs[0]), 'onchange="sourceFields()"'))}
    ${field('Category / activity', sel('st', EMISSION_FACTORS.filter(f => f.scope === dataScope).map(f => opt(f.id, f.category + ' · ' + f.name, EMISSION_FACTORS.find(v => v.category === cat)?.id)).join('')))}
    ${field('Zone', sel('sz', opt('', 'No zone')))}
    ${field('Equipment or meter', sel('sa', '', `onchange="$('newasset').style.display=this.value==='new'?'block':'none'"`))}
    <div id="newasset" style="display:none">${field('New asset name', inp('san'))}${field('Asset type', sel('sat', opt('Equipment', 'Equipment') + opt('Meter', 'Meter')))}</div>
    ${modalFoot(collecting ? 'Save & enter activity' : 'Save source', `saveSource(${collecting})`)}`);
  sourceFields();
}

function sourceFields() {
  const loc = value('sf'), org = currentOrg();
  zoneOptions('sf', 'sz');
  $('sa').innerHTML = opt('', 'Aggregate / no equipment') + db.ghg.assets.filter(a => a.orgId === org.id && a.facilityId === loc).map(a => opt(a.id, a.name)).join('') + opt('new', '+ Create new equipment / meter');
  $('newasset').style.display = 'none';
}

function saveSource(collecting) {
  const org = currentOrg(), name = value('sn'), facilityId = value('sf'), factorId = value('st'), zone = value('sz');
  let assetId = value('sa');
  if (!name || !factorOf(factorId)) return formError('Enter a source name and activity.');
  if (!canEditData(currentUser(), facilityId)) return formError('You cannot add sources here.');
  if (db.ghg.sources.some(s => s.orgId === org.id && s.facilityId === facilityId && s.name.toLowerCase() === name.toLowerCase())) return formError('A source with that name already exists here.');
  if (assetId === 'new') {
    const assetName = value('san');
    if (!assetName || db.ghg.assets.some(a => a.orgId === org.id && a.facilityId === facilityId && a.name.toLowerCase() === assetName.toLowerCase())) return formError('Enter a unique asset name.');
    assetId = 'a-' + uid();
    db.ghg.assets.push({ id: assetId, orgId: org.id, facilityId, name: assetName, zone, type: value('sat') });
  }
  const id = 's-' + uid();
  db.ghg.sources.push({ id, orgId: org.id, facilityId, name, factorId, assetId, zone, active: true });
  delete db.ghg.na[`${org.id}|${facilityId}|${factorOf(factorId).category}`];
  logAction('Emission source created', `${locationName(facilityId)} · ${name}`, { facilityId: facilityId || null, isData: true });
  closeModal(); render();
  if (collecting) entryModal(id);
}

/* ---------- Data collection (flow 4: Engineer uploads to an assigned facility) ---------- */
VIEWS['ghg-collect'] = function (u, org) {
  if (!org) return noOrgYet();
  const records = viewRecords(u, org).filter(r => scopeOfRecord(r) === dataScope);
  const writable = orgIsWritable(org) && !periodClosed(org.id) && editableLocations(u, org).length;
  return ghgHead(u, org, 'Data collection', u.role === 'Org Admin'
      ? 'Enter actual consumption or upload a spreadsheet, anywhere in the organisation. Data counts as soon as it is saved.'
      : 'Enter actual consumption or upload a spreadsheet for your assigned facilities. Data counts as soon as it is saved.',
    writable ? btn('Upload Excel / CSV', 'importModal()', 'primary') + btn('Download CSV template', 'csvTemplate()') : '') +
    scopeTabs() + categoryBoxes(u, org, true) +
    `<div class="card section"><h2>Activity records · ${periodLabel(dataPeriod)}</h2>${recordTable(u, records, true)}</div>`;
};

function recordTable(u, records, actions = false) {
  const org = currentOrg();
  const writable = orgIsWritable(org) && !periodClosed(org.id);
  return table(['Source / location', 'Reference', 'Quantity', 'Emissions tCO₂e', 'Entered by', 'Status', 'Version', ''], records.map(r => {
    const v = currentVersion(r);
    return [`${esc(ghgSource(r.sourceId).name)}<br><small>${esc(locationName(r.facilityId))}</small>`, esc(r.ref), `${fmt(v.q)} ${esc(v.unit)}`, fmt(co2(v), 3),
      `${esc(userName(v.by))}<br><small>${fmtDate(v.at)}</small>`, badge(v.status), r.versions.length,
      btn('Details', `recordDetail('${r.id}')`) + (actions && writable && canEditData(u, r.facilityId) ? btn('Revise', `entryModal('${r.sourceId}','${r.id}')`) : '')];
  }), 'No records in this view.');
}

function entryModal(sourceId, recordId = '') {
  if (!ensureDataOpen()) return;
  const s = ghgSource(sourceId), f = factorOf(s.factorId), r = db.ghg.records.find(x => x.id === recordId), v = r && currentVersion(r);
  openModal(r ? 'Revise activity' : 'Add activity data', `<div class="notice">${esc(s.name)} · Scope ${f.scope} · ${esc(locationName(s.facilityId))} · ${periodLabel(dataPeriod)}</div>
    ${field('Activity reference (unique for source and month)', inp('er', r?.ref || 'Monthly total', r ? 'readonly' : ''))}
    ${field(`Quantity (${esc(f.unit)})`, inp('eq', v?.q ?? '', `type="number" min="0" step="any" oninput="entryPreview('${sourceId}')"`))}
    ${field('Evidence reference / notes', inp('ee', v?.evidence || ''))}
    ${field('Attach supporting file (name kept in demo)', '<input id="efile" type="file" accept=".pdf,.jpg,.png,.xlsx,.csv">')}
    ${field('Reason / change description', inp('why', r ? '' : 'Initial entry'))}
    <div class="card" id="preview"></div>
    ${modalFoot(r ? 'Save revision' : 'Save activity', `saveEntry('${sourceId}','${recordId}')`)}`);
  entryPreview(sourceId);
}

function entryPreview(sourceId) {
  const f = factorOf(ghgSource(sourceId).factorId), q = Number(value('eq')) || 0;
  $('preview').innerHTML = `<small>Calculation preview · mock factor v1</small><div class="stat">${fmt(q * f.ef / 1000, 3)} <span>tCO₂e</span></div>
    <small>${esc(f.name)} · ${f.ef} kgCO₂e/${esc(f.unit)} · quantity × factor ÷ 1,000</small>
    ${f.scope === 2 && currentOrg().dualScope2 ? `<p>Alternative market-based demo: ${fmt(q * (f.mb ?? f.ef) / 1000, 3)} tCO₂e</p>` : ''}`;
}

function newVersion(source, q, evidence, reason) {
  const f = factorOf(source.factorId);
  return { id: uid(), q, unit: f.unit, ef: f.ef, mb: f.mb ?? f.ef, method: 'Demo factor v1', status: 'Recorded', at: nowIso(), by: session.userId, evidence, reason };
}

function saveEntry(sourceId, recordId) {
  if (!ensureDataOpen()) return;
  const s = ghgSource(sourceId), org = currentOrg();
  if (!canEditData(currentUser(), s.facilityId)) return formError('You are no longer assigned to this facility.');
  const q = Number(value('eq')), ref = value('er'), reason = value('why');
  const evidence = [value('ee'), $('efile').files[0]?.name].filter(Boolean).join(' · ');
  if (!value('eq') || !Number.isFinite(q) || q < 0 || !ref || !reason) return formError('Enter a quantity of zero or more, a reference and a reason.');
  let r = db.ghg.records.find(x => x.id === recordId);
  const same = x => x.sourceId === sourceId && x.period === dataPeriod;
  if (!r && db.ghg.records.some(x => same(x) && x.ref.toLowerCase() === ref.toLowerCase())) return formError('Duplicate reference. Revise the existing record instead.');
  if (!r && db.ghg.records.some(x => same(x) && (x.ref.toLowerCase() === 'monthly total' || ref.toLowerCase() === 'monthly total'))) return formError('A monthly total overlaps other records for this source. Revise it instead.');
  if (!r) { r = { id: 'r-' + uid(), orgId: org.id, facilityId: s.facilityId, sourceId, period: dataPeriod, ref, versions: [] }; db.ghg.records.push(r); }
  const prev = currentVersion(r);
  if (prev) prev.status = 'Superseded';
  r.versions.push(newVersion(s, q, evidence, reason));
  logAction(prev ? 'Activity revised' : 'Data uploaded', `${locationName(s.facilityId)} · ${s.name} · ${fmt(q, 0)} ${factorOf(s.factorId).unit} · ${periodLabel(dataPeriod)} · v${r.versions.length}`, { facilityId: s.facilityId || null, isData: true });
  closeModal(); render();
  toast('Saved. It now shows for the Managers of this facility and the CXO.');
}

function recordDetail(id) {
  const r = db.ghg.records.find(x => x.id === id);
  openModal('Calculation record · ' + ghgSource(r.sourceId).name, `<p class="muted">${esc(r.ref)} · ${periodLabel(r.period)} · ${esc(locationName(r.facilityId))}</p>
    ${r.versions.map((v, i) => `<div class="card section"><div class="row between"><h3>Version ${i + 1}</h3>${badge(v.status)}</div>
      <p class="mono">${fmt(v.q)} ${esc(v.unit)} × ${v.ef} ÷ 1,000 = ${fmt(co2(v), 3)} tCO₂e</p><p>${esc(v.method)} · ${esc(v.id)}</p>
      <small>${fmtDateTime(v.at)} · ${esc(userName(v.by))}</small><p>Evidence: ${esc(v.evidence || 'None recorded')}</p><p>Reason: ${esc(v.reason)}</p></div>`).join('')}
    <div class="modalfoot">${btn('Close', 'closeModal()')}</div>`);
}

/* ---------- Spreadsheet import ---------- */
function csvTemplate() {
  const u = currentUser(), org = currentOrg();
  const sources = viewSources(u, org).filter(s => factorOf(s.factorId).scope === dataScope && canEditData(u, s.facilityId));
  download(`SA-Nest-scope-${dataScope}-template.csv`, [['source_id', 'period', 'reference', 'quantity', 'unit', 'evidence'],
    ...sources.map(s => [s.id, dataPeriod, '', '', factorOf(s.factorId).unit, ''])].map(csvLine).join('\n'));
}

function importModal() {
  if (!ensureDataOpen()) return;
  pendingImport = null;
  openModal('Upload Excel or CSV', `<div class="notice">Scope ${dataScope} · ${periodLabel(dataPeriod)}. Download the template for valid source IDs. One row per activity. For .xlsx files the first worksheet is used.</div>
    ${field('Select file', '<input id="ifile" type="file" accept=".csv,.xlsx">')}
    <div class="row">${btn('Download template', 'csvTemplate()')}${btn('Load sample rows', 'sampleImport()')}</div>
    <div id="importpreview" class="section"></div><div id="formerr" class="err"></div>
    <div class="modalfoot">${btn('Cancel', 'closeModal()')}${btn('Validate file', 'validateFile()')}${btn('Import valid rows', 'commitImport()', 'primary')}</div>`);
}

async function validateFile() {
  const file = $('ifile').files[0];
  if (!file) return formError('Choose a CSV or XLSX file.');
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Demo file limit is 5 MB.');
    const rows = file.name.toLowerCase().endsWith('.xlsx') ? await parseXlsx(file) : parseCSV((await file.text()).replace(/^﻿/, ''));
    validateRows(rows, file.name);
  } catch (e) { formError(e.message); }
}

function sampleImport() {
  const u = currentUser(), org = currentOrg();
  const s = viewSources(u, org).find(x => factorOf(x.factorId).scope === dataScope && canEditData(u, x.facilityId) &&
    !db.ghg.records.some(r => r.sourceId === x.id && r.period === dataPeriod && r.ref.toLowerCase() === 'monthly total'));
  if (!s) return formError('Every source you can edit already has a monthly total. Add a source first.');
  const unit = factorOf(s.factorId).unit;
  validateRows([['source_id', 'period', 'reference', 'quantity', 'unit', 'evidence'], [s.id, dataPeriod, 'Demo batch ' + uid(), 25, unit, 'Sample log'],
    [s.id, dataPeriod, 'Invalid example', -10, unit, ''], ['unknown', dataPeriod, 'Bad source', 30, unit, '']], 'Sample import.csv');
}

function validateRows(data, name) {
  const u = currentUser(), org = currentOrg();
  const head = (data.shift() || []).map(v => String(v || '').trim().toLowerCase()), required = ['source_id', 'period', 'reference', 'quantity', 'unit'];
  if (required.some(k => !head.includes(k))) return formError('Missing required columns: ' + required.join(', '));
  const seen = new Set();
  const parsed = data.map((row, i) => {
    const get = k => String(row[head.indexOf(k)] ?? '').trim();
    const id = get('source_id'), s = ghgSource(id), period = get('period'), ref = get('reference'), q = Number(get('quantity')), unit = get('unit');
    const key = id + '|' + period + '|' + ref.toLowerCase();
    const overlaps = db.ghg.records.some(r => r.sourceId === id && r.period === period && (r.ref.toLowerCase() === 'monthly total' || ref.toLowerCase() === 'monthly total')) ||
      [...seen].some(k => k.startsWith(id + '|' + period + '|') && (k.endsWith('|monthly total') || ref.toLowerCase() === 'monthly total'));
    let err = '';
    if (!s || s.orgId !== org.id || !inDataView(u, org, s.facilityId) || factorOf(s.factorId).scope !== dataScope) err = 'Unknown or out-of-context source';
    else if (!canEditData(u, s.facilityId)) err = 'You are not assigned to this facility';
    else if (period !== dataPeriod) err = 'Reporting period mismatch';
    else if (!ref || !get('quantity') || !Number.isFinite(q) || q < 0) err = 'Invalid reference or quantity';
    else if (unit !== factorOf(s.factorId).unit) err = 'Unit mismatch: expected ' + factorOf(s.factorId).unit;
    else if (overlaps) err = 'Monthly total overlaps other records';
    else if (seen.has(key) || db.ghg.records.some(r => r.sourceId === id && r.period === period && r.ref.toLowerCase() === ref.toLowerCase())) err = 'Duplicate reference';
    seen.add(key);
    return { line: i + 2, id, ref, q, unit, evidence: get('evidence'), err };
  });
  pendingImport = { name, parsed };
  $('formerr').textContent = '';
  $('importpreview').innerHTML = `<p><b>${parsed.filter(x => !x.err).length} valid</b> · ${parsed.filter(x => x.err).length} rejected</p>` +
    table(['Row', 'Source', 'Reference', 'Quantity', 'Validation'], parsed.slice(0, 100).map(x => [x.line, esc(ghgSource(x.id)?.name || x.id), esc(x.ref), esc(x.q) + ' ' + esc(x.unit),
      x.err ? `<span class="tag bad">${esc(x.err)}</span>` : badge('Valid')]));
}

function commitImport() {
  if (!pendingImport) return formError('Validate a file or the sample first.');
  if (!ensureDataOpen()) return;
  const org = currentOrg(), { name, parsed } = pendingImport;
  let ok = 0, bad = 0;
  const facilities = new Set();
  for (const x of parsed) {
    if (x.err) { bad++; continue; }
    const s = ghgSource(x.id);
    db.ghg.records.push({ id: 'r-' + uid(), orgId: org.id, facilityId: s.facilityId, sourceId: s.id, period: dataPeriod, ref: x.ref, versions: [newVersion(s, x.q, x.evidence || name, 'Imported from ' + name)] });
    facilities.add(s.facilityId);
    ok++;
  }
  const facilityId = facilities.size === 1 ? [...facilities][0] : '';
  db.ghg.imports.unshift({ orgId: org.id, facilityId, name, period: dataPeriod, ok, bad, by: session.userId, at: nowIso() });
  logAction('File imported', `${name} · ${ok} recorded / ${bad} rejected`, { facilityId: facilityId || null, isData: true });
  pendingImport = null;
  closeModal(); render(); toast(`${ok} rows recorded`);
}

/* ---------- GHG inventory ---------- */
VIEWS['ghg-inventory'] = function (u, org) {
  if (!org) return noOrgYet();
  const records = viewRecords(u, org), t = totals(records), sources = viewSources(u, org);
  const locations = (dataFacility === 'org' ? [''] : dataFacility ? [dataFacility] : (seesOrgLevel(u) ? dataFacilityIds(u, org).concat(['']) : dataFacilityIds(u, org)));
  return ghgHead(u, org, 'GHG inventory', `${seesOrgLevel(u) ? 'Organisation-wide' : 'Your assigned facilities'} · ${org.boundary || 'Operational control'} · Scope 3 not assessed.`,
    btn('Export CSV', 'exportInventory()', 'primary')) +
    `<div class="grid section">${statCard('Total', fmt(t.total), 'tCO₂e', 'Scope 1 + location-based Scope 2')}${statCard('Scope 1', fmt(t.s1), 'tCO₂e', 'Direct emissions')}
      ${statCard('Scope 2', fmt(t.s2), 'tCO₂e', 'Location-based')}${statCard('Missing', missingSources(sources, records).length, 'sources', 'Configured but no data')}</div>
    <div class="two section"><div class="card"><h2>Emissions by scope</h2><div class="stat">${fmt(t.total)} <span>tCO₂e</span></div>
      <div class="bar" style="margin:15px 0"><i style="width:${t.total ? t.s1 / t.total * 100 : 0}%"></i><i class="alt" style="width:${t.total ? t.s2 / t.total * 100 : 0}%"></i></div>
      <div class="row between"><small>● Scope 1 · ${fmt(t.s1)}</small><small>● Scope 2 · ${fmt(t.s2)}</small></div>
      ${org.dualScope2 ? `<p class="section muted">Market-based Scope 2 (alternative): ${fmt(t.mb)} tCO₂e</p>` : ''}</div>
    <div class="card"><h2>Completeness</h2><p>${missingSources(sources, records).length} configured sources without data · ${unassessedCategories(u, org, sources).length} unassessed categories.</p>
      <p class="muted section">This may be a partial inventory. Missing is not zero.</p></div></div>
    <div class="card section"><h2>Consolidated by location</h2>${table(['Location', 'Scope 1', 'Scope 2 location', 'Total', ...(org.dualScope2 ? ['Scope 2 market (alt.)'] : [])],
      locations.map(id => { const a = totals(records.filter(r => r.facilityId === id)); return [esc(locationName(id)), fmt(a.s1), fmt(a.s2), `<b>${fmt(a.total)}</b>`, ...(org.dualScope2 ? [fmt(a.mb)] : [])]; }))}</div>
    <div class="card section"><h2>Source records</h2>${table(['Scope', 'Category', 'Source', 'Location', 'Quantity', 'tCO₂e', 'Entered by', ''], records.map(r => {
      const s = ghgSource(r.sourceId), v = currentVersion(r);
      return [scopeOfRecord(r), esc(factorOf(s.factorId).category), esc(s.name), esc(locationName(r.facilityId)), `${fmt(v.q)} ${esc(v.unit)}`, fmt(co2(v), 3), esc(userName(v.by)), btn('Trace', `recordDetail('${r.id}')`)];
    }))}</div>`;
};

function exportInventory() {
  const u = currentUser(), org = currentOrg();
  const rows = viewRecords(u, org).map(r => {
    const v = currentVersion(r);
    return [org.name, locationName(r.facilityId), r.period, scopeOfRecord(r), ghgSource(r.sourceId).name, r.ref, v.q, v.unit, v.ef, co2(v), org.dualScope2 && scopeOfRecord(r) === 2 ? co2(v, true) : '', userName(v.by), v.id];
  });
  download('SA-Nest-inventory.csv', [['organisation', 'location', 'period', 'scope', 'source', 'reference', 'quantity', 'unit', 'factor', 'tCO2e', 'market_tCO2e_alternative', 'entered_by', 'version'], ...rows].map(csvLine).join('\n'));
  logAction('Inventory exported', periodLabel(dataPeriod));
}

/* ---------- History ---------- */
VIEWS['ghg-history'] = function (u, org) {
  if (!org) return noOrgYet();
  const tabs = ['Calculation history', 'Import history'];
  const records = db.ghg.records.filter(r => r.orgId === org.id && inDataView(u, org, r.facilityId));
  const imports = db.ghg.imports.filter(i => i.orgId === org.id && (i.facilityId === '' ? seesOrgLevel(u) || i.by === u.id : inDataView(u, org, i.facilityId)));
  return ghgHead(u, org, 'History', 'Every version of every calculation, and every spreadsheet import. The audit trail of who did what is the Ledger.', btn('Open ledger', "go('ledger')")) +
    `<div class="tabs section">${tabs.map(x => `<button class="${historyTab === x ? 'active' : ''}" onclick="historyTab='${x}';render()">${x}</button>`).join('')}</div>
    <div class="card">${historyTab === tabs[0]
      ? table(['Period', 'Source', 'Location', 'Reference', 'Versions', 'Current status', ''], records.map(r => [periodLabel(r.period), esc(ghgSource(r.sourceId).name), esc(locationName(r.facilityId)), esc(r.ref), r.versions.length, badge(currentVersion(r).status), btn('View history', `recordDetail('${r.id}')`)]))
      : table(['File', 'Location', 'Period', 'Recorded', 'Rejected', 'By', 'Time'], imports.map(i => [esc(i.name), esc(i.facilityId ? facilityName(i.facilityId) : 'Several / organisation'), periodLabel(i.period), i.ok, i.bad, esc(userName(i.by)), fmtDateTime(i.at)]), 'No imports yet.')}</div>`;
};

/* ---------- Reports (Org Admin and CXO) ---------- */
VIEWS.reports = function (u, org) {
  if (!org) return noOrgYet();
  const closed = periodClosed(org.id), admin = u.role === 'Org Admin' && orgIsWritable(org);
  const allRecords = db.ghg.records.filter(r => r.orgId === org.id && r.period === dataPeriod);
  const t = totals(allRecords);
  const facilities = activeFacilities(org.id);
  return pageHead('Reports', 'Organisation-wide reports cover all facilities in the selected organisation. Facility-wide reports cover one facility.',
    admin ? btn(closed ? 'Reopen period' : 'Close period', `periodAction(${closed})`, 'primary') : '', org.name) +
    `<div class="card filters"><label class="inline">Period ${sel('gp', PERIODS.map(p => opt(p, periodLabel(p), dataPeriod)).join(''), 'onchange="dataPeriod=this.value;render()"')}</label></div>
    <div class="card section"><h2>${periodLabel(dataPeriod)} · ${closed ? 'Closed period' : 'Open period'}</h2>
      <p>Scope 1: ${fmt(t.s1)} tCO₂e · Scope 2 location: ${fmt(t.s2)} tCO₂e · Total: <b>${fmt(t.total)}</b> tCO₂e</p>
      <p class="muted">Scope 3 excluded. Closing a period makes its data read-only and saves a closed snapshot.</p>
      <div class="row section">${admin ? btn('Save report snapshot', 'makeReport()', 'primary') : ''}${btn('Download organisation-wide CSV', "downloadReport('')")}
        ${sel('rf', facilities.map(f => opt(f.id, f.name)).join(''), 'aria-label="Facility" style="width:auto"')}${btn('Download facility-wide CSV', "downloadReport(value('rf'))")}${btn('Print', 'window.print()')}</div></div>
    <div class="card section"><h2>Saved reports</h2>${table(['Report', 'Period', 'State', 'Scope 1', 'Scope 2 location', 'Total', 'Saved by', ''], db.ghg.reports.filter(r => r.orgId === org.id).map(r => [
      esc(r.id), periodLabel(r.period), badge(r.closed ? 'Closed' : 'Draft'), fmt(r.t.s1), fmt(r.t.s2), fmt(r.t.total), esc(userName(r.by)), btn('View snapshot', `reportDetail('${r.id}')`)
    ]), 'No saved reports yet.')}</div>`;
};

function periodAction(reopen) {
  const org = currentOrg();
  if (!requireWritable(org)) return;
  if (reopen) {
    const why = prompt('Reason for reopening the period:');
    if (!why?.trim()) return;
    db.ghg.closed = db.ghg.closed.filter(c => !(c.orgId === org.id && c.period === dataPeriod));
    logAction('Period reopened', `${periodLabel(dataPeriod)} · ${why}`);
  } else {
    if (!confirm(`Close ${periodLabel(dataPeriod)}? Its data becomes read-only until reopened.`)) return;
    db.ghg.closed.push({ orgId: org.id, period: dataPeriod, at: nowIso(), by: session.userId });
    logAction('Period closed', periodLabel(dataPeriod));
    makeReport(false);
  }
  render();
}

function makeReport(show = true) {
  const org = currentOrg(), records = db.ghg.records.filter(r => r.orgId === org.id && r.period === dataPeriod), id = 'R-' + uid();
  db.ghg.reports.unshift({ id, orgId: org.id, period: dataPeriod, closed: periodClosed(org.id), t: totals(records), at: nowIso(), by: session.userId,
    name: org.name, boundary: org.boundary, standard: org.standard, dual: org.dualScope2,
    records: records.map(r => ({ source: ghgSource(r.sourceId).name, location: locationName(r.facilityId), v: { ...currentVersion(r) } })) });
  logAction('Report snapshot saved', `${id} · ${periodLabel(dataPeriod)}`);
  if (show) { render(); reportDetail(id); }
}

function reportDetail(id) {
  const r = db.ghg.reports.find(x => x.id === id);
  openModal('GHG report snapshot', `<div class="eyebrow">${r.closed ? 'Closed period' : 'Draft'} · ${periodLabel(r.period)} · ${esc(r.id)}</div><h1>${esc(r.name)}</h1>
    <p>${esc(r.boundary || 'Operational control')} · ${esc(r.standard || 'GHG Protocol')}</p><div class="stat">${fmt(r.t.total)} <span>tCO₂e</span></div>
    <p>Scope 1: ${fmt(r.t.s1)} · Scope 2 location: ${fmt(r.t.s2)}${r.dual ? ' · Scope 2 market alternative: ' + fmt(r.t.mb) : ''}</p>
    <p class="muted">Scope 3 not assessed. Mock factors; not for disclosure.</p>
    <div class="section">${table(['Source', 'Location', 'Quantity', 'tCO₂e', 'Version'], r.records.map(x => [esc(x.source), esc(x.location), `${fmt(x.v.q)} ${esc(x.v.unit)}`, fmt(co2(x.v), 3), esc(x.v.id)]))}</div>
    <div class="modalfoot">${btn('Close', 'closeModal()')}</div>`);
}

function downloadReport(facilityId) {
  const org = currentOrg();
  const records = db.ghg.records.filter(r => r.orgId === org.id && r.period === dataPeriod && (!facilityId || r.facilityId === facilityId));
  const t = totals(records);
  const lines = [['organisation', 'scope_of_report', 'period', 'scope_1', 'scope_2_location', 'total'], [org.name, facilityId ? facilityName(facilityId) : 'Organisation-wide', dataPeriod, t.s1, t.s2, t.total], [],
    ['location', 'scope', 'source', 'quantity', 'unit', 'tCO2e', 'entered_by'],
    ...records.map(r => { const v = currentVersion(r); return [locationName(r.facilityId), scopeOfRecord(r), ghgSource(r.sourceId).name, v.q, v.unit, co2(v).toFixed(3), userName(v.by)]; })];
  download(`SA-Nest-${facilityId ? 'facility' : 'organisation'}-report-${dataPeriod}.csv`, lines.map(csvLine).join('\n'));
  logAction('Report downloaded', `${facilityId ? facilityName(facilityId) : 'Organisation-wide'} · ${periodLabel(dataPeriod)}`);
}

/* ---------- Factor library ---------- */
VIEWS.factors = function () {
  return pageHead('Emission factor library', 'Read-only demonstration factors. These values are invented or illustrative, not verified Qatar reporting factors.', '', 'Reference') +
    `<div class="card">${table(['Scope', 'Category', 'Factor', 'Unit', 'kgCO₂e/unit', 'Version'], EMISSION_FACTORS.map(f => [f.scope, esc(f.category), esc(f.name), esc(f.unit), f.ef, 'Demo v1']))}</div>`;
};

/* Latest uploads card on each role's overview. */
function dataSummaryCard(u, org) {
  if (!can(u, 'data.view')) return '';
  const saved = dataFacility; dataFacility = '';
  const events = uploadsInOrg(org.id).filter(e => inDataView(u, org, e.facilityId)).slice(0, 6);
  dataFacility = saved;
  return `<div class="card section"><div class="row between"><h2>Latest uploads ${seesOrgLevel(u) ? 'in the organisation' : 'at your facilities'}</h2>${btn('Open inventory', "go('ghg-inventory')", 'link')}</div>
    ${table(['Source', 'Location', 'Period', 'Quantity', 'Entered by', 'When'], events.map(e => [esc(ghgSource(e.record.sourceId).name), esc(locationName(e.facilityId)),
      periodLabel(e.record.period), `${fmt(e.q, 0)} ${esc(e.unit)}`, esc(userName(e.by)), fmtDate(e.at)]), 'No uploads yet.')}</div>`;
}
