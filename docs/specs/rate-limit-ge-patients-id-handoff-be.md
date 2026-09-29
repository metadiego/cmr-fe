# Handoff BE — `GET /patients/:id` devuelve 429 de forma persistente para una cuenta normal

**Severidad: alta** (deja una ficha de paciente inaccesible sin que el usuario pueda hacer nada
del lado suyo).

## Síntoma

Usuario reportó no poder abrir la ficha del récord **#15712** (paciente GUARDARRAMA NOBLE, JOSIE,
CMR Caguas, `patientId=6111a709-1c67-4c3c-8f55-93fa3e692d45`) en `/patients`: la pantalla muestra

```
RATE_LIMITED · ThrottlerException: Too Many Requests
```

## Verificado en producción (26-sep-2026), cuenta `atencion@centrodemedicinaregenerativa.com`

Reproducido en vivo, repetidas veces, en una ventana de **más de 3 minutos** con muy pocas
peticiones de por medio (no un bombardeo):

```
GET /api/v2/patients/6111a709-1c67-4c3c-8f55-93fa3e692d45 → 429
{"error":{"code":"RATE_LIMITED","message":"ThrottlerException: Too Many Requests"},
 "meta":{"tenant":"5f98ef29-5b71-4fc4-8291-0ca3ff50bc7d","timestamp":"2026-09-26T23:45:23.951Z", ...}}
```

- La respuesta **no trae `Retry-After` ni ningún header `X-RateLimit-*`** — el FE no tiene forma de
  saber cuánto falta para poder reintentar ni de mostrar un mensaje útil ("intenta en N segundos").
- El mismo `patientId`, mismo tenant, mismo usuario, sigue en 429 pasados varios minutos sin que el
  FE le haya vuelto a pegar más que una vez cada tanto para verificar.
- Se descartó una causa del lado del FE: se encontró y arregló un bug real (ver más abajo) que
  triplicaba/cuadruplicaba `GET /menu` en cada navegación, y aun con ese arreglo desplegado y
  verificado (confirmado en producción: `/menu` bajó de 3-4 llamadas a 1 por página), **el 429 en
  `/patients/:id` sigue igual**. Es decir, no era la causa completa, o el cupo ya estaba agotado y
  su ventana de reseteo es más larga de lo esperable para una cuenta con uso normal.

## Lo que se pide

1. Confirmar la ventana y el umbral configurados del `ThrottlerGuard` para este endpoint (o el
   global, si es un cupo compartido por usuario/IP) — a ojo, unas pocas peticiones por minuto no
   deberían agotarlo para un usuario normal navegando la app.
2. Agregar `Retry-After` (o headers `X-RateLimit-Remaining`/`X-RateLimit-Reset`) a la respuesta 429,
   para que el FE pueda mostrar un mensaje útil o reintentar automáticamente en vez de un error
   mudo.
3. Si el cupo es compartido entre TODOS los endpoints por usuario/IP (no solo `/patients/:id`),
   confirmarlo — eso explicaría por qué una sesión de pruebas/QA intensiva (muchas peticiones a
   endpoints no relacionados) puede dejar bloqueado un endpoint completamente distinto y de bajo
   costo como este.

## Lo que ya se hizo del lado del FE (bug real, arreglado y desplegado)

`GET /menu` se pedía 3-4 veces por cada carga de página (el rail lateral, el menú de usuario, el
header y `/configuration` montaban cada uno su propio fetch, sin compartir el resultado) —
verificado en vivo en producción antes y después del fix. Corregido con un `MenuProvider`
compartido (mismo patrón que `MeProvider` ya usa para `/auth/me`), PR #73, desplegado en `main`
(`000bafe`). Esto reduce la carga real contra el BE en cada navegación, pero **no es la causa
completa** del 429 reportado — ver arriba.

---

# RESPUESTA DEL BE — 29-sep-2026

Los tres puntos, contestados con lo que los comprobó. **Lo verificado va separado de lo supuesto.**

## Antes que nada: dos de los tres ya estaban

**El `Retry-After` YA SALE**, y las cabeceras ya están expuestas al navegador. Se hizo en el PR
#362 (`fix(security): trust proxy solo Cloudflare + exponer headers de rate-limit al FE`), que
aterrizó DESPUÉS de que escribieras este handoff. Comprobado provocando un 429 real contra
producción hoy:

```
HTTP/2 429
access-control-expose-headers: Retry-After,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset
retry-after: 58
```

Si el FE no lo veía el 26, era porque aún no estaba desplegado. Hoy se lee sin hacer nada más.

## 1. La ventana y el umbral — y por qué se agotaban

**Verificado** (`src/core/core.module.ts`, antes de hoy): un único cubo de **100 peticiones / 60 s**.
Pero el número no era el problema. El problema es **de quién era el cubo**:

`ThrottlerGuard` identificaba al peticionario por `request.ip`. **Todo el personal de un centro sale
a internet por la MISMA IP pública**, así que las cien peticiones del minuto **se repartían entre
todos los que estuvieran trabajando allí**. Con veinte personas en recepción, cinco por minuto cada
una. Eso es exactamente lo que le pasó a `atencion@` con el récord #15712: no había gastado su
cuota — se la habían gastado sus compañeros. Y por eso tu arreglo de `/menu` (real y correcto) no
movió la aguja.

## 2. Respuesta a tu punto 3: SÍ, el cupo era compartido — y ya no lo es

**Arreglado**: la cuota se gasta ahora **por principal**, no por IP.

- Usuario de Supabase → su propio cubo (`user:<id>`).
- Llave de API → el suyo (`api_key:<id>`); dos llaves distintas no se pisan.
- Sin autenticar (`@Public()`, login, token inválido) → sigue por IP, que es lo único que hay. Nadie
  se queda sin cubo.

Lo vigila una prueba de integración con **dos personas detrás de la misma IP**: la primera agota su
cuota y **la segunda sigue trabajando**. Es el defecto de este handoff convertido en test, para que
no vuelva.

## 3. El 429 ahora trae las CUATRO cabeceras, no solo una

Antes solo viajaba `Retry-After` en el rechazo (los `X-RateLimit-*` solo salían en las respuestas
que pasaban). Ahora van las cuatro juntas en el 429:

| Cabecera | Qué dice |
|---|---|
| `Retry-After` | segundos enteros, **nunca 0** (un 0 invita a reintentar ya y volver a chocar) |
| `X-RateLimit-Limit` | el techo de la ventana |
| `X-RateLimit-Remaining` | lo que queda (0 en un 429) |
| `X-RateLimit-Reset` | segundos hasta que se abre la ventana |

Y **el cuerpo ya no sale pelado**: antes el `ThrottlerException` mandaba un string y el filtro global
solo sabe leer `code`/`labelKey`/extras cuando el cuerpo es un objeto. Ahora:

```json
{ "error": { "code": "RATE_LIMITED",
             "labelKey": "errores.demasiadas_peticiones",
             "retryAfter": 58,
             "message": "demasiadas peticiones; inténtalo de nuevo en unos segundos" } }
```

**Lo que el FE puede hacer ya**: leer `error.retryAfter` (o la cabecera `Retry-After`) y decir
«inténtalo en N segundos», o reintentar solo. El `labelKey` es para traducirlo, no para enseñarlo.

## 4. El techo dejó de ser un número en el fuente

`RATE_LIMIT_TTL_SECONDS` y `RATE_LIMIT_LIMIT`, validadas en el arranque, **con los valores de hoy
por defecto** (60 / 100). Subir o bajar el techo ya no es un despliegue de código. Si tras esto
siguen apareciendo 429 en uso normal, se sube por variable de entorno, no por PR.

## Lo que NO se hizo, y por qué

- **No se le quitó el límite a `/patients/:id`** ni a nada. Apagar la protección para que deje de
  dar 429 no es arreglarlo.
- **No hay techos por endpoint** todavía. Con el cubo por persona el caso reportado desaparece; si
  aparece un endpoint caro que de verdad necesite el suyo, se añade entonces y con su medición
  delante, no ahora por si acaso.

## Pendiente tuyo (no mío)

Nada bloqueante. Cuando esto esté desplegado, si quieres, cambia el error mudo de
`RATE_LIMITED` por el mensaje con los segundos — el dato ya viaja.
