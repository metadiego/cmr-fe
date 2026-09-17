# Citar varios servicios de una vez (hoy estamos por debajo del legado)

**Fecha:** 2026-09-16 · **De:** BE · **Para:** FE · **Lo reportaron los usuarios probando.**

## El problema, en sus palabras

En el legado la pantalla enseña **todos los servicios a la vez**: se le pone fecha a uno y, marcando
los demás, todos toman esa misma fecha. Una pasada.

En el nuestro hay que elegir el servicio en un desplegable, poner fecha, agendar, reabrir, cambiar el
desplegable y repetir. Para un paciente con seis terapias son seis pasadas. **Es nuestro deber ser
igual o mejor que el legado, y aquí estamos por debajo.**

## Lo que ya podéis usar (desplegado y probado)

`POST /api/v2/frontdesk/sessions/book-multiple` acepta ahora **varios servicios**:

```json
{
  "pacienteId": "…",
  "servicioIds": ["…", "…", "…"],
  "fechas": ["2026-09-18", "2026-09-25"],
  "hora": "09:00"
}
```

- Agenda el cruce completo: cada servicio en cada fecha, en una sola llamada.
- `servicioId` (singular) sigue funcionando: no hay que migrar nada de golpe.
- Idempotente: lo que ya exista para (paciente, servicio, fecha) se omite y se cuenta en `omitidas`.
- Avisos: `meta.warnings` trae los de cupo por cada par (servicio, fecha) realmente agendado, y
  `data.aviso` el de disponibilidad excedida **por servicio** (nunca bloquea; alertar y permitir).

La herramienta MCP `book_multiple` acepta los mismos campos.

## Lo que hace falta en la pantalla

En `/boards/frontdesk`, al pulsar **Citar**: la lista de los servicios del centro con casilla — los
mismos que ya salen como pestañas arriba — y el calendario al lado. Se marcan los servicios, se
eligen las fechas, y una sola llamada los agenda todos.

Sugerencias, no imposiciones: dejar marcado por defecto el servicio de la pestaña activa, y enseñar
al final un resumen de qué se agendó y qué se omitió por existir ya (el BE devuelve ambos números).
