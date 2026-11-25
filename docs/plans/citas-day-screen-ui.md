# Plan: pieza 4 del ciclo de vida de la cita, parte FE (release 4a del BE)

Specs: `docs/specs/citas-day-screen.md` (la pantalla), `docs/specs/appointment-lifecycle-switch-fe.md`
(contrato 4a), `docs/specs/appointment-actions-board.md` (pieza 3). Rama `feat/citas-day-screen-ui`
desde `main`. **El BE 4a no está desplegado**: los tipos nuevos se escriben a mano en `lib/api/` y
`schema.d.ts` se regenera después del despliegue.

## Lo que se leyó antes de planear (estado real del código, 25-nov-2026)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Menú | `lib/nav/manifest.ts` (clave → ruta/grupo/orden), `lib/nav-manifest.ts` (paleta del editor de menú), etiqueta = `labelKey` del ítem del BE (`nav.citas`) | El ítem `citas` lleva a `/scheduling/appointments` (`BookingScreen`). El BE siembra los ítems (`/me/menu`); el FE solo decide grupo y orden. |
| Botones del tablero genérico | `components/tablero/tablero-acciones.tsx` | Filtra `definicion.transiciones` por `fromStatuses` + `permissionSlug` (`can`). Lo usa `generic-board.tsx` para tableros cuya entidad no es `cita`. |
| Casillas del flujo médico | `lib/tablero/toggle-hora.ts` (`resolveToggle`, puro y testeado), usado por `celda-toggle-hora.tsx` y `flujo-atencion.tsx` | Avance/retroceso de Presente / En consulta / Asistido por `fromStatuses`. Las filas de consulta del Patient desk (`consultation-rows.tsx`) pasan por aquí (`TableroDinamico`). |
| Fila de terapia del Patient desk | `components/patient-desk/service-sessions-table.tsx` → `FilaSesion` (`components/frontdesk/fila-sesion.tsx`) → `RowMenu` (`components/frontdesk/row-menu.tsx`) | Pills del flujo (siguiente paso por `estado`), deshacer por `render.revert`, menú por `transiciones` sin formulario, Cancelar dedicado. **Son componentes compartidos**: el tablero deprecado `/boards/frontdesk` también los monta. |
| Menú de la cita médica | `components/citas/cita-actions.tsx` (tabla `ACTIONS` por estado) | Lo monta `CitaModal` en edición y `cita-board.tsx`. Recibe la entidad `Cita` (`GET appointments`), que **no trae** `allowedActions`. |
| Alta de cita médica | `components/agenda/cita-modal.tsx` (`estadoCrear` → `status`), `components/tablero/nueva-cita-modal.tsx` (`status: "confirmada"`), `components/citas/next-appointment-cell.tsx` (`status: "confirmada"`) | Mandan el estado legado. |
| Alta de terapia | `lib/api/frontdesk.ts` (`crearSesion`, `agendarVariosServicios`), `lib/api/resources.ts` (`bookTrain`), `components/patient-desk/therapy-booking-form.tsx` | No mandan nada de confirmación. |
| Tiempo real | `hooks/use-cita-stream.ts` | Un solo bus SSE de citas y sesiones por centro; `onInvalidate` con debounce y poll de seguridad. |
| Centro de la pantalla | `hooks/use-centro-pantalla.ts` + `CentroPantallaSelector` | El patrón único (lo usa `BookingScreen`). |
| "Yo" | `Me.staffId` (`lib/api/auth.ts`), `myStaffId` (`lib/auth/who-did-it.ts`) | El id de personal de la sesión. |
| Zona del centro | `lib/format/fecha.ts` (`todayPR`) | El FE no recibe la zona del centro en `/me/centros-donde-puedo`; todo el FE usa `America/Puerto_Rico`, igual que el default del BE. |
| PR #154 (`feat/lifecycle-actions-screens`, sin mezclar) | `lib/lifecycle/board-action-rules.ts` | Oculta Cancelar/No-show por estado legado. **No está en `main`**: esta rama no lo importa; `allowedActions` lo reemplaza. |

## Decisiones

1. **Orden de despliegue (seguridad):** hasta que 4a esté en producción las filas NO traen
   `allowedActions`. Regla única: *si la fila trae el arreglo (aunque vacío), manda; si no lo trae,
   se usa la regla de hoy*. Así esta rama no rompe nada antes de 4a. La excepción son los altas con
   `confirmed`: los DTO del BE son `forbidNonWhitelisted`, así que **el FE no se mezcla antes de que
   4a esté en producción** (si no, crear una cita da 400). Lo mismo para la pantalla nueva
   (`GET appointments/day` no existe antes de 4a).
2. **Un solo traductor slug → acción** en `lib/lifecycle/allowed-actions.ts`: los tableros siguen
   declarando transiciones por slug (`presente`, `cancelar`…); el slug se ofrece si alguna de sus
   acciones está en `allowedActions` (`cancelar` ↔ `cancel`/`not_serve`). Un slug que no es del
   ciclo de vida (p. ej. una transición propia de otro tablero) sigue la regla del tablero. Se
   siguen mandando los slugs al BE (los acepta igual que las claves), así el clic es el mismo antes y
   después de 4a.
3. **Cancelar sobre una fila llegada** se rotula `lifecycle.action.not_serve` cuando la lista trae
   `not_serve` (mismo diálogo y motivo).
4. **Componentes compartidos con el tablero deprecado** (`FilaSesion`, `RowMenu` en
   `components/frontdesk/`): se tocan solo con props/datos de fila **opcionales**. El tablero
   deprecado no cambia de comportamiento antes de 4a; después de 4a sus filas también traen la lista
   (la sirve el BE), lo que solo puede quitar botones que el BE rechaza. `frontdesk-board.tsx` no se
   toca.
5. **Confirmar terapia** en el Patient desk: entrada «Confirmar» / «Desconfirmar» en el menú de la fila
   cuando la lista la trae (puertas nuevas `frontdesk/sessions/:id/confirm|unconfirm`).
6. **`CitaActions`** recibe `allowedActions` opcional. En la pantalla Citas se pasa la de la fila; en
   el resto (entidad `Cita` sin lista) sigue la tabla de hoy.
7. **Altas con `confirmed`**: el interruptor del modal médico pasa a ser el booleano; se muestra solo si
   la persona tiene `appointments.confirm` **en el centro de destino** (`/me/centros-donde-puedo`), y
   sin ese permiso la cita nace sin confirmar (antes nacía `confirmada` sin chequeo; ahora el BE daría
   403). Terapia: `confirmed` opcional en `crearSesion`, `agendarVariosServicios` y `bookTrain`, con
   casilla en el formulario de terapia del Patient desk.
8. **Menú**: `nav.citas` pasa a decir «Agendar cita» / «Book appointment» (misma clave, misma ruta). La
   pantalla nueva es la clave `appointments-day` → `/scheduling/booked`, grupo `scheduling`, orden 0.5
   (encima de Agendar). **El ítem lo siembra el BE** (`/me/menu`, permiso `citas.read`): hand-off;
   mientras tanto un admin puede darlo de alta desde el editor de menú (la ruta está en la paleta).
9. **Zona horaria**: «ahora» se calcula con la zona del centro si el FE la conoce; hoy no la recibe,
   así que es `America/Puerto_Rico` (igual que el BE para centros sin zona). La función ya acepta la
   zona para cuando llegue.

## Pasos (TDD para todo lo de `lib/`)

1. `lib/lifecycle/allowed-actions.ts` + test: `readAllowedActions`, `slugOffered`, `cancelMeaning`,
   `confirmToggle`, `refusalRefreshesRow`.
2. `lib/tablero/toggle-hora.ts`: parámetro opcional `allowed` (test nuevo; los viejos intactos).
3. `lib/appointments-day/*.ts` + tests: consulta (`dayListQuery` desde fecha/centro/tipo/«reservado
   por»), cubetas de tipo, estado a mostrar (`rowStatus`), agrupación de hoy (`todayGroup`,
   `todaySummary`, `nowInZone`), estado en URL, memoria de «reservado por».
4. `lib/api/appointments-day.ts`: tipo `DayListRow` a mano, `getAppointmentsDay`, puertas
   confirm/unconfirm/cancel de ambos tipos. `lib/api/tablero.ts`: `allowedActions?` en las filas.
   `lib/api/citas.ts`: `unconfirmCita`, `confirmed` en el alta.
5. Pantalla `/scheduling/booked`: `app/(app)/scheduling/booked/page.tsx` +
   `components/appointments-day/*` (barra de filtros, tabla `DataTable`, resumen `StatGrid`, acciones
   de fila, diálogo de motivo, diálogo de mover terapia, editar cita médica con `EditAppointmentModal`).
   Tonos nuevos en `kit/status-badge.tsx` (tipo `lifecycle`).
6. Tableros: `tablero-acciones.tsx`, `celda-toggle-hora.tsx`, `flujo-atencion.tsx` leen la lista de
   la fila.
7. Patient desk: `FilaSesion` / `RowMenu` (pills, menú, cancelar, confirmar terapia).
8. Altas: `cita-modal.tsx`, `nueva-cita-modal.tsx`, `next-appointment-cell.tsx`,
   `therapy-booking-form.tsx`.
9. Menú, catálogos `es`/`en`, `typecheck`, `lint`, `test`, `build`.

## Fuera de esta rama

Check-in por `POST visits/check-in` (4b), el nuevo fin de día (4c), regenerar `schema.d.ts` (después
de desplegar 4a), sembrar el ítem de menú en el BE, `service-booking-form.tsx` /
`recurring-booking-modal.tsx` / `therapy-day-scheduler.tsx` (altas de terapia sin casilla de
confirmar: siguen naciendo sin confirmar, como hoy).

## Cómo quedó (25-nov-2026)

- Lógica en `lib/` con tests: `lib/lifecycle/allowed-actions.ts`, `lib/lifecycle/confirm-on-create.ts`,
  `lib/board/available-transitions.ts`, `lib/appointments-day/day-list.ts`, y `allowed` en
  `lib/tablero/toggle-hora.ts`. Tests: 1412 en `main` → 1449 en la rama, todos verdes.
- Pantalla: `app/(app)/scheduling/booked/page.tsx` + `components/appointments-day/*`; reutiliza
  `CancelAppointmentDialog` (con título/etiqueta opcionales) y `EditAppointmentModal`.
- Tableros: `TableroAcciones`, `CeldaToggleHora`, `FlujoAtencion`. Patient desk: `FilaSesion` con
  `drawFromAllowedActions` (solo lo pasa `ServiceSessionsTable`), `RowMenu` (Cancelar / no atendido,
  Confirmar / Desconfirmar terapia).
- Nota: `TableroDinamico` (y con él `CeldaToggleHora` / `FlujoAtencion`) lo comparten Atención, el
  Patient desk y la pestaña Consulta del tablero deprecado; después de 4a esas casillas siguen la lista
  en los tres. Solo puede ocultar movimientos que el BE ya rechaza. Las filas de terapia del tablero
  deprecado no cambian.
- PR #154 (`lib/lifecycle/board-action-rules.ts`) se mezcló en esta rama (merge, sin rebase). Regla
  única: una fila CON `allowedActions` se dibuja de la lista; una SIN lista (lecturas de entidad:
  pantalla de agendar, calendario, vista día, modal del tablero, cita-board; o un BE antes de 4a) sigue
  las reglas de pieza 3 de #154. Un helper por regla: `cancelMeaning(status, allowed?)` y
  `refusalRefreshesRow` viven solo en `board-action-rules.ts`; `availableTransitions` aplica
  `boardActionView` a filas sin lista; el menú de `CitaActions` es `appointmentMenuFor` (lib, con tests).
- Hand-off al BE: `docs/specs/appointments-day-menu-handoff-be.md` (ítem de menú; orden de despliegue).
- Sin verificar en navegador (la sesión no tiene uno): claro/oscuro, 375px, estados vacío/carga/error.

## Arreglos tras la revisión (25-nov-2026)

- Crear sin interruptor visible (Nueva cita del tablero, celda de próxima cita, walk-in del tablero):
  `confirmed: canConfirmHere !== false` (sin saber → true, como el flujo por estado; falta sabida →
  false) y un toast (`lifecycle.bookedUnconfirmed`) cuando nace sin confirmar por falta del permiso. El
  interruptor explícito se muestra salvo falta sabida, igual en `CitaModal` y `TherapyBookingForm`
  (`confirmToggleShown`). Todo en `lib/lifecycle/confirm-on-create.ts`, con tests.
- Mover sesión: sin hora el BE conserva la actual (`hora ?? sesion.hora`); la ayuda lo dice, y los
  `warnings` de cupo del endpoint salen como en las otras pantallas (`reagendarSesion` lee el sobre con
  `apiFetchEnvelope`; `mostrarAvisos`).
- Menores: `LiveBadge` en la cabecera; «Agendar otra cita» conserva el centro de la fila (`?centro=`) y
  solo aparece con `citas.create`; «Agendado por» no lee «Todos» antes de cargar `me`, y un personal
  recordado que ya no está entre las opciones vuelve a «Yo» (`bookedByChoice`, con tests).
