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
