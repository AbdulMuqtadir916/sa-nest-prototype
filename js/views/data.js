/*
 * Data screens: upload, review, dashboard and reports.
 *
 * Who can do what comes from the permission matrix:
 *   data.upload  Org Admin anywhere in the organisation, Engineer at assigned facilities
 *   data.view    Org Admin and CXO organisation-wide, Manager and Engineer at assigned facilities
 *   reports.org  Org Admin and CXO
 * Review rule (open question in the document): any Manager assigned to the facility, or the
 * Org Admin, can approve or return an upload. The ledger records who did it. See canReview().
 */
let uploadFacilityId = '';
let dataPeriod = PERIODS[0];

function dataPagesFor(user) {
  const pages = [];
  if (can(user, 'data.upload')) pages.push(['data-upload', 'Upload data', '⇪']);
  if (user.role === 'Manager' || user.role === 'Org Admin') pages.push(['data-review', 'Reviews', '✓']);
  if (can(user, 'data.view')) pages.push(['data-dashboard', 'Emissions dashboard', '◉']);
  if (can(user, 'reports.org')) pages.push(['reports', 'Reports', '▧']);
  return pages;
}

/* ---------- Lookups used across screens ---------- */
const factorOf = id => EMISSION_FACTORS.find(f => f.id === id);
const ghgSource = id => db.ghg.sources.find(s => s.id === id);
const tco2e = r => r.quantity * r.ef / 1000;
const periodLabel = p => new Date(p + '-15T12:00:00').toLocaleString('en-US', { month: 'long', year: 'numeric' });

const uploadsInOrg = orgId => db.ghg.records.filter(r => r.orgId === orgId).sort((a, b) => b.at.localeCompare(a.at));
const uploadsAtFacility = facilityId => db.ghg.records.filter(r => r.facilityId === facilityId).sort((a, b) => b.at.localeCompare(a.at));
const uploadsByUser = userId => db.ghg.records.filter(r => r.by === userId).sort((a, b) => b.at.localeCompare(a.at));

/* Records this user may see in the current organisation. */
function visibleRecords(u, org) {
  return uploadsInOrg(org.id).filter(r => canAtFacility(u, 'data.view', r.facilityId));
}

function canReview(u, facilityId) {
  if (u.role === 'Org Admin') return true;
  return u.role === 'Manager' && u.facilityIds.includes(facilityId);
}

function totals(records) {
  const approved = records.filter(r => r.status === 'Approved');
  const s1 = approved.filter(r => factorOf(ghgSource(r.sourceId).factorId).scope === 1).reduce((a, r) => a + tco2e(r), 0);
  const s2 = approved.filter(r => factorOf(ghgSource(r.sourceId).factorId).scope === 2).reduce((a, r) => a + tco2e(r), 0);
  return { s1, s2, total: s1 + s2 };
}

function recordRows(records, actions) {
  return records.map(r => {
    const s = ghgSource(r.sourceId);
    return [`${esc(s.name)}<br><small>${esc(facilityName(r.facilityId))}</small>`, esc(periodLabel(r.period)),
      `${fmt(r.quantity, 0)} ${esc(r.unit)}`, fmt(tco2e(r), 3), esc(userName(r.by)) + `<br><small>${fmtDate(r.at)}</small>`,
      badge(r.status) + (r.review ? `<br><small>${esc(userName(r.review.by))}${r.review.note ? ': ' + esc(r.review.note) : ''}</small>` : ''),
      actions ? actions(r) : ''];
  });
}
const RECORD_HEADERS = ['Source / facility', 'Period', 'Quantity', 'tCO₂e', 'Uploaded by', 'Status', ''];

/* ---------- Upload (flow 4) ---------- */
function startUpload(facilityId) { uploadFacilityId = facilityId; go('data-upload'); }

VIEWS['data-upload'] = function (u, org) {
  if (!org) return noOrgYet();
  const facilities = facilitiesFor(u, org.id).filter(f => f.status !== 'Archived' && canAtFacility(u, 'data.upload', f.id));
  if (!facilities.length) return pageHead('Upload data', '', '', org.name) + '<div class="card empty">You have no assigned facility to upload to yet.</div>';
  if (!facilities.some(f => f.id === uploadFacilityId)) uploadFacilityId = facilities[0].id;
  const fid = uploadFacilityId;
  const sources = db.ghg.sources.filter(s => s.facilityId === fid);
  const records = uploadsAtFacility(fid);
  return pageHead('Upload data', u.role === 'Org Admin' ? 'As Org Admin you can upload for any facility in the organisation.' : 'Choose one of your assigned facilities, then enter activity data.',
    btn('Upload CSV', 'csvUploadModal()') + btn('Add emission source', 'sourceModal()'), org.name) +
    `<div class="card"><div class="formgrid">
      ${field('Facility', sel('uf', facilities.map(f => opt(f.id, f.name, fid)).join(''), 'onchange="uploadFacilityId=this.value;render()"'))}
      ${field('Reporting period', sel('up', PERIODS.map(p => opt(p, periodLabel(p), dataPeriod)).join(''), 'onchange="dataPeriod=this.value;render()"'))}
    </div></div>
    <div class="card section"><h2>Emission sources at ${esc(facilityName(fid))}</h2>
      ${table(['Source', 'Scope', 'Activity', `${periodLabel(dataPeriod)}`, ''], sources.map(s => {
        const f = factorOf(s.factorId);
        const r = records.find(x => x.sourceId === s.id && x.period === dataPeriod);
        return [esc(s.name), f.scope, esc(f.category + ' · ' + f.name), r ? badge(r.status) + ` <small>${fmt(r.quantity, 0)} ${esc(r.unit)}</small>` : badge('Data pending'),
          !r || r.status === 'Returned' ? btn(r ? 'Correct & resubmit' : 'Enter data', `entryModal('${s.id}')`, 'primary') : ''];
      }), 'No emission sources yet. Add one to start.')}
    </div>
    <div class="card section"><h2>Uploads at ${esc(facilityName(fid))}</h2>
      <p class="muted">Past uploads stay with the facility and keep the uploader's name, even if access changes.</p>
      ${table(RECORD_HEADERS, recordRows(records))}</div>`;
};

function entryModal(sourceId) {
  if (!requireWritable()) return;
  const s = ghgSource(sourceId), f = factorOf(s.factorId);
  const existing = db.ghg.records.find(x => x.sourceId === sourceId && x.period === dataPeriod);
  openModal('Enter activity data', `<div class="notice">${esc(s.name)} · ${esc(facilityName(s.facilityId))} · ${periodLabel(dataPeriod)} · Scope ${f.scope}</div>
    ${existing?.review?.note ? `<div class="notice warn">Returned by ${esc(userName(existing.review.by))}: ${esc(existing.review.note)}</div>` : ''}
    ${field(`Quantity (${esc(f.unit)})`, inp('eq', existing?.quantity ?? '', `type="number" min="0" step="any" oninput="$('ep').textContent=fmt((Number(this.value)||0)*${f.ef}/1000,3)"`))}
    ${field('Evidence reference', inp('ee', existing?.evidence || ''))}
    ${field('Attach file (name kept in demo)', '<input id="efile" type="file">')}
    <p class="muted">Preview: <b id="ep">${fmt((existing?.quantity || 0) * f.ef / 1000, 3)}</b> tCO₂e · ${f.ef} kgCO₂e per ${esc(f.unit)} (demo factor)</p>
    ${modalFoot('Submit for review', `saveEntry('${sourceId}')`)}`);
}

function saveEntry(sourceId) {
  const s = ghgSource(sourceId), f = factorOf(s.factorId);
  const q = Number(value('eq'));
  if (!value('eq') || !Number.isFinite(q) || q < 0) return formError('Enter a quantity of zero or more.');
  if (!canAtFacility(currentUser(), 'data.upload', s.facilityId)) return formError('You are no longer assigned to this facility.');
  const evidence = [value('ee'), $('efile').files[0]?.name].filter(Boolean).join(' · ');
  let r = db.ghg.records.find(x => x.sourceId === sourceId && x.period === dataPeriod);
  if (!r) { r = { id: 'r-' + uid(), orgId: s.orgId, facilityId: s.facilityId, sourceId, period: dataPeriod }; db.ghg.records.push(r); }
  Object.assign(r, { quantity: q, unit: f.unit, ef: f.ef, status: 'Submitted', by: session.userId, at: nowIso(), evidence, review: null });
  logAction('Data uploaded', `${facilityName(s.facilityId)} · ${s.name} · ${fmt(q, 0)} ${f.unit} · ${periodLabel(dataPeriod)}`, { facilityId: s.facilityId, isData: true });
  closeModal(); render(); toast('Uploaded. Managers of this facility can now see it.');
}

function sourceModal() {
  if (!requireWritable()) return;
  openModal('Add emission source · ' + facilityName(uploadFacilityId), `${field('Source name', inp('sn', '', 'placeholder="e.g. Main electricity"'))}
    ${field('Activity', sel('sf', EMISSION_FACTORS.map(f => opt(f.id, `Scope ${f.scope} · ${f.category} · ${f.name}`)).join('')))}
    ${modalFoot('Add source', 'saveSource()')}`);
}

function saveSource() {
  const name = value('sn');
  if (!name) return formError('Enter a source name.');
  if (db.ghg.sources.some(s => s.facilityId === uploadFacilityId && s.name.toLowerCase() === name.toLowerCase())) return formError('That source already exists here.');
  const f = findFacility(uploadFacilityId);
  db.ghg.sources.push({ id: 's-' + uid(), orgId: f.orgId, facilityId: f.id, name, factorId: value('sf') });
  logAction('Emission source added', `${f.name} · ${name}`, { facilityId: f.id, isData: true });
  closeModal(); render();
}

/* CSV upload: one row per source for the selected facility and period. */
function csvUploadModal() {
  if (!requireWritable()) return;
  openModal('Upload CSV · ' + facilityName(uploadFacilityId), `<div class="notice">Columns: source_id, quantity, evidence. Period: ${periodLabel(dataPeriod)}.</div>
    ${field('File', '<input id="cf" type="file" accept=".csv">')}
    <div class="row">${btn('Download template', 'csvTemplate()')}</div>
    ${modalFoot('Upload', 'saveCsv()')}`);
}

function csvTemplate() {
  const rows = db.ghg.sources.filter(s => s.facilityId === uploadFacilityId).map(s => [s.id, '', '']);
  download('SA-Nest-upload-template.csv', [['source_id', 'quantity', 'evidence'], ...rows].map(csvLine).join('\n'));
}

async function saveCsv() {
  const file = $('cf').files[0];
  if (!file) return formError('Choose a CSV file.');
  const lines = (await file.text()).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map(l => l.split(',').map(c => c.replace(/^"|"$/g, '').trim()));
  const head = lines.shift() || [];
  const ix = k => head.indexOf(k);
  if (ix('source_id') < 0 || ix('quantity') < 0) return formError('The file needs source_id and quantity columns.');
  let ok = 0, bad = 0;
  for (const row of lines) {
    const s = ghgSource(row[ix('source_id')]), q = Number(row[ix('quantity')]);
    const existing = s && db.ghg.records.find(x => x.sourceId === s.id && x.period === dataPeriod);
    if (!s || s.facilityId !== uploadFacilityId || row[ix('quantity')] === '' || !(q >= 0) || (existing && existing.status !== 'Returned')) { bad++; continue; }
    const f = factorOf(s.factorId);
    const r = existing || { id: 'r-' + uid(), orgId: s.orgId, facilityId: s.facilityId, sourceId: s.id, period: dataPeriod };
    if (!existing) db.ghg.records.push(r);
    Object.assign(r, { quantity: q, unit: f.unit, ef: f.ef, status: 'Submitted', by: session.userId, at: nowIso(), evidence: row[ix('evidence')] || file.name, review: null });
    ok++;
  }
  logAction('Data uploaded', `${facilityName(uploadFacilityId)} · ${file.name} · ${ok} rows accepted, ${bad} rejected`, { facilityId: uploadFacilityId, isData: true });
  closeModal(); render(); toast(`${ok} rows uploaded, ${bad} rejected`);
}

/* ---------- Review ---------- */
VIEWS['data-review'] = function (u, org) {
  if (!org) return noOrgYet();
  const mine = visibleRecords(u, org).filter(r => canReview(u, r.facilityId));
  const waiting = mine.filter(r => r.status === 'Submitted');
  return pageHead('Reviews', 'Any Manager assigned to the facility can approve or return an upload. The first decision counts and the ledger shows who made it.', '', org.name) +
    `<div class="card"><h2>Waiting for review (${waiting.length})</h2>${table(RECORD_HEADERS, recordRows(waiting, r =>
      btn('Approve', `reviewRecord('${r.id}', true)`, 'primary') + btn('Return', `reviewRecord('${r.id}', false)`)), 'Nothing waiting. Uploads appear here as soon as an Engineer submits them.')}</div>
    <div class="card section"><h2>All uploads at your facilities</h2>${table(RECORD_HEADERS, recordRows(mine))}</div>`;
};

function reviewRecord(id, approve) {
  if (!requireWritable()) return;
  const r = db.ghg.records.find(x => x.id === id);
  if (r.status !== 'Submitted') return toast('Someone has already reviewed this upload.');
  const note = approve ? '' : prompt('Why are you returning it? The Engineer will see this.');
  if (!approve && !note?.trim()) return;
  r.status = approve ? 'Approved' : 'Returned';
  r.review = { by: session.userId, at: nowIso(), note: note || '' };
  logAction(approve ? 'Upload approved' : 'Upload returned', `${facilityName(r.facilityId)} · ${ghgSource(r.sourceId).name} · ${periodLabel(r.period)}${note ? ' · ' + note : ''}`, { facilityId: r.facilityId, isData: true });
  render(); toast(approve ? 'Approved' : 'Returned to the Engineer');
}

/* ---------- Dashboard ---------- */
VIEWS['data-dashboard'] = function (u, org) {
  if (!org) return noOrgYet();
  const records = visibleRecords(u, org).filter(r => r.period === dataPeriod);
  const t = totals(records);
  const facilities = facilitiesFor(u, org.id).filter(f => f.status !== 'Archived');
  const scopeText = ['Org Admin', 'CXO'].includes(u.role) ? 'Organisation-wide' : 'Your assigned facilities';
  return pageHead('Emissions dashboard', `${scopeText} · approved uploads only. Demo factors, not for disclosure.`,
    sel('dp', PERIODS.map(p => opt(p, periodLabel(p), dataPeriod)).join(''), 'onchange="dataPeriod=this.value;render()" aria-label="Period"'), org.name) +
    `<div class="grid">${statCard('Approved total', fmt(t.total), 'tCO₂e')}${statCard('Scope 1', fmt(t.s1), 'tCO₂e', 'Direct')}${statCard('Scope 2', fmt(t.s2), 'tCO₂e', 'Location-based')}${statCard('Waiting for review', records.filter(r => r.status === 'Submitted').length, 'uploads')}</div>
    <div class="card section"><h2>By facility</h2>${table(['Facility', 'Scope 1', 'Scope 2', 'Total tCO₂e', 'Uploads', 'Waiting'], facilities.map(f => {
      const rs = records.filter(r => r.facilityId === f.id), ft = totals(rs);
      return [esc(f.name), fmt(ft.s1), fmt(ft.s2), `<b>${fmt(ft.total)}</b>`, rs.length, rs.filter(r => r.status === 'Submitted').length];
    }))}</div>
    <div class="card section"><h2>Uploads · ${periodLabel(dataPeriod)}</h2>${table(RECORD_HEADERS, recordRows(records))}</div>`;
};

/* Small card on each role's overview. */
function dataSummaryCard(u, org) {
  if (!can(u, 'data.view')) return '';
  const recent = visibleRecords(u, org).slice(0, 5);
  return `<div class="card section"><div class="row between"><h2>Latest uploads ${['Org Admin', 'CXO'].includes(u.role) ? 'in the organisation' : 'at your facilities'}</h2>${btn('Open dashboard', "go('data-dashboard')", 'link')}</div>
    ${table(RECORD_HEADERS, recordRows(recent), 'No uploads yet.')}</div>`;
}

/* ---------- Reports (Org Admin and CXO) ---------- */
VIEWS.reports = function (u, org) {
  if (!org) return noOrgYet();
  const facilities = activeFacilities(org.id);
  return pageHead('Reports', 'Organisation-wide reports cover all facilities in the selected organisation. Facility-wide reports cover one facility.', '', org.name) +
    `<div class="two"><div class="card"><h2>Organisation-wide</h2><p class="muted">${esc(org.name)} · all ${facilities.length} facilities</p>
      ${field('Period', sel('rp', PERIODS.map(p => opt(p, periodLabel(p), dataPeriod)).join('')))}
      ${btn('Download CSV', "downloadReport('')", 'primary')}</div>
    <div class="card"><h2>Facility-wide</h2>
      ${field('Facility', sel('rf', facilities.map(f => opt(f.id, f.name)).join('')))}
      ${btn('Download CSV', "downloadReport(value('rf'))", 'primary')}</div></div>`;
};

function downloadReport(facilityId) {
  const org = currentOrg(), period = value('rp') || dataPeriod;
  const rows = uploadsInOrg(org.id).filter(r => r.period === period && r.status === 'Approved' && (!facilityId || r.facilityId === facilityId));
  const lines = [['organisation', 'facility', 'period', 'scope', 'source', 'quantity', 'unit', 'tCO2e', 'uploaded_by', 'approved_by'],
    ...rows.map(r => { const s = ghgSource(r.sourceId); return [org.name, facilityName(r.facilityId), r.period, factorOf(s.factorId).scope, s.name, r.quantity, r.unit, tco2e(r).toFixed(3), userName(r.by), userName(r.review?.by)]; })];
  download(`SA-Nest-${facilityId ? 'facility' : 'organisation'}-report-${period}.csv`, lines.map(csvLine).join('\n'));
  logAction('Report downloaded', `${facilityId ? facilityName(facilityId) : 'Organisation-wide'} · ${periodLabel(period)}`);
}
