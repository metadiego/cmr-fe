# Handoff BE — banderas de prioridad: menú + embebido en tableros

Contrato base: `docs/specs/alertas-de-prioridad-del-paciente.md` (cmr-be). FE construido hoy
(06-oct-2026) contra ese contrato, verificado en vivo (`/api/v2/patients/priority-flag-types`,
`/api/v2/patients/:id/priority-flags`). Dos piezas pendientes del lado BE, ninguna bloquea lo ya
entregado.

## 1. Falta la fila de menú para el admin del catálogo

`/configuration/priority-flags` (nueva pantalla, permiso `pacientes.prioridadFlags.admin`) no
tiene `clave` en `menu_items` todavía, así que no aparece en el menú lateral — el índice de
Configuración (`app/(app)/configuration/page.tsx`) solo pinta tarjetas cuyo `route` resuelto
coincide con algo que `GET /me/menu` ya mandó. Hoy se llega por un enlace "Catálogo" metido dentro
del propio selector de banderas (`priority-flags-badges.tsx`), no por el menú — suficiente para
probar, no para que un admin lo encuentre solo.

Pedido: sembrar una fila en `menu_items` (grupo configuración) para esta pantalla. El FE ya tiene
la clave propuesta `config-prioridad-flags` registrada en `lib/nav/manifest.ts` esperando la real
del BE — avisen si usan otra.

## 2. GET de tablero/agenda no trae las banderas del paciente (bloquea la pieza 3 del handoff)

El handoff original pide pintar las banderas "en CUALQUIER tablero donde aparezca el paciente —
Atención, Agenda, Servicios". Hoy, pintar eso exigiría una llamada aparte
(`GET /patients/:id/priority-flags`) POR CADA fila visible — un N+1 real, justo el patrón que este
FE evita en todas partes (ver, por contraste, cómo `sesion.patient` ya trae `medicalRecordNumber`/
`name` embebidos para no repetir esa llamada por fila).

Pedido: que las filas de `GET /board/rows` (tablero `atencion`), `GET /frontdesk/*` (tablero por
servicio) y `GET /appointments` (agenda) embeban, igual que ya hacen con `patient.medicalRecordNumber`/
`.name`, algo como:

```json
"patient": { "id": "...", "medicalRecordNumber": "...", "name": "...",
             "priorityFlags": [{ "slug": "oxigeno", "icon": "oxygen", "color": "blue" }] }
```

Con eso el FE pinta los íconos/badges en las tres pantallas con los datos que YA trae cada fila,
sin ninguna llamada nueva — mismo patrón que el filtro en vivo recién entregado
(HANDOFF-filtro-en-vivo-reciproco-consulta-servicios).

## Lo que NO se tocó

- El catálogo y las banderas por paciente (piezas 1 y 2 del handoff original) están completos y en
  producción: admin del catálogo, asignar/quitar desde la ficha del paciente.
- La pieza 3 (visualización EN LOS TABLEROS) queda pendiente de lo de arriba — no se construyó una
  versión con llamadas por fila a propósito.
