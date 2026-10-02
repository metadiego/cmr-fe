# Bug — la agenda del día no deja elegir fecha, y no se puede citar desde ahí

**Reportado por el dueño, 02-oct-2026**, con capturas: *«error terrible para dar una cita en ese
módulo, no habilita un date picker […] y además en las vistas nueva debería tener el botón que
aparece en el calendario, porque en las vistas solo da oportunidad para el día de hoy»*.

Pantalla: `/scheduling/appointments/2026-10-02`, en sus dos vistas (**Classic** y **New**).

## Los tres defectos, en orden de gravedad

### 1. No hay selector de fecha — solo se puede trabajar HOY

La cabecera tiene `‹ Today ● Live` y nada más. Para ver otro día hay que **editar la URL a mano**,
y el personal de control de citas no va a hacer eso. La fecha ya está en la ruta
(`/scheduling/appointments/<YYYY-MM-DD>`), así que falta el control, no el dato.

**No es del backend.** Verificado contra producción el 02-oct-2026, `GET
/api/v1/citas/agenda-dia?fecha=…` responde para cualquier fecha:

```
2026-10-02 → 49 citas     2026-10-09 → 23 citas     2026-11-20 → 0 citas
```

Hace falta un date picker junto a «Today» (y, ya puestos, flechas de día anterior/siguiente: hoy
solo está la de atrás, `‹`).

### 2. Falta el botón «+ New appointment» en estas dos vistas

Existe en el calendario mensual (`Medical appointments`) arriba a la derecha, y **no** en Classic
ni en New. Quien está mirando el día tiene que irse al calendario para poder citar. Debe estar en
las tres, y abrir el modal **con la fecha que se está viendo ya puesta**, no con la de hoy.

### 3. El modal nace con la hora de fin ANTES que la de inicio

En la captura: `Start time 02:00 PM` y `End time 09:30 AM`. La cita acabaría antes de empezar.
Los dos campos se inicializan por separado y nadie los relaciona. **End time debe derivar del
Start** (inicio + la duración del tipo de cita, o un defecto razonable) y no poder quedar antes.

## Lo que el backend ya da (nada que pedirle)

- `GET /api/v1/citas/agenda-dia?fecha=YYYY-MM-DD` — cualquier fecha, el día entero con sus franjas.
- `GET /api/v2/appointments/day-agenda?date=…` — lo mismo en inglés.
- `POST /api/v1/citas` — crear, con `fecha`, `hora`, `horaFin`.
- Los tipos de cita traen su duración, para derivar la hora de fin.
