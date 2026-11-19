# Handoff BE → FE: el gerente acusa la corrección de cifras ya firmadas

**Dueño, 11-nov-2026.** En el cuadre de Caguas de ese día, la firma de Berkaira («Aceptado por Berkaira ·
11/11/2026 04:25 p.m.») mostraba en rojo «Firmado con otras cifras: total $390.00 · diferencia $0.00».

**Causa:** después de su firma se anularon tres pagos «Exonerada» de $10 registrados por error (facturas
001170, 001196 y 001199). Fue un error imprevisible y el aviso rojo confunde.

## Lo que hace el BE (#565, en producción)

- Un gerente (permiso `caja.sign_as_manager`) **acusa la corrección** sobre una firma viva, con un motivo
  obligatorio.
- No se reescribe nada de lo firmado.
- Mientras la hoja siga con las cifras acusadas, la firma ya no sale como cambiada. Si la hoja vuelve a
  moverse, el aviso rojo vuelve.

### Endpoint

`POST /v2/cash/reconciliations/:id/signatures/:signatureId/acknowledge`, con cuerpo `{ "reason": "…" }`
(entre 3 y 500 caracteres).

- `:id` es la hoja de la firma: el `reconciliationId` del bloque. Para la firma de un cajero dentro de la
  hoja total, es la hoja propia de ese cajero.
- Pasa por el escudo de confirmación, que se pide por defecto. La primera llamada responde **428**
  `ACTION_REQUIRES_CONFIRMATION` con `action: "cash.signature.acknowledge"`. Se repite con la cabecera
  `X-Confirm-Action: cash.signature.acknowledge`. El cliente HTTP ya maneja el 428.
- Errores:
  - **403** si quien llama no tiene `caja.sign_as_manager`;
  - **400** con `caja.signOff.acknowledgeReasonRequired` o `caja.signOff.signatureNotLive`;
  - **409** `CASH_FIGURES_NOT_CHANGED` (`caja.signOff.nothingToAcknowledge`) si la hoja no cambió.

### Firmas: `GET /v2/cash/reconciliations/:id/signatures`

Cada firma trae ahora cinco campos más, verificados en la respuesta real v2 en producción:
- `acknowledgedFigures`: `null`, o `{ dayTotal, salesCash, countedCash, difference }`
- `acknowledgedAt`
- `acknowledgedBy`
- `acknowledgedByName`
- `acknowledgeReason`

**Cuándo se marca como cambiada (la misma regla que el BE, `signatureChanged`):** la firma está cambiada
si `figures` difiere de las cifras actuales de la hoja **y**, además, `acknowledgedFigures` es `null` o
también difiere de las cifras actuales.

(En el PDF y el correo, los bloques de firma traen además `signatureId`, `reconciliationId` y
`acknowledged: { byName, at, reason }`.)

## Lo que pide el FE

1. Si la firma está cambiada (regla de arriba) y quien mira tiene `caja.sign_as_manager`, mostrar un botón **«Acusar corrección»**
   junto al aviso rojo. Abre un diálogo con un campo de motivo obligatorio y llama al endpoint.
2. Si hay `acknowledgedAt` y, según la regla, la firma no está cambiada, mostrar una **nota neutra, nunca
   en rojo**: «Cifras corregidas · confirmado por {acknowledgedByName} · {acknowledgedAt} —
   {acknowledgeReason}».
3. i18n en es y en: el botón, el diálogo, la nota, las tres `labelKey` de error y
   `confirmation.action.acknowledgeCashFigures`.

Nombres de campo copiados de la respuesta real v2 en producción (11-nov, hoja 2591d22f de Berkaira).
