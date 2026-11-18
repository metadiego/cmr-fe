"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { RecibirCompra } from "@/components/inventario/recibir-compra";
import { ReceiptsList } from "@/components/inventario/receipts-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// «Recibir compra» and, next to it, «Recepciones»: every reception as it was loaded (owner 18-nov-2026).
// The tab lives in ?tab= so a link can open the list directly.
export default function ReceivePurchasePage() {
  return (
    <React.Suspense>
      <ReceivePurchaseTabs />
    </React.Suspense>
  );
}

function ReceivePurchaseTabs() {
  const t = useTranslations("inventoryReceipts");
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") === "receipts" ? "receipts" : "receive";

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => router.replace(v === "receipts" ? "?tab=receipts" : "?", { scroll: false })}
      className="w-full"
    >
      <TabsList className="mb-2">
        <TabsTrigger value="receive">{t("tabReceive")}</TabsTrigger>
        <TabsTrigger value="receipts">{t("tabReceipts")}</TabsTrigger>
      </TabsList>
      <TabsContent value="receive">
        <RecibirCompra />
      </TabsContent>
      <TabsContent value="receipts">
        <ReceiptsList />
      </TabsContent>
    </Tabs>
  );
}
