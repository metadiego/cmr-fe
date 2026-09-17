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
