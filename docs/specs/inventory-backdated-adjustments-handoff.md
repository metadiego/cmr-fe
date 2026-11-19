# Handoff BE → FE: ajustes de inventario con fecha pasada

**BE:** cmr-be PR #646 (merge `3524f8e6`), en producción desde el 19-nov-2026. Spec del BE:
`cmr-be/docs/specs/inventory-backdated-adjustments.md`.

Los nombres de campo de este documento están **copiados de respuestas reales de `/api/v2` en producción**
(19-nov-2026, Caguas, `vitacintra`), no del DTO.

## 1. Qué cambió en el BE (y por qué la pantalla tiene que enterarse)

La pantalla `/inventory/adjustments` (`components/inventario/adjustment-form.tsx`) ya manda `effectiveDate`.
Hasta hoy el BE aceptaba cualquier fecha sin reglas. Ahora, si la fecha es un **día pasado** (en la zona del
centro):

1. Hace falta el permiso `inventory.retroactive` **en el centro del almacén** → si no, 403.
2. Cabe en la ventana del centro (`maxDays`, por defecto 45) → si no, 400.
3. Lleva motivo (`notes`, ya obligatorio en el formulario) → si no, 400.
4. Si deja algún día entre la fecha y hoy en negativo y el centro está en `block` (por defecto) → 409.
5. Si todo está bien → **428** `ACTION_REQUIRES_CONFIRMATION`, acción `inventory.adjustment.backdate`. El
   host genérico (`lib/api/confirm-action.ts` + `components/confirm-action-host.tsx`) ya lo maneja: repite con
   `X-Confirm-Action`. Solo faltan los textos (§5).
6. Un día **futuro** → siempre 400.

Una fecha de **hoy** (o sin fecha) se comporta exactamente como antes.

Las mismas reglas valen para `POST /inventory/operations/adjust` (modal «Ajustar» de Existencias) y
`POST /inventory/operations/count` (conteo físico). En el conteo con fecha pasada, `notes` pasa a ser
obligatorio.

## 2. Cambios de pantalla en `/inventory/adjustments`

1. **Selector de fecha con hoy por defecto** (hoy está vacío = «ahora»). Mostrar el día de hoy del centro;
   no permitir días futuros (el BE los rechaza igual).
2. **Si el día elegido es anterior a hoy**: aviso visible («Ajuste con fecha pasada») y, antes de guardar,
   pedir la **vista previa** (§3) cada vez que cambien fecha, almacén o líneas (con debounce). Enseñar:
   - por producto: `delta`, saldo del día efectivo antes → después (`effectiveDayBefore` → `effectiveDayAfter`),
     hoy antes → después (`todayBefore` → `todayAfter`), y cada inicial de mes afectado (`monthOpenings`:
     p. ej. «Inicial de noviembre 133 → 135»);
   - en rojo los días que pasan a negativo (`newlyNegativeDays`);
   - aviso si hay conteos físicos posteriores (`laterCounts`) o cierres posteriores (`closings`);
   - tabla plegable día a día (`days[]`: `date`, `before`, `after`), a pantalla completa.
   - `problems[]`: lo que el guardado rechazaría; si hay alguno, deshabilitar «Guardar» y mostrar su `labelKey`.
   - si `canBackdate` es `false`, el selector de fechas pasadas debería avisar antes de que la persona trabaje.
3. **Motivo obligatorio** con fecha pasada (`notes` ya lo es en el formulario; mantenerlo).
4. **Al guardar**: el 428 lo resuelve el diálogo genérico; la respuesta trae `effectiveDate` (el instante
   guardado) e `isRetroactive`, y `meta.advertencias` trae `INVENTORY_BACKDATED_ADJUSTMENT` (toast).
5. **Lista de ajustes** (`GET /inventory/adjustments`): ya trae `effectiveDate` y `createdAt`. Mostrar las dos
   cuando difieren (día distinto): «Fecha efectiva 31-oct · registrado 19-nov».
6. **Kardex del día** (`/inventory/kardex`, nivel 2, `GET /inventory/reports/daily-kardex/day`): cada movimiento
   trae ahora `recordedAt` e `isRetroactive`. Si `isRetroactive`, mostrar un distintivo «Con fecha pasada ·
   registrado el {recordedAt}».

## 3. Vista previa — `POST /api/v2/inventory/adjustments/preview`

Permiso `inventory.adjust` (en el centro del almacén). **No escribe nada.** Cuerpo = el mismo del guardado
(`notes` opcional):

```json
{ "warehouseId": "…", "effectiveDate": "2026-10-31", "notes": "…",
  "lines": [{ "productId": "…", "quantity": 2, "sign": "positivo" }] }
```

Respuesta real (201, `data`), recortada:

```json
{
  "clinicId": "5f98ef29-…", "warehouseId": "b6a99d6f-…",
  "effectiveDate": "2026-10-31T16:00:00.000Z", "effectiveDay": "2026-10-31", "today": "2026-11-19",
  "backdated": true, "daysBack": 19,
  "settings": { "maxDays": 45, "negativeBalance": "block" },
  "canBackdate": true, "confirmationRequired": true,
  "problems": [], "closings": [],
  "products": [{
    "productId": "e9eed314-…", "sku": "vitacintra", "name": "VITAMINA C INTRAVENOSA (…)",
    "delta": 2,
    "laterCounts": [{ "date": "2026-11-15", "netChange": 8050 }, { "date": "2026-11-16", "netChange": -7728 }],  // netChange = lo que el conteo movió ese día (puede ser negativo), NO la cantidad contada
    "effectiveDayBefore": 133, "effectiveDayAfter": 135,
    "todayBefore": 189, "todayAfter": 191, "minAfter": 50,
    "newlyNegativeDays": [], "alreadyNegativeDays": [],
    "monthOpenings": [{ "date": "2026-11-01", "before": 133, "after": 135 }],
    "days": [{ "date": "2026-10-31", "before": 133, "after": 135 }, "… uno por día hasta hoy"]
  }]
}
```

Con una salida de 100 el mismo día, `problems` trae (real):
`{ "code": "INVENTORY_BACKDATE_NEGATIVE_BALANCE", "status": 409, "labelKey": "inventory.backdate.negativeBalance", "products": [{ "productId": "…", "newlyNegativeDays": ["2026-11-11", …] }] }`.

Las cifras salen en **viales cerrados** (la misma capa que el kardex diario): en producción coinciden con el
kardex (31-oct cierre 133, inicial 1-nov 133, hoy 189).

## 4. Configuración por centro

- `GET /api/v2/inventory/adjustments/retroactive/settings?centerIds=…` (permiso `inventory.read`). Real:
  `[{ "clinicId": "…", "clinicName": "CMR Caguas", "maxDays": 45, "negativeBalance": "block", "negativeBalanceOptions": ["block","confirm","allow"] }]`
- `PUT /api/v2/inventory/adjustments/retroactive/settings` (permiso `inventory.backdate_settings`, solo por
  concesión explícita). Cuerpo `{ "clinicId"?, "maxDays"? (0–366), "negativeBalance"? }`. Responde
  `{ clinicId, previous, current }`.
- Sale en el panel de configuración como ítem `modulo: inventario`, `clave: backdate`,
  `labelKey: configuracion.panel.inventory_backdate`, `ruta: inventario/ajustes/retroactiva/configuracion`.
  Pantalla: dos controles (número de días, selector de 3 opciones) en Configuración → Inventario.
- Si la confirmación se pide o no en un centro: la pantalla existente de políticas de confirmación, acción
  `inventory.adjustment.backdate`.

## 5. Errores y textos (i18n por `labelKey`)

| code | HTTP | labelKey | payload extra |
|---|---|---|---|
| `INVENTORY_EFFECTIVE_DATE_IN_FUTURE` | 400 | `inventory.backdate.future` | `effectiveDay`, `today` |
| `INVENTORY_BACKDATE_FORBIDDEN` | 403 | `inventory.backdate.forbidden` | `permission` |
| `INVENTORY_BACKDATE_TOO_OLD` | 400 | `inventory.backdate.tooOld` | `maxDays`, `oldestAllowed`, `daysBack` |
| `INVENTORY_BACKDATE_REASON_REQUIRED` | 400 | `inventory.backdate.reasonRequired` | — |
| `INVENTORY_BACKDATE_NEGATIVE_BALANCE` | 409 | `inventory.backdate.negativeBalance` | `products[{ productId, newlyNegativeDays }]` |
| `VALIDATION_ERROR` (fecha ilegible) | 400 | `inventory.backdate.invalidDate` | — |
| `VALIDATION_ERROR` (config) | 400 | `inventory.backdate.invalidSettings` | `field` |

Confirmación (428): `actionLabelKey: confirmation.action.backdatedInventoryAdjustment`; `effects` posibles:
`confirmation.effect.backdateRewritesBalances`, `confirmation.effect.backdateClosedPeriod`,
`confirmation.effect.backdateAfterCount`, `confirmation.effect.backdateNegativeBalance`. `params`:
`effectiveDay`, `today`, `daysBack`, `reason`, `closings`, `products[]` (como en la vista previa, sin `days`).

Advertencia tras guardar (`meta.advertencias`): `code: INVENTORY_BACKDATED_ADJUSTMENT`,
`labelKey: inventory.backdate.written`, `effectiveDay`, `daysBack`, `products[{ productId, delta, todayBefore, todayAfter }]`.

Textos nuevos a dar de alta en `messages/es.json` y `en.json`: todos los `labelKey` de esta sección más
`configuracion.panel.inventory_backdate` y los de la pantalla (aviso de fecha pasada, títulos de la tabla).

## 6. Permisos

- `inventory.adjust` — guardar y vista previa (como hoy).
- `inventory.retroactive` — fechar en el pasado (ya existía; en producción lo tienen Administrador, Gerente,
  Facturación, Facturación e Inventario, Inventarios y Solo lectura).
- `inventory.backdate_settings` — cambiar la configuración (nuevo; no lo tiene ningún rol, admin por `*`).

## 7. Qué NO hace falta
- No hay campos nuevos en el cuerpo del guardado: `effectiveDate` ya existía.
- No hay que normalizar la fecha en el FE: mandar `YYYY-MM-DD`; el BE la guarda a las 12:00 del centro.
