"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FacturasListView } from "@/components/facturacion/facturas-list-view";
import { DevolucionesListView } from "@/components/facturacion/devoluciones-list-view";
import { CuadreCaja } from "@/components/caja/cuadre-caja";

type Tab = "facturas" | "devoluciones" | "caja";
const TABS: Tab[] = ["facturas", "devoluciones", "caja"];

// Facturación (General/Consulta) con Devoluciones y Cuadre de caja como PESTAÑAS, no ítems de menú
// aparte (owner, 09-oct-2026): son del mismo contexto — correponden siempre a la MISMA división que
// la pantalla (nunca una mezcla), así que viven juntas en vez de obligar a saltar de pantalla.
// `?tab=` sigue el mismo patrón que /scheduling/appointments: la pestaña activa la decide la URL, no
// un estado local, así un enlace a `?tab=caja` abre directo esa pestaña y sobrevive a un reload.
// TabsContent de Radix solo monta el panel activo (no las tres a la vez), así que cambiar de pestaña
// no dispara las llamadas de las otras dos.
export function FacturacionConTabs({ contexto }: { contexto: "general" | "consulta" }) {
  const t = useTranslations("facturacionTabs");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "facturas";

  function selectTab(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next === "facturas") q.delete("tab");
    else q.set("tab", next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      <TabsList className="mb-4">
        <TabsTrigger value="facturas">{t("facturas")}</TabsTrigger>
        <TabsTrigger value="devoluciones">{t("devoluciones")}</TabsTrigger>
        <TabsTrigger value="caja">{t("caja")}</TabsTrigger>
      </TabsList>
      <TabsContent value="facturas">
        <FacturasListView contexto={contexto} />
      </TabsContent>
      <TabsContent value="devoluciones">
        <DevolucionesListView contexto={contexto} />
      </TabsContent>
      <TabsContent value="caja">
        <CuadreCaja division={contexto === "general" ? "general" : "consulta"} />
      </TabsContent>
    </Tabs>
  );
}
