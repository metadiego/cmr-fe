# Panel de configuración general — una vista por módulo, de solo lectura + enlaces

**BE:** PR #388 en revisión (`feat/panel-de-configuracion-general`, cmr-be), sin desplegar todavía.
**FE:** pendiente — pantalla nueva `/configuration/panel`.

## Qué hace

Hoy hay más de una docena de interruptores (por centro, por persona) y 4 numeraciones
(facturas, presupuestos, récord de paciente, devoluciones) repartidos en pantallas distintas, sin
un solo lugar donde verlos todos agrupados. Este endpoint agrega (compone, no reimplementa) la
lectura de todos, para una pantalla nueva donde el dueño ve de un vistazo qué está prendido/apagado
por módulo, en el centro activo.

**El panel SOLO lee.** Cada ítem trae su propio endpoint real (`metodo`+`ruta`) — el FE escribe
pegándole a ESE endpoint, nunca a uno genérico del panel. No hay `PUT configuracion/panel`.

## Endpoint

```
GET /api/v1/configuracion/panel   (o /api/v2/settings/panel)
```

- Header `X-Tenant-ID` obligatorio (como el resto de endpoints de numeración): sin centro elegido,
  400.
- Permiso: `configuracion.panel` — **solo administrador** (como `/configuracion/requeridos`,
  `/configuracion/datos-paciente`, `/configuracion/tableros`, `/configuracion/formatos`; mismo
  grupo `CONFIGURACION_DELICADA`). Ítem de menú nuevo: `/configuracion/panel`.

Respuesta:

```json
{
  "data": [
    {
      "modulo": "centro",
      "clave": "autoAssignRecordOnArrival",
      "labelKey": "configuracion.panel.auto_assign_record_on_arrival",
      "tipo": "toggle",
      "valor": true,
      "metodo": "PUT",
      "ruta": "centros/:id/datos-fiscales"
    },
    {
      "modulo": "personal",
      "clave": "frontdeskStartsOnConsultation",
      "labelKey": "configuracion.panel.frontdesk_starts_on_consultation",
      "tipo": "toggle",
      "valor": 2,
      "metodo": "PUT",
      "ruta": "personal/:id"
    },
    {
      "modulo": "numeracion",
      "clave": "devoluciones",
      "labelKey": "configuracion.panel.numeracion_devoluciones",
      "tipo": "numeracion",
      "valor": { "serie": "default", "prefijo": "D-", "padding": 6, "proximo": 1 },
      "metodo": "PUT",
      "ruta": "facturacion/devoluciones/series/:serie"
    }
  ]
}
```

## Los `modulo` que aparecen hoy (por si hace falta agrupar/ordenar en la UI)

`centro`, `personal`, `ehrIntegration`, `schedulingBridge`, `pacientes`, `numeracion`. Pueden
sumarse más en el futuro sin romper el contrato — el FE no debe asumir una lista fija, debe
agrupar por lo que venga en `modulo`.

## Lectura de cada `tipo`

- **`toggle`**: `valor` es `true`/`false`, salvo el caso especial de
  `personal.frontdeskStartsOnConsultation`, donde `valor` es un **conteo** (cuántas fichas activas
  del centro lo tienen encendido) — es un dato por PERSONA, no por centro, así que no hay un único
  booleano que mostrar aquí. Mostrarlo como info ("2 personas"), con un enlace a `/personal` para
  editar ficha por ficha (`PUT personal/:id`, campo `frontdeskStartsOnConsultation`).
- **`numeracion`**: `valor` es `{ serie, prefijo, padding, proximo }`. Para cambiar formato,
  `PUT <ruta con :serie=valor.serie>` con `{ prefijo?, padding? }`. Para mover el arranque, el
  mismo patrón que ya existe para facturas: `PUT <ruta>/arranque` con `{ arranque, motivo }` — el
  `ruta` del panel YA apunta a `.../series/:serie`, agregar `/arranque` al final para esa acción.
  Devoluciones es la numeración NUEVA de este PR — antes no se podía tocar por ningún lado.
- **`otro`**: valores que no son ni boolean simple ni numeración (`frontdeskConsultationOrder`,
  un número o null; `camposObligatorios`, un array de strings). Mostrar tal cual, editar por su
  `ruta` propia.

## Qué tocar en el FE

1. Pantalla nueva `/configuration/panel`, protegida por el mismo permiso que ya protege las otras
   pantallas de "Configuración" (administrador).
2. Agrupar visualmente por `modulo`, un bloque por módulo con sus ítems.
3. Por ítem: según `tipo`, un toggle o un mini-formulario de numeración, que al confirmar llama al
   `metodo`+`ruta` que YA viene en la respuesta (reemplazando `:id`/`:serie` por lo que corresponda
   — para numeración, `valor.serie`; para centro, el centro activo).
4. Después de escribir, volver a pedir `GET configuracion/panel` para refrescar (no hay un evento
   en tiempo real para esto todavía).

## No-scope (de este PR)

- No agrega un dashboard de salud/estado del sistema — es solo configuración.
- No reemplaza `/configuracion/requeridos`, `/configuracion/datos-paciente`,
  `/configuracion/tableros` ni `/configuracion/formatos` — esas siguen donde están.

## Pendiente de verificar en vivo (aún no desplegado)

El PR #388 todavía no está mezclado. En cuanto se despliegue, se confirma por HTTP real contra
producción que el shape de arriba coincide exactamente, y se actualiza esta nota.

Razón completa: `cmr-be/docs/specs/panel-de-configuracion-general.md`.
