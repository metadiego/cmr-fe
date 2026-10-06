"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { imprimirFactura, getCatalogoFacturacion, getFormasPago } from "@/lib/api/facturas";
import { buildRecibo, type Recibo } from "@/lib/factura/build-recibo";
import { getActiveCentro } from "@/lib/tenant";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";

// Página DEDICADA del recibo, fuera de la app (como el print.php del legado): la hoja contiene SOLO el
// recibo, sin menú ni pantalla alrededor, así que al imprimir no hay nada que esconder ni que descuadre y el
// diálogo del navegador abre en todos (también Firefox). Emite la factura (idempotente) y se autoimprime al
// cargar; la abre el botón "Imprimir" en una pestaña nueva. Handoff: estructura de impresión como el legado.
export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const [recibo, setRecibo] = React.useState<Recibo | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    const centro = getActiveCentro() ?? undefined;
    (async () => {
      try {
        const r = await imprimirFactura(id, centro); // emite (idempotente) y devuelve la proyección final
        const f = r.invoice;
        const [catalogo, formas] = await Promise.all([
          getCatalogoFacturacion(centro, f.appointmentId ? "consulta" : undefined).catch(() => []),
          getFormasPago(centro).catch(() => []),
        ]);
        if (!active) return;
        const diasCatalogo: Record<string, number> = {};
        catalogo.forEach((p) => {
          const dt = (p as { treatmentDays?: number | null }).treatmentDays;
          if (dt != null) diasCatalogo[(p as { id: string }).id] = dt;
        });
        const clavePorFormaId: Record<string, string> = {};
        formas.forEach((fp) => {
          if (fp.slug) clavePorFormaId[fp.id] = fp.slug;
        });
        setRecibo(buildRecibo(f, diasCatalogo, clavePorFormaId, r.quoteNumber ?? undefined));
      } catch {
        if (active) setError(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Autoimprimir cuando el recibo ya está pintado (y los estilos/imagen cargados).
  React.useEffect(() => {
    if (!recibo) return;
    const h = setTimeout(() => window.print(), 400);
    return () => clearTimeout(h);
  }, [recibo]);

  if (error) return <p style={{ padding: 16, fontSize: 14 }}>No se pudo cargar el recibo.</p>;
  if (!recibo) return <p style={{ padding: 16, fontSize: 14 }}>Preparando recibo…</p>;
  return <ReciboTermico recibo={recibo} />;
}
