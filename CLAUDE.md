# SA-Nest prototype

A clickable prototype of SA-Nest, a GHG (carbon) accounting tool, at the **V1 user hierarchy** stage.
It runs in the browser on mock data only: no server, no real sign-in, no real email.

Read `HANDOFF.md` first. It covers what exists, the role rules, the decisions already made and what is left open.
The source requirements are in `original/SA-NEST_User_Hierarchy_and_Workflows.pdf`.

## Owner

Abdul Kabir (UI/UX designer, GitHub `kabeer-design-lab`) owns this project from here, including all core features,
UI libraries, the design system, templates and core scoping. Anything here may be replaced; nothing is sacred except
the business rules in "Rules to keep" below, unless the product owner (abdul) changes them.

## Run

Open `index.html` in a browser. No install, no build, no package manager.
Demo password for every account: `demo1234`. **Reset demo data** on the sign-in page restores the mock data
(data is saved in `localStorage` under `sanest-hierarchy-v2`; bump that key in `js/core/store.js` when the data shape changes).

## Code map

- `index.html` loads plain `<script>` files in a fixed order (helpers → mock data → rules → shell → screens). No modules,
  so it works from `file://`. Everything is global; inline `onclick` handlers call global functions.
- `js/data/` mock data only. `js/core/` the rules from the document. `js/views/` screens, one file per area.
- A screen is a function `VIEWS['key'] = (user, org) => htmlString`. The sidebar per role is `NAVIGATION` in `js/app.js`
  (the "Data" group comes from `dataPagesFor()` in `js/views/ghg.js`). `render()` redraws the whole page after any change.
- Every permission check goes through `can()` / `canAtFacility()` / `permission()` in `js/core/permissions.js`, which
  reads the `PERMISSIONS` table. Change a rule there, not in a screen.
- Every change is recorded with `logAction()` (`js/core/ledger.js`); data changes pass `isData: true` so the Platform Admin
  never sees their detail.
- Always escape data put into HTML with `esc()`.

## Rules to keep (from the document and confirmed decisions)

- Five roles, one role per person: Platform Admin, Org Admin, CXO, Manager, Engineer.
- Only the Org Admin creates users and facilities and assigns Managers and Engineers. Each Engineer reports to exactly one Manager.
- The Platform Admin never sees organisation data. No role sees ledger activity of roles above it.
- No upload review in V1: data counts as soon as it is saved; every version is kept.
- Plan limits block adding, never delete. Pending invites count toward limits; expired invites, deactivated users and archived facilities don't.
- Each organisation keeps at least one active Org Admin.

## Checking changes

There is no test suite. Open every role's pages from the demo accounts and watch the browser console for errors.
A headless check with Playwright (visit every page in `navFor(currentUser())` for every active user) was used during the build.
