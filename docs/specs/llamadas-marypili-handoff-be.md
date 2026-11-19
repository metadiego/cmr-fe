# Handoff BE — sumar las llamadas de Marypili (Vapi) a «Ahora mismo»

> FE → BE. Fecha: 2026-11-11. No bloqueante: feature nueva, no bug.

## Qué falta

El panel de llamadas de `/monitoring/right-now` (`CallsPanel`, alimentado por
`GET /right-now/centers`) solo muestra las dos centrales telefónicas humanas, `3cx` y
`ucm-bayamon`. No incluye las llamadas que atiende **Marypili**, el asistente de voz de Vapi que
responde al call center. El dueño pidió sumarla.

## Cómo la trae el sistema legado (verificado leyendo el código, no supuesto)

El legado (`/Applications/MAMP/htdocs/cmr/`, servidor `192.130.74.115`) sí la tiene, como su propio
bloque "MARYPILI" en `/cmr/callcenter`, con contador propio y tabla filtrable por fecha/teléfono.
Mecanismo real:

1. Un cron propio, `scheduler.js` (Node, corre con PM2 en el servidor 115 — **no** es el botón
   «Procesar vía Make.com» de esa pantalla, que es para otra cosa: devolver llamadas perdidas con
   VapiAI). Dos tareas en `scheduler/config.json`:
   - **«Marypili Transcripciones Sync»**, cada 5 min casi todo el día →
     `GET /api/callcenterai/syncMarypili`.
   - **«Marypili Captura Citas»**, también cada 5 min, desfasada →
     `GET /api/callcenterai/capturaCitasMarypili`.
2. `syncMarypili()` (`app/api/CallcenteraiController.php:2085`): descarga un CSV
   (`curl_init(URL_GS_MARYPILI)` — un Google Sheet de transcripciones que llena Vapi/Make, no el
   mismo Sheet del scheduling-server de citas), lo parsea, e inserta lo nuevo en
   `marypili_transcripciones` (`telefono, fecha_hora, transcripcion, resumen, duracion,
   vapi_call_id, agente, fecha`), deduplicando por `vapi_call_id`.
3. Con lo insertado, hace un `UPDATE` sobre `llamadas_log`: cualquier fila `estado='perdida'` y
   `tipo IN ('entrante','facebook')` cuyo `numero_origen` (últimos 10 dígitos) y `fecha` calcen con
   una fila de `marypili_transcripciones`, pasa a `tipo='marypili'`. Así es como una llamada que el
   PBX vio como "perdida" termina mostrándose como atendida por Mary.
4. `capturaCitasMarypili()` (aparte): escanea el `scheduling-server` (el de citas, no el de
   llamadas) por citas con `citadoPor='MP'` y crea los clientes (`MClientes`) correspondientes — esto
   es sobre CITAS, no sobre llamadas; se documenta aquí solo porque corre en el mismo cron y toca el
   mismo bot, pero es un dato aparte si se quiere separar el alcance.
5. En pantalla: extensión fija `2222` para toda fila Marypili, contador propio arriba, tabla con
   `hora, número, duración, tipo=marypili` y acciones (Devolver / borrar).

## Lo nuestro hoy (verificado en código)

- `src/modules/callcenter/dto/ingesta.dto.ts`: `IngestaDto.central` ya es un string libre («qué
  central manda el lote (ucm-bayamon, 3cx…). Es DATO»), así que una tercera central no pide cambiar
  el DTO — pero sí falta QUIÉN la alimenta: hoy nada llama a `POST /callcenter/ingesta` con
  `central: "marypili"`.
- `src/modules/ahora-mismo/office-figures.ts` arma `byPbx`/`ranking` agrupando por `c.pbx` sobre lo
  que ya esté en la tabla de llamadas — si llegaran filas con `pbx: "marypili"`, el agrupado y el
  ranking las mostrarían solas, sin tocar ese archivo.
- No hay nada de Vapi, Make ni "marypili" en `src/` hoy (confirmado por grep).

## Lo que se pide

Decidir e implementar, del lado BE, cómo entran esas llamadas a nuestra tabla de llamadas (la que
ya alimenta `ahora-mismo`), para que el panel de `/monitoring/right-now` las muestre como una
central más (o un bloque propio, a decisión del BE según cómo se vea mejor en `byPbx`/`ranking`).
Preguntas abiertas que el BE tiene que resolver, no el FE:

- **Origen de los datos**: ¿se replica el mismo mecanismo del legado (leer el Google Sheet de
  transcripciones de Vapi), o hay una API de Vapi más directa que convenga usar en vez de un CSV?
  (El MCP de este proyecto ya tiene herramientas `vapi_list_calls` / `vapi_get_call` disponibles,
  por si sirven de fuente en vez del Sheet.)
- **Dedupe**: el legado deduplica por `vapi_call_id`; nuestra tabla de llamadas tendría que tener
  dónde guardar ese id externo para no reinsertar en cada corrida.
- **Relación con llamadas perdidas existentes**: el legado RE-ETIQUETA una llamada que el PBX ya
  vio como perdida (por teléfono+fecha) en vez de crear una fila aparte. Decidir si conviene igual
  aquí o si es más simple (y más correcto) que Marypili entre siempre como su propia fila,
  independiente del PBX.
- **Cadencia**: el legado sincroniza cada 5 minutos. Ver si conviene un cron propio o colgarlo del
  mismo worker que ya exista para ingesta de llamadas.

## Relacionado
- `lib/api/right-now.ts`, `components/right-now/calls-panel.tsx` (FE, ya leen `byPbx`/`ranking`
  genérico — no necesitan cambios si la nueva central llega con esa misma forma).
- Legado: `cmr/scheduler/scheduler.js` + `cmr/scheduler/config.json`, `cmr/app/api/CallcenteraiController.php`.
