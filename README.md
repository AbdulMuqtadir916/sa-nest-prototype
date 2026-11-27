# SA-Nest · V1 user hierarchy prototype

> Taking over this project? Start with [HANDOFF.md](HANDOFF.md). AI assistants: see [CLAUDE.md](CLAUDE.md).

A clickable prototype of the SA-Nest user hierarchy, built from the
**SA-NEST User Hierarchy & Workflows** document (V1). Everything runs in the browser on mock data.
There is no server and no real security.

## Run it

Open `index.html` in a browser. No install or build step.
Every demo account uses the password `demo1234`, and the sign-in page has one-click demo accounts.
Changes are saved in your browser; **Reset demo data** on the sign-in page (or Organisation settings) restores the mock data.

## The demo story

The sign-in page lists the 10-step V1 setup flow. In short:

1. **Sara (Platform Admin)** sets plan terms and invites the first Org Admin.
2. The invitation appears in the **Mock inbox** on the sign-in page. Open it and set a password.
3. The new **Org Admin** creates the organisation. It shows *Awaiting plan*.
4. **Sara** applies the plan. The organisation becomes active.
5. The **Org Admin** completes the profile, adds facilities, invites the CXO and Managers, links Managers to facilities,
   invites Engineers with one reporting Manager each.
6. An **Engineer** accepts, picks an assigned facility and uploads data.
7. **Managers** of that facility see the upload straight away (there is no review step in V1). The **CXO** sees everything read-only.

Ready-made data also covers the document's example (Manager A on Facilities 1 and 2, Manager B sharing Facility 2),
an Org Admin with two organisations, a pending and an expired invitation, a deactivated user, an unassigned Engineer,
an organisation at its facility limit with an open upgrade request, an organisation whose plan has ended (read-only), uploads by a
now-deactivated Engineer (still showing their name), a revised record with version history, and an organisation-level source.

## GHG screens

The original prototype's carbon accounting screens are all here, scoped by role: Equipment & meters, Emission sources
(with "not applicable" decisions), Data collection (manual entry and CSV/XLSX upload), GHG inventory, History, Reports
(save snapshots, close and reopen a period) and the Factor library. Every page has a facility and period filter.

| Role | GHG access |
| --- | --- |
| Org Admin | Everything in the organisation, including organisation-level sources; enters data anywhere; closes periods |
| CXO | Everything in the organisation, read-only, plus organisation reports |
| Manager | Assigned facilities, read-only |
| Engineer | Assigned facilities; enters and uploads data there |
| Platform Admin | None (never sees organisation data) |

## Roles

| Role | Demo account | Sees |
| --- | --- | --- |
| Platform Admin | sara@sa-nest.demo | Every organisation's plan, usage and status, never its data |
| Org Admin | omar@qhg.demo (two organisations) | Everything in the organisations they administer |
| CXO | layla@qhg.demo | Everything in their organisation, read-only |
| Manager | ahmed@qhg.demo, fatima@qhg.demo | Assigned facilities and their Engineers |
| Engineer | yusuf@qhg.demo, priya@qhg.demo | Assigned facilities; uploads data |

## Where things live

```
index.html              page shell; loads the scripts below in order
css/styles.css          original prototype styles (colours, cards, tables)
css/hierarchy.css       small additions for the hierarchy screens
js/core/utils.js        HTML helpers, modal, toast, dates
js/data/                MOCK DATA ONLY: edit these to change the demo
  plans.js              plan tiers and limit labels
  organisations.js      organisations, facilities, upgrade requests
  users.js              people, roles, assignments, invitations
  ledger.js             starting ledger entries
  ghg.js                emission factors, equipment, sources and activity records
js/core/                RULES FROM THE DOCUMENT
  permissions.js        the permission matrix as a table: change a rule here and every screen follows
  people.js             user status, invitation expiry, who can see whom
  plans.js              organisation state, limits and usage
  ledger.js             logging and ledger visibility per role
  ghg.js                who sees and edits which GHG data, emission calculations
  spreadsheet.js        CSV and XLSX reading for uploads
  store.js              load/save to the browser, reset
  auth.js               mock sign-in, sign-out, accepting invitations
js/app.js               sidebar per role and the render loop
js/views/               one file per area of the app
  login.js              sign-in, demo accounts, mock inbox
  platform-admin.js     SA-NEST console: organisations, plans, first Org Admin invitations, upgrade requests
  organisation.js       my organisations, settings, plan & usage, upgrade requests
  overview.js           home screen for each role, Manager stats
  facilities.js         facilities and Manager assignment
  people.js             the organisation user panel: add user, assignments, roles, deactivation
  ghg.js                equipment, sources, data collection, inventory, history, reports, factor library
  records.js            ledger, roles & permissions reference
original/               the prototype and document this was built from
```

To add a screen: write a function in `js/views/`, register it with `VIEWS['key'] = ...`, and list the key under the
right roles in `NAVIGATION` in `js/app.js`.

## Decisions on the document's open questions

Confirmed with abdul on 27 Nov 2026.

| Question | What the prototype does |
| --- | --- |
| Who reviews Engineer uploads when several Managers oversee a facility? | Nobody: V1 has no review step. Data counts as soon as it is saved and shows at once for the facility's Managers and the CXO. Revisions keep every version. |
| How long is an invitation valid? | 7 days (`INVITE_VALID_DAYS` in `js/core/people.js`). "Simulate expiry" shows the Expired state. |
| What can an Org Admin do before the plan is applied? | View and edit the organisation profile only. The same applies when the Platform Admin stops an organisation's plan ("Stop plan"). Facilities, invitations and data unlock once the plan is applied or restarted. After a plan's end date the organisation is fully read-only. |
| Who adds facilities? | The Org Admin, as the document says. The Platform Admin sets plans and invites the first Org Admin. |
| Who can see a Manager's "own" people list? | Their direct reports plus Engineers and Managers at their assigned facilities. |

## Out of scope (for the design hand-off)

- **V2 branding** (logo, colours, display name, email sender) is not built. Its open question, who can edit and publish
  branding, is still open.
- UI libraries, the design system, templates and core scoping features are intentionally untouched: the styling is the
  original prototype's, kept simple so it can be replaced.
- GHG calculations use invented demo factors and are not for disclosure. Scope 3 is not covered.
- Sign-in, invitations and the ledger are simulations. Nothing is secure, emailed or tamper-proof.
