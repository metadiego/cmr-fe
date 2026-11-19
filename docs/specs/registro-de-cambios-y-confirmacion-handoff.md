# Handoff FE — Registro de cambios (con deshacer) y escudo de confirmación

**BE:** cmr-be, spec `docs/specs/registro-de-cambios-y-confirmacion.md`. Fecha: 10-nov-2026.
**Pantalla principal:** `/boards/patient-desk` (`https://cmr-fe-gamma.vercel.app/boards/patient-desk?date=…`).
Ahí el dueño desasistió por error una sesión el 6-nov y no pudo dejarla como estaba.

> Los nombres de campo que se leyeron de la respuesta real en producción van marcados **[verificado]**;
> los demás salen del código del BE y hay que comprobarlos con la primera respuesta real.

## 1. El escudo: diálogo «¿Aceptar o no?»

- **Cuándo salta:** cualquier llamada protegida puede responder **HTTP 428**:

```json
{ "error": {
  "code": "ACTION_REQUIRES_CONFIRMATION",
  "labelKey": "confirmation.required",
  "action": "frontdesk.unattend",
  "actionLabelKey": "confirmation.action.unattend",
  "effects": ["confirmation.effect.returnsPackageSession", "confirmation.effect.returnsStock", "confirmation.effect.clearsAttendedTime"],
  "params": { "sessionId": "…", "patientId": "…", "serviceId": "…", "date": "2026-11-06", "from": "asistido", "to": "pendiente" }
} }
```

- **Lo que hace el FE (UNA pieza compartida en el cliente HTTP, no un parche por pantalla):**
  1. Al recibir un 428 con ese `code`, muestra un diálogo modal con el título `actionLabelKey`, la lista
     `effects` traducida, y el paciente y el servicio (los tiene en pantalla, o resueltos por
     `params.patientId`/`serviceId`).
  2. Botones **Aceptar** / **Cancelar**.
  3. **Aceptar** repite **la misma petición** (mismo método, URL y cuerpo) con la cabecera
     `X-Confirm-Action: <action>`.
  4. **Cancelar** no hace nada: el BE no escribió nada.
- **Desde `/boards/patient-desk` lo disparan:**
  - **Desasistir** (cualquier acción del menú de la fila que saque una sesión de `asistido`, sea del
    motor o del mostrador), **Cancelar** una sesión **asistida** y **Reabrir/corregir** desde asistido:
    `frontdesk.unattend`;
  - **Eliminar** sesión (`DELETE /frontdesk/sessions/:id`): `frontdesk.delete`;
  - **Cancelar todas** (`POST /frontdesk/patients/:id/day/cancel`): `frontdesk.cancel_day`;
  - **Reparar** (`POST /frontdesk/sessions/:id/repair`): `frontdesk.repair`;
  - **Deshacer presente** (`/frontdesk/patients/:id/undo-present`): `frontdesk.undo_present`.
    **No pregunta** por defecto.
  - **Cancelar** una sesión abierta (`frontdesk.cancel`): **no pregunta** por defecto; el botón sigue
    como está.
- **También en facturación:** anular una factura (`invoice.void`) y anular una devolución
  (`refund.void`) preguntan.
- **Las acciones de `POST /board/action` (motor de tableros) pasan por lo mismo:** el interceptor del
  cliente las cubre sin código por acción.

**Configurar qué pregunta (pantalla nueva, Configuración → «Confirmaciones»,
`/configuracion/confirmaciones`):**
- `GET /api/v2/confirmation-policies?centerIds=…` devuelve
  `[{ key, labelKey, requiredByDefault, centers: [{ clinicId, required, isDefault }] }]`.
- `PUT /api/v2/confirmation-policies/:actionKey` con `{ required: boolean, centerIds: [uuid] }`.
  Necesita `confirmation_policies.manage` (configuración delicada).
- **Interfaz:** una tabla con una fila por acción, una columna por centro y un interruptor.

## 2. Historial de cambios (leer y deshacer)

**Endpoint:** `GET /api/v2/change-log`. Pagina como siempre (`data`, `meta.pagination`).

**[verificado]** con una respuesta real de producción, Caguas, 10-nov 14:03:
- campos de cada entrada: `action`, `actorKind`, `actorName`, `actorProfileId`, `actorRef`,
  `actorStaffId`, `businessDate`, `changeSet`, `clinicId`, `clinicName`, `createdAt`, `entityId`,
  `entityType`, `id`, `localTime`, `patient`, `patientId`, `reason`, `requestId`, `undoesEntryId`,
  `undoneAt`, `undoneByName`, `updatedAt`;
- `patient` lo añade el BE con el récord del paciente;
- `changeSet` trae `fields`, `before` y `after`;
- ejemplo: `action:"start_therapy"`, `actorName:"Eduardo Ortiz Rodriguez"`,
  `localTime:"2026-11-10 14:03:27"`, `changeSet.fields:["estado","terapiaInEn"]`.

`GET /api/v2/confirmation-policies` **[verificado]** devuelve las 9 acciones con su estado por centro.

**Filtros** (en la petición): una sesión (`entityType=frontdesk_session&entityId=<sesión>`), el día de
un paciente (`patientId=…&date=YYYY-MM-DD`), un usuario (`actorStaffId=…` o `actorProfileId=…`), un
periodo (`from`/`to`, ISO), `page`/`limit` (≤ 200) y `centerIds`.

**Cada entrada trae:**

| Campo | Qué es |
|---|---|
| `id` | |
| `clinicId`, `clinicName` | Centro. |
| `entityType`, `entityId` | Qué fila cambió. |
| `action` | Etiqueta `changeLog.action.<action>`. Valores: `create`, `present`, `undo_present`, `start_therapy`, `back_to_present`, `back_to_pending`, `attend`, `unattend`, `cancel`, `reopen`, `reschedule`, `edit`, `delete`, `status`. |
| `actorKind` | `user`, `api-key` o `system` («Sistema»). |
| `actorName` | El nombre que se muestra, ya resuelto. |
| `actorStaffId`, `actorProfileId` | |
| `localTime` | «2026-11-06 19:31:54», **ya en la hora del centro**: mostrarlo tal cual. |
| `createdAt` | ISO. |
| `patientId`, `businessDate` | |
| `reason` | |
| `requestId` | |
| `undoesEntryId` | Si esta entrada fue un deshacer, cuál deshizo. |
| `undoneAt`, `undoneByName` | |
| `changeSet` | `{ fields: string[], before: {...} \| null, after: {...} \| null }`. Las claves de `before`/`after` y de `fields` son las propiedades de la sesión **tal como las guarda la tabla**, iguales en v1 y v2: `estado`, `presenteEn`, `terapiaInEn`, `asistidoEn`, `productoAplicadoId`, `cantidad`, `enfermeraId`, `tecnicoId`, `medicoId`, `datos`, `fecha`, `hora`, `paqueteId`… Etiquetarlas con `changeLog.field.<nombre>`. Los ids (dosis, enfermera…) resolverlos con los catálogos que ya tiene la pantalla. |

**Dónde se ve:**
1. **En `/boards/patient-desk`**, en el menú de cada fila: **«Historial de cambios»** abre un panel
   lateral con `entityId` = la sesión. Lista cronológica: hora, quién, acción y «antes → después» de
   cada campo de `fields`, con un botón **Deshacer** en cada entrada no deshecha. En el detalle del
   paciente, un **«Historial del día»** con `patientId` + `date`.
2. **Pantalla nueva «Historial de cambios»** (Monitoreo, `/monitoring/change-log`, permiso
   `change_log.read`): filtros por usuario (selector de personal), por paciente y por fechas, a pantalla
   completa.

**Deshacer:** `POST /api/v2/change-log/:id/undo` con `{ "reason": "…" }`.
- Primero responde **428** (`change_log.undo`): mostrar el diálogo y repetir con
  `X-Confirm-Action: change_log.undo`. Los pasos que eso desencadena no vuelven a preguntar.
- Deshace **el clic entero** al que pertenece la entrada.
- **Errores:**
  - **409 `CHANGE_SUPERSEDED`**, con `fields`: alguien cambió esos campos después; deshacer primero el
    cambio posterior. Mensaje: `changeLog.error.superseded`.
  - **409 `CHANGE_ALREADY_UNDONE`**.
  - **400 `CHANGE_NOT_UNDOABLE`**.
- **Permiso:** `change_log.undo`, que se concede explícitamente (supervisores). **Ocultar el botón sin
  ese permiso.**
- **Una sesión borrada** aparece en el historial como `delete`. Deshacerla la **restaura** con su
  historial: es el «Restaurar».

## 3. Claves i18n nuevas (es/en)

- **Mensajes del escudo:** `confirmation.required`, `confirmation.unknownAction`.
- **Acciones protegidas:** `confirmation.action.unattend`, `.deleteSession`, `.cancelDay`, `.repair`,
  `.cancelSession`, `.undoPresent`, `.undoChange`, `.voidInvoice`, `.voidRefund`.
- **Efectos:** `confirmation.effect.returnsPackageSession`, `.returnsStock`, `.clearsAttendedTime`,
  `.sessionDeleted`, `.cancelsOpenSessionsOfTheDay`, `.redoesDischarge`, `.sessionCancelled`,
  `.backToPending`, `.invoiceVoided`, `.refundVoided`.
- **Historial:**
  - `changeLog.action.*` (una por acción de la tabla de arriba);
  - `changeLog.field.*`, como mínimo `estado`, `presenteEn`, `terapiaInEn`, `asistidoEn`,
    `productoAplicadoId`, `cantidad`, `enfermeraId`, `tecnicoId`, `medicoId`, `datos`, `fecha`,
    `hora`, `paqueteId`, `vialAbiertoId`;
  - `changeLog.error.superseded`, `.alreadyUndone`, `.notUndoable`.
- **Menú:** `nav.changeLog`, `nav.confirmationPolicies`.

## 4. Menú

Las filas `change-log` y `confirmation-policies` las crea el BE con `POST /menu` (detalles en
`src/scripts/menu-items.ts`). Si al terminar no aparecen en `/me/menu`, crearlas igual que la de
«Medidas sin vincular».

## 5. La bitácora de TODA la API (`/auditoria`), solo lectura

`audit_logs` **ya registra** cada POST/PUT/PATCH/DELETE con éxito de todos los módulos (v1, v2 y MCP):
**[verificado]**, 3,303 en 3 días en producción.

**Lo que cambia para la pantalla `/auditoria`:**
- **Quién:** en cada fila, `usuarioNombre`; una llave de API sale como «API: <nombre>». Mostrarlo en vez
  del uuid.
- **Filtros:**
  - nuevo: `entidadId` (una sesión, una factura…);
  - los que ya había: `userId` (id de autenticación), `desde`/`hasta`, `dominio`, `accion`, `metodo`,
    `soloCambios=true` (solo escrituras) y `centerIds`.
- **Antes/después de una fila:** `GET /api/v2/change-log?requestId=<requestId de la fila>`. Hoy trae
  datos para las sesiones de frontdesk; para el resto de dominios llega vacío por ahora, y entonces la
  fila solo dice qué se hizo, sin el detalle.
- **Hora:** `createdAt` es UTC; mostrarla en la hora del centro (America/Puerto_Rico).
