# Handoff FE — el tablero se pide DE UNA VEZ, y hay dos cosas que son vuestras

**Origen**: el dueño, 29-sep-2026, leyendo el arreglo de la cuota de peticiones: *«eso de las
peticiones debe ser un error propio de código, porque humanamente es imposible realizar esa
cuantiosa cantidad de peticiones haciendo click; debe ser que el mismo software las hacía sin
mesura»*. Tenía razón. Esto es lo que salió al medirlo, y lo que ya está hecho del lado BE.

## Lo medido en producción (no supuesto)

Sobre `audit_logs` de los últimos 3 días:

| Ruta | Peticiones en 3 días |
|---|---|
| `/api/v2/frontdesk/sesiones` | 11.545 |
| `/api/v2/frontdesk/tablero` | 11.544 |
| `/api/v2/frontdesk/presentes` | 11.543 |
| `/api/v2/frontdesk/reportes/avisos` | 11.543 |

Las cuatro en **paso perfecto**: una sola pantalla pidiendo cuatro cosas a la vez. Contado por
minuto, `/tablero` sale **6 veces por minuto** — un sondeo cada 10 segundos. Cuatro rutas × seis
vueltas = **24 peticiones por minuto POR CADA PANTALLA ABIERTA**. Con el techo en 100, **cuatro
pantallas agotaban la cuota del centro entero**. Eso fue lo que dejó inaccesible la ficha del
récord #15712, no el número del techo.

Y hay algo más, también medido: **sigue pidiendo de madrugada**. 720 peticiones de frontdesk entre
las 03:00 y las 04:00, 723 entre la 01:00 y las 02:00, con nadie trabajando. Son pestañas abiertas
sondeando toda la noche.

## Lo que ya está hecho en el BE

### 1. Una sola petición para toda la pantalla

```
GET /api/v2/frontdesk/board-snapshot?servicio=<clave>&fecha=YYYY-MM-DD&desde=…&hasta=…[&servicioId=<uuid>][&include=…]
```

(en v1: `/frontdesk/instantanea-del-tablero`)

Devuelve en un viaje lo que hoy cuesta cuatro:

```json
{ "data": {
    "board":    { … },   ← lo mismo que GET /frontdesk/tablero
    "present":  { … },   ← lo mismo que GET /frontdesk/presentes
    "sessions": { … },   ← lo mismo que GET /frontdesk/sesiones
    "notices":  { … } }, ← lo mismo que GET /frontdesk/reportes/avisos
  "meta": { … } }
```

**De 24 peticiones por minuto y pantalla a 6.**

`include` es opcional y acepta coma: `include=board,present`. Por defecto vienen las cuatro. Valen
también los nombres en español (`tablero,presentes,sesiones,avisos`), por si os resulta más cómodo
migrar por partes. Una pieza que no existe da **400** con la lista de las válidas — a propósito: un
sobre vacío se leería en pantalla como «hoy no hay nadie», y eso no es verdad.

Los parámetros son los mismos que ya mandáis a las cuatro rutas:

- **`servicio` es la CLAVE del servicio** (`apex`, `mots_c`…), exactamente igual que en
  `GET /frontdesk/board` — **no es su uuid**. Lo comprobé contra producción: con el uuid, el tablero
  responde 404. Si os pasa lo mismo alguna vez, es esto.
- **`servicioId` (uuid) es OTRO dato**, y solo filtra la pieza `sessions`. Es opcional: sin él, las
  sesiones del rango no se filtran por servicio.
- `fecha` para el tablero y los presentes; `desde`/`hasta` para las sesiones y los avisos.

### 2. Si no cambió, no cuesta nada

La respuesta lleva **`ETag`**. Mandadlo de vuelta en `If-None-Match` y, si nada cambió, contesta
**304 sin cuerpo y sin tocar la base**. Un tablero quieto —que es casi todo el día, y toda la
noche— deja de costar cuatro consultas cada diez segundos.

La huella incluye el centro y el principal, así que **dos personas de centros distintos nunca se
sirven la instantánea de la otra**.

### 3. Nada se retira

Las cuatro rutas de hoy siguen **exactamente igual**. Esto es el camino corto, no un reemplazo:
podéis migrar cuando queráis y por partes.

## AMPLIACIÓN 29-sep, después de medirlo a fondo: NINGUNA de esas llamadas funcionó

Al mirar el estado de las 46.598 llamadas salió lo de verdad:

| Ruta | Llamadas (3 días) | Estado |
|---|---|---|
| `/frontdesk/sesiones` | 11.650 | **401 UNAUTHORIZED** |
| `/frontdesk/tablero` | 11.650 | **401 UNAUTHORIZED** |
| `/frontdesk/reportes/avisos` | 11.649 | **401 UNAUTHORIZED** |
| `/frontdesk/presentes` | 11.649 | **401 UNAUTHORIZED** |

**Ni una tuvo éxito.** No es un tablero cargándose mucho: es **una pantalla con la sesión caducada
que lleva reintentando desde el 17-sep a las 00:12**, cada ~20 segundos, doce días seguidos, de día
y de noche. Nadie la está mirando.

### D. (NUEVO, y es lo más importante) Al recibir 401, PARAR

Un reintento con la misma credencial caducada no va a funcionar la vez diez mil. Lo que hace falta:

- **Cortar el intervalo en cuanto llega un 401.** No reprogramar la siguiente vuelta.
- **Intentar refrescar la sesión UNA vez.** Si el refresco falla, mandar al login y dejar de pedir.
- **Nunca reintentar en bucle un 401.** Un 500 o un fallo de red sí merecen reintento (con espera
  creciente); un 401 no: la respuesta no va a cambiar sola.

Esto es lo que más carga quita de las cuatro cosas de esta lista, y además es lo correcto para el
usuario: hoy alguien con la sesión vencida ve un tablero congelado en vez de que se le pida entrar.

## Lo que es VUESTRO (y sin esto, el problema no se cierra)

### A. Parar de sondear con la pestaña oculta

Nadie mira un tablero que no está en pantalla. Las 720 peticiones de las tres de la mañana son
exactamente eso: pestañas olvidadas. Con `document.visibilityState !== 'visible'` → parar el
intervalo, y al volver a `visible` → una petición inmediata y reanudar.

Es el cambio de mayor efecto de los tres, y es de una línea.

### B. Engancharse al SSE que YA existe

`GET /api/v2/frontdesk/stream` emite los cambios del centro activo. No es nuevo: la propia
documentación de `presentes` dice *«se refresca por el SSE de /frontdesk/stream»*. La pantalla lo
ignora y sondea igual.

Con el SSE conectado, el sondeo pasa a ser **la red de seguridad** (cada 60 s, por si se cae el
stream), no el mecanismo. Ahí una pantalla quieta baja de 24 peticiones por minuto a **una**.

### C. Revisad el intervalo de 10 segundos

Aunque hagáis A y B: un tablero de recepción no necesita refrescar cada 10 segundos. Con el SSE
dando los cambios al instante, 30 o 60 segundos de red de seguridad sobran.

## Lo que ya se arregló antes, para que no lo busquéis

La cuota de peticiones **ya no es por IP sino por persona** (desplegado hoy, commit `24d9e34`), así
que un centro entero dejó de repartirse las cien del minuto. Y el 429 ya trae `Retry-After`,
`X-RateLimit-Limit/Remaining/Reset` y un `retryAfter` en el cuerpo — está contestado en detalle en
`rate-limit-ge-patients-id-handoff-be.md`.

Pero **eso trata el síntoma**. La causa es el sondeo, y los puntos A, B y C son los que la cierran.
