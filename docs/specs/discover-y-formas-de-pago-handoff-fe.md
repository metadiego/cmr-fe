# Faltan etiquetas de forma de pago (Amex, ATH, Care Credit, Discover...)

**BE:** PR #390 en revisión (`feat/discover-forma-pago`, cmr-be), sin desplegar todavía.
**FE:** pendiente — completar `messages/es.json` y `messages/en.json`.

## El problema

El dueño pidió precisión en la columna "forma de pago" del reporte de facturas
(`billing/cash/consultation` y el general): si se pagó con Care Credit, Visa, Mastercard, Amex o
Discover, debe decir eso, nunca el genérico "Tarjeta".

El BE ya distingue cada marca por separado (`siglasDePago()` en `tributario.ts` tiene sigla
propia para `visa`, `master`, `amex`, `discover`, `care_credit`, `ath`), y el catálogo de formas
de pago (`GET facturacion/formas-pago`) ya trae 13 formas reales en producción — pero revisando
`messages/es.json`/`en.json`, el namespace `formasPago` **solo tiene 7 claves**:

```json
"formasPago": {
  "efectivo": "Efectivo", "cheque": "Cheque", "tarjeta": "Tarjeta",
  "seguro": "Seguro", "transferencia": "Transferencia",
  "master": "Mastercard", "visa": "Visa"
}
```

Faltan: `amex`, `ath`, `care_credit`, `deducible`, `exonerada`, `prepagado`, y la nueva
`discover` (BE PR #390). Donde sea que el FE use `formasPago.<clave>` para traducir una forma de
pago, esas caen sin traducción (o muestran la clave cruda).

## Qué agregar

**`messages/es.json`** (namespace `formasPago`):

```json
"amex": "Amex",
"ath": "ATH",
"care_credit": "Care Credit",
"discover": "Discover",
"deducible": "Deducible (seguro)",
"exonerada": "Exonerada",
"prepagado": "Prepagado"
```

**`messages/en.json`** (mismo namespace):

```json
"amex": "Amex",
"ath": "ATH",
"care_credit": "Care Credit",
"discover": "Discover",
"deducible": "Deductible (insurance)",
"exonerada": "Waived",
"prepagado": "Prepaid"
```

## Verificar

1. Que el selector de forma de pago al registrar un cobro YA ofrezca las 13 formas reales (si
   solo muestra 7, falta cablear el `GET facturacion/formas-pago` en vez de una lista fija en el
   FE — confirmar cuál es el caso antes de solo traducir).
2. Que el reporte de facturas en `billing/cash/*` muestre la marca exacta por factura, no
   "Tarjeta" genérico, para cualquier pago con marca conocida.

Razón completa: `cmr-be/docs/specs/discover-y-formas-de-pago-reconciliadas.md`.
