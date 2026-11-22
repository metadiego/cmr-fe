# Appointments booking: Day / Week / Month views and an informative type list

Date: 2026-11-04 · Status: approved by the owner (mockup `views-and-types.html`, option A for the type
list) · Extends `2026-11-04-appointments-booking-calendar-design.md` (that spec still applies; this one
wins where they differ) · Repo: cmr-fe only

## 1. View switcher (Day / Week / Month)

Today the calendar header shows `‹ Hoy ›` next to a month title, which reads as if "Hoy" were the view.
Make it work like Google Calendar:

- Header: `‹  Today  ›` (navigation only; "Today" jumps to today in the current view) · period title
  · on the right a **view menu** button showing the current view (`Week ▾`) with items **Day (D)**,
  **Week (W)**, **Month (M)**. Keyboard shortcuts D / W / M switch view when focus is not in an input,
  textarea, select or contentEditable (same guard as Esc). The Free/Booked switch (medical only) stays.
- **Month**: today's month grid, unchanged.
- **Week**: Monday–Saturday columns (Sunday omitted; the clinic is closed) × hour rows (the hours the
  type's slots use, e.g. 7:00…16:00/17:00). Each cell = free spots in that hour for the chosen type
  (Free) or booked/capacity (Booked, medical only), same colour buckets as the month. Respects
  Any/Morning/Afternoon by hiding rows outside the window. Clicking a cell = picking that day + time
  (same as clicking the time in the day panel: medical → CitaModal; service → service form; moving →
  "Move here?"). Closed/holiday/past columns are greyed. ‹ › move one week.
- **Day**: one day, large: Morning / Afternoon grids of times (the existing day-panel content, bigger),
  plus "Booked that day" is out of scope (no list endpoint wired) — keep "Open full day ›". ‹ › move one
  day, skipping nothing (a closed day shows "Closed").
- In Week and Day views the separate right-hand day panel is not shown when it would duplicate the main
  area: Week keeps the day panel (it shows the picked cell's day and hosts the form / Move box); Day view
  hosts the form / Move box itself.
- URL keeps `view=day|week|month` (default month). Next free strip stays in all views.
- Data: Week = the 6 days' availability (same per-day hook/cache); Day = one day.

## 2. "What are we booking?" as a searchable list with the next opening (option A)

Replace the coloured-dot grid of buttons with a **list**:

- A search box at the top filters by name as you type (accent- and case-insensitive).
- Groups: **Medical** then **Services**. With a patient selected, services the patient has package
  sessions for come first in their own group "Ana's packages" (name from the patient), then the rest.
  Within a group: the configured order.
- Each row: thin colour bar on the left (the type's colour, as an accent only), **name** (bold),
  a meta line (duration in minutes when known; for medical "with doctor" when the type requires one;
  for a patient's package "N sessions left" chip), and on the right **"next free"** with the next
  opening (e.g. `Thu 5 · 7:20`, `Today · 3:40`), computed lazily for visible rows from the same
  availability data (scan forward up to 14 bookable days, stop at the first free slot; show a small
  skeleton while loading; "—" when none in 14 days).
- A service with no capacity set up (availability `configured:false`) shows "Not set up for booking",
  dimmed, still selectable (the calendar then shows the existing empty state).
- Clicking a row picks the type (same as today). Keyboard: ↑/↓ moves through rows, Enter picks.
- Requests: "next free" uses the existing cache and concurrency limit; it must not fire for rows
  filtered out by the search.

## Non-goals

Year / Schedule / 4-day views; per-doctor columns; drag-and-drop.
