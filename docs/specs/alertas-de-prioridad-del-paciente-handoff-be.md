# Handoff BE — banderas de prioridad: falta la fila de menú del admin

Contrato base: `docs/specs/alertas-de-prioridad-del-paciente.md` (cmr-be). FE construido contra ese
contrato, verificado en vivo (`/api/v2/patients/priority-flag-types`,
`/api/v2/patients/:id/priority-flags`).

**Actualización 07-oct-2026 — corrección del dueño:** la primera versión de este FE solo dejaba
ver/asignar las banderas desde la FICHA del paciente, tratándolas como si fueran un diagnóstico
archivado. El pedido real es que se vean Y SE APLIQUEN en el momento, en frente del paciente — en
TODO Frontdesk (Consulta y cada servicio), no solo en la ficha. Ya corregido: `PriorityFlagsBadges`
(el mismo componente de la ficha, con su propio fetch del catálogo + de las banderas de ESE
paciente) ahora vive también en la celda del nombre del paciente en Atención
(`components/agenda/tablero-dinamico.tsx`) y en Servicios
(`components/frontdesk/fila-sesion.tsx`) — mismo patrón de fetch-por-fila-visible que ya usa este
código para el saldo de dosis (`saldoByPaciente`), no una llamada nueva al servidor por el hecho de
pintar el tablero. La pieza de "embeber las banderas en las filas del tablero" que se pedía más
abajo deja de hacer falta: cada badge ya resuelve sus propios datos.

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

## Lo que NO se tocó

- El catálogo, las banderas por paciente, y su visualización/aplicación EN LOS TABLEROS (Atención y
  cada pestaña de Servicios) están completos y en producción — ver la actualización de arriba.
- Pendiente real: solo la fila de menú (§1). Nada más se le pide al BE por este handoff.
