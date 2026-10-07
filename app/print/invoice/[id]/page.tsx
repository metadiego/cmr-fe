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
  // Firefox no imprime bien este recibo pase lo que pase con sus ajustes (causa aún sin encontrar; Chrome,
  // Edge y Brave sí funcionan — Edge/Brave necesitan Márgenes=Mínimo). Se avisa y se evita el intento
  // automático para no gastar papel a ciegas; el usuario puede imprimir manualmente si insiste. Detección
  // simple por userAgent: el único dato fiable entre navegadores es que Firefox siempre incluye "Firefox/".
  // Ver docs/specs/recibo-termico-causa-raiz-y-arreglo.md.
  const [esFirefox] = React.useState(() => typeof navigator !== "undefined" && /Firefox\//.test(navigator.userAgent));

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
  // ahí el usuario mira el iframe y el botón "Imprimir" del modal abre ESTA MISMA página en una pestaña
  // nueva para que se imprima sola — ver imprimirDesdeVisor en la factura. Sin embed (pestaña propia, abierta
  // por "Imprimir" o por reimprimir desde el visor): se autoimprime y se cierra sola al terminar, como el
  // print.php del legado (window.close() tras window.print()).
  React.useEffect(() => {
    if (!recibo || embed || esFirefox) return;
    const h = setTimeout(() => {
      window.print();
      window.onafterprint = () => {
        try {
          window.close();
        } catch {
          /* algunos navegadores no dejan cerrar una pestaña que no abrió un script; no pasa nada, queda abierta */
        }
      };
    }, 400);
    return () => clearTimeout(h);
  }, [recibo, embed]);

  if (error) return <p style={{ padding: 16, fontSize: 14 }}>No se pudo cargar el recibo.</p>;
  if (!recibo) return <p style={{ padding: 16, fontSize: 14 }}>Preparando recibo…</p>;
  // `#pagina-recibo`: marca que ESTA página es solo el recibo (AppShell no le pinta chrome, ver
  // BARE_PREFIXES) para que el CSS de impresión (globals.css) deje de esconder/posicionar-absoluto — ese
  // truco (necesario cuando el recibo vive DENTRO de la pantalla de facturación) era justo lo frágil entre
  // navegadores. Aquí el documento completo ES el recibo, como el print.php del legado.
  return (
    <>
      {/* Fuera de #pagina-recibo a propósito: el CSS de impresión solo hace visible el recibo, así que esto
          se ve en pantalla pero NO llega al papel. */}
      {esFirefox && (
        <p style={{ padding: 12, margin: 0, background: "#fff3cd", color: "#664d03", fontFamily: "sans-serif", fontSize: 13 }}>
          Este navegador (Firefox) no imprime bien este recibo. Usa Chrome, Edge o Brave (Edge y Brave:
          pon Márgenes en Mínimo en el diálogo de impresión). No se intentó imprimir automáticamente.
        </p>
      )}
      <div id="pagina-recibo">
        <ReciboTermico recibo={recibo} />
      </div>
    </>
  );
}
