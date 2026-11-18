# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

Complements [`AGENTS.md`](./AGENTS.md) (gstack and browser-based QA), which still applies.
The Next 16 rules that open that file override any memory of earlier versions: **read
`node_modules/next/dist/docs/` before writing framework code.**

# CMR FE — web client

Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui. This is a **thin client over
`cmr-be`**: almost no business logic lives here. Authentication is Supabase and the data comes
from the API. The contract between the two repos is in `../CLAUDE.md` (monorepo root).

## Los estatutos — lo que se cumple SIEMPRE, en BE y en FE

Vale para todo lo que se entrega, sin excepción: **API-First + MCP + Swagger + configurable +
multi-tenant + RBAC + comentarios en DB y en cada campo + spec/plan + TDD + drift-clean + i18n**.
Sin hardcode. **UI para TODO el CRUD de la API.** Revisar el endpoint CORRECTO, no el más cómodo. No
duplicar código. Sin secretos. **Nunca asumir: investigar y revisar en profundidad las veces que haga
falta.** Jamás suponer, y mucho menos confiar.

**Permisos por centro.** Cada endpoint puede recibir, opcionalmente, el array de centros como
parámetro para resolver el permiso (`read`, `write` y los que hagan falta); la UI debe pasarlo en vez
de depender solo del centro activo.

**Diseño.** Buscar en internet el layout de UI más moderno antes de diseñar, aplicarlo manteniendo la
uniformidad del diseño existente, y hacer un uso eficiente y óptimo de la pantalla: toda la pantalla.

### Las tres preguntas, antes de dar nada por terminado

¿Lo entiendo? ¿Lo puedo mantener? ¿Lo probé? **Si la respuesta a alguna es NO, no se entrega: se dice
que no.**

### Lo verificado y lo supuesto van SEPARADOS

Siempre, y de forma explícita. Lo verificado, con su fuente o el comando que lo comprobó. Lo supuesto,
marcado como supuesto. **Nunca mezclados en la misma frase.**

### El rigor se gradúa por lo que cuesta equivocarse

Máximo en lo que va a producción, toca datos de pacientes o mueve dinero. Ligero en scripts y
herramientas de usar y tirar.

### Las herramientas del equipo (gstack)

- `/qa` y `/qa-only` → QA con navegador REAL contra `localhost:8080` o `https://cmr-fe-gamma.vercel.app`
  (flujos de frontdesk, toasts, persistencia).
- `/review` → revisión rigurosa del branch/PR ANTES del merge a main.
- `/cso` → auditoría de seguridad OWASP + STRIDE (datos de pacientes, auth/tenancy/RBAC).
- `/browse` → solo como dependencia de `/qa`.

## Commands

```bash
npm run dev          # next dev on port 8080
npm run build        # next build (Turbopack)
npm run lint         # eslint — BLOCKS in CI
npm run typecheck    # tsc --noEmit
npm test             # node --test (see the warning below)
npm run format       # prettier
npm run gen:api      # regenerates lib/api/schema.d.ts from the backend's OpenAPI, then englishifies it
```

`gen:api` runs `openapi-typescript --default-non-nullable false` and then `scripts/englishify-schema.mjs`.
The flag matters: without it, an optional BE field that has a `default` (e.g. `alcance` on services)
is generated as REQUIRED and tsc reports drift that does not exist. Point it at prod with
`CMR_OPENAPI_URL=https://api.centrodemedicinaregenerativa.com/api/docs-json`.

**Vercel owns deployment**, not GitHub Actions. `.github/workflows/ci.yml` is only the gate:
typecheck → lint → tests → build, on every PR and every push to `main`.

## Two tooling traps that cost an hour if you do not know them

1. **The tests are neither vitest nor jest.** They are `node --test --experimental-strip-types`.
   Running `npx vitest run` returns "No test suite found in file" for all 17 files and looks like
   a broken repo: it is not, it is the wrong runner. Use `npm test`. This is also why CI pins
   **Node 22** — `--experimental-strip-types` does not exist before 22.6, and on Node 20 the tests
   would not fail: they would never run, and the job would go green.
2. **Only what lives in `lib/` is executed.** The glob is `"lib/**/*.test.ts"`. A test placed in
   `components/` or `app/` **is run by nobody** and nothing warns you. If component tests ever
   arrive, the glob has to be widened in the same commit that adds them.

## Guardrails — what must never happen again

The August assessment (`../cmr-be/docs/plans/assessment-hallazgos-2026-08.md`) left two findings
that belong to this repo, and neither was fixed by being written down. Now something fails behind
each one.

### 1. Nothing gets switched off to make CI pass
All four steps (`typecheck`, `lint`, `test`, `build`) block. **None of them gets commented out,
set to `continue-on-error`, or skipped to land a change.** If one goes red, the red is the work.
For months this repo reached production unwatched while the backend had a gate since 2-Sep; that
asymmetry is what just closed.

### 2. File ceilings only go down (`npm run lint`)
`frontdesk-board.tsx` (2,582 lines) and the invoice screen (2,274) have been named in writing for
months and have kept growing in every report. They are exactly the two places money flows through,
and a two-thousand-line file does not get reviewed: it gets skimmed.

- **A new file is born under 600 lines.** No exceptions.
- The ones that were already big carry their current size as a ceiling in `DEBT`
  (`eslint.config.mjs`). That list **may only shrink**: when a component is split, lower the number
  or delete the line.
- **Adding an entry to `DEBT`, or raising a ceiling, is not a passing decision**: it is admitting
  debt, and it gets discussed with the owner and explained in the commit. When in doubt, split the
  component.
- Deliberately exempt: `components/ui/**` (shadcn primitives, regenerated by its CLI) and
  `lib/api/schema.d.ts` (generated from the backend's OpenAPI).

### 3. Everything is written in ENGLISH
Requested as refactor **5d** months ago and **never written into any CLAUDE.md**, so it was broken
in good faith by copying the file next door. Here it is.

**English, for everything that gets committed:** filenames, npm scripts, identifiers, routes,
props, i18n keys, component names — and equally **comments, console messages, CI step names and
commit messages**.

**Three things may be written in Spanish:**

1. **The documents under `docs/`** — specs, plans and handoffs. That is where the reasoning lives,
   and it is written in the language this product is thought in.
2. **Pull request descriptions.**
3. **Translated UI copy** — the *values* in `messages/es.json`. The app is deliberately bilingual
   (`next-intl`, Spanish and English catalogues side by side), and Spanish user-facing text is the
   product working as intended, not debt. See the paragraph below for where that stops.

Everything else in the repository is English, comments and console messages included. A long
explanatory comment is not a "document": it is code, and it goes in English.

#### Where the UI exception stops

The exception covers the **translated string**, not the code around it. Concretely:

- **A Spanish string hardcoded into a component is NOT covered.** User-facing copy goes through
  `useTranslations`/`getTranslations` and lands in **both** `messages/es.json` and
  `messages/en.json`. A literal in JSX is invisible to the English catalogue and silently makes the
  app monolingual again. 164 of the 235 files under `app/` and `components/` already do this
  properly, so it is the norm here, not an aspiration.
- **Message keys and namespaces are English.** The catalogue is mid-migration — `appointments`,
  `patients`, `common` sit next to `citas`, `tablero`, `configuracion` — and new keys go in English.
  The Spanish key next door is history, not licence.
- **Adding a key to `es.json` without its twin in `en.json`** leaves a hole that only shows up for
  an English-speaking user. Both catalogues move together, in the same commit.

The remaining exception is a name that belongs to an external or legacy system, which keeps its
original spelling because there the name is a fact, not a choice.

**A Spanish file does not authorize the next one.** Much of this repo predates the rule and is
still being translated; that is history, not licence.

**Careful with what arrives from the API:** most of the app is on `/api/v2` and gets English keys,
but the handful of endpoints still on `/api/v1` answer with Spanish ones (`nombre`, `cantidad`).
That is a fact of the contract, not a choice made here — do not rename them on the fly (see rule 6).

### 3b. Dates and numbers follow the APP's language (`npm run lint`)
`toLocaleString()` / `toLocaleDateString()` / `toLocaleTimeString()` with **no locale argument, or
an explicit `undefined`, follow the BROWSER's language** — never the app's. That is not theoretical:
it is why picking English still showed "lunes, 4 de septiembre" in the day view and "septiembre 2026"
on the calendar headers, with a fully translated catalogue sitting right there. Both forms are now
lint **errors**.

- Format through next-intl: `useFormatter()` in a component, `getFormatter()` on the server, with a
  **named format from `i18n/formats.ts`** (`time`, `dateAndTime`, `monthYear`, `dayLong`, …). That
  file is imported by both `i18n/request.ts` and `components/intl-provider.tsx`, because the client
  provider cannot inherit formats across the RSC boundary — add a format in one place, get it in both.
- **A calendar day is not an instant.** `"2026-07-21"` from the BE is a day; rendering it in a
  timezone is what makes an invoice show yesterday. Pair a `day*`/`monthYear` format (they pin UTC)
  with `parseDayUTC` from `lib/format/fecha.ts` (it anchors at UTC noon). Never `new Date(iso + "T00:00:00")`.
- **Deliberately still allowed:** `new Intl.*Format` with an *explicit* locale. Several 24-hour clocks
  pin one on purpose and their output is digits only — "14:30" is identical in es and en — as is USD
  money. Those carry no language, so making them locale-aware would turn 24h into "02:30 PM" in
  English: a regression, not a fix.

### 4. A test is never deleted in silence
When moving, renaming or splitting code, **the test count does not go down**. If a test is genuinely
redundant, say so in the commit and explain why. CI sees tests that fail, not tests that vanish —
and with the glob limited to `lib/`, a test moved out of `lib/` disappears without breaking
anything.

### 5. Money gets tested, however inconvenient
Today's coverage is **123 tests over pure helpers in `lib/`** and **zero component or page tests**,
across 66 pages and 164 components. That is I-11 from the assessment and it is still open. Anything
touching billing, cash or frontdesk **ships with its test in `lib/`**: if the calculation cannot be
tested without mounting a component, the logic is in the wrong place — move it to `lib/` and test it
there. Suggested order in `docs/specs/tests-por-donde-empezar.md`.

### 6. The v1 leftovers answer in Spanish; do not "fix" them by hand
The migration described here **is done**: `apiFetch` and `apiFetchPaged` prefix **`/api/v2`**, and
the app gets English keys. What is left is a deliberate, explicit v1 lane — `apiFetchV1` /
`apiFetchPagedV1` in `lib/api/client.ts` — for the few endpoints the backend has not published in
English yet. Today that is exactly:

- `/auditoria/*` (`lib/api/auditoria.ts`)
- `/me/centros-donde-puedo` (`lib/api/centers.ts`)

Those answer with **Spanish field names**, and that is the contract, not debt introduced here.
**Do not rename a single field on the fly** to make them look English: a partial rename leaves a
screen half in one language and half in the other, which is worse than not starting. The lane is
retired endpoint by endpoint as the backend ships each v2, per
`docs/specs/api-v2-huecos-handoff-be.md`. Reaching for `apiFetchV1` for anything **not** on that
list is the mistake this rule exists to stop — the v2 endpoint already exists.

### 7. This file and the repo cannot diverge
If you change a script, the CI, the test runner or a ceiling, **update this file in the same
commit**. In the backend, `CLAUDE.md` ended up forbidding a command that was already safe and
describing a CI that had not existed for months: an obsolete instruction is worse than none, because
it gets obeyed blindly.

### 8. Forms and dialogs use the kit (only the `confirm()` ban is linted)
A Bayamón receptionist could not book because «Agendar» stayed grey and nothing said the hour was
missing. Every dialog and sheet was then moved onto one shell (spec
`docs/specs/2026-11-16-campos-obligatorios-y-que-falta-design.md`). New ones are built the same way:

- **The shell:** `FormDialog` / `FormSheet` (sizes `sm`–`2xl`), or `FormFooter` alone when the layout
  is unusual. Fields are the kit `Field` (`label`, `required`, `error`, `hint`, `htmlFor` + a
  matching `id` on the control). **No local `Field` / `Lbl` copies.** Three or more required
  fields get a `RequiredLegend`.
- **`missing` drives `disabled`:** list what is empty with `missingFields([[label, ok], …])`, in
  on-screen order, and pass it as `missing`. There is no `canSubmit`; never restate the same
  conditions in a second variable.
- **Filled but invalid is never "missing":** it is a `reason` (text only, it never disables).
  `blocked` is for a non-field cause that already blocks, and **always comes with a true
  `reason`**: never a grey button with nothing written above it, and never «Cargando…» when
  nothing is loading.
- **The hooks:** `useSubmit` (busy, double-submit guard, error toast), `useDialogForm(initial,
  open, record?.id)` (clean form on every open and on another record), `useConfirm()` for any
  yes/no. The browser's `confirm()` is a **lint error**; the only exception is
  `components/calendario/evento-modal.tsx`, until the agenda PR removes it.
- **A submit never "succeeds" without saving** (no bare `return` in an async submit: throw, or put
  the condition in `missing`/`blocked`), and **a failed save never closes the dialog or loses what
  was typed**.
- **Enter submits** when the button is enabled — except for irreversible or outward actions
  (voids, deletes, sending an email or invite, signing a cash day, changing access, moving stock).
  Those use `onSubmit={() => {}}` plus `actions=[…]`, so only the button fires them. Inputs
  embedded inside a form (a row you add, a search box) must not save the parent on Enter: call
  `e.preventDefault()` on Enter in that input (the shell skips events that are already prevented).
- **Pure logic lives in `lib/`:** the kit's in `lib/forms/`; for money, cash, desks, board, patients
  and stock, each form's checks go in `lib/<area>/<form>-missing.ts` with a test (rule 5).

### 9. Live screens, and the one that stays the reference

| Screen | Route | Lives in | Status |
| --- | --- | --- | --- |
| Patient desk | `/boards/patient-desk` | `components/patient-desk/*`, `hooks/use-patient-day.ts` | **The reference.** Where new frontdesk work happens. |
| Old frontdesk | `/boards/frontdesk` | `components/frontdesk/frontdesk-board.tsx` | **Deprecated — never a reference.** Still routed (`app/(app)/boards/[clave]/page.tsx`, nav manifest), no new work (see its own DEBT comment in `eslint.config.mjs`). |

A secondary view over a live screen — a viewer, panel or modal that shows the same sessions, the
same board, the same flow from somewhere else in the app — reuses that screen's OWN components and
hooks. It never keeps a parallel copy of the data pipeline or the row component, and it never
hardcodes a literal into a prop that should come from that shared pipeline (`sinSaldo={false}` while
the real screen tracks it live is exactly the bug this rule exists to stop). Only the layout/chrome
may differ. Confusing which screen is the reference costs real rework: this rule was written after a
viewer got built against the deprecated frontdesk (cmr-fe #139, 18-nov-2026) and had to be redone
against patient-desk's `usePatientDay`/`useServiceBoards`/`ServiceSessionsTable` instead. When in
doubt about which screen governs, this table is the answer — not grep, not git history.

### 10. UI: one visual language, built from the kit

The app grew screen by screen, each with its own idea of a card: **153 files** under `app/` and
`components/` hand-roll `rounded-md bg-card ring-1 ring-foreground/10 shadow-[rgba(16,32,64,0.06)]`,
every status is the same grey pill, and empty, loading and error states look different on every
tab. The result reads as a dozen apps stitched together. The patient record (cmr-fe #141) was rebuilt
as the **reference implementation**: `app/(app)/patients/[id]/layout.tsx` and
`components/clientes/ficha-*.tsx`. Copy from there, not from the file next door.

**Use the building blocks; do not re-roll them.**

| Need | Use | Never |
| --- | --- | --- |
| Page frame | `PageContainer` / `PageHeader` (`components/ui/page.tsx`) | ad-hoc page padding or `<h1>` |
| A section of a screen | `Panel` (`components/kit/panel.tsx`): titled header row, `actions`, content under a hairline | a hand-rolled `ring-1 … shadow-[rgba…]` box |
| A full-page list | `DataTable` (`components/kit/data-table.tsx`): columns, pagination, skeleton | a bare `<table>` |
| A table inside a section | `RecordTable` / `Th` / `Td` (`kit/panel.tsx`) | per-file `Th`/`Td` copies |
| A row of numbers | `StatGrid` + `Stat` (`kit/panel.tsx`): one card divided into cells | one boxed card per number |
| A status | `StatusBadge` (`components/kit/status-badge.tsx`): tone by meaning, label from the catalogue | `<Badge variant="secondary">{status}</Badge>`, a raw enum on screen, a per-screen colour |
| Empty / error / loading | `EmptyState` / `ErrorState` / `LoadingPanel` (`kit/panel.tsx`), `kit/skeletons.tsx` | "Cargando…" text where a skeleton fits; a bare red `<p>` |
| Forms and dialogs | rule 8 | — |

A new status value gets its tone **once**, in `kit/status-badge.tsx`: done = success (green),
in progress / upcoming = info (blue), needs attention = warning (amber), cancelled / voided =
destructive (red), neutral = secondary.

**Hierarchy and actions.**
- **One primary button per region**: the thing the screen is for (Editar on a record). Everything
  else is `outline` or `ghost`.
- **Destructive or rare actions go in a ⋮ `DropdownMenu`** and confirm with `useConfirm()`. They are
  never a permanent red button next to Edit.
- An action that edits a section sits in that section's `Panel` header.
- **Tabs:** a screen's top-level tabs use `variant="line"` (underlined, full width; the URL holds the
  tab via `useTabRoute`). The default segmented control is for switching a view *inside* a section
  (Visitas / Compras, Todas / Próximas / Anteriores), never for page navigation.

**Tokens, not values.**
- Cards: `rounded-xl border bg-card shadow-xs`, inner padding `px-5`, vertical rhythm `space-y-6` /
  `gap-6`.
- Section titles: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.
- Field labels: `text-[11px] font-medium uppercase tracking-wide text-muted-foreground`; values
  `text-sm`.
- Every number, date, money amount and count is `tabular-nums`.
- Colour comes **only** from theme tokens (`primary`, `muted`, `success`, `warning`, `info`,
  `destructive`). No hex, no `rgba(…)`, no raw palette (`text-green-600`): those break dark mode.

**Honest data.**
- A missing value is a muted "—". It is never a guess, and never placeholder text that reads as a
  fact.
- If the backend has no source for a field, the UI does not show the section. The record used to
  print "Sin alergias conocidas" for every patient with nothing behind it; #141 removed it, and
  this app does not hold allergies, alerts or implants.
- An empty state names what is missing. It never hides a sibling section that does have data
  (Asistencia once hid a patient's purchases because they had no visits).

**Layout.**
- Use the whole width: two- or three-column grids on `lg:` that collapse to one column on mobile.
- It must still work at **375px**: tables scroll inside their card (`overflow-x-auto`), tab strips
  scroll, header actions wrap.
- **Skeletons copy the real chrome**: the same borders, card header rows and tab rule, with bars
  where the data goes (`components/clientes/patient-record-skeleton.tsx`,
  `docs/specs/2026-10-10-skeletons-de-carga.md`). Never grey slabs.

**Migrating the rest (`npm run lint`).** The hand-rolled card (`ring-foreground/10` or
`shadow-[rgba(…)]` in a class string) is a lint **error** everywhere except `components/ui/**` and
the files listed in `eslint/legacy-card-files.mjs`.
- That list was taken on 18-nov-2026 (154 files) and **may only shrink**, like `DEBT`.
- `lib/lint/legacy-card-files.test.ts` fails while a listed file is already clean, so moving a file
  onto the kit means deleting its line in the same commit.
- Adding a file to the list is admitting debt and gets discussed with the owner.
- When you touch a listed screen, move **the region you touch** onto the kit. Never add a new
  hand-rolled card next to old ones "for consistency with the file".

**Done means seen.** Typecheck does not see layout. Before calling a UI change finished, look at it
in a browser:
- light **and** dark theme
- desktop **and** ~375px wide
- the loading, empty and error states, not only the happy path

Put the before/after screenshots in the PR.

## Things worth knowing about the code

- **`lib/env.ts` throws on import** if `NEXT_PUBLIC_SUPABASE_URL` or
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing. That is why the CI build passes fake credentials:
  compiling never calls Supabase or the API.
- **`lib/api/client.ts`** is the only door to the backend: `apiFetch` prefixes `/api/v2`, unwraps
  `.data` from the `{ data, meta }` envelope and throws `ApiError`. If the backend changes the
  envelope, it changes here. `apiFetchV1` is the narrow exception documented in rule 6.
- **The browser Supabase client is a singleton on purpose** (`lib/supabase/client.ts`): recreating
  it on every call left `autoRefreshToken` unrun and the session died after ~15 minutes. Do not turn
  it back into a factory.
- **Tenancy**: the active center travels as `X-Tenant-ID`, taken from
  `session.user.app_metadata.clinic_id`.
