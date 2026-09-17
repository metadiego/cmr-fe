# Frontdesk: al buscar un paciente, enseñar solo SUS servicios

**Fecha:** 2026-09-17 · **De:** BE · **Para:** FE · **Idea del dueño.**

## Qué quiere

Hoy el frontdesk enseña las ~22 pestañas de servicios del centro, siempre. Cuando se busca a un
paciente concreto, deberían quedar **solo los servicios que ese paciente tiene ese día**, y un botón
para volver a la vista normal del día.

Mi opinión, ya que la pedía: es una buena idea y además barata, porque el dato ya existe. Añado dos
cosas que conviene cuidar —el botón de volver tiene que ser visible (no un aspa pequeña), y mientras
el filtro está puesto debería verse a quién se está mirando, para que nadie se quede filtrado sin
darse cuenta y crea que el día está vacío.

## No hace falta endpoint nuevo

`GET /api/v2/frontdesk/patients/:patientId/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD` ya devuelve las
sesiones del paciente con su servicio. Con `from = to = el día del tablero`:

```json
[
 { "id": "d8c6153e-…", "date": "2026-09-16", "status": "presente",
   "serviceId": "5a5f3e91-…", "serviceSlug": "emtt", "serviceName": "EMTT", "color": null }
]
```

Los `serviceId` distintos de esa respuesta son exactamente las pestañas que deben quedar. Si vuelve
vacía, el paciente no tiene nada ese día: mejor decirlo con una línea que enseñar cero pestañas.

**Cambio de hoy, ya desplegado:** ese campo se llamaba `servicioNombre` (español) mientras sus
hermanos iban en inglés; ahora es **`serviceName`**, coherente con `serviceId` y `serviceSlug`.

## Si luego hace falta el otro camino

Para marcar al citar ya existe `GET /frontdesk/patients/:patientId/availability` (lo que compró y
aún le queda). Son cosas distintas: aquí se filtra por lo que tiene HOY agendado, no por su saldo.

---

## Caso de prueba REAL, con datos poblados (17-sep, 11:45)

Vuestro matiz era el bueno: probasteis con pacientes sin agenda, así que la lista volvía vacía.
Aquí va uno cargado, medido contra producción hace un minuto.

**Centro:** Caguas (`5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d`)
**Paciente:** ANGEL L PEREZ GARCIA — récord **15747** — `906beaf4-743f-4b62-9233-73f67ced6a9d`

**Hoy (2026-09-17): cuatro servicios distintos**

```
GET /api/v2/frontdesk/patients/906beaf4-743f-4b62-9233-73f67ced6a9d/agenda?from=2026-09-17&to=2026-09-17
```

```json
[
 { "serviceName": "Avacen",             "serviceSlug": "avacen",             "status": "pendiente" },
 { "serviceName": "Cámara Hiperbárica", "serviceSlug": "camara_hiperbarica", "status": "pendiente" },
 { "serviceName": "EMTT",               "serviceSlug": "emtt",               "status": "pendiente" },
 { "serviceName": "Sueroterapia Vit C", "serviceSlug": "vitc",               "status": "pendiente" }
]
```

Al filtrar por él, el tablero debe quedarse con esas cuatro pestañas de veintitantas.

**Ayer (2026-09-16): el mismo paciente tiene SEIS**, y una de ellas en estado `presente` — sirve para
ver que el filtro no depende del estado. Otro caso en Bayamón: CARMEN M ROSADO FERNANDEZ, récord
89854, con dos servicios el 16-sep.

**Caso vacío**, para el otro camino: cualquier paciente recién creado, o este mismo con una fecha sin
sesiones (por ejemplo `from=to=2026-09-20`).

**Además, desplegado hoy:** `book-multiple` ya acepta `dates` en inglés además de `fechas` (antes
daba 400, el mismo hueco que `serviceIds`). Las cuatro sesiones de arriba se crearon con esa llamada.
