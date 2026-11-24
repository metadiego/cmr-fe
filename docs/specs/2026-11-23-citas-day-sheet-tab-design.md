# Citas: «Agenda del día» tab — design (next PR, draft)

Date: 2026-11-23 · Status: **draft, to be finished before building** (follows the appointments booking
upgrades PR, `2026-11-23-appointments-booking-upgrades-design.md`).

## What the owner asked (2026-11-23)

"For the Citas page, show something like the current `/scheduling/appointments/2026-11-24` page. The current
appointments detail page should be what's shown in Citas, but with better UI."

Decisions taken in conversation:
- **Placement:** a **tab inside Citas** (`/scheduling/appointments`). Citas gets two tabs: **«Agenda del día»**
  (the day sheet, redesigned) and **«Agendar»** (today's booking screen). The URL holds the tab.
- **Timing:** its **own PR**, after the booking upgrades PR merges.

## Today

- Citas = `/scheduling/appointments` → `components/appointments-booking/booking-screen.tsx` (booking only).
- The day sheet = `/scheduling/appointments/[date]` → `app/(app)/scheduling/appointments/[date]/page.tsx` →
  `components/agenda/dia-view.tsx` (605 lines; KPIs/chips `dia-kpi`, slot sections by type
  `franja-tipo-section`, focus banner, live stream `use-cita-stream`, per-center selector, CitaModal for
  create/edit, EHR gate host, board transitions from `getDefinicion`). The booking screen links to it from the
  day panel ("Abrir el día completo").

## Proposal (to confirm when this PR starts)

- Tabs with `variant="line"` and `useTabRoute` (CLAUDE.md rule 10); tab slugs in `lib/nav/tab-routes.ts`.
- «Agenda del día» **reuses the day sheet's own data pipeline and hooks** (`getAgendaDia`, `useCitaStream`,
  `useAgendaCenter`, …) — CLAUDE.md rule 9: a second view of a live screen never keeps a parallel pipeline.
  Only the layout/chrome is redesigned, on the kit (`Panel`, `StatGrid`/`Stat`, `StatusBadge`,
  `EmptyState`/`ErrorState`/skeletons), whole width, works at 375px.
- A day picker (‹ today ›) in the tab; `/scheduling/appointments/[date]` keeps working by opening the tab on
  that date (old links and bookmarks).
- From the day sheet, "book" actions open the «Agendar» tab preset to that day/patient instead of a separate
  form; created bookings end in the success dialog (already app-wide).
- `dia-view.tsx` is at the 600-line ceiling: the redesign splits it.

## Open — ask the owner at the start of that PR

1. **"Better UI": what is wrong with the current day sheet?** (what reception looks for first: who's next,
   who arrived, gaps, by doctor or by type?) — this decides the layout; ideally screenshots of what they dislike.
2. Default tab when opening Citas: «Agenda del día» or «Agendar»?
3. Does the day sheet keep its per-center selector, or follow the booking screen's center?

## Next steps

Brainstorm the open questions → finish this spec → plan in `docs/plans/` grounded in a review of `dia-view.tsx`
and its components → build with TDD, browser QA in light/dark and 375px.
