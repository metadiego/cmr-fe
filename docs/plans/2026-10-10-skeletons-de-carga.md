# Plan — Skeletons de carga (Control de Citas + Servicios)

Spec: `docs/specs/2026-10-10-skeletons-de-carga.md`. Rama `feat/page-skeletons` (sobre `main`).

## Revisión del código (2026-10-10)

- Todo carga con `useResource` (`hooks/use-resource.ts`): `loading | ok | fail`, `reload()` vuelve a
  `loading`, `refresh()` es silencioso. No hay react-query ni `loading.tsx`.
- `Skeleton` de shadcn existe (`components/ui/skeleton.tsx`) y casi no se usa.
- Tablas: `components/ui/data-table.tsx` (marco + `TableLoading` de una fila), `components/kit/data-table.tsx`
  (`DataTable<T>` por columnas; en `loading` pinta un `<p>` y oculta la tabla) y varias `<table>` crudas.
- Estado de carga actual por pantalla: «Cargando…» en `cupos-config.tsx`, `festivos-config.tsx`,
  `resources-config.tsx`, `generic-board.tsx`, `frontdesk-board.tsx`, `patient-desk.tsx`,
  `service-sessions-table.tsx`, `therapy-day-scheduler.tsx`, `cambio-protocolo-form.tsx`; «…» en
  `panel-enfermeria.tsx`; nada (rejilla vacía) en `medicas-calendar.tsx`, `servicios-calendar.tsx`,
  `calendario.tsx` — estos dos primeros además hacen `reload()` cada 20 s.
- Techos DEBT: `frontdesk-board.tsx` 843 (lleno) → cualquier skeleton suyo va en archivo aparte.

## Pasos

1. **Kit** `components/kit/skeletons.tsx`: `LoadingRegion` (aria-busy + sr-only), `CellSkeleton`
   (formas: text/long/short/avatar/badge/button/dot), `TableRowsSkeleton` (filas bajo un `TableHeader`
   real), `RawRowsSkeleton` (igual para `<table>` cruda), `ControlSkeleton`, `PillsSkeleton`.
2. **Kit `DataTable<T>`**: en `loading` pinta el marco y las cabeceras reales con `TableRowsSkeleton`.
3. **Control de Citas**:
   - `month-calendar.tsx` acepta `loading` → `PillsSkeleton` por celda del mes.
   - `medicas-calendar.tsx` / `servicios-calendar.tsx`: `loading` mientras la primera carga de citas/sesiones;
     Select del catálogo y leyenda con skeleton; el intervalo de 20 s pasa a `refresh()`.
   - `calendario.tsx`: píldoras en mes/semana, filas en día/agenda, sin «sin eventos» mientras carga.
   - Configuración de agenda: tabla de cupos, recursos (kit), festivos con filas skeleton.
   - `generic-board.tsx` / `tablero-dinamico.tsx` (Atención): chips KPI + filas skeleton; sin tabla vacía
     mientras `centros` carga.
   - `therapy-day-scheduler.tsx`: rejilla de botones de hora y resumen del plan.
4. **Servicios**:
   - Frontdesk: `components/frontdesk/frontdesk-skeleton.tsx` nuevo (pestañas, KPI, filas); el board solo lo monta.
   - Patient desk: lista de pacientes + detalle + tablas por servicio.
   - Pacientes: `TableRowsSkeleton` con las 8–9 columnas y contador en skeleton.
   - Panel de Enfermería: secciones con rejilla de tarjetas.
   - Cambio de protocolo: tarjetas de paquetes.
5. Verificación: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; vista previa sin sesión
   de cada skeleton (página temporal `app/zz-*`, se borra antes del commit) a 1280 y 1600 px.
