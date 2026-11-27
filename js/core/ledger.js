/*
 * Ledger: an append-only record of everything that happens (sign-ins, uploads, invitations,
 * assignments, role changes), with who did it and when. Nobody can edit an entry.
 *
 * Each role sees only its own scope, never the activity of roles above it:
 *   Platform Admin  every organisation's activity and SA-NEST staff actions, never the data itself
 *   Org Admin       everyone in the organisations they administer
 *   CXO             everyone in the organisation except Org Admins
 *   Manager         their own actions and Engineer activity in their assigned facilities
 *   Engineer        their own actions only
 */
function logAction(action, detail = '', { orgId = session?.orgId || null, facilityId = null, isData = false, actorId = session?.userId } = {}) {
  db.ledger.unshift({ id: uid(), at: nowIso(), actorId, orgId, facilityId, action, detail, isData });
  saveStore();
}

function ledgerVisibleTo(user, orgId) {
  const actorRole = e => findUser(e.actorId)?.role;
  switch (user.role) {
    case 'Platform Admin':
      return db.ledger;
    case 'Org Admin':
      return db.ledger.filter(e => e.orgId === orgId && actorRole(e) !== 'Platform Admin');
    case 'CXO':
      return db.ledger.filter(e => e.orgId === orgId && !['Platform Admin', 'Org Admin'].includes(actorRole(e)));
    case 'Manager':
      return db.ledger.filter(e => e.actorId === user.id ||
        (e.orgId === orgId && actorRole(e) === 'Engineer' && user.facilityIds.includes(e.facilityId)));
    case 'Engineer':
      return db.ledger.filter(e => e.actorId === user.id);
    default:
      return [];
  }
}

function ledgerTable(user, entries) {
  const hideData = user.role === 'Platform Admin';
  return table(['When', 'Who', 'Role', 'Organisation', 'Action', 'Detail'], entries.slice(0, 300).map(e => {
    const actor = findUser(e.actorId);
    return [
      esc(fmtDateTime(e.at)),
      esc(actor?.name || 'Unknown'),
      esc(actor?.role || ''),
      esc(findOrg(e.orgId)?.name || 'SA-NEST'),
      esc(e.action),
      e.isData && hideData ? '<span class="muted">Data hidden from SA-NEST staff</span>' : esc(e.detail)
    ];
  }), 'No ledger entries in your scope yet.');
}
