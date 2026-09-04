import type { FacturaConItems, FacturaEmpresa, ReciboDevolucion } from "@/lib/api/facturas";

// Fiscal/branch block, projected by the BE per sucursal (getById `empresa`). NO
// hardcoded company data here.
export type ReciboEmpresa = FacturaEmpresa | null;

// NOTA: `Recibo`/`ReciboItem` son el MODELO PRESENTACIONAL del FE que consume <ReciboTermico>,
// NO datos del API → sus claves se quedan en español a propósito (no vienen del backend). Lo que se
// traduce al inglés son las LECTURAS de la factura/devolución del API (f.*, d.*, it.*).
export type ReciboItem = {
  cantidad: number; // EFECTIVA (base × multiplicadores). Para láser: 24, no la base 1.
  descripcion: string;
  precioUnitario: number;
  descuento: number;
  total: number;
  // "Incluye:" de un kit (item.content, disponible en borrador+emitida). Vacío = compacto.
  // `precio` = REFERENCIA (mapeado del catálogo por productId); NO suma al total.
  // `nota` = programación/protocolo del componente (PR #100), opcional.
  componentes?: { descripcion: string; cantidad: number; precio?: number; nota?: string | null }[];
  // Duración del protocolo del kit en visitas (producto.treatmentDays), si aplica.
  protocoloVisitas?: number;
  // Multiplicadores (láser: {dias:12, areas:2}) — el label lo resuelve el recibo (fac.col.<clave>).
  multiplicadores?: Record<string, number>;
};

// Presentational model consumed by <ReciboTermico>. Assembled ONCE here from the
// dynamic invoice contract so the same receipt works for consulta/productos/servicios.
export type Recibo = {
  empresa: ReciboEmpresa;
  logoUrl: string | null;
  // "factura" (por defecto) o "devolucion" → el encabezado dice "Factura #" vs "Devolución #".
  tipoDocumento?: "factura" | "devolucion" | "presupuesto";
  numeroDisplay: string;
  fecha: string;
  estado: string;
  anulada: boolean;
  paciente: { nombre: string; record?: string | null; docId?: string | null };
  items: ReciboItem[];
  subtotal: number;
  descuento: number;
  impuesto: number;
  impuestos: { nombre: string; tasa?: number; monto: number }[];
  envio: number; // envío/flete sumado al total DESPUÉS del impuesto (0 = sin envío → no se imprime)
  total: number;
  montoAbonado: number;
  saldo: number;
  // `clave` = clave estable de la forma (efectivo/cheque/…) para traducir el label en el recibo; el
  // `formaPagoNombre` (español) queda de fallback para formas personalizadas.
  pagos: { formaPagoNombre: string; clave?: string | null; monto: number; referencia?: string | null }[];
  atendidoPor?: string;
};

const num = (v: unknown) => Number(v ?? 0);

// Assemble the receipt model from the BE's enriched GET /invoices/:id projection.
// All data travels from the BE (empresa, payments, emisor, doctor, displayNumber,
// emitidaEn) — no FE fallbacks/hardcode. displayNumber is null on drafts → "—".
// `diasTratamiento` = mapa productId→visitas del protocolo (producto.treatmentDays).
export function buildRecibo(
  f: FacturaConItems,
  diasTratamiento: Record<string, number> = {},
  // Mapa paymentMethodId → clave (del catálogo) para traducir la forma en el recibo. Opcional.
  clavePorFormaId: Record<string, string> = {},
  // Modo PRESUPUESTO: un borrador (aún sin emitir) es una cotización, no una factura. El nº de
  // presupuesto lo asigna el BE al imprimir (`quoteNumber`). Handoff imprimir-presupuesto.
  presupuestoNumero: string | null = null,
): Recibo {
  const items: ReciboItem[] = (f.items ?? []).map((it) => {
    // "Incluye:" del kit desde item.content (BE PR #96): disponible en borrador Y emitida.
    // Compacto (imprimeComponentes=false) → content:[] (el BE ya lo devuelve vacío).
    // El PRECIO viene RESUELTO en content[].price (cascada centro→global→base, BE #99) → leerlo
    // tal cual; NO mapear del catálogo (que solo tiene precios por-centro y omitía componentes).
    const content =
      (it as { content?: { productId?: string; name?: string; quantity?: number; price?: number | null; note?: string | null }[] }).content ?? [];
    const itemComps = content.map((c) => ({
      descripcion: c.name ?? "—",
      cantidad: num(c.quantity),
      ...(c.price != null ? { precio: num(c.price) } : {}),
      ...(c.note ? { nota: c.note } : {}),
    }));
    const visitas = it.productId ? diasTratamiento[String(it.productId)] : undefined;
    // Multiplicadores (láser: áreas×días) → cantidad EFECTIVA = base × Π(multiplicadores).
    // `meta` es una bolsa OPACA: su contenido (multiplicadores) NO se traduce, sigue en español.
    const mult = (it.meta as { multiplicadores?: Record<string, number> } | null | undefined)?.multiplicadores;
    const multiplicadores = mult && Object.keys(mult).length ? mult : undefined;
    const base = num(it.quantity) || 1;
    const cantEfectiva = multiplicadores
      ? Object.values(multiplicadores).reduce((p, v) => p * (Number(v) || 1), base)
      : num(it.quantity);
    return {
      cantidad: cantEfectiva,
      descripcion: it.description ?? "—",
      precioUnitario: num(it.unitPrice),
      descuento: num(it.discount),
      total: num(it.total) || num(it.quantity) * num(it.unitPrice),
      ...(itemComps.length ? { componentes: itemComps } : {}),
      ...(itemComps.length && visitas ? { protocoloVisitas: visitas } : {}),
      ...(multiplicadores ? { multiplicadores } : {}),
    };
  });
  const subtotal = num(f.subtotal) || items.reduce((s, it) => s + it.total, 0);
  const descuento = num(f.discount);
  const impuesto = num(f.tax);
  const total = num(f.total) || Math.max(0, subtotal - descuento + impuesto);
  const montoAbonado = num(f.paidAmount);

  // Tax breakdown when the BE projects it (products); consulta has none.
  const impuestosRaw =
    (f as { taxes?: { name?: string; label?: string; rate?: number; amount?: number }[] })
      .taxes ?? [];
  // Un renglón por impuesto TAL CUAL lo proyecta el BE (Estatal 10.5% + Municipal 1% en PR). NO se
  // filtran los que dan 0: si la línea es gravada, el renglón va aunque salga en 0,00 — su ausencia se
  // leería como un error de cálculo. Los exentos llegan con la lista VACÍA (no ceros). Handoff IVU.
  const impuestos = impuestosRaw.map((i) => ({ nombre: i.name ?? i.label ?? "", tasa: i.rate, monto: num(i.amount) }));

  const pac = f.patient;

  // Un borrador es un PRESUPUESTO (no emitido): el papel lo dice y usa el nº de presupuesto, no el de
  // factura (que es null hasta emitir). Handoff imprimir-presupuesto-cuando-no-esta-cobrada.
  const esBorrador = String(f.status ?? "") === "borrador";
  return {
    empresa: f.empresa ?? null,
    // Per-branch logo enables distinct brands; null → the FE default asset.
    logoUrl: f.empresa?.logoUrl ?? null,
    tipoDocumento: esBorrador ? "presupuesto" : "factura",
    numeroDisplay: esBorrador ? (presupuestoNumero ?? f.displayNumber ?? "—") : (f.displayNumber ?? "—"),
    fecha: f.emitidaEn ?? f.date ?? f.createdAt ?? "",
    estado: String(f.status ?? ""),
    anulada: String(f.status ?? "") === "anulada",
    paciente: {
      nombre: pac ? ((pac as { displayName?: string | null }).displayName || [pac.firstName, pac.lastName].filter(Boolean).join(" ")) : "",
      record: pac?.medicalRecordNumber ?? null,
      docId: pac?.documentId ?? null,
    },
    items,
    subtotal,
    descuento,
    impuesto,
    impuestos,
    envio: num((f as { shipping?: number }).shipping),
    total,
    montoAbonado,
    saldo: Math.max(0, total - montoAbonado),
    pagos: (f.payments ?? []).map((p) => ({
      formaPagoNombre: p.formaPagoNombre ?? "—",
      clave: p.paymentMethodId ? clavePorFormaId[String(p.paymentMethodId)] : undefined,
      monto: num(p.amount),
      referencia: p.reference ?? null,
    })),
    // "Atendido por" = quien COBRÓ (issuedBy) o, si aún es borrador, quien la CREÓ (createdBy).
    // BE PR #82; `emisor` queda como fallback legacy. NUNCA el médico.
    atendidoPor: f.issuedBy?.name ?? f.createdBy?.name ?? f.emisor?.name ?? undefined,
  };
}

// Recibo PROPIO de una devolución, reusando <ReciboTermico>. El encabezado dice "Devolución #D-000016".
//
// Desde el 3-sep-2026 el BE manda la `description` de cada línea devuelta (la tomó de la línea de la
// factura de origen, congelada). Antes no la mandaba y aquí se ponía "—", así que el papel decía
// «1 … 170.46» sin nombrar el producto. El mapa `nombres` se conserva como respaldo para recibos
// viejos y para quien ya lo pasaba. Los `pagos` muestran el REEMBOLSO (forma + monto). Sin
// abonado/saldo (no aplica a una devolución).
export function buildReciboDevolucion(
  d: ReciboDevolucion,
  nombres: Record<string, string> = {},
  // Mapa nombre-de-forma → clave (el recibo del BE trae la forma de reembolso como nombre, no id).
  clavePorFormaNombre: Record<string, string> = {},
): Recibo {
  const items: ReciboItem[] = (d.items ?? []).map((it) => {
    const base = num(it.amount);
    const cant = num(it.quantity) || 1;
    return {
      cantidad: num(it.quantity),
      // El BE manda la descripción; el mapa de la factura de origen es el respaldo.
      descripcion:
        (it as { description?: string | null }).description?.trim() ||
        nombres[it.invoiceItemId] ||
        "—",
      precioUnitario: cant ? base / cant : base,
      descuento: 0,
      total: base, // base pre-impuesto por línea; el impuesto va al pie, igual que la factura
    };
  });
  const total = num(d.refundedAmount);
  const impuesto = num(d.refundedTax);
  const subtotal = total - impuesto;
  const pac = d.patient;

  return {
    empresa: d.empresa ?? null,
    logoUrl: d.empresa?.logoUrl ?? null,
    tipoDocumento: "devolucion",
    numeroDisplay: d.displayNumber ?? "—",
    fecha: d.date ?? "",
    estado: String(d.status ?? ""),
    anulada: String(d.status ?? "") === "anulada",
    paciente: {
      nombre: pac ? ((pac as { displayName?: string | null }).displayName || [pac.firstName, pac.lastName].filter(Boolean).join(" ")) : "",
      record: pac?.medicalRecordNumber ?? null,
      docId: pac?.documentId ?? null,
    },
    items,
    subtotal,
    descuento: 0,
    impuesto,
    impuestos: [],
    envio: 0,
    total,
    montoAbonado: 0,
    saldo: 0,
    // El reembolso se muestra como "pago" del recibo (forma + monto), si el BE ya lo resolvió.
    // `formaReembolso` NO está en el mapa api-ingles → el BE la deja en español.
    pagos: d.formaReembolso
      ? [{ formaPagoNombre: d.formaReembolso, clave: clavePorFormaNombre[d.formaReembolso], monto: total }]
      : [],
    atendidoPor: d.emisor?.name ?? undefined,
  };
}
