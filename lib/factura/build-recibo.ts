import type { FacturaConItems, FacturaEmpresa } from "@/lib/api/facturas";

// Fiscal/branch block, projected by the BE per sucursal (getById `empresa`). NO
// hardcoded company data here.
export type ReciboEmpresa = FacturaEmpresa | null;

export type ReciboItem = {
  cantidad: number;
  descripcion: string;
  precioUnitario: number;
  descuento: number;
  total: number;
};

// Presentational model consumed by <ReciboTermico>. Assembled ONCE here from the
// dynamic invoice contract so the same receipt works for consulta/productos/servicios.
export type Recibo = {
  empresa: ReciboEmpresa;
  logoUrl: string | null;
  numeroDisplay: string;
  fecha: string;
  estado: string;
  anulada: boolean;
  paciente: { nombre: string; record?: string | null; docId?: string | null };
  items: ReciboItem[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  impuestos: { nombre: string; monto: number }[];
  total: number;
  montoAbonado: number;
  saldo: number;
  pagos: { formaPagoNombre: string; monto: number; referencia?: string | null }[];
  atendidoPor?: string;
};

const num = (v: unknown) => Number(v ?? 0);

// Assemble the receipt model from the BE's enriched GET /facturas/:id projection.
// All data travels from the BE (empresa, pagos, emisor, medico, numeroDisplay,
// emitidaEn) — no FE fallbacks/hardcode. numeroDisplay is null on drafts → "—".
export function buildRecibo(f: FacturaConItems): Recibo {
  const items: ReciboItem[] = (f.items ?? []).map((it) => ({
    cantidad: num(it.cantidad),
    descripcion: it.descripcion ?? "—",
    precioUnitario: num(it.precioUnitario),
    descuento: num(it.descuento),
    total: num(it.total) || num(it.cantidad) * num(it.precioUnitario),
  }));
  const subtotal = num(f.subtotal) || items.reduce((s, it) => s + it.total, 0);
  const descuento = num(f.descuento);
  const impuesto = num(f.impuesto);
  const total = num(f.total) || Math.max(0, subtotal - descuento + impuesto);
  const montoAbonado = num(f.montoAbonado);

  // Tax breakdown when the BE projects it (products); consulta has none.
  const impuestosRaw =
    (f as { impuestos?: { nombre?: string; label?: string; monto?: number }[] })
      .impuestos ?? [];
  const impuestos = impuestosRaw
    .map((i) => ({ nombre: i.nombre ?? i.label ?? "", monto: num(i.monto) }))
    .filter((i) => i.monto > 0);

  const pac = f.paciente;

  return {
    empresa: f.empresa ?? null,
    // Per-branch logo enables distinct brands; null → the FE default asset.
    logoUrl: f.empresa?.logoUrl ?? null,
    numeroDisplay: f.numeroDisplay ?? "—",
    fecha: f.emitidaEn ?? f.fecha ?? f.createdAt ?? "",
    estado: String(f.estado ?? ""),
    anulada: String(f.estado ?? "") === "anulada",
    paciente: {
      nombre: pac ? [pac.nombres, pac.apellidos].filter(Boolean).join(" ") : "",
      record: pac?.record ?? null,
      docId: pac?.docId ?? null,
    },
    items,
    subtotal,
    descuento,
    impuesto,
    impuestos,
    total,
    montoAbonado,
    saldo: Math.max(0, total - montoAbonado),
    pagos: (f.pagos ?? []).map((p) => ({
      formaPagoNombre: p.formaPagoNombre ?? "—",
      monto: num(p.monto),
      referencia: p.referencia ?? null,
    })),
    // "Atendido por" = quien COBRÓ (emitidoPor) o, si aún es borrador, quien la CREÓ (creadoPor).
    // BE PR #82; `emisor` queda como fallback legacy. NUNCA el médico.
    atendidoPor: f.emitidoPor?.nombre ?? f.creadoPor?.nombre ?? f.emisor?.nombre,
  };
}
