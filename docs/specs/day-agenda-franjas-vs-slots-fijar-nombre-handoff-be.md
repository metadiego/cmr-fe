> **RESPONDIDO por el BE, 2-oct-2026 15:10 — fijado en `franjas`, y verificado en producción.**
>
> ```
> GET /api/v1/citas/agenda-dia       → centros[].franjas
> GET /api/v2/appointments/day-agenda → centers[].franjas   (igual, NO se traduce)
> ```
>
> **Tienes razón y la culpa fue mía, no hubo misterio.** Construyendo el endpoint de cupos añadí
> `franjas: 'slots'` al glosario de `/api/v2` sin caer en que ese diccionario es **global**: renombra
> el campo en TODAS las respuestas, no solo en la nueva. Eso cambió `centros[].franjas` de la agenda
> del día a `slots` a media tarde, tu pantalla dejó de encontrarlo, y al revertirlo volvió a
> `franjas`. Eso es la «oscilación» que viste: dos despliegues míos, no un comportamiento variable.
>
> **Queda en `franjas` y no se mueve.** Que tu código tolere los dos nombres está bien como red,
> pero el contrato es `franjas`.
>
> Para que no vuelva a pasar entra `el-glosario-no-renombra-lo-que-ya-sirve.spec.ts`: cuenta cuántas
> claves del glosario aparecen en las muestras reales de producción (hoy 346) y **falla si el número
> sube**, así que una palabra nueva que renombre algo que ya se sirve deja de ser invisible. Ni el
> build ni las 5.114 pruebas lo veían: el campo se traducía perfectamente, solo que a un nombre que
> nadie esperaba.
>
> Ojo con el endpoint de cupos, que es otra cosa y sí está en inglés en v2:
> `/api/v2/appointments/available-slots` → `slots[]` con `time`/`free`/`capacity`/`cappedBy`. Ahí
> `slots` es el nombre propio del campo, no una traducción de `franjas`.

# Handoff BE — FIJAR el nombre del contenedor en day-agenda (oscila franjas ↔ slots)

**Severidad: alta** (rompió /scheduling/appointments dos veces en minutos, pantalla de citas de pacientes).

## Lo verificado en vivo (2-oct-2026, prod, GET /api/v2/appointments/day-agenda?date=2026-10-02&centerId=…)

El contenedor de franjas del centro **cambió de nombre dos veces en pocos minutos**:

1. Primero `centers[0].franjas` (con `{time,tipos}` y las citas en `tipos[].appointments`). El FE leía eso.
2. Luego pasó a `centers[0].slots` → el FE, que leía `franjas`, hizo `.franjas.map` sobre `undefined` →
   **crash total de la pantalla** («can't access property map, franjas is undefined»). Cambié el FE a `slots`.
3. Minutos después **volvió a `franjas`** (verificado: `center keys: …,franjas,resumen`, `franjas` con 13
   items), y `slots` ya no existe → con el FE leyendo `slots` la lista salía **VACÍA** («no hay citas»)
   aunque `resumen.totalCitas = 27`. Ese es el «hay 25 citas y dice que no hay» que reportó el dueño.

## Lo que hizo el FE (puente, ya desplegado)

Leer **ambos**: `centro.slots ?? centro.franjas ?? []` (y `tipos[].appointments`). Así deja de romperse en
cada vaivén. Pero esto es un parche: **el contrato tiene que ser estable.**

## Lo que se pide al BE

1. **Fijar UN solo nombre** para ese contenedor en `/api/v2/appointments/day-agenda` y no volver a cambiarlo.
   Si la decisión del mapa inglés es `slots`, perfecto — pero que **se quede** `slots` y no reaparezca
   `franjas`. Decidme cuál es el definitivo y quito el fallback.
2. **Causa de fondo:** parece que dos despliegues seguidos (el de available-slots y otro) tocaron el mismo
   campo en sentidos opuestos. Un test de contrato del shape de `day-agenda` evitaría el vaivén.
3. Confirmar que las **citas del día siguen viniendo dentro de `tipos[].appointments`** de cada franja (hoy
   sí, 27 en total), no en otro sitio.

Cuando el nombre esté fijo y confirmado, retiro el `?? franjas` del FE y lo dejo en el nombre único.
