"use client";

import * as React from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getReciboDevolucion, getFactura } from "@/lib/api/facturas";
import { buildReciboDevolucion, type Recibo } from "@/lib/factura/build-recibo";
import { ReciboTermico } from "@/components/facturacion/recibo-termico";
import { toastError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PrinterIcon, ArrowLeft01Icon } from "@hugeicons/core-free-icons";

// Recibo PROPIO de una devolución ("Devolución #D-000001"), reusando <ReciboTermico>. El nombre de cada
// producto no viene en el recibo del BE → lo resolvemos desde la factura de origen (facturaItemId → descripción).
export default function ReciboDevolucionPage() {
  const params = useParams<{ id: string; devId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = String(params.id);
  const devId = String(params.devId);
  const centro = search.get("centro") ?? undefined;
  const tRoot = useTranslations();

  const [recibo, setRecibo] = React.useState<Recibo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    Promise.all([getReciboDevolucion(id, devId, centro), getFactura(id, centro).catch(() => null)])
      .then(([rec, fact]) => {
        if (!active) return;
        const nombres: Record<string, string> = {};
        (fact?.items ?? []).forEach((it) => {
          if (it.id) nombres[String(it.id)] = it.descripcion ?? "—";
        });
        setRecibo(buildReciboDevolucion(rec, nombres));
      })
      .catch((err) => toastError(err, tRoot))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id, devId, centro, tRoot]);

  if (loading) return <p className="mx-auto max-w-7xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (!recibo) return <p className="mx-auto max-w-7xl px-6 py-16 text-center text-sm text-muted-foreground">{tRoot("facturacion.notFound")}</p>;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-3 flex items-center justify-between no-print">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.back()}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {tRoot("facturacion.back")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <HugeiconsIcon icon={PrinterIcon} className="size-4" />
          {tRoot("receipt.print")}
        </Button>
      </div>
      <div className="flex justify-center rounded-xl border bg-muted/30 p-6">
        <div className="shadow-lg ring-1 ring-border">
          <ReciboTermico recibo={recibo} />
        </div>
      </div>
    </div>
  );
}
