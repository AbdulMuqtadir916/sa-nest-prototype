/*
 * Facilities. A facility is one location where activity data is recorded.
 * Org Admin: add, edit, archive (within the facility limit). CXO: read-only, every facility.
 * Manager and Engineer: their assigned facilities only.
 */
VIEWS.facilities = function (u, org) {
  if (!org) return noOrgYet();
  const manage = can(u, 'facility.manage');
  const list = facilitiesFor(u, org.id);
  const lim = limitsOf(org);
  const title = ['Manager', 'Engineer'].includes(u.role) ? 'My facilities' : 'Facilities';
  const desc = manage
    ? `Active facilities: ${usage(org.id).facilities} of ${lim.facilities ?? '—'}. Archived facilities do not count.`
    : u.role === 'CXO' ? 'Every facility in the organisation. Read-only.' : 'The facilities the Org Admin has assigned to you.';
  return pageHead(title, desc, manage ? btn('Add facility', 'facilityModal()', 'primary') : '', org.name) +
    `<div class="grid">${list.map(f => facilityCard(u, org, f)).join('') || `<div class="card empty">${manage ? 'Add your first facility.' : 'No facilities assigned to you yet.'}</div>`}</div>`;
};

function facilityCard(u, org, f) {
  const managers = db.users.filter(x => x.role === 'Manager' && x.facilityIds.includes(f.id) && usesSeat(x));
  const engineers = engineersAtFacility(f.id);
  const archived = f.status === 'Archived';
  const manage = can(u, 'facility.manage');
  return `<div class="card facility-card">
    <div class="row between"><div class="iconbox">▣</div>${badge(archived ? 'Archived' : 'Active')}</div>
    <h2>${esc(f.name)}</h2><small>${esc(f.type)} · ${esc(f.city)}${f.address ? ' · ' + esc(f.address) : ''}</small>
    <div><small>Managers</small><p>${managers.map(m => esc(m.name)).join(', ') || '<span class="muted">None assigned</span>'}</p></div>
    <div><small>Engineers ${org.plan ? `(${engineers.length} of ${limitsOf(org).engineersPerFacility})` : ''}</small><p>${engineers.map(e => esc(e.name)).join(', ') || '<span class="muted">None assigned</span>'}</p></div>
    <small>${typeof uploadsAtFacility === 'function' ? uploadsAtFacility(f.id).length + ' uploads recorded' : ''}</small>
    <div class="row">
      ${!archived && canAtFacility(u, 'data.upload', f.id) && typeof startUpload === 'function' ? btn('Upload data', `startUpload('${f.id}')`, 'primary') : ''}
      ${manage && !archived ? btn('Edit', `facilityModal('${f.id}')`) + btn('Managers', `facilityManagersModal('${f.id}')`) + btn('Archive', `archiveFacility('${f.id}')`, 'danger') : ''}
      ${manage && archived ? btn('Restore', `restoreFacility('${f.id}')`) : ''}
    </div></div>`;
}

function facilityModal(id = '') {
  const org = currentOrg();
  if (!requireWritable(org)) return;
  if (!id) { const block = facilityLimitBlock(org); if (block) return limitBlockedModal(block, 'facilities'); }
  const f = findFacility(id) || {};
  openModal(id ? 'Edit facility' : 'Add facility', `<div class="formgrid">
    ${field('Facility name', inp('fn', f.name))}
    ${field('Facility type', sel('ft', FACILITY_TYPES.map(t => opt(t, t, f.type)).join('')))}
    ${field('City', inp('fc', f.city))}
    ${field('Address', inp('fa', f.address))}
    </div>${modalFoot(id ? 'Save facility' : 'Add facility', `saveFacility('${id}')`)}`);
}

function saveFacility(id) {
  const org = currentOrg();
  const name = value('fn'), city = value('fc');
  if (!name || !city) return formError('Enter the facility name and city.');
  if (db.facilities.some(f => f.orgId === org.id && f.id !== id && f.name.toLowerCase() === name.toLowerCase())) return formError('A facility with that name already exists.');
  const fields = { name, type: value('ft'), city, address: value('fa') };
  if (id) {
    Object.assign(findFacility(id), fields);
    logAction('Facility edited', name, { facilityId: id });
  } else {
    const block = facilityLimitBlock(org);
    if (block) return formError(block);
    const nid = 'f-' + uid();
    db.facilities.push({ id: nid, orgId: org.id, status: 'Active', ...fields });
    logAction('Facility added', name, { facilityId: nid });
  }
  closeModal();
  render();
  toast(id ? 'Facility saved' : 'Facility added');
}

function archiveFacility(id) {
  if (!requireWritable()) return;
  const f = findFacility(id);
  if (!confirm(`Archive ${f.name}? Its data and history stay. It stops counting toward the facility limit.`)) return;
  f.status = 'Archived';
  logAction('Facility archived', f.name, { facilityId: id });
  render();
}

function restoreFacility(id) {
  const org = currentOrg();
  if (!requireWritable(org)) return;
  const block = facilityLimitBlock(org);
  if (block) return limitBlockedModal(block, 'facilities');
  const f = findFacility(id);
  f.status = 'Active';
  logAction('Facility restored', f.name, { facilityId: id });
  render();
}

/* Flow 2 step 4 / flow 5: add or remove Managers at one facility. Other Managers keep their assignments. */
function facilityManagersModal(id) {
  if (!requireWritable()) return;
  const f = findFacility(id);
  const managers = db.users.filter(x => x.role === 'Manager' && x.orgIds.includes(f.orgId) && usesSeat(x));
  openModal('Managers · ' + f.name, `<p class="muted">A facility can have several Managers. Removing one leaves the others in place.</p>
    <div class="section">${checkboxes('fm', managers.map(m => ({ id: m.id, label: m.name + (userStatus(m) === 'Invited' ? ' (invited)' : '') })), managers.filter(m => m.facilityIds.includes(id)).map(m => m.id))}</div>
    ${managers.length ? '' : '<p class="muted">Invite a Manager from the People page first.</p>'}
    ${modalFoot('Save Managers', `saveFacilityManagers('${id}')`)}`);
}

function saveFacilityManagers(id) {
  const f = findFacility(id);
  const chosen = checkedValues('fm');
  db.users.filter(x => x.role === 'Manager' && x.orgIds.includes(f.orgId)).forEach(m => {
    const had = m.facilityIds.includes(id), has = chosen.includes(m.id);
    if (has && !had) { m.facilityIds.push(id); logAction('Manager assigned', `${m.name} → ${f.name}`, { facilityId: id }); }
    if (!has && had) { m.facilityIds = m.facilityIds.filter(x => x !== id); logAction('Manager unassigned', `${m.name} ✕ ${f.name}`, { facilityId: id }); }
  });
  saveStore();
  closeModal();
  render();
  toast('Managers updated');
}
