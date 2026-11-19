"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { useCentroGate } from "@/hooks/use-centro-gate";
import { AdjustmentForm } from "@/components/inventario/adjustment-form";
import { AdjustmentsList } from "@/components/inventario/adjustments-list";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Inventario → Ajustes: «Nuevo ajuste» (one or several products, one number) and «Ajustes hechos»
// (owner 18-nov-2026, cmr-be #627). The tab lives in ?tab= so a link opens the list directly.
export default function AdjustmentsPage() {
  return (
    <React.Suspense>
      <Adjustments />
    </React.Suspense>
  );
}

function Adjustments() {
  const t = useTranslations("inventoryAdjustments");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "list" ? "list" : "new";
  const gate = useCentroGate();
  const [centerPick, setCenterPick] = React.useState("");
  const centerId = centerPick || gate.centro || gate.centros[0]?.id || "";
  const centerName = gate.centros.find((c) => c.id === centerId)?.name ?? "";
  const [reloadKey, setReloadKey] = React.useState(0);

  return (
    <PageContainer className="w-full">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          gate.centros.length > 1 && (
            <Select value={centerId} onValueChange={setCenterPick}>
              <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {gate.centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )
        }
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "list" ? "?tab=list" : "?", { scroll: false })}>
        <TabsList className="mb-2">
          <TabsTrigger value="new">{t("tabNew")}</TabsTrigger>
          <TabsTrigger value="list">{t("tabList")}</TabsTrigger>
        </TabsList>
        <TabsContent value="new">
          {centerId && (
            <AdjustmentForm
              key={centerId}
              centerId={centerId}
              onSaved={() => {
                setReloadKey((k) => k + 1);
                router.replace("?tab=list", { scroll: false });
              }}
            />
          )}
        </TabsContent>
        <TabsContent value="list">
          {centerId && <AdjustmentsList centerId={centerId} centerName={centerName} reloadKey={reloadKey} />}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
