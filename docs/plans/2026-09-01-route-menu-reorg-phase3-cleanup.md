# Route + Menu Reorg — Phase 3: Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. One PR off `main` (menu-editor follow-up may be split into its own PR — see Task 4). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Remove the now-dead legacy routes and reconcile the admin menu-editor
with FE-owned structure. All three legacy deletes confirmed (master §2 decision #3).

**Architecture:** Delete the `/atencion` + `/frontdesk` redirect stubs (the menu
points straight at `/boards/*` since Phase 1) and the orphan `/settings/tableros`
personal-board page; drop their FE catch-all manifest rows; note the matching
BE-seed tidy (separate repo). Then relabel/hide the menu-editor's now-inert
`path`/reorder controls for manifest-known items.

**Tech Stack:** Next.js App Router, TypeScript.

**Prereq:** Phases 0–2 merged. Routes are English; menu groups are FE-owned.
**Master plan:** `docs/plans/2026-09-01-route-menu-reorg-00-master.md`.

## Global Constraints

- Dev :8080. Build gate + `npm run typecheck` + `npm test` after each task.
- NEVER touch `lib/api/*`; never change `clave`/`permisoClave`.
- Commit trailer `Co-Authored-By: Claude …`; branch off `main`; never merge to `main`.
- BE lives in `../cmr-be` — any BE seed edit is a SEPARATE cmr-be PR, not part of this FE PR (noted, not executed here unless asked).

---

### Task 1: Delete the `/atencion` and `/frontdesk` redirect stubs

**Files:**
- Delete: `app/(app)/atencion/page.tsx` (+ empty `atencion/` dir)
- Delete: `app/(app)/frontdesk/page.tsx` (+ empty `frontdesk/` dir)

Since Phase 1, the menu links go straight to `/boards/atencion` / `/boards/frontdesk`
(manifest routes), so these stub pages (which only `redirect`/`permanentRedirect`
to `/boards/*`) are dead. Hard cutover: old `/atencion` and `/frontdesk` URLs 404.

- [ ] **Step 1: Confirm nothing links to the stub URLs**

Run:
```bash
grep -rnE "(href|push|replace|redirect|permanentRedirect)\(\s*[\"'\`]/(atencion|frontdesk)[\"'\`]" app components --include="*.tsx" --include="*.ts" | grep -v "/lib/api/"
```
Expected: zero hits (all board links point at `/boards/*` after Phase 1). If any survive, fix them to `/boards/*` first.

- [ ] **Step 2: Delete the folders**

```bash
git rm -r "app/(app)/atencion" "app/(app)/frontdesk"
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck` → clean.
Run: build gate → page count drops by 2 (the two stub pages gone).

- [ ] **Step 4: Manual smoke on :8080**

Confirm `/boards/atencion` and `/boards/frontdesk` still open from the menu; visiting old `/atencion` / `/frontdesk` now 404s (expected — hard cutover).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(routes): delete /atencion + /frontdesk redirect stubs (Phase 3)

Menu points straight at /boards/* since Phase 1; hard cutover, old URLs 404.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Delete the orphan `/settings/tableros` personal-board page

**Files:**
- Delete: `app/(app)/settings/tableros/page.tsx` (+ `settings/tableros/` dir; and `settings/` if now empty)
- Possibly delete: `components/tablero/personalizar-panel.tsx` (only if unused after this)
- Modify: `lib/nav-manifest.ts` (remove the `/settings/tableros` catch-all row, line ~74)

The `mis-tableros` / personal board-personalization feature is confirmed unwanted
(master §2 decision #3). By Phase 1 Task 6, all other `/settings/*` moved under
`/configuration`; `/settings/tableros` was left as the orphan to delete here.

- [ ] **Step 1: Check whether `PersonalizarTablero` is used anywhere else**

Run:
```bash
grep -rn "PersonalizarTablero" app components --include="*.tsx" --include="*.ts"
```
Expected: hits only in `app/(app)/settings/tableros/page.tsx` (the page being deleted) and `components/tablero/personalizar-panel.tsx` (its definition). If those are the ONLY two, the component is safe to delete along with the page. If it's referenced elsewhere, KEEP `personalizar-panel.tsx` and delete only the page.

- [ ] **Step 2: Delete the page (and component if unused)**

```bash
git rm -r "app/(app)/settings/tableros"
# only if Step 1 showed no other users:
git rm "components/tablero/personalizar-panel.tsx"
# remove settings/ if it is now empty:
rmdir "app/(app)/settings" 2>/dev/null || true
```

- [ ] **Step 3: Remove the FE catch-all manifest row**

In `lib/nav-manifest.ts`, delete the row `{ path: "/settings/tableros", labelKey: "nav.tablerosSettings" }` (the orphan). Leave the other `/settings/*` rows — they were already flipped to `/configuration/*` in Phase 1 Task 6.

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck` → clean (confirms no dangling import of the deleted component).
Run: build gate → page count drops by 1 more.

- [ ] **Step 5: Manual smoke on :8080**

Confirm the app builds and the menu no longer surfaces "Mis tableros"; visiting `/settings/tableros` 404s.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(routes): delete orphan /settings/tableros personal-board page (Phase 3)

Personal board-personalization confirmed unwanted (decision #3). Removes the page,
its now-unused PersonalizarTablero panel (if unreferenced), and the catch-all
manifest row.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Note the BE-seed tidy (documentation only — no FE code)

**Files:**
- Modify: `docs/plans/2026-09-01-route-menu-reorg-00-master.md` (append a "BE follow-up" note) — OR record as a cmr-be issue.

No FE code changes. The BE (`cmr-be/src/scripts/menu-items.ts`) still seeds old
`path` values and the `mis-tableros` item. Because the FE now owns routes +
structure, this is cosmetic — but for tidiness the BE should (separate cmr-be PR):
- Drop the `mis-tableros` seed row (its FE page is deleted; the resolver would
  otherwise fall back to the dead `/settings/tableros` for admins with `tablero.config`).
- Optionally update seed `path` values to the new English routes and rename group
  `clave`s (`g-agenda → g-scheduling`, …). Purely cosmetic; the FE ignores `path`
  for known claves.
- No schema change; a plain seed edit + optional idempotent data-fix script.

- [ ] **Step 1: Record the BE follow-up**

Add a short "BE follow-up (separate cmr-be PR)" note to the master plan (or open a cmr-be issue) capturing the two bullets above. Nothing to build/test.

- [ ] **Step 2: Commit (docs)**

```bash
git add docs/plans/2026-09-01-route-menu-reorg-00-master.md
git commit -m "docs(routes): record BE-seed tidy follow-up (Phase 3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 (optional, may be its own PR): Menu-editor reconciliation

**Files:**
- Modify: `components/configuracion/menu-editor.tsx`
- Modify: `components/admin/menu-admin.tsx`

**Context:** After Phase 2, FE owns group + order + route for manifest-known
`clave`s. The menu-editor still lets admins reorder (`parentClave`/`orden`, persisted
via `updateMenuItem`) and add-from-manifest by `path` — but for known items these
no longer affect the rendered rail (only per-center `labelCustom` + `visible` +
permissions still take effect). Left as-is, admins get controls that silently
do nothing. Spec §8 marks this **non-blocking**; do it as a follow-up so the
editor's affordances match reality.

**Goal:** For manifest-known items, DISABLE/HIDE the reorder + free-text `path`
controls and show the FE-owned route read-only; KEEP full controls for
dynamic/board items (unknown to the manifest) and keep `labelCustom` + `visible`
editable for all.

- [ ] **Step 1: Add a "known to FE manifest?" predicate**

In `components/configuracion/menu-editor.tsx`, import `groupForClave` from
`@/lib/nav/manifest` and derive, per item, `const feKnown = !!groupForClave(it.clave);`.

- [ ] **Step 2: Gate the reorder + path affordances on `!feKnown`**

- Disable the drag/move (`MoveResult`/reorder persistence at lines ~91-150, ~209-214) for `feKnown` rows (or hide the move handles), so `orden`/`parentClave` writes only happen for unknown/dynamic items.
- Where the item `path` is shown (line ~506-507) or edited, for `feKnown` items render the FE route read-only via `routeForClave(it.clave, it.path)` and remove the editable `path` input; keep the free-text `path` input for `!feKnown` items (dynamic boards).
- In `components/admin/menu-admin.tsx`, apply the same gate to its `path` input (placeholder at line ~225) and any reorder control.

- [ ] **Step 3: Keep `labelCustom` + `visible` editable for ALL items**

Verify the per-center label override + visibility toggles remain enabled regardless of `feKnown` (these stay BE-owned — master §2, spec §9).

- [ ] **Step 4: Typecheck + build + smoke**

Run: `npm run typecheck` → clean; build gate green.
:8080 smoke as an admin: open the menu editor; known items show a read-only FE
route and no move handles; a dynamic board item still allows path + reorder;
label + visibility editable everywhere.

- [ ] **Step 5: Commit**

```bash
git add components/configuracion/menu-editor.tsx components/admin/menu-admin.tsx
git commit -m "feat(menu-editor): read-only route + no reorder for FE-owned items (Phase 3)

Manifest-known items show their FE route read-only and hide the now-inert
path/reorder controls; dynamic/board items keep full editing; labelCustom +
visible stay editable for all (BE-owned).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 completion checklist

- [ ] `/atencion`, `/frontdesk`, `/settings/tableros` deleted; those URLs 404.
- [ ] `npm run typecheck` clean; `npm test` green; build gate green (page count reflects the 3 deletions).
- [ ] :8080 smoke — menu intact; boards open at `/boards/*`; no "Mis tableros"; menu-editor affordances match FE ownership (if Task 4 done).
- [ ] BE-seed tidy recorded as a cmr-be follow-up.
- [ ] PR(s) off `main`.

## Reorg complete

After Phase 3: every route is English under a coherent category prefix; the menu
mirrors the route structure (9 FE-owned groups); BE owns only visibility +
per-center label overrides; no legacy stubs. Final full-app grep gate (master §6)
should show zero spanglish route segments outside `lib/api/*`.
