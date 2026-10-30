# Plan — pestañas como rutas

Spec: `docs/specs/pestanas-como-rutas.md`. Rama `feat/deep-links-sections-tabs`, apilada sobre la del
PR #112 (comparten `facturacion-con-tabs.tsx` y la miga del shell).

## Revisión del código (antes de tocar nada)

- Pestañas con `?tab=`: `components/facturacion/facturacion-con-tabs.tsx`,
  `app/(app)/scheduling/appointments/page.tsx`, `app/(app)/admin/page.tsx`.
- Pestañas sin URL: `app/(app)/patients/[id]/page.tsx` (`defaultValue="resumen"`).
- Enlaces internos a `?tab=servicios`: `frontdesk-board.tsx`, `patient-desk.tsx`,
  `service-day-view.tsx`, `servicios-calendar.tsx`; el día de servicios lo decidía
  `scheduling/appointments/[date]/page.tsx` leyendo `?tab=`.
- Ruta hermana dinámica: `billing/invoices/[id]` y `scheduling/appointments/[date]` → las pestañas ahí
  son carpetas estáticas (ganan a la dinámica), no `[tab]`.
- Shell: `components/app-shell.tsx` decide título/miga comparando el path con el menú.

## Pasos

1. TDD: `lib/nav/tab-routes.test.ts` (9 casos: ruta por defecto, segmento, id dinámico, páginas de
   debajo que no son pestañas, pestaña de otra pantalla, href con query, `?tab=` viejos, shell) →
   `lib/nav/tab-routes.ts`.
2. `hooks/use-tab-route.ts` y `components/kit/tab-page.tsx`.
3. Facturación: `page.tsx` → `(tabs)/layout.tsx` + páginas `returns`/`cash`/`stats`; Consultas igual
   (`returns`/`cash`). `FacturacionConTabs` usa el hook.
4. Citas: `(calendars)/layout.tsx` + `services/page.tsx`; nueva `services/[date]/page.tsx`; `[date]`
   redirige el `?tab=servicios` viejo; enlaces internos a las rutas nuevas.
5. Admin: `layout.tsx` + `[tab]/page.tsx` (valida, si no redirige).
6. Paciente: `layout.tsx` + `[tab]/page.tsx` (valida, si no redirige); pestaña no permitida → Resumen.
7. Shell: `screenPathOf` para el título.
8. `next.config.ts`: redirecciones de las páginas standalone viejas.
9. Puerta de CI: typecheck, lint, test, build.
