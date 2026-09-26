# Handoff BE — Agenda de terapias: filtros y panorama por horas

**Contexto.** La vista de día de «Citas de servicio» (`/scheduling/appointments/<fecha>?tab=servicios`,
`components/agenda/service-day-view.tsx`) ya muestra: KPIs del día, chips por terapia, **filtro por estado**
y **búsqueda por paciente** (ambos hoy en el FE, sobre lo ya cargado), y la lista del día. El cockpit de
planificación (`therapy-day-scheduler.tsx`) muestra las horas de UN servicio con `GET /resources/availability`.

Lo que sigue es lo que **no** se puede hacer bien solo en el FE y necesita el BE. Cada punto dice si hoy ya
existe o hay que crearlo. Todo en **inglés**, `/api/v2`, multi-tenant (`X-Tenant-ID`), con el array de centros
opcional para resolver permiso por centro. Sin romper contratos vivos.

---

## 1. Panorama por horas de TODOS los recursos a la vez (nuevo endpoint)

Hoy `GET /resources/availability` es **por un `serviceId`**. Para el panorama visual que pидió el dueño —ver de
un vistazo, sin elegir un servicio, qué recurso (rooms de láser, sillas de suero, etc.) está libre a cada hora—
hace falta un corte **por recurso × hora** del día completo. Es la vista «agenda del recurso» (columnas =
recursos, filas = horas).

Propuesta:

```
GET /api/v2/resources/day-occupancy?date=YYYY-MM-DD[&centerIds=...]
→ {
    date,
    slots: ["07:00","07:30", … "17:00"],           // la misma jornada que availability
    resources: [
      { id, slug, name, labelKey, capacity, staffRole,
        staffOnShift: number|null,                  // techo humano del turno (menor entre puestos y gente)
        cells: [ { time, used, free, cappedBy: "stations"|"staff"|null } ]
      },
      …
    ]
  }
```

- `free` ya debe considerar el **menor entre puestos y personal de turno** (como en `availability`), y `cappedBy`
  dice cuál manda, para pintar distinto «lleno de puesto» vs «sin técnico» (hoy `reasonKey` hace esa distinción
  en el modo por-servicio; aquí hace falta el equivalente por celda).
- Sin `serviceId` porque es del recurso, no del servicio: varios servicios comparten un recurso.
- Un solo viaje para todo el día; el FE pinta la rejilla.

Con esto el FE añade un **filtro/vista por horas** real (elige una hora → ver qué recursos tienen hueco) y la
agenda visual por recurso, sin pedir servicio primero.

---

## 2. Filtros server-side en la lista de sesiones (`GET /frontdesk/sesiones`)

Hoy el FE filtra **en cliente** por estado y por paciente sobre lo ya traído del día. Para que escale (y para
rangos de varios días) conviene aceptar estos filtros en el DTO de query, **todos opcionales**:

- `status=pendiente|presente|en_terapia|asistido|cancelada` (repetible, o CSV).
- `technicianId` / `nurseId` / `doctorId` — para el filtro «quién atiende».
- `patientId` — ya existe.
- `serviceId` — ya existe.
- `withTime=true|false` — solo las que tienen hora asignada (o solo las day-based).

Deben estar declarados en el DTO (Swagger) para que no los ignore el `ValidationPipe`. Si alguno ya existe,
solo confírmalo aquí y lo consumo.

---

## 3. Otros filtros/datos que el dueño aún no ve pero pidió anticipar

- **Filtro por técnico/enfermera** (columna «Atiende» de la lista): depende de `technicianId`/`nurseId` en el
  filtro del punto 2. El FE ya mapea el id → nombre con `GET /staff`.
- **Áreas por paciente en la lista**: hoy la lista no muestra áreas. Si `FrontdeskSesionEntity` expusiera las
  `areas` efectivas de cada sesión (las que nacen de la factura), el panorama diría cuánto ocupa cada quien.
  ¿Se puede añadir `areas` a la entidad de sesión?
- **Resumen del día por recurso** (para KPIs): cuántos puestos-hora se usaron vs disponibles por recurso, para
  medir el cuello de botella que el dueño quiere optimizar. Se puede derivar del punto 1; si prefieres un
  `meta.resumen` en `day-occupancy`, mejor.

---

## Lo que NO cambia

- `availability` por servicio y `patient-day` siguen igual; esto los complementa, no los sustituye.
- Agendar sigue por `book-multiple` del frontdesk. El panorama es de lectura.

Cuando (1) y (2) estén, el FE pinta la rejilla por recurso y mueve los filtros a server-side. Marca aquí qué
queda listo y con qué nombres exactos de campo, y hago `gen:api` + conecto.
