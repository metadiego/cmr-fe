"use client";

import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  // `?embed=1`: va DENTRO del visor (iframe) del modal de facturación — no se auto-imprime; el botón del
  // modal manda a imprimir. Sin embed (pestaña propia) sí se auto-imprime, como el print.php del legado.
  const searchParams = useSearchParams();
  const embed = searchParams?.get("embed") === "1";
  // `centro` SIEMPRE de la URL primero: esta página no comparte estado con quien la abrió (otra pestaña o
  // un iframe), así que depender de la cookie `cmr_active_centro` podía traer OTRO centro que el de la
  // factura (bug real encontrado: la pantalla de facturación ya resuelve el centro por `?centro=`, pero el
  // iframe no lo pasaba). La cookie queda de respaldo solo si no vino en la URL.
  const centroParam = searchParams?.get("centro") || undefined;
  const [recibo, setRecibo] = React.useState<Recibo | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    let active = true;
    const centro = centroParam ?? getActiveCentro() ?? undefined;
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
  }, [id, centroParam]);

  // Autoimprimir cuando el recibo ya está pintado (y los estilos/imagen cargados). En modo visor (embed) NO:
  // el usuario imprime/reimprime desde el botón del modal.
  React.useEffect(() => {
    if (!recibo || embed) return;
    const h = setTimeout(() => window.print(), 400);
    return () => clearTimeout(h);
  }, [recibo, embed]);

  if (error) return <p style={{ padding: 16, fontSize: 14 }}>No se pudo cargar el recibo.</p>;
  if (!recibo) return <p style={{ padding: 16, fontSize: 14 }}>Preparando recibo…</p>;
  // `#pagina-recibo`: marca que ESTA página es solo el recibo (AppShell no le pinta chrome, ver
  // BARE_PREFIXES) para que el CSS de impresión (globals.css) deje de esconder/posicionar-absoluto — ese
  // truco (necesario cuando el recibo vive DENTRO de la pantalla de facturación) era justo lo frágil entre
  // navegadores. Aquí el documento completo ES el recibo, como el print.php del legado.
  return (
    <div id="pagina-recibo">
      <ReciboTermico recibo={recibo} />
    </div>
  );
}
