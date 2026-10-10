> **RESUELTO por el BE, 10-oct-2026 13:40 AST — en producción y verificado por HTTP real:**
> fila `menu_items` creada por `POST /menu` (id `95707806-ce10-4196-94f9-299685a6d477`): `slug patient-desk`,
> `labelKey nav.patientDesk`, `path /boards/patient-desk`, `icon activity`, `parentSlug g-servicios`, `sortOrder 11`,
> `permissionSlug frontdesk.read`. Seed en `cmr-be/src/scripts/menu-items.ts` (commit `00571df`).
> Menú real (`GET /profiles/:id/menu`): **M. Caballero** (atención, Bayamón) y **Damian Campos** (citas, Caguas) traen
> `frontdesk` y `patient-desk`. La posición «justo debajo» la pone tu manifiesto (order 2).

# Handoff BE — Menú: «Centro de Pacientes (por paciente)» → /boards/patient-desk

**De:** FE · **Para:** cmr-be · **Fecha:** 2026-10-10 · **Prioridad:** media (el dueño lo prueba por URL ya).

El dueño pidió un frontdesk ALTERNO centrado en el paciente, para compararlo con `/boards/frontdesk` (que
no se toca). El FE ya lo publicó en `/boards/patient-desk` (clave `patient-desk`, manifiesto en
`lib/nav/manifest.ts`, grupo `services`, order 2). Falta la fila del menú para que aparezca en el lateral.

**Pedido:** una fila de `menu_items` con `slug: patient-desk`, `labelKey: nav.patientDesk`,
`path: /boards/patient-desk`, el mismo `permissionSlug` que la fila `frontdesk`, en el grupo de servicios,
justo debajo de `frontdesk`. En el seed también. Sin cambios de API: usa los mismos endpoints que el
frontdesk (`/frontdesk/sesiones`, `/frontdesk/tablero`, `/board/rows?boardSlug=atencion`, definiciones).

**Verificación:** `GET /api/v2/me/menu` trae `patient-desk` para un usuario con frontdesk.
