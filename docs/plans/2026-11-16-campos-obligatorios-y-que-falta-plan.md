# Required fields, "what's missing" hints and the standard dialog shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every dialog/sheet with a submit button marks required fields with `*`, says above its
disabled button what is still missing, and is built from one shared shell (submit cycle, reset on
open, confirm, errors, size/scroll, Enter, busy label).

**Architecture:** Pure, tested logic in `lib/forms/` (no React imports, so `node --test` can run
it). Thin hooks and components in `components/kit/` on top of it. Then 10 migration PRs, one
area each, that move every dialog onto the kit and delete its hand-built copies.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, shadcn/ui (Radix), next-intl, `node --test --experimental-strip-types`.

**Spec:** `docs/specs/2026-11-16-campos-obligatorios-y-que-falta-design.md` (Spanish). Read it before any task.

## Global Constraints

- English for every identifier, comment, i18n key, commit message; Spanish only in `docs/`, PR descriptions and `messages/es.json` values (CLAUDE.md rule 3).
- Every new UI string goes in **both** `messages/es.json` and `messages/en.json`, same commit. No literals in JSX.
- New files are born under 600 lines; `DEBT` ceilings in `eslint.config.mjs` only go down — when a migrated file shrinks, lower its number in the same PR.
- Tests live only in `lib/**/*.test.ts` (nothing else runs). Pure modules in `lib/forms/` must not import React or `next-intl`.
- `missing` and the primary button's `disabled` come from the same value. No separate `canSubmit` restating the same conditions.
- `reason` is text only; it never disables. Disabling for a non-field cause uses `blocked`, and only where the form already blocks today.
- Filled-but-invalid is never "missing": it goes to `reason` (or `Field error`) with its own message.
- Forms that today validate on click switch to disabled + hint (owner decision, 16-nov). List them in the PR description under "Behaviour change".
- No new runtime dependencies. No change to any API call, payload or business rule.
- Merging to `main` deploys to production (Vercel). Each PR: `npm run typecheck && npm run lint && npm test && npm run build` green, plus the browser checklist (Task R, step R8).

## Review Focus

1. **Enter while picking from a search/combobox** (patient search, selects) must pick the option, not submit the dialog → tested in Task 1.3.
2. **Disabled with no explanation:** `blocked` true, `missing` empty, no `reason` — user sees a grey button and nothing else → `footerState` test pins that `missing` beats `reason`, and Task R step R3 requires every `blocked` to come with a `reason`.
3. **Double submit** (double click, Enter held, click + Enter) creating two appointments/payments → `createSubmitGuard` test in Task 1.2.
4. **Edit dialog reused for another record** (open row A, close, open row B) showing A's data → `shouldReset` test with a changed `key` in Task 1.4.
5. **Two confirms requested back-to-back** (second overwrites the first and its promise never settles) → queue test in Task 1.5.

---

## PR overview

| PR | Branch | Scope | Files |
|---|---|---|---|
| 1 | `feat/forms-kit` | Kit: `lib/forms/*`, `components/kit/*`, `ConfirmHost`, i18n | new + `form-dialog.tsx`, `app-shell.tsx`, messages |
| 2 | `feat/forms-desk-patients` | Patient desk (incl. the front desk dialogs it shares), board (tablero) & patients | 30 |
| 3 | `feat/forms-billing-cash` | Billing & cash | 22 |
| 4 | `feat/forms-admin-config` | Users, access, staff & configuration (+ retire `FormDialog.canSubmit`) | 32 |
| 5 | `feat/forms-rest` | Inventory, services, audit, formats, auth | 20 |
| 6 | `chore/forms-lock-in` | Lint rules + CLAUDE.md section so it stays this way | 2 |
| 7 | `feat/forms-agenda` | Agenda & appointments, incl. the therapy scheduler — **deferred, "later"** (owner, 16-nov) | 7 |

Order set by the owner on 16-nov. PRs 2–5 and 7 depend only on PR 1. Each branches from the latest
`main`.

**Because the agenda PR is deferred,** two things carry temporary exceptions until it lands:
- **PR 5's final sweep** ignores `components/agenda/*`, `components/citas/*` and `components/calendario/*` (plus the two deprecated front desk files, below). Those files keep their local `Field` copies and two `window.confirm`s for now.
- **PR 6's lint rule** lists `components/agenda/recurring-booking-modal.tsx` and `components/calendario/evento-modal.tsx` as named exceptions. PR 7 deletes those exceptions in the same commit that removes their `window.confirm`.

---

## Deprecated: `/boards/frontdesk` (owner, 16-nov)

The service-based front desk (`/boards/frontdesk`, `components/frontdesk/frontdesk-board.tsx`) is
deprecated in favour of the patient desk (`/boards/patient-desk`). It is **not updated** by any PR in
this plan. Deprecated in this plan only: the app menu does not change.

Not touched, because only `/boards/frontdesk` reaches them (traced from every `page.tsx`/`layout.tsx`, 16-nov):
- `components/frontdesk/frontdesk-board.tsx`
- `components/frontdesk/programar-citas-modal.tsx` (in fact imported by nothing — see Dead code)

All other `components/frontdesk/*` dialogs are also reached from the patient desk, the generic
board or the patient file, so they are migrated in PR 2.

The sweeps and lint exceptions treat these two files like the deferred agenda files:
- PR 5's final sweep skips them.
- PR 6's lint rule needs no exception for them, because neither calls `window.confirm`; re-check with `grep` before PR 6.

## Dead code found by the trace (16-nov) — deleted in PR 1 (owner OK, 16-nov)

Imported by nothing, checked by file name and component name in `app/`, `components/` and `lib/`:
- `components/admin/assign-center-dialog.tsx` (`AssignCenterDialog`)
- `components/agenda/sesion-modal.tsx` (`SesionModal`)
- `components/citas/cita-form-sheet.tsx` (`CitaFormSheet`)
- `components/frontdesk/programar-citas-modal.tsx` (`ProgramarCitasModal`)

They are deleted in PR 1, in their own commit. Note: the
earlier trace followed only `@/` imports; this one also follows relative imports. That is why
`nueva-cita-modal` turned out to be in use.

## PR 1 — The kit

### Task 1.1: `missingFields` and `footerState`

**Files:**
- Create: `lib/forms/missing.ts`
- Test: `lib/forms/missing.test.ts`

**Interfaces — Produces:**
```ts
export type Check = readonly [label: string, ok: boolean];
export function missingFields(checks: readonly Check[]): string[];
export type FooterInput = { missing?: readonly string[]; reason?: string | null; blocked?: boolean; submitting?: boolean };
export type Hint = { kind: "missing"; items: string[] } | { kind: "reason"; text: string } | null;
export function footerState(i: FooterInput): { disabled: boolean; hint: Hint };
```

- [ ] **Step 1: Write the failing tests**
```ts
test("missingFields keeps the order of the failing checks", () => {
  assert.deepEqual(missingFields([["Paciente", true], ["Hora", false], ["Motivo", false]]), ["Hora", "Motivo"]);
});
test("missingFields drops duplicate labels", () => {
  assert.deepEqual(missingFields([["A o B", false], ["A o B", false]]), ["A o B"]);
});
test("footerState: nothing missing, nothing blocked → enabled, no hint", () => {
  assert.deepEqual(footerState({}), { disabled: false, hint: null });
});
test("footerState: missing disables and is the hint", () => {
  assert.deepEqual(footerState({ missing: ["Hora"] }), { disabled: true, hint: { kind: "missing", items: ["Hora"] } });
});
test("footerState: missing wins over reason", () => {
  assert.equal(footerState({ missing: ["Hora"], reason: "No cabe" }).hint?.kind, "missing");
});
test("footerState: reason alone is shown but does NOT disable", () => {
  assert.deepEqual(footerState({ reason: "No cabe" }), { disabled: false, hint: { kind: "reason", text: "No cabe" } });
});
test("footerState: blocked disables and shows its reason", () => {
  assert.deepEqual(footerState({ blocked: true, reason: "Sin permiso" }), { disabled: true, hint: { kind: "reason", text: "Sin permiso" } });
});
test("footerState: submitting disables", () => {
  assert.equal(footerState({ submitting: true }).disabled, true);
});
```
- [ ] **Step 2:** `npm test` → FAIL (module not found).
- [ ] **Step 3:** Implement both functions in `lib/forms/missing.ts`. An empty-string `reason` counts as none.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(forms): missingFields and footerState`.

### Task 1.2: Submit guard

**Files:** Create `lib/forms/submit.ts`; Test `lib/forms/submit.test.ts`

**Interfaces — Produces:**
```ts
export type SubmitResult<T> = { status: "ok"; value: T } | { status: "error"; error: unknown } | { status: "skipped" };
export function createSubmitGuard(): { run<T>(fn: () => Promise<T>): Promise<SubmitResult<T>>; readonly busy: boolean };
```

- [ ] **Step 1: Failing tests**
  - `"a second run while the first is pending is skipped and fn is not called"`: start run with a deferred promise, call run again → `{ status: "skipped" }`, call count 1.
  - `"busy is true while pending and false after it settles"`.
  - `"a rejected fn returns status error and releases the guard"`: after the error a new run calls fn again.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement with a closure flag, released in `finally`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat(forms): submit guard against double submit`.

### Task 1.3: Enter-to-submit rule

**Files:** Create `lib/forms/enter.ts`; Test `lib/forms/enter.test.ts`

**Interfaces — Produces:**
```ts
export type EnterEvent = { key: string; shiftKey: boolean; isComposing: boolean; targetTag: string; targetRole: string | null; targetExpanded: boolean };
export function shouldSubmitOnEnter(e: EnterEvent, disabled: boolean): boolean;
```

- [ ] **Step 1: Failing tests** (one `test` each):
  - Enter in `INPUT`, not disabled → `true`.
  - Enter while `disabled` → `false`.
  - Enter in `TEXTAREA` → `false`; Shift+Enter in `INPUT` → `false`.
  - `isComposing: true` → `false`.
  - `targetRole: "combobox"` with `targetExpanded: true` → `false` (Review Focus 1).
  - Enter on `BUTTON` → `false` (the button handles its own click).
  - Key `"a"` → `false`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(forms): enter-to-submit rule`.

### Task 1.4: Reset-on-open rule

**Files:** Create `lib/forms/dialog-form.ts`; Test `lib/forms/dialog-form.test.ts`

**Interfaces — Produces:**
```ts
export function shouldReset(prev: { open: boolean; key: unknown }, next: { open: boolean; key: unknown }): boolean;
```
True when the dialog goes closed → open, or when it stays open and `key` changes (`Object.is`).

- [ ] **Step 1: Failing tests:** closed→open → true; open→open with the same key → false; open→closed → false; open→open with key `"A"`→`"B"` → true (Review Focus 4); closed→closed with a changed key → false.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(forms): reset-on-open rule`.

### Task 1.5: Confirm queue

**Files:** Create `lib/forms/confirm-queue.ts`; Test `lib/forms/confirm-queue.test.ts`

**Interfaces — Produces:**
```ts
export type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };
export function createConfirmQueue(): {
  request(o: ConfirmOptions): Promise<boolean>;
  current(): ConfirmOptions | null;
  settle(ok: boolean): void;            // resolves the current one, advances
  cancelAll(): void;                    // resolves every pending one with false (host unmount)
  subscribe(fn: () => void): () => void;
};
```

- [ ] **Step 1: Failing tests:** one request → `current()` is it, `settle(true)` resolves `true`; two requests → the second waits, and after the first settles `current()` is the second (Review Focus 5); `settle` with nothing pending is a no-op; `cancelAll` resolves all pending with `false`; subscribers are notified on request and on settle.
- [ ] **Steps 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(forms): confirm queue`.

### Task 1.6: Kit components and hooks

**Files:**
- Create: `components/kit/required-mark.tsx`, `components/kit/field.tsx`, `components/kit/missing-hint.tsx`, `components/kit/form-footer.tsx`, `components/kit/form-sheet.tsx`, `components/kit/confirm-host.tsx`, `components/kit/use-submit.ts`, `components/kit/use-dialog-form.ts`
- Modify: `components/kit/form-dialog.tsx` (keep re-exporting `Field` so the 15 current imports compile), `components/app-shell.tsx:68` (mount `<ConfirmHost />` next to `<ConfirmActionHost />`, which stays as is), `messages/es.json`, `messages/en.json`
- Modify: `components/clientes/paciente-form-sheet.tsx` only to read the legend from its new key (the old key `clientes.form.requiredLegend` is removed)

**Interfaces — Consumes:** Tasks 1.1–1.5. **Produces:**
```ts
RequiredMark(): JSX                                          // "*" text-destructive aria-hidden + sr-only t("common.form.required")
Field(p: { label: string; htmlFor?: string; required?: boolean; hint?: string; error?: string | null; className?: string; children: ReactNode })
FormError(p: { message?: string | null })                    // general error block above the footer; renders nothing when empty
RequiredLegend()                                             // "* Campos obligatorios"
MissingHint(p: { id: string; missing?: readonly string[]; reason?: string | null; blocked?: boolean })
type FooterAction = { label: string; onClick: () => void; variant?: ButtonProps["variant"] };
FormFooter(p: { primary: FooterAction | FooterAction[]; missing?: readonly string[]; reason?: string | null;
  blocked?: boolean; submitting?: boolean; submittingLabel?: string; onCancel?: () => void; cancelLabel?: string;
  extra?: ReactNode; className?: string })
type FormSize = "sm" | "md" | "lg" | "xl" | "2xl";            // sm:max-w-sm | md | lg | 2xl | 5xl
FormDialog(p: { open; onOpenChange; title; description?; size?: FormSize /* default "md" */; children;
  onSubmit: () => void | Promise<void>; submitLabel?; submittingLabel?; cancelLabel?; submitting?: boolean;
  missing?: readonly string[]; reason?: string | null; blocked?: boolean; extra?: ReactNode;
  /** @deprecated use missing/blocked; removed in PR 4 */ canSubmit?: boolean })
FormSheet(same props as FormDialog, side "right", size widths sm:max-w-md | lg | xl | 2xl | 3xl)
useSubmit<T>(fn: () => Promise<T>, o?: { successMessage?: string; onSuccess?: (v: T) => void }): { submitting: boolean; submit: () => Promise<void> }
useDialogForm<T>(initial: () => T, open: boolean, key?: unknown): [T, (patch: Partial<T> | ((s: T) => T)) => void]
useConfirm(): (o: ConfirmOptions) => Promise<boolean>
ConfirmHost(): JSX                                           // mounted once; renders the queue's current item as an AlertDialog
```
Behaviour pinned by the spec:
- `FormFooter`: hint above the buttons (full width on mobile, right-aligned with the buttons from `sm:`). Each primary button gets `aria-describedby={hintId}` and `disabled` from `footerState`. While `submitting`, primaries show `submittingLabel ?? t("common.saving")`.
- `FormDialog`/`FormSheet`: content `flex max-h-[90dvh] flex-col`, body `min-h-0 flex-1 overflow-y-auto`, footer `shrink-0` (always visible). While `submitting`, closing is ignored (`onOpenChange(false)`, Esc, ✕ and outside click all no-ops). `onKeyDown` on the body uses `shouldSubmitOnEnter` with `footerState(...).disabled`. `canSubmit === false` maps to `blocked: true`.
- `useSubmit`: built on `createSubmitGuard`; on `error` calls `toastError(err, tRoot)` (`lib/api/errors.ts:85`); on `ok` shows `toast.success(successMessage)` if given, then `onSuccess`.
- `useDialogForm`: re-runs `initial()` when `shouldReset` says so.
- `Field`: `required` adds `RequiredMark` after the label; the caller also passes `aria-required` to its control. `error` renders under the control in `text-xs text-destructive`.
- i18n, both catalogues: `common.form.missingPrefix` = "Para continuar, completa:" / "To continue, fill in:"; `common.form.required` = "obligatorio" / "required"; `common.form.requiredLegend` = "Campos obligatorios" / "Required fields"; `common.confirm` already exists (reuse it as the default confirm label).

- [ ] **Step 1:** Implement the files above. Each file stays under 200 lines.
- [ ] **Step 2:** `npm run typecheck && npm run lint && npm test && npm run build` → all green.
- [ ] **Step 3:** Browser check on `localhost:8080`, using one existing `FormDialog` user (e.g. Configuración › Tableros › new board):
  - the footer stays visible when the window is short;
  - Esc does nothing while saving;
  - Enter in a text input submits;
  - a confirm from the dev console works: `useConfirm` via a temporary button, removed before commit.
- [ ] **Step 4:** Commit `feat(forms): standard dialog kit (field, footer, hint, sheet, confirm, submit)`, then open PR 1.

---

## The migration recipe (Task R) — applied to every file in PRs 2–5 and 7

Each file in a PR's list is one task: **Task R on `<file>`**. Steps:

- [ ] **R1 — Classify.** Open the file and decide which kind it is:
  - **(a)** form with a submit button;
  - **(b)** confirm-only (`AlertDialog` with no fields, or `window.confirm`);
  - **(c)** viewer with no submit.
  - **(c)** is left alone unless it has a `window.confirm` or a local `Field`. Write the classification into the PR description's table.
- [ ] **R2 — List the required fields** (for (a)): everything the current `disabled` condition requires, **plus** everything the click-time validation rejects when empty. Text fields count as filled after `.trim()`. If the second group is non-empty, the file goes under "Behaviour change" in the PR description.
- [ ] **R3 — Write the checks.**
  - In agenda, frontdesk, board, patients-with-logic, billing and cash, write a pure `lib/<area>/<form>-missing.ts` exporting `<form>Missing(state): FieldKey[]` (a union of English string keys), plus a `.test.ts` with one test per required field (missing → listed) and one "all present → []".
  - Elsewhere, call `missingFields([...])` inline.
  - Invalid-but-filled conditions go to `reason`, using an existing message key or a new one in both catalogues.
  - Any remaining non-field disable becomes `blocked` with a `reason`.
- [ ] **R4 — Use the shell.**
  - Replace hand-built `Dialog`+`DialogFooter` with `FormDialog`, and `Sheet` with `FormSheet`, choosing the `size` nearest at or above the old width.
  - Where the body or footer layout is unusual (e.g. the scheduler), keep the layout and use `FormFooter` directly.
  - Mark each required field: `Field required`. Add `RequiredLegend` when there are ≥ 3 required fields.
- [ ] **R5 — Use the hooks.**
  - `busy` state + `try/catch` + toast → `useSubmit`.
  - Reset in `onOpenChange` / effects → `useDialogForm(initial, open, record?.id)`.
  - Field-level and general error text → `Field error` / `FormError`.
  - `window.confirm` and hand-built confirm `AlertDialog`s → `useConfirm`.
- [ ] **R6 — Delete** the file's local `Field`/`FieldRow`/`Lbl`, plus any `canSubmit`-style variable that restated the checks.
- [ ] **R7 — Gate:**
  - `npm run typecheck && npm run lint && npm test` → green.
  - If the file is in `DEBT`, lower its ceiling to its new `wc -l`.
- [ ] **R8 — Browser check** (`/qa` against `localhost:8080`), for each (a) dialog:
  - (i) `*` on exactly the R2 fields;
  - (ii) empty form → hint lists them, in on-screen order;
  - (iii) fill one at a time → the item drops off, and the button enables when the list is empty;
  - (iv) Enter submits once (no duplicate row/toast);
  - (v) Esc is ignored while saving;
  - (vi) close and reopen (and reopen on another record) → clean form;
  - (vii) a forced API error (offline devtools) → error toast, dialog stays open.
- [ ] **R9 — Commit** per file or per small group: `refactor(<area>): <dialog> on the standard form shell`.

Each PR ends with:
- `npm run build` green;
- PR description (Spanish allowed) with the classification table, the "Behaviour change" list, the `DEBT` changes and the R8 results;
- `🤖 Generated with [Claude Code](https://claude.com/claude-code)` as the last line.

---

## PR 2 — Patient desk, board & patients (`feat/forms-desk-patients`)

**First task, before any Task R (carried over from PR 1's final review):** in `components/kit/form-footer.tsx` render `onClick={() => a.onClick()}` so the click event never reaches a `useSubmit` function with optional arguments; type `FooterAction.onClick` as `() => void | Promise<void>` with a JSDoc line "wrap `submit`, never pass it directly"; give `FormSheet`'s body the same `py-1 -my-1` focus-ring room as `FormDialog`; treat `actions={[]}` like no `actions`. Commit `fix(forms): footer actions never receive the click event`.

One PR (owner, 16-nov). Commit per area in this order — shared desk dialogs, board, patient desk, patients — so the review can go area by area.

### Shared desk dialogs (live in `components/frontdesk/`, used by the patient desk)
The patient desk renders `fila-sesion` (via `service-sessions-table`), which opens these, so they are migrated even though `/boards/frontdesk` is deprecated (owner, 16-nov). The deprecated front desk picks up the new UI where it uses them, as a side effect.

Task R on each file in `components/frontdesk/`:
- `fila-sesion` (`DEBT` 723), `compras-modal`, `confirm-deshacer-dialog`, `corregir-disponibilidad-dialog`
- `dosis-aviso-dialog`, `formatos-modal`, `historial-modal`, `nurse-status-button`
- `panel-notificar-modal`, `row-menu`, `sesiones-cell`, `technician-status-button`

### Board, patient desk & patients
- `components/tablero/`: `acciones-modal`, `agregar-cita-modal`, `celda-toggle-icon`, `ehr-readiness-modal`, `historial-dialog`, `nueva-cita-modal` (the `nueva_cita_prescripcion` post-action, opened via `post-accion.tsx` from the generic board), `tablero-acciones`
- `components/patient-desk/`: `patient-desk`, `therapy-queue-strip`

- `components/clientes/`: `acciones-paciente-sheet`, `ficha-facturacion`, `ficha-tabs`, `old-record-suggestion-banner`, `paciente-form-sheet` (`DEBT` 550), `patient-merge-dialog`, `cambio-protocolo-form`
- `app/(app)/patients/[id]/layout.tsx`
- `components/body-measurements/link-visit-dialog.tsx`

## PR 3 — Billing & cash (`feat/forms-billing-cash`)
- `components/facturacion/`:
  - `add-kit-component`, `como-se-cobra`, `devoluciones-list-view`, `factura-row-actions`
  - `grupos-admin`, `invoice-add-item` (local `Lbl`), `invoice-change-patient`, `invoice-header-dialog`
  - `invoice-reopen` (`window.confirm`), `pagos-factura`, `personalizar-kit-dialog`, `receipt-print-dialog`
  - `regenerar-disponibilidad-dialog`, `resumen-paciente-panel`, `sales-package-parts`
- `app/(app)/billing/invoices/[id]/page.tsx` (`DEBT` 1460, `window.confirm`)
- `app/(app)/billing/invoices/[id]/returns/[devId]/page.tsx`

- `components/caja/`: `cash-sign-off`, `cuadre-attachment-delete-button`, `cuadre-scan-button`, `past-day-confirm-host`, `resumen-pagos`

## PR 4 — Users, access, staff & configuration (`feat/forms-admin-config`)
- `components/admin/`:
  - `access-dialog`, `cambiar-email-dialog`, `centers-list`, `codigo-acceso-dialog`
  - `datos-fiscales-dialog`, `invite-dialog`, `menu-admin`, `override-settings`, `pending-profiles`
  - `permisos-catalogo` (`window.confirm`), `permisos-dialog`, `profile-centros-dialog` (`window.confirm`), `profile-edit-dialog`, `rbac-settings` (`window.confirm`)
- `components/personal/`: `ehr-link-section`, `give-access-dialog`, `nuevo-personal-dialog`

- `components/configuracion/`:
  - `column-config-dialog`, `columnas-tab`, `menu-editor` (`DEBT` 700), `meta-crud`, `resources-config`
  - `scheduling-bridge-config-form`, `scheduling-bridge-mappings`, `scheduling-bridge-status-cards`
  - `service-resources-editor`, `tablero-editor-admin`, `tableros-list`
- `components/comunicaciones/comunicaciones-admin.tsx`
- `app/(app)/configuration/priority-flags/page.tsx`
- `components/paneles/panel-secciones-admin.tsx`
- `components/right-now/external-source-settings.tsx`

Last task: `grep -rn "canSubmit" components app` must show no `FormDialog` user. Then remove the deprecated `canSubmit` prop from `form-dialog.tsx`. Commit `refactor(forms): drop FormDialog.canSubmit`.

## PR 5 — Inventory and the rest (`feat/forms-rest`)
- `components/inventario/`:
  - `ajuste-modal`, `amp-editor-sheet`, `insumos-editor-sheet`, `live-stock-history-sheet`, `pp-form-sheet`
  - `presentaciones-proveedor-admin`, `productos-admin` (`DEBT` 1048), `proveedores-admin`, `retire-scale-button`
  - `sales-packages-admin`, `transferencias/transferencia-recibir`, `transferencias/transferencia-nueva`
- `components/servicios/servicio-form-fields.tsx`, `components/servicios/servicios-admin.tsx` (`DEBT` 661)
- `components/formatos/formatos-admin.tsx`
- `components/auditoria/audit-detail-sheet.tsx`, `components/auditoria/auditoria-log.tsx` (`DEBT` 567)
- `components/change-log/change-log-sheet.tsx`
- `components/auth/forgot-password-dialog.tsx`

Final sweep before opening the PR. Each grep must return nothing outside `components/kit`, `components/ui` and the deferred agenda files (`components/agenda/*`, `components/citas/*`, `components/calendario/*`) and the deprecated `components/frontdesk/frontdesk-board.tsx` and `components/frontdesk/programar-citas-modal.tsx`:
- `grep -rnE "^function (Field|FieldRow|Lbl)\b" components app`
- `grep -rnE "window\.confirm|[^.a-zA-Z]confirm\(" components app` (excluding `useConfirm` callers)

## PR 6 — Lock it in (`chore/forms-lock-in`)

**Files:** Modify `eslint.config.mjs`, `CLAUDE.md`

- [ ] **Step 1:** In `eslint.config.mjs` add `no-restricted-globals` for `confirm`, and `no-restricted-properties` for `window.confirm`, with the message "Use useConfirm() from components/kit/confirm-host". `npm run lint` → green, which proves PRs 2–5 removed them all. Add a per-file override for `components/agenda/recurring-booking-modal.tsx` and `components/calendario/evento-modal.tsx`, with a comment saying the agenda PR (PR 7) removes it.
- [ ] **Step 2:** Add a "Forms and dialogs" section to `CLAUDE.md` (rule 7: the file and the repo cannot diverge). It says:
  - new dialogs use `FormDialog`/`FormSheet`/`FormFooter`/`Field`;
  - `missing` drives `disabled`;
  - `reason` never disables;
  - `useSubmit` / `useDialogForm` / `useConfirm` are the standard;
  - pure logic lives in `lib/forms/`.
- [ ] **Step 3:** `npm run lint && npm run build` → green. Commit `chore(forms): lint rule and CLAUDE.md section for the form shell`.

## PR 7 — Agenda & appointments (`feat/forms-agenda`) — deferred

Runs after PR 6, whenever the owner schedules it. Also delete the two lint exceptions PR 6 added, in the same commit that removes their `window.confirm`.

First task, before Task R: **split `components/agenda/therapy-day-scheduler.tsx`** (598 lines, not in `DEBT`):
- move the left column (patient hero, bought chips, therapy cards) to `components/agenda/therapy-day-cards.tsx`;
- move the bottom summary to `components/agenda/therapy-day-summary.tsx`;
- no behaviour change; `typecheck` + build;
- commit `refactor(agenda): split the therapy day scheduler`.

Then Task R on:
- `components/agenda/therapy-day-scheduler.tsx`:
  - `missing` = patient, therapies, hour (`lib/agenda/therapy-day-missing.ts`);
  - `FormFooter` with `primary` = [«Agendar y seguir», «Agendar y cerrar»] and `extra` = «Programar una serie del tren» (keeps its own `disabled`);
  - a slot that doesn't fit stays bookable, with its warning as today.
- `components/agenda/cita-modal.tsx`
- `components/agenda/planificar-dia-modal.tsx`
- `components/agenda/recurring-booking-modal.tsx` (has `window.confirm`)
- `components/agenda/train-series-modal.tsx`
- `components/citas/cita-actions.tsx` (cancel and reschedule dialogs)
- `components/calendario/evento-modal.tsx` (has `window.confirm`)
