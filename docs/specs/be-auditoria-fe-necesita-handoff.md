# BE Handoff (petición amable) — Auditoría: lo que el FE necesita del BE

> Contexto: la pantalla `/auditoria` ya está construida en el FE (tabla densa + filtros + detalle,
> ancho completo, i18n, gate `auditoria.read`). Consume `GET /auditoria` con `apiFetchPaged` — el BE
> responde el envelope estándar `{ data: filas[], meta: { pagination } }` (verificado en prod; la
> paginación va en `meta`, NO dentro de `data`). Faltan 3 cosas que NO deben resolverse en el cliente. Todo API-First + Swagger +
> `COMMENT ON` + tests + sin romper el contrato actual.

## 1. Nombre del usuario en cada fila (alto impacto)
Hoy `userId` es el `authUserId` de Supabase y el FE solo puede pintar un uuid (el perfil expone `id`,
no `authUserId`, así que mapear en el cliente es imposible). Pedimos que el BE resuelva el nombre:

- Agregar a cada fila `usuarioNombre` (y opcional `usuarioApellido`) resolviendo
  `authUserId → perfil`. `null` si no hay perfil (p. ej. `api-key` o login anónimo).
- `COMMENT ON`: "Nombre visible del actor (resuelto desde authUserId → perfil) para la UI de auditoría."

FE lo consume sin más cambios (cae al uuid si viene null).

## 2. Filtros multivalor que el contrato actual no soporta (los 2 chips más útiles)
El endpoint filtra `metodo` y `resultado` de a UN valor, y no hay filtro por `errorCode`. Por eso los
dos chips que el negocio más quiere NO se pueden hacer server-side sin inventar. Pedimos parámetros:

- **`soloCambios=true`** — devuelve solo `POST/PUT/PATCH/DELETE` (la vista "quién creó/editó/borró
  hoy"). Alternativa equivalente: aceptar `metodo` como CSV (`metodo=POST,PUT,PATCH,DELETE`).
- **`excluirErrorCode=RATE_LIMITED`** (o `ocultarRuido=true`) — el 81% de los errores son
  `RATE_LIMITED` (251k de 310k); sin poder excluirlos el chip "Ocultar límite de tasa" es imposible
  sin romper el total/paginación. Idealmente un parámetro repetible `excluirErrorCode`.

Con esto el FE enciende ambos chips (hoy solo está "Solo errores" = `resultado=error`, que sí soporta).

## 3. Facetas para los desplegables (opcional, evita adivinar)
No hay endpoint de valores disponibles, así que el FE fija la lista de dominios a mano. Si exponen
`GET /auditoria/facetas → { dominios: string[], acciones: string[] }` (valores distintos), los
desplegables se llenan con datos reales y quedan configurables (sin hardcode).

## Prioridad sugerida
1) Nombre de usuario (#1) — desbloquea leer la bitácora sin uuids.
2) `soloCambios` + excluir `RATE_LIMITED` (#2) — habilita las dos vistas del día a día.
3) Facetas (#3) — cuando haya espacio.

Gracias 🙏 — con #1 y #2 la pantalla queda como la pidió el negocio.

## 4. Usuarios en las facetas (para el desplegable "filtrar por usuario")
Hoy el filtro por usuario se activa clicando la celda Usuario de una fila (trae `userId`+`usuarioNombre`).
Para ofrecer además un desplegable "filtrar por usuario", pedimos que `GET /auditoria/facetas` incluya
`usuarios: { userId: string; nombre: string }[]` (los actores presentes en la ventana, `userId` =
authUserId, ordenados por nombre). Sin esto no hay mapa nombre→authUserId en el cliente.
