# Plan FE: Rol de acceso, Funciones y Horario (PR 2 del programa)

Spec / contrato: `docs/specs/rol-de-acceso-funciones-y-horario-handoff-be.md` (handoff del BE, al día 28-nov).
Programa: `cmr-be/docs/plans/role-functions-and-learning-schedule.md` §PR 2. Rama `feat/role-functions-screens`.

## 0. Decisión del dueño que cambia el handoff (27-nov)

Los **puestos de trabajo sin permisos** (`doctor`, `nurse`, `technician`, `cashier`, `accounting`) ya no se
enseñan en «Rol de acceso». Para que quitar «Técnico» de Funciones no choque con el 409
`functions.backedByPosition`, el **BE** pasa a quitar también el puesto que la respalda en el mismo `PUT
/staff/:id/functions` (PR del BE aparte, `feat/functions-drop-job-position`; se mezcla ANTES que este). Con
login, si eso cambia los centros donde trabaja y quien guarda no es admin: 403
`positions.accessChangeNeedsAdmin` (ya traducido).

## 1. Lo revisado en el código (base de este plan)

- Ficha: `app/(app)/configuration/staff/page.tsx` (`FichaPersonal`, pestañas Ficha / Disponibilidad / …),
  un solo «Guardar» por `components/personal/save-group.tsx` (`useSaveSection`).
- Puestos hoy: `components/personal/staff-positions-section.tsx` + `positions-picker.tsx` +
  `lib/personal/positions.ts` (+ tests). El PUT manda la lista COMPLETA: lo oculto se tiene que reenviar.
- Agenda hoy: `components/personal/medico-disponibilidad.tsx` › `Horarios`: lee `?doctorId=` sin centros,
  escribe sin `centerId` (cae en el centro de la sesión: el error que el handoff §2.3 describe) y pide
  `citas.config`. Se reemplaza.
- `lib/api/schema.d.ts` regenerado contra producción: ya tiene `/functions`, `/staff/{id}/functions`,
  `/staff/{id}/day-changes`, `/staff/{id}/home-center`.
- Configuración: el índice pinta solo lo que manda `/me/menu`; la ruta nueva entra en
  `lib/nav-manifest.ts` (paleta del editor de menú) y en `SECCIONES`. **Un admin la añade al menú** desde
  Configuración › Menú (como se hizo con nursing-statuses).

## 2. Lógica pura en `lib/` (TDD, `npm test`)

| Archivo | Qué |
|---|---|
| `lib/personal/functions.ts` | etiqueta (`labelKey` → `t`, si no `name`); agrupar Servicios / Tareas en `sortOrder`; qué se ofrece (activas + las que ya tiene); alternar; ¿cambió?; cuerpo `{ functions }`; ¿es médico / recepción? (sustituye a `capabilities` en la ficha) |
| `lib/personal/access-roles.ts` | qué puestos son «Rol de acceso» (no son puesto de trabajo = slug con función homónima y 0 permisos; fuera `read_only` y `facturacion-inventario` salvo que ya los tenga); cuerpo del PUT que **reenvía intactos** los puestos de trabajo ocultos |
| `lib/personal/schedule.ts` | separar filas propias / del centro; agrupar por día (Lun→Dom); validar horas; plan de «mover a otro centro» (crear + desactivar) |
| `lib/personal/day-changes.ts` | validar (con centro: horas las dos o ninguna; sin centro: sin horas; no pasado) y cuerpo |
| `lib/personal/home-center.ts` | opciones y si el selector se puede tocar (`staff.update` en el actual) |

## 3. API (`lib/api/`)

- `functions.ts`: `getFunctions(includeInactive)`, `createFunction`, `updateFunction`, `getStaffFunctions`,
  `setStaffFunctions` (tipos desde `schema.d.ts`).
- `staff-schedule.ts`: `getStaffSchedule(staffId, centerIds)`, `createScheduleRow`, `createScheduleRows`
  (bulk), `updateScheduleRow`, `deactivateScheduleRow` — siempre con `centerId` en el cuerpo y el centro de
  la fila como tenant.
- `day-changes.ts`: `getDayChanges`, `setDayChange`, `deleteDayChange`.
- `personal.ts`: `setHomeCenter(staffId, centerId)`.

## 4. Pantallas (cada archivo < 600 líneas)

En la ficha (pestaña «Ficha», un solo «Guardar»):
1. **Centro de origen** (`home-center-field.tsx`): selector con los centros activos donde quien mira tiene
   `staff.update`; deshabilitado con su porqué si no lo tiene en el actual. Sección `home-center`.
2. **Funciones** (`staff-functions-section.tsx`): chips Servicios / Tareas con «Presencial / Para cualquier
   centro» a la vista; edita quien tiene `staff.update` en el centro de origen. Sección `functions`.
3. **Rol de acceso** (`staff-positions-section.tsx` reducido): solo admin; solo roles de acceso.

La pestaña «Disponibilidad» pasa a «Horario»:
4. **Horario** (`staff-schedule.tsx`): Lun→Dom, cada fila con su centro, horas, cambiar / quitar; añadir a
   varios días a la vez (bulk); filas del centro marcadas «Horario general del centro», solo lectura.
   Escribe al momento (como hoy), pide `staff.update` en el centro de la fila.
5. **Cambios de un día** (`staff-day-changes.tsx`): lista desde hoy, alta (fecha, centro o «No viene»,
   horas opcionales, nota) y baja.
6. Ausencias y «próxima fecha» se quedan como están.

Configuración › Funciones (`app/(app)/configuration/functions/page.tsx`): tabla del catálogo (etiqueta,
tipo, servicio, lugar, activa, orden), editar en línea, alta en diálogo. Solo acceso total (`rbac.*`).

## 5. Lo que se va con este PR

- Las pestañas «Agenda / Pacientes / Producción» y «Especialidad» y las preferencias de Consulta dejan de
  leer `capabilities` / `job_title`: leen Funciones (`doctor`, `front_desk`), con lo ya guardado visible.
- `lib/personal/responsibilities.ts` se recorta a lo que quede en uso (sin borrar tests en silencio).
- i18n es + en: `functions.*` (catálogo y errores), `dayChanges.*`, `staff.unknownCenter`, textos nuevos.

## 6. Verificación

`npm run typecheck && npm run lint && npm test && npm run build`. En navegador (local contra el BE local
con la rama del BE): admin y gerente de un centro, claro/oscuro, 375 px: Funciones guarda y quitar Técnico
quita el puesto; Horario crea en el centro elegido, mueve de centro, quita; cambio de un día; centro de
origen; Configuración › Funciones.

## 7. Orden de salida

BE `feat/functions-drop-job-position` → producción → este PR. Después del merge, un admin añade
«Funciones» al menú de Configuración.
