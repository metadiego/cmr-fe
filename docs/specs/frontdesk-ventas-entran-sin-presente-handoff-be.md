# Handoff BE — las citas de servicio que vienen de VENTA deben ENTRAR, pero NO en «presente»

**De:** cmr-fe. **Fecha:** 2026-09-24. Reportado por usuarios de frontdesk (citas de servicio).

## Lo que piden los usuarios (textual)

> «Las citas que vengan directa de las ventas, que ya entran en presente, que sigan entrando pero no
> en presente; simplemente que entren.»

## Lo verificado (no supuesto)

Hoy el enganche **factura → frontdesk** es binario, controlado por `frontdeskAutoPresent` por centro
(schema `lib/api/schema.d.ts:5686`, comentario del BE):

- `true` → al saldar una factura del mismo día, cada línea `a_la_entrega` **entra automáticamente
  PRESENTE** al tablero de su servicio.
- `false` → **desconectado** (no entra nada).

O sea: **no existe** el estado que piden — «entra, pero sin sellar presente». Con `true` entra presente;
con `false` no entra. (Fuente: el propio comentario del schema del BE + el flag en
`components/admin/datos-fiscales-dialog.tsx`.)

Además, el frontdesk ya distingue el ORIGEN de una fila: `source: "manual" | "autopresente" | "agendada"`
(schema `:8601`). Es decir, ya hay una forma de que una fila entre **sin** el sello de presente.

## Lo que toca al BE

Que la línea de venta (`a_la_entrega`, al saldar) **entre al tablero del servicio SIN marcarse
presente** — que quede como recién llegada/agendada (sin la hora de presente sellada), lista para que
el frontdesk la marque presente cuando de verdad llegue el paciente.

Dos formas, la que el BE prefiera (decisión de contrato, no la fijo yo):

1. **Cambiar el significado del enganche a tri-estado.** Sustituir `frontdeskAutoPresent` (boolean) por,
   p. ej., `frontdeskVentaEntrada: "off" | "entra" | "entra_presente"` (nombres en inglés a gusto del BE).
   `off` = no entra; `entra` = entra sin presente (lo que piden); `entra_presente` = lo de hoy.
2. **Cambiar el comportamiento sin nueva config**, si el dueño confirma que YA NO quieren el
   auto-presente para ventas en ningún centro: que el enganche entre la fila sin presente y punto.

En ambos casos el `source` de esa fila debería reflejar que vino de venta (p. ej. un nuevo
`"venta"`, o reutilizar `"agendada"`), para no confundirla con un presente real.

## Lo que hará el FE cuando el BE responda

- Si es tri-estado: cambiar el `Switch` de `frontdeskAutoPresent` en `datos-fiscales-dialog.tsx` por un
  selector de 3 opciones, con su i18n. UI para todo el CRUD de la API, como siempre.
- Si es cambio de comportamiento sin config: nada que tocar en el FE (la fila entra sin presente sola);
  se verifica en pantalla.

## Decisión del dueño — RESUELTA (2026-09-24): CONFIGURABLE POR CENTRO → opción 1 (tri-estado)

El dueño lo quiere **configurable por centro**. Por tanto: **opción 1**, sustituir el boolean
`frontdeskAutoPresent` por un tri-estado por centro (p. ej. `frontdeskVentaEntrada:
"off" | "entra" | "entra_presente"`, nombres en inglés a gusto del BE), con **migración** del valor
actual (true → `entra_presente`, false → `off`) para no perder la configuración de ningún centro.
El default para los centros nuevos lo decide el dueño; hoy la mayoría querrá **`entra`** (entra sin
presente). El FE cambiará el `Switch` por un selector de 3 opciones cuando el contrato esté.

## Normas que el BE debe cumplir en esta entrega (recordatorio del dueño)

API-First + MCP + Swagger + configurable + multi-tenant + RBAC + comentarios en DB y en cada Field +
spec/plan + TDD + drift-clean + i18n. **Sin hardcode.** UI para TODO el CRUD de la API. **Revisar el
endpoint CORRECTO, no el más cómodo.** No duplicar código. Sin secretos. **Nunca asumir: investigar y
revisar en profundidad las veces que haga falta; jamás suponer ni confiar.** Aplica a BE y FE.

- **Permisos por centro:** cada endpoint puede recibir, opcionalmente, el array de centros como
  parámetro para resolver el permiso (`read`, `write` y los que hagan falta).
- **Nombres en INGLÉS:** tablas, entidades, campos/fields, comentarios en DB, endpoints, variables,
  constantes, funciones y métodos.
- **Probar por HTTP** antes de decir que está bien. Separar lo verificado (con su fuente/comando) de lo
  supuesto (marcado), nunca mezclados. Graduar el rigor: **máximo** aquí (toca frontdesk/flujo del día).
- **Las tres preguntas** antes de dar por terminado: ¿lo entiendo? ¿lo puedo mantener? ¿lo probé? Si
  alguna es NO, no se entrega: se dice que no.
- **`/review`** antes del merge a main; **`/cso`** (OWASP + STRIDE) por tocar auth/tenancy/RBAC y flujo
  clínico; entregar completo, no a medias, y proponer por escrito cualquier mejora.
