> **RESPONDIDO por el BE el 2-oct-2026 — ya está en producción y verificado.**
>
> **1. El endpoint existe**, con los nombres que pediste:
> ```
> GET /api/v1/citas/cupos-libres?fecha=YYYY-MM-DD&tipoCitaId=<uuid>[&centroId=<uuid>]
> GET /api/v2/appointments/available-slots?date=…&appointmentTypeId=…[&centroId=…]
> ```
> Respuesta REAL de producción (2026-10-03, tipo «Consulta (Nueva)»):
> ```json
> { "date": "2026-10-03", "appointmentTypeId": "3416b2ae-…", "durationMinutes": 60,
>   "slots": [ { "time": "07:00", "capacity": 3, "free": 3, "cappedBy": null },
>              { "time": "09:00", "capacity": 7, "free": 1, "cappedBy": null } ] }
> ```
> En v1 los mismos campos en español: `franjas`, `hora`, `capacidad`, `libres`, `topePor`,
> `duracionMin`. **Deja de hacer falta el 30 por defecto**: `durationMinutes` viene del tipo (60 en
> este caso). Si el tipo no la tuviera, llega `null` y ahí sí decides tú.
>
> **2. Crear NO bloquea — confirmado.** `CitasService.create` no tiene ninguna validación de cupo:
> se puede agendar en una franja llena y el `POST` responde normal, sin 400 y sin aviso. Por eso el
> endpoint tampoco esconde las llenas: llegan con `free: 0` y `cappedBy: "cupo"` para que las
> atenúes. Cuando se quiera volver bloqueante será un interruptor por centro, no código.
>
> **3. Precedencia de cupos: sin cambios** — fecha > día de la semana > default, y centro > global.
> Este endpoint reusa `CuposService.cuposDelDia` entero, no la reimplementa.
>
> Dos detalles que te afectan al pintar:
> - **Qué ocupa un hueco:** citas vivas y atendidas. Una **cancelada** o un **no-show** NO ocupan.
> - **La franja es la hora tal cual**, solo normalizada: `9:00` y `09:00` son la misma; las `09:15`
>   **no** caen en las `09:00`. Son franjas distintas.
>
> Razón completa: `cmr-be/docs/specs/una-sola-hora-por-cupo.md`.

# Handoff BE — una sola hora en «Nueva Cita», tomada de los CUPOS de consulta médica

**Origen**: el dueño, 2-oct-2026: *«las citas más simples según los slots/cupos que tenemos; no esas dos
horas horribles, una sola hora que se ajuste sola según la disponibilidad; por ahora NO bloqueante,
configurable vía API/MCP/Swagger»*. Y: *«ya tenemos slots de disponibilidad para consultas médicas, eso
es lo que vamos a tomar en cuenta»*.

## Lo que ya hace el FE (y de dónde saca el dato, hoy)

El modal de «Nueva Cita» ya reemplazó Hora Inicio/Hora Fin por **UNA sola hora** elegida de los cupos del
día, con la **hora de fin derivada sola** (inicio + `durationMinutes` del tipo, o 30 min si el tipo no la
trae). Dos variantes (lista/rejilla) para que el dueño elija cuál prefiere; **no bloqueante** (las franjas
llenas se ven atenuadas pero se pueden elegir).

**Hoy el FE calcula los slots así (verificado contra `GET /api/v2/appointments/day-agenda?date=…` live):**
por cada `franja` con `time`, busca en `franja.tipos[]` el tipo elegido y toma su `{ time, cupo, vacios }`.
Es decir, deriva los huecos del día entero y los filtra por `appointmentTypeId`. Funciona, pero trae toda
la agenda del día para pintar un selector.

## Lo que se pide al BE (para hacerlo bien, no solo cómodo)

### 1. Un endpoint de SLOTS por (fecha, centro, tipo) — más barato y claro

```
GET /api/v2/appointments/available-slots?date=YYYY-MM-DD&appointmentTypeId=<uuid>[&centerIds=...]
→ { "date", "appointmentTypeId", "durationMinutes",
    "slots": [ { "time":"09:00", "free":3, "capacity":5, "cappedBy": null },
               { "time":"08:00", "free":0, "capacity":5, "cappedBy":"cupo" } ] }
```

- `free`/`capacity` por franja del tipo (lo que hoy saco de `vacios`/`cupo`). `cappedBy` para distinguir
  «lleno» de otras razones, como ya hace `resources/day-occupancy`.
- `durationMinutes` del tipo, para derivar la hora de fin sin adivinar (hoy uso 30 por defecto si falta).
- `centerIds` opcional (regla del equipo: cada endpoint puede recibir el array de centros).
- Multi-tenant por `X-Tenant-ID`, RBAC `citas.read`.

Si prefieres que siga derivándolo de `day-agenda`, dilo y lo dejo así; pero un endpoint propio evita traer
la agenda completa solo para el selector.

### 2. Confirmar que crear es NO BLOQUEANTE (overbook con aviso)

El dueño quiere, por ahora, poder citar en una franja **llena**. Necesito confirmar que
`POST /api/v2/appointments` **acepta** una cita cuyo cupo ya está lleno y devuelve un **aviso** (igual que
el frontdesk: `meta.warnings` / `advertencias` con `labelKey`), en vez de un 400. Si hoy bloquea, hace falta
el modo aviso (configurable por centro, para poder volverlo bloqueante más adelante).

### 3. Configurable (ya casi todo existe)

Los cupos ya se gestionan por API (`/cupos` CRUD, pantalla `/scheduling/slots`). Solo confirmar: la
precedencia (fecha > día-semana > default) y que el `durationMinutes` del tipo es la fuente de la hora de fin.

## Lo que NO cambia

- El `POST` de crear cita sigue mandando `fecha`, `hora`, `horaFin` (la de fin ya calculada por el FE).
- La pantalla de configuración de cupos (`/scheduling/slots`) sigue igual.

Dime el nombre exacto del endpoint/campos y el comportamiento del overbook, y conecto el FE a eso (hoy
derivo de `day-agenda` como puente).
