# Handoff FE — página de consentimiento para conectar Claude a CMR

Estado: listo para construir · 2026-11-10 · BE: `cmr-be` rama `feat/mcp-connector-claude`
(spec `cmr-be/docs/specs/mcp-connector-claude.md`, plan `cmr-be/docs/plans/mcp-connector-claude.md`)

## Qué es y por qué

Cualquier usuario de CMR podrá conectar Claude (claude.ai, Claude Desktop, móvil, Claude Code) a
CMR pegando una URL (`https://api.centrodemedicinaregenerativa.com/api/mcp`) y entrando con su
cuenta de CMR. El servidor de autorización OAuth es **Supabase Auth** (su servidor OAuth 2.1, con
registro dinámico de clientes). Supabase **no trae pantalla de consentimiento**: redirige al usuario
a una ruta de NUESTRA app con un `authorization_id`, y nuestra app le pregunta «¿dejas que Claude
entre en CMR como tú?». Esta página es eso.

Lo que Claude puede hacer después lo decide el BE (los mismos permisos y centros del usuario). Esta
página no concede nada por su cuenta: solo aprueba o deniega la petición de Supabase.

## Lo que el FE tiene que construir

### 1. Ruta `/oauth/consent`

- **Ruta exacta:** `/oauth/consent`. Tiene que coincidir con la «Authorization path» que el dueño
  configura en Supabase (Dashboard › Authentication › OAuth Server). Si se cambia aquí, se cambia allí.
- **Fuera del shell de la app** (`app/oauth/consent/page.tsx`, no dentro de `app/(app)`): no lleva
  menú ni barra de centros; es una tarjeta centrada, como `/login`.
- **Requiere sesión.** No va en `PUBLIC_PATHS` de `proxy.ts`.
- Lee `authorization_id` de la query. Sin él → mensaje de error («Enlace de autorización inválido»)
  y nada más.

### 2. Volver a la página después de iniciar sesión (cambio necesario en el login)

Hoy `proxy.ts` manda a `/login` **sin recordar de dónde venía**, y `app/login/actions.ts` siempre
redirige a `HOME_ROUTE`. Con eso, quien no tenga sesión pierde el `authorization_id` y acaba en el
inicio: la conexión con Claude se rompe.

- `proxy.ts`: al redirigir a `/login`, añadir `?next=<pathname+search>` del destino original.
- `app/login/actions.ts`: tras el `signInWithPassword` correcto, redirigir a `next` **solo si** es una
  ruta relativa de la propia app (empieza por `/`, no por `//`, sin esquema ni host). Si no, a
  `HOME_ROUTE`. Esto evita convertir el login en un redirector abierto.
- El caso «ya tiene sesión y entra en `/login`» puede seguir yendo al inicio, pero si trae `next`
  válido, mejor a `next`.

### 3. Lo que hace la página

Con `@supabase/supabase-js` (instalado: 2.107.0; métodos comprobados en
`node_modules/@supabase/auth-js/dist/main/lib/types.d.ts`, `AuthOAuthServerApi`):

1. `const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId)`.
   - Si `data` tiene `redirect_url` (el usuario ya había aprobado este cliente) → `window.location`
     a esa URL inmediatamente.
   - Si tiene `authorization_id` → mostrar el consentimiento (abajo).
   - `error` → mensaje de error genérico + botón «Volver a CMR».
2. **Estado de la cuenta**, antes de dejar aprobar: `getMe()` de `lib/api/auth.ts` (`GET /auth/me`,
   el mismo que usa `app/(app)/pending/page.tsx`). Si `status` es `pendiente`, `rechazado` o `suspendido` → mostrar el
   mismo mensaje que la pantalla `pending` y **no** mostrar «Aprobar» (solo «Cancelar», que deniega).
   El BE rechazaría igualmente cada llamada de Claude; esto evita que el usuario apruebe algo que no
   va a funcionar.
3. **Aprobar:** `supabase.auth.oauth.approveAuthorization(authorizationId)` (sin
   `skipBrowserRedirect`: Supabase redirige solo a Claude con el código).
4. **Denegar:** `supabase.auth.oauth.denyAuthorization(authorizationId)` (redirige a Claude con
   `access_denied`).
5. Los botones se deshabilitan mientras la llamada está en curso (doble clic = dos peticiones).

### 4. Qué muestra (todo con claves i18n en `messages/es.json` y `messages/en.json`)

Tarjeta centrada, mismo estilo que `/login`:

- Logo del cliente (`client.logo_uri`) si viene, y su nombre (`client.name`, p. ej. «Claude»).
- Título: «**{cliente}** quiere acceder a CMR».
- «Como: **{email del usuario}**» (de `data.user.email`) + enlace «¿No eres tú? Cerrar sesión» (cierra
  sesión y vuelve a esta misma URL, que pasará por el login con `next`).
- Qué podrá hacer, en lenguaje llano: «Podrá hacer todo lo que tú puedes hacer en CMR, con tus mismos
  permisos y en tus centros. Cada acción queda registrada en la auditoría como hecha a través de
  Claude.»
- **El host de la redirección** (obligatorio por la especificación MCP, para que el usuario vea a
  dónde vuelve): «Volverás a: **{hostname de `redirect_uri`}**» (p. ej. `claude.ai`, o `localhost`
  para Claude Code).
- Botones: «Aprobar» (primario) y «Cancelar» (secundario = denegar).
- Pie: «Puedes desconectarlo cuando quieras desde Claude (Ajustes › Conectores).»

Claves sugeridas (namespace `oauthConsent`): `title`, `signedInAs`, `notYou`, `whatItCanDo`,
`auditNote`, `returnTo`, `approve`, `deny`, `disconnectHint`, `invalidLink`, `genericError`,
`backToCmr`. `messages-parity.test.ts` exige que existan en los dos idiomas.

### 5. Auditoría: ver lo que hizo Claude (pantalla existente de auditoría)

El BE ya guarda en cada fila de la bitácora:

| Campo (v2) | Qué es |
|---|---|
| `channel` | `rest` (la app y las integraciones) o `mcp` (un agente de IA como Claude) |
| `tool` | La herramienta MCP usada (solo filas `mcp`) |
| `clientId` | El cliente OAuth (el de Claude); null en REST |

Y la lista acepta dos filtros nuevos, `channel` y `tool`. La pantalla de auditoría sigue en el carril
v1 (`lib/api/auditoria.ts`, regla 6 del `CLAUDE.md` del FE): los tres campos y los dos filtros se
llaman **igual en v1 y en v2** (nacieron en inglés), así que no hay que tocar el carril, solo añadir
los parámetros: `GET /auditoria?channel=mcp&tool=<nombre>`. En la pantalla:

- Columna o insignia «Vía»: «App» / «Claude» (i18n), a partir de `channel`.
- Filtro «Vía» (Todas / App / Claude) → `channel`.
- En las filas `mcp`, mostrar `tool` donde hoy se muestra la acción.
- Las lecturas de Claude también se registran (las de la app no): con `channel=mcp` se ve todo lo que
  Claude consultó, además de lo que cambió.

## Lo que NO hace el FE

- No emite tokens, no guarda nada del cliente OAuth, no llama al BE para aprobar: eso es Supabase.
- No elige centro: Claude lo pregunta en la conversación (herramientas `my_clinics` y `switch_clinic`).

## Cómo probarlo

Requisito: el dueño activó el servidor OAuth y el registro dinámico en Supabase y puso la
«Authorization path» en `/oauth/consent` (Tarea 0 del plan del BE), y el BE está desplegado con
`MCP_PUBLIC_URL`.

1. En claude.ai › Ajustes › Conectores › Añadir conector personalizado → URL del MCP.
2. Sin sesión en CMR: debe pasar por `/login` y **volver** a `/oauth/consent?authorization_id=…`.
3. Aprobar → vuelve a Claude conectado. Pedirle «¿quién soy en CMR?» (herramienta `whoami`).
4. Repetir con un usuario `suspendido`: no aparece «Aprobar».
5. Denegar → Claude informa que se denegó el acceso.
6. En auditoría, filtro «Vía: Claude» muestra las llamadas del paso 3.
