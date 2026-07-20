# Handoff BE — Desglose de tarjetas en el detalle del cuadre

> **Fecha:** 2026-07-20 · **Origen:** FE cmr-fe (Cuadre de Caja) · **Destino:** cmr-be módulo `caja`
> **Status:** SOLICITADO. Verificado contra el reporte legacy de LASER (Caguas, 2026-07-04).

## Problema (verificado)

El reporte legacy separa CADA tipo de tarjeta y luego totaliza. Ejemplo real (Laser, 07/04/2026):
- ATH: **-940.00** (una devolución en ATH → monto neto negativo)
- Care Credit: **2,160.00**
- VISA: **2,040.00**
- (subtotal informativo) **VISA + MASTERCARD: 2,040.00**
- **Cobranzas en tarjetas (total): 3,260.00** = ATH (-940) + Care Credit (2160) + VISA (2040)

Hoy `GET /caja/reportes/dia` → `detalle.tarjetas` devuelve **una sola fila** genérica
(`{clave:'tarjeta', nombre:'Tarjeta', cantidad:4, monto:3260}`) y **Care Credit cae en `otros`**.
Por eso el FE muestra "Tarjeta ×4 $3260" en vez del desglose, y el total de tarjetas no incluye
Care Credit. El FE solo puede renderizar lo que llega en `detalle.tarjetas` / `detalle.otros`.

## Lo que se pide (BE)

1. **Diferenciar las tarjetas**: que `detalle.tarjetas` traiga **una fila por tipo real** (ATH, VISA,
   MASTERCARD, Care Credit, AMEX…), cada una con `{ clave, nombre, cantidad, monto }` (monto NETO,
   puede ser negativo por devoluciones, como ATH -940). Esto requiere que el pago guarde el **tipo de
   tarjeta** (forma de pago específica), no una forma genérica "Tarjeta".
2. **Care Credit ES tarjeta**: incluir su clave en el grupo configurable `tarjetas`
   (`grupos_metodo_pago`), para que entre en `detalle.tarjetas` y en `detalle.totalTarjetas`
   (hoy va en `otros`). Configurable, sin hardcode.
3. **Total de todas las tarjetas** (`detalle.totalTarjetas`) = Σ de todas las anteriores **incluyendo
   Care Credit** (= 3,260.00 en el ejemplo).
4. Subtotal **VISA + MASTERCARD**: debe salir de un **grupo configurable** (`grupos_metodo_pago`,
   p.ej. clave `visa_mc` = [visa, master]) y venir en `porGrupo` (que ya existe en la respuesta).
   El FE lo renderiza como línea informativa leyendo `porGrupo` + el catálogo de grupos (label i18n
   por `labelKey`). **NO** se calcula en el cliente por nombre de tarjeta (eso sería hardcode). No
   debe sumarse doble al total de tarjetas.

## Contrato esperado (ejemplo)
```jsonc
"detalle": {
  "efectivo": { "cantidad": N, "monto": 2761.36 },
  "tarjetas": [
    { "clave": "ath",         "nombre": "ATH",         "cantidad": 1, "monto": -940.00 },
    { "clave": "care_credit", "nombre": "Care Credit", "cantidad": 1, "monto": 2160.00 },
    { "clave": "visa",        "nombre": "VISA",        "cantidad": 1, "monto": 2040.00 }
  ],
  "otros": [],
  "totalTarjetas": 3260.00,       // incluye Care Credit
  "totalOtros": 0,
  "totalElectronicas": 3260.00,
  "total": 6021.36
}
```

## Criterios de aceptación
1. En el ejemplo Laser 07/04, `detalle.tarjetas` tiene ATH/-940, Care Credit/2160, VISA/2040 y
   `totalTarjetas = 3260.00`; `otros = []`.
2. La clasificación tarjeta/otros sale de `grupos_metodo_pago` (dato), no hardcode.
3. Swagger tipado (`DetalleTarjetaDto` con clave/nombre/cantidad/monto).

## Ya hecho en el FE (no bloquea)
- Renderiza cada fila de `detalle.tarjetas` y `detalle.otros` por separado (monto negativo incluido).
- Subtotal **VISA + MASTERCARD** informativo calculado en el cliente cuando esas filas existan.
- `Total tarjetas` = `detalle.totalTarjetas` del BE (mostrará Care Credit al aplicar el punto 2).
