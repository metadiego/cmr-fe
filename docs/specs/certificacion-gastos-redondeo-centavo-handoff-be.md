# Handoff FE → BE — Certificación de gastos: "no cuadra" por 1 centavo

**Contexto:** el dueño vio, en la ficha del paciente → Documentos → Certificación de gastos, el aviso
"El desglose no cuadra con las facturas; no se puede imprimir." El FE no hace ningún cálculo acá: solo
pinta `reconciliation.cuadra` tal cual lo manda `GET /invoices/expenses-certificate` (ver
`components/clientes/certificacion-gastos.tsx:48-49`, `lib/api/facturas.ts:234-266`). El problema está
del lado del BE.

## Evidencia (prod, verificado por curl)

Paciente **PAMELA LUQUIS CAMACHO**, record **82289**, centro **Caguas**
(`id = a2e23db5-7541-45bb-8136-c37907e67f46`), rango `2025-01-01` a `2026-12-31`:

```json
"reconciliation": {
  "totalFacturas": 561.4,
  "totalDesglose": 561.41,
  "difference": 0.01,
  "cuadra": false
}
```

8 facturas en `sin_clasificar` ($311.41) + 1 en `bpc` ($250.00) = $561.41 de desglose, contra
$561.40 de la suma de facturas — **1 centavo de diferencia**, casi con certeza un redondeo (sumar
floats de centavos, o redondear cada línea antes vs. después de sumar) y no una factura real que
falte o sobre en alguno de los dos lados.

## Lo que se pide

1. Revisar por qué `totalFacturas` y `totalDesglose` no coinciden exactamente para este paciente/rango
   — lo más probable es que uno de los dos sume en coma flotante antes de redondear a centavos y el
   otro redondee cada línea primero (o viceversa). Confirmar cuál de los dos números es el correcto.
2. Independientemente del origen exacto, un desglose de centavo (p. ej. ≤ $0.01 en un total de
   cientos/miles de dólares) no debería bloquear la impresión de un documento legítimo. Se pide
   agregar una tolerancia razonable a `cuadra` (p. ej. `Math.abs(difference) &lt; 0.01` o redondear
   ambos lados a centavos ANTES de compararlos), en vez de una igualdad exacta de floats.

## Cómo verificar al terminar

`GET /invoices/expenses-certificate?patientId=a2e23db5-7541-45bb-8136-c37907e67f46&desde=2025-01-01&hasta=2026-12-31`
→ `reconciliation.cuadra` debe salir `true` (o la diferencia real explicada, si de verdad falta/sobra
una factura).
