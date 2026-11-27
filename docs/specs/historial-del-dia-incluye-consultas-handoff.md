# Handoff FE — «Historial del día» incluye las consultas (parte 1)

**Fecha:** 27-nov-2026 · BE: rama `feat/consultation-change-log` de `cmr-be`
(spec `cmr-be/docs/specs/historial-del-dia-incluye-consultas.md`).

## Qué cambió en el BE

- Las **consultas** (citas médicas) ahora quedan en el registro de cambios, con
  `entityType: 'appointment'`. «Historial del día» (`GET /change-log?patientId&date`) las devuelve
  junto a las sesiones de terapia, sin cambiar la llamada.
- **Cada entrada trae `undoable: boolean`.** Es `false` para `appointment`: el deshacer de una
  consulta es la parte 2, y hoy el BE responde 400 `CHANGE_NOT_UNDOABLE`. Es `true` para los tipos
  que ya se deshacen (sesiones, etc.).
- En `before`/`after` de una consulta, los ids llegan con su nombre al lado: `medicoId` →
  `medicoNombre`, `callcenterId` → `callcenterNombre`, `enfermeraVitalesId` →
  `enfermeraVitalesNombre`, `tipoCitaId` → `tipoCitaNombre`. Ya lo resuelve `nameKey` por la regla
  `Id → Nombre` (`lib/change-log/entry.ts`).

## Qué hay que hacer en el FE

1. **No ofrecer «Deshacer» si no se puede.** En `canUndo` (`lib/change-log/entry.ts`), devolver
   `false` cuando `e.undoable === false`. Un `undefined` (un BE anterior) sigue como hoy. Tipar
   `undoable?: boolean` en `ChangeLogEntry` (`lib/api/change-log.ts`, o con `gen:api`). Test en
   `lib/change-log/`.
2. **Decir que es la consulta.** En `components/change-log/change-log-list.tsx`, una entrada con
   `entityType === 'appointment'` lleva una marca «Consulta» junto a la acción (i18n
   `changeLog.entity.appointment`: «Consulta» / «Consultation»).
3. **Etiquetas nuevas** en `messages/es.json` y `messages/en.json` (las dos a la vez).
   - **Acciones** `changeLog.action.*`:

     | clave | es | en |
     |---|---|---|
     | `confirm` | Confirmada | Confirmed |
     | `unconfirm` | Sin confirmar | Unconfirmed |
     | `start_triage` | En triage | In triage |
     | `start_consultation` | En consulta | In consultation |
     | `no_show` | No se presentó | No-show |
     | `portfolio_fill` | Cartera asignada | Portfolio filled |

     Ya existen y se reusan: `create`, `present`, `undo_present`, `back_to_present`, `attend`,
     `unattend`, `cancel`, `reopen`, `reschedule`, `edit`, `delete`, `status`.
   - **Campos** `changeLog.field.*`:

     | clave | es | en |
     |---|---|---|
     | `llegadaEn` | Llegada | Arrival |
     | `vitalesEn` | Vitales | Vitals |
     | `horaInEn` | Entró a consulta | Consultation start |
     | `horaOutEn` | Salió de consulta | Consultation end |
     | `confirmadaEn` | Confirmada | Confirmed at |
     | `enfermeraVitalesId` | Enfermera de vitales | Vitals nurse |
     | `callcenterId` | Agente | Agent |
     | `tipoCitaId` | Tipo de cita | Appointment type |
     | `motivo` | Motivo | Reason |
     | `notas` | Notas | Notes |
     | `horaFin` | Hora fin | End time |
     | `esPrimeraVez` | Primera vez | First visit |
     | `registradaTardeEn` | Registrada tarde | Recorded late |

     `estado`, `fecha`, `hora` y `medicoId` ya existen.
   - **Valores de estado:** `estado` de una consulta trae palabras médicas (`programada`,
     `confirmada`, `presente`, `triage`, `en_consulta`, `atendida`, `no_show`, `cancelada`,
     `reprogramada`). Hoy `changeLog.status.*` solo tiene las de terapia (`pendiente`, `presente`,
     `en_terapia`, `asistido`, `cancelada`): faltan `programada`, `confirmada`, `triage`, `en_consulta`,
     `atendida`, `no_show` y `reprogramada`.

## Cómo se comprueba

- En una consulta de hoy, marcar presente y deshacer la llegada.
- «Historial del día» del paciente muestra dos entradas marcadas «Consulta» («Presente» y «Deshacer
  presente»), con quién y a qué hora, **sin** botón «Deshacer».
- Una sesión de terapia sigue con su «Deshacer».
