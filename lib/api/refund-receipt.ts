// A refund's receipt ready to draw or to send to the print hub (Recibo for recibo-termico.tsx and for
// receiptToEscPos): ONE loader for the on-screen page, the print page and the hub path. The line names
// come from the BE; the origin invoice's items are the fallback, and the refund method's slug (for its
// translation) comes from the center's payment methods.
import { getFactura, getFormasPago, getReciboDevolucion } from "./facturas";
import { buildReciboDevolucion, type Recibo } from "@/lib/factura/build-recibo";

export async function loadRefundRecibo(invoiceId: string, refundId: string, centerId?: string): Promise<Recibo> {
  const [rec, fact, formas] = await Promise.all([
    getReciboDevolucion(invoiceId, refundId, centerId),
    getFactura(invoiceId, centerId).catch(() => null),
    getFormasPago(centerId).catch(() => []),
  ]);
  const nombres: Record<string, string> = {};
  (fact?.items ?? []).forEach((it) => {
    if (it.id) nombres[String(it.id)] = it.description ?? "—";
  });
  const clavePorNombre: Record<string, string> = {};
  formas.forEach((f) => {
    if (f.name && f.slug) clavePorNombre[f.name] = f.slug;
  });
  return buildReciboDevolucion(rec, nombres, clavePorNombre);
}
