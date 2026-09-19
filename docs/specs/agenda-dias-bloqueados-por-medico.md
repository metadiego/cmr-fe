# Agenda: días bloqueados por médico (ausencias + próxima fecha válida) — listo en el BE

El backend ya sirve la regla completa. **Desplegado y probado por HTTP contra producción**
(18-sep-2026). Falta la pantalla.

Contexto: en Caguas el Dr. Ocasio libra los lunes y las citas automáticas caían justo ahí. La regla
vive en el servidor para que ninguna vía se la salte.

## La pregunta que resuelve todo

```
GET /api/v1/disponibilidad/proxima-fecha-valida?doctorId=<uuid>&date=2026-09-21
GET /api/v2/availability/next-available-date?doctorId=<uuid>&date=2026-09-21
```

Respuesta real de producción:

```json
{
  "doctorId": "107e113d-…",
  "askedDate": "2026-09-21",
  "date": "2026-09-23",
  "moved": true,
  "reason": "vacation",
  "exhausted": false,
  "labelKey": "citas.bloqueo.vacation"
}
```

- `moved: false` → la fecha pedida sirve; no molestes al usuario.
- `moved: true` → **explica el motivo con `labelKey` y ofrece `date`**, que es siempre **hacia
  adelante**. El usuario decide.
- `exhausted: true` con `date: null` → no hubo hueco en 60 días; se muestra el motivo y se deja
  elegir a mano.

`reason` (y su `labelKey` `citas.bloqueo.<reason>`): `sunday`, `holiday`, `no_schedule`, `vacation`,
`leave`. **Hacen falta esas cinco claves en el diccionario del FE**, más
`disponibilidad.ausencia.rango_invalido` (400 al guardar una ausencia que termina antes de empezar).

Opcional: `centerId` para preguntar por otro centro (exige el permiso allí).

## Las reglas (para redactar los mensajes)

| `reason` | Qué pasó | Mensaje sugerido |
|---|---|---|
| `sunday` | Domingo. **El sábado SÍ se trabaja** | «Los domingos no se atiende» |
| `holiday` | Festivo con «cierra la agenda» | «Ese día es feriado» |
| `no_schedule` | El médico no tiene horario ese día de la semana | «El Dr. X no atiende los lunes» |
| `vacation` / `leave` | Vacaciones o permiso cargados | «El Dr. X está de vacaciones» |

**Importante:** el día libre semanal **no es un campo**: es no tener horario ese día en
`/medicos/horarios` (`/doctors/schedules`, que ya existía). La pantalla de horarios ES la que define
los días libres. Un médico **sin horarios cargados no queda bloqueado** ningún día laborable: se
entiende que falta configurarlo, no que no trabaje.

## CRUD de ausencias (vacaciones y permisos)

| v1 | v2 | |
|---|---|---|
| `GET /medicos/ausencias?doctorId=&from=&to=` | `GET /doctors/absences` | Lista; `from`/`to` = las que **solapan** ese rango |
| `POST /medicos/ausencias` | `POST /doctors/absences` | `{ doctorId, kind: "vacation"\|"leave", startDate, endDate, reason? , active? }` |
| `PUT /medicos/ausencias/:id` | `PUT /doctors/absences/:id` | Parcial |
| `DELETE /medicos/ausencias/:id` | `DELETE /doctors/absences/:id` | 204 |

Permisos: leer `citas.read`, escribir `citas.config` — los mismos que horarios y festivos. Todo
acotado al centro activo: una ausencia de Bayamón ni se ve ni cierra la agenda de Caguas (probado).

Los festivos **ya tenían** su CRUD (`/festivos`, `/holidays`), con recurrente anual, global o por
centro, y la marca de si cierra la agenda o solo informa.

## Lo que pide la pantalla

1. **Ausencias del médico**: tabla + alta/edición/baja, con rango y motivo. Cabe junto a los horarios.
2. **Festivos**: si no existe ya, el mismo CRUD (el endpoint está desde antes).
3. **Al agendar** (Agregar cita, Nueva cita, agenda del call center): antes de guardar, preguntar
   `next-available-date` con el médico y la fecha elegidos. Si `moved`, avisar con el motivo y
   ofrecer la fecha sugerida en un clic.
4. **Ítem de menú** para la pantalla de disponibilidad, si aún no lo hay.

## Lo que NO hace el BE (a propósito)

- **No mueve citas ya creadas.** Es una consulta; quien agenda decide.
- **No agenda solo.** Quien crea la cita aplica la fecha corrida.

## Pendiente de DATOS (no de código)

Para que el caso real del Dr. Ocasio funcione hay que **cargar su horario** (los días que sí
trabaja) desde la pantalla de horarios; hoy no tiene ninguno, y por eso el lunes todavía le sale
válido. Verificado en producción: con una ausencia cargada, el 21-sep se corre al 23 como debe.
