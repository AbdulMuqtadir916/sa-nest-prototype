# SA-Nest hand-off: V1 user hierarchy prototype

For Abdul Kabir (`kabeer-design-lab`), who owns the project from here. Written 27 Nov 2026.

## 1. Where the project is

- **Done:** a browser-only prototype of the V1 user hierarchy from `original/SA-NEST_User_Hierarchy_and_Workflows.pdf`,
  wrapped around the original prototype's Scope 1 and 2 carbon accounting screens (`original/SA-Nest_Interactive_Prototype.html`).
- **Not done:** any backend, real sign-in, real email, V2 branding, the final design. Everything runs on mock data in the browser.
- **Styling** is the original prototype's (`css/styles.css`) plus small additions (`css/hierarchy.css`). No UI library or design
  system was introduced on purpose: that is yours to choose.

Run it: open `index.html`. Every demo account uses `demo1234`. **Reset demo data** on the sign-in page restores everything.

## 2. The five roles

| Role | Created by | Sees | Main job | Demo account |
| --- | --- | --- | --- | --- |
| Platform Admin (SA-NEST staff) | SA-NEST | Every organisation's plan, usage and status, never its data | Invites the first Org Admin, sets plans | sara@sa-nest.demo |
| Org Admin | Platform Admin (first one), Org Admin (any more) | All organisations they administer | Creates every user and facility, assigns Managers and Engineers, can do anything other roles can | omar@qhg.demo (2 orgs) |
| CXO | Org Admin | Everything in their organisation, read-only | Oversees facilities, Managers and Engineers, including Manager stats | layla@qhg.demo |
| Manager | Org Admin | Assigned facilities | Views assigned facilities, follows Engineer progress | ahmed@qhg.demo, fatima@qhg.demo |
| Engineer | Org Admin | Assigned facilities | Uploads data to assigned facilities; reports to exactly one Manager | yusuf@qhg.demo, priya@qhg.demo |

One role per person. Managers can oversee several facilities and a facility can have several Managers.
Engineers can upload to several facilities. The mock data reproduces the document's example: Manager A on Facilities 1 and 2,
Manager B sharing Facility 2, Engineer A (→ Manager A) on both, Engineer B (→ Manager B) on Facility 2.

### Permission matrix (`js/core/permissions.js`)

✓ = across the organisation · Own = assigned facilities only · — = unavailable

| Action | Platform Admin | Org Admin | CXO | Manager | Engineer |
| --- | --- | --- | --- | --- | --- |
| Create an organisation | — | ✓ | — | — | — |
| Set/change a plan, stop or restart it | ✓ | — | — | — | — |
| View plan and usage | ✓ | ✓ | ✓ | — | — |
| Edit organisation settings | — | ✓ | — | — | — |
| Add, edit, archive facilities | — | ✓ | — | — | — |
| Invite the first Org Admin | ✓ | — | — | — | — |
| Invite Org Admins, CXOs, Managers, Engineers | — | ✓ | — | — | — |
| Assign Managers / Engineers to facilities | — | ✓ | — | — | — |
| Change a role, deactivate or reactivate | — | ✓ | — | — | — |
| View the people list | — | ✓ | ✓ | Own | — |
| Upload or enter activity data | — | ✓ | — | — | Own |
| View data and dashboards | — | ✓ | ✓ | Own | Own |
| View every Manager's stats | — | ✓ | ✓ | — | — |
| View and download organisation reports | — | ✓ | ✓ | — | — |

A Manager's "own" people list is their direct reports plus Engineers and Managers at their facilities.
Organisation-level GHG sources (no facility) are visible and editable only to roles with ✓.

### Ledger (`js/core/ledger.js`)

Everything is logged (sign-ins, invitations, assignments, role changes, uploads, plan changes) with who and when; entries are never edited.

| Role | Sees |
| --- | --- |
| Platform Admin | All activity and staff actions; data details hidden |
| Org Admin | Everyone in the organisation (not Platform Admin actions) |
| CXO | Everyone in the organisation except Org Admins |
| Manager | Own actions plus Engineer activity at their facilities |
| Engineer | Own actions only |

## 3. Plans, organisations and invitations

- **Plan** (`js/core/plans.js`): a tier (Starter, Growth, Enterprise in `js/data/plans.js`) with limits for facilities, Org Admins,
  CXOs, Managers and Engineers *per facility*, plus start and end dates. The Platform Admin can override any value per organisation.
- **At a limit** adding stops, the limit is shown, and the Org Admin can send an upgrade request to the Platform Admin.
  Lowering a limit deletes nothing. Pending invitations count; expired invitations, deactivated users and archived facilities don't.
  An Engineer counts at every facility they are assigned to.
- **Organisation states:** `Awaiting plan` (just created) → `Active` (plan applied) → `Suspended` (Platform Admin pressed
  "Stop plan") or `Expired` (past end date, worked out from the date, never stored).
  - Awaiting plan and Suspended: view and export everything, edit the organisation profile, nothing else.
  - Expired: fully read-only.
- **User status** (`js/core/people.js`): Invited (uses a seat, cannot sign in) → Active, or Expired after 7 days
  (`INVITE_VALID_DAYS`, no seat, inviter can resend), or Deactivated (no seat, can be reactivated).
  Deactivation signs the user out at once and keeps their uploads and history under their name. Deactivating a Manager
  requires a replacement Manager for their direct reports. The last active Org Admin cannot be deactivated.
  Engineers with no facility appear in an "Unassigned" notice for the Org Admin.

## 4. Workflows and where they live

| # | Flow (from the document) | Screens |
| --- | --- | --- |
| 1 | Onboard: Platform Admin sets plan terms and invites the first Org Admin; they accept and set a password; create the organisation; Platform Admin applies the plan | `platform-admin.js`, `login.js` (Mock inbox), `organisation.js` |
| 2 | Set up: profile, facilities up to the limit, invite CXO and Managers, assign Managers to facilities | `organisation.js`, `facilities.js`, `people.js`; Org Admin overview shows a setup checklist |
| 3 | Staff a facility: invite Engineers, pick one reporting Manager, assign facilities | `people.js` |
| 4 | Upload: Engineer picks an assigned facility and enters data or uploads CSV/XLSX | `ghg.js` (Data collection) |
| 5 | Change an assignment: add/remove Managers on a facility, change an Engineer's facilities or Manager (immediate) | `facilities.js`, `people.js` |
| 6 | Remove someone: deactivate, reassign direct reports | `people.js` |
| 7 | Reach a plan limit: blocked with the limit shown, upgrade request, Platform Admin raises it | `organisation.js`, `platform-admin.js` |

Invitations land in the **Mock inbox** on the sign-in page instead of email. "Simulate expiry" shows the Expired state.

## 5. Decisions already made (confirmed by abdul, 27 Nov 2026)

1. Keep the original GHG screens, on mock data, scoped by role: Equipment & meters, Emission sources (with "not applicable"),
   Data collection (manual and CSV/XLSX), GHG inventory, History, Reports (snapshots, close/reopen a period), Factor library.
2. Follow the document: the Org Admin, not the Platform Admin, adds facilities.
3. **No upload review in V1.** Data counts as soon as it is saved; revisions add versions. (Open question in the document.)
4. Invitations are valid for 7 days. (Open question in the document.)
5. A new organisation can only edit its profile until a plan is applied; the same applies when the Platform Admin stops the plan.
6. V2 branding is out of scope.
7. Demo sign-in with one-click accounts plus a Mock inbox for invitations.
8. Plain HTML, CSS and vanilla JS in small files, no framework, no build step; data saved in the browser with a reset.

## 6. Mock data and files

```
index.html             loads the scripts below in order
css/styles.css         original prototype styles (tokens in :root)
css/hierarchy.css      additions for the hierarchy screens
js/data/               MOCK DATA: plans, organisations + facilities, users, ledger seed, GHG factors/sources/records
js/core/               RULES: permissions, people, plans, ledger, ghg, auth (mock), store (localStorage), spreadsheet, utils
js/app.js              sidebar per role (NAVIGATION) and render()
js/views/              screens: login, platform-admin, organisation, overview, facilities, people, ghg, records
original/              the source prototype and the hierarchy document
```

Mock dates are relative to today (`mockDate()`), so the demo doesn't go stale. Edge cases in the mock data: a pending and
an expired invitation, a deactivated Engineer with past uploads, an unassigned Engineer, an organisation at its facility limit
with an open upgrade request, an organisation whose plan has ended, a first Org Admin invited before their organisation exists.

## 7. Known limits

- Not secure: passwords are plain text in mock data, sign-in is checked in the browser, the ledger can be edited in dev tools.
- No server, email or multi-user state: each browser keeps its own copy of the data.
- Emission factors are invented demo values; Scope 3 is not covered.
- Manager stats use simple counts (facilities, direct reports, uploads); the document says the real measures come with the core features.
- No automated tests; checks were done by driving every page in a headless browser.
- Small accessibility gaps remain in the original styles (e.g. table header contrast).

## 8. Yours to decide or build

- UI library, design system, templates, page layouts and visual design.
- Core scoping features and the full GHG feature set.
- V2 branding (logo, colours, display name, email sender per organisation). Open question: who can edit and publish branding?
- A real backend, authentication, email delivery and a tamper-proof ledger.
- Any change to the rules in sections 2 to 5 should be agreed with abdul first.
