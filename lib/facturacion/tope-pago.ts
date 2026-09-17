// Tope de un pago (dinero): un abono nunca debe hacer que lo abonado exceda el total de la factura.
// Lógica pura para poder testearla en lib/ (el BE es la autoridad; esto es la barrera de la UI).
// Solo aplica a pagos tipo "pago"; los reembolsos (type=reembolso) tienen su propia regla y no pasan por aquí.

// Holgura de centavos para comparaciones de dinero (evita falsos positivos por flotantes).
export const EPS_PAGO = 0.005;

// Máximo que puede tomar un pago sin que lo abonado supere el total.
//  - Al AGREGAR: montoActual = 0 → tope = total − abonado = saldo.
//  - Al EDITAR: montoActual = importe ACTUAL del pago (al editarlo se "libera") → tope = saldo + montoActual.
// Nunca negativo.
export function topePago(total: number, abonado: number, montoActual = 0): number {
  const tope = Number(total) - Number(abonado) + Number(montoActual);
  return tope > 0 ? tope : 0;
}

// ¿El monto propuesto excede el tope? (con holgura de centavos).
export function pagoExcede(monto: number, tope: number): boolean {
  return Number(monto) > tope + EPS_PAGO;
}
