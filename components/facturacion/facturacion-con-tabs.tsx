"use client";

import { useTranslations } from "next-intl";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TabsBarWithActions } from "@/components/kit/tabs-actions-slot";
import { FacturasListView } from "@/components/facturacion/facturas-list-view";
import { DevolucionesListView } from "@/components/facturacion/devoluciones-list-view";
import { CuadreCaja } from "@/components/caja/cuadre-caja";
import { EstadisticasDiariasView } from "@/components/reportes/estadisticas-diarias-view";
import { useTabRoute } from "@/hooks/use-tab-route";
import { BILLING_CONSULTATION_TABS, BILLING_GENERAL_TABS } from "@/lib/nav/tab-routes";

// Billing (general/consultation) with Returns and Cash count as TABS, not separate menu items (owner,
// 09-oct-2026): they always belong to the SAME division as the screen, so they live together instead
// of forcing a jump between screens. Daily stats is the EXCEPTION: it has no general/consultation
// notion (it adds up both divisions, one card per allowed CENTER), so it lives only in General.
// Each tab is a path under the screen (/billing/invoices/cash, /billing/consultations/returns — see
// lib/nav/tab-routes.ts), so a link opens that tab directly and survives a reload. Radix TabsContent
// mounts only the active panel, so switching tabs does not fire the other tabs' requests.
export function FacturacionConTabs({ contexto }: { contexto: "general" | "consulta" }) {
  const t = useTranslations("facturacionTabs");
  const [tab, selectTab] = useTabRoute(contexto === "general" ? BILLING_GENERAL_TABS : BILLING_CONSULTATION_TABS);

  return (
    <Tabs value={tab} onValueChange={selectTab}>
      {/* The active tab's header actions (e.g. Live + New sale) share this row, right-aligned. */}
      <TabsBarWithActions
        className="mb-4"
        tabs={
          <TabsList>
            <TabsTrigger value="invoices">{t("facturas")}</TabsTrigger>
            <TabsTrigger value="returns">{t("devoluciones")}</TabsTrigger>
            <TabsTrigger value="cash">{t("caja")}</TabsTrigger>
            {contexto === "general" && <TabsTrigger value="stats">{t("estadisticas")}</TabsTrigger>}
          </TabsList>
        }
      >
      <TabsContent value="invoices">
        <FacturasListView contexto={contexto} />
      </TabsContent>
      <TabsContent value="returns">
        <DevolucionesListView contexto={contexto} />
      </TabsContent>
      <TabsContent value="cash">
        <CuadreCaja division={contexto === "general" ? "general" : "consulta"} />
      </TabsContent>
      {contexto === "general" && (
        <TabsContent value="stats">
          <EstadisticasDiariasView />
        </TabsContent>
      )}
      </TabsBarWithActions>
    </Tabs>
  );
}
