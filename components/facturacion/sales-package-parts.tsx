"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PackageIcon } from "@hugeicons/core-free-icons";

import { listSalesPackages, type SalesPackage } from "@/lib/api/sales-packages";
import { invoiceSavings, packageEvidence, savingsPct } from "@/lib/factura/sales-package";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// USD with an explicit locale: digits only, identical in es and en (CLAUDE.md rule 3b).
const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

// Under a package line: «Paquete X — Precio regular · Ahorro (%) · Precio del paquete», from the numbers
// the BE froze in meta.salesPackage (old invoices keep them). `locked` adds the "remove and add again" note.
export function PackageEvidence({ item, locked }: { item: { salesPackageId?: string | null; meta?: unknown }; locked?: boolean }) {
  const t = useTranslations("salesPackages");
  const e = packageEvidence(item);
  if (!e) return null;
  return (
    <span className="mt-0.5 block text-[11px] text-muted-foreground">
      <span className="font-semibold text-foreground">{t("evidence", { name: e.name })}</span>
      {" — "}
      {t("regularPrice")} {money(e.regularPrice)} · {t("savingsLabel")}{" "}
      <span className="font-medium text-success">
        {money(e.savings)} ({savingsPct(e)}%)
      </span>{" "}
      · {t("packagePrice")} {money(e.packagePrice)}
      {locked && <span className="block italic">{t("lockedNote")}</span>}
    </span>
  );
}

// «Usted ahorró $X» at the foot, when the invoice has package lines; nothing otherwise.
export function PackageSavingsRow({ items }: { items: Array<{ salesPackageId?: string | null; meta?: unknown }> }) {
  const t = useTranslations("salesPackages");
  const saved = invoiceSavings(items);
  if (saved <= 0) return null;
  return (
    <div className="flex items-center justify-between rounded-md bg-success/10 px-2 py-1.5 text-sm font-semibold text-success">
      <span>{t("youSaved")}</span>
      <span className="tabular-nums">{money(saved)}</span>
    </div>
  );
}

// «Agregar paquete» on a draft invoice: the invoice center's active packages; picking one sells it
// (the parent posts it and refetches the invoice, whose totals come from the BE).
export function AddSalesPackage({
  centro,
  disabled,
  onPick,
}: {
  centro?: string;
  disabled?: boolean;
  onPick: (pkg: SalesPackage) => Promise<void>;
}) {
  const t = useTranslations("salesPackages");
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} disabled={disabled}>
        <HugeiconsIcon icon={PackageIcon} className="size-4" />
        {t("addToInvoice")}
      </Button>
      {open && (
        <PackagePicker
          centro={centro}
          onClose={() => setOpen(false)}
          onPick={async (p) => {
            setOpen(false);
            await onPick(p);
          }}
        />
      )}
    </>
  );
}

function PackagePicker({ centro, onClose, onPick }: { centro?: string; onClose: () => void; onPick: (p: SalesPackage) => void }) {
  const t = useTranslations("salesPackages");
  const res = useResource<SalesPackage[]>(() => listSalesPackages({ centroId: centro }), [centro]);
  const rows = (res.state.kind === "ok" ? res.state.data : []).filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("pickTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {res.state.kind === "loading" && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          {res.state.kind === "fail" && <p className="text-sm text-destructive">{res.state.message}</p>}
          {res.state.kind === "ok" && rows.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t("pickEmpty")}</p>}
          {rows.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ring-1 ring-foreground/10 transition hover:bg-primary/5 hover:ring-primary/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("regularPrice")} {money(p.regularPrice)} · {t("savingsLabel")} {money(p.savings)}
                  {p.savingsPct != null && ` (${p.savingsPct}%)`}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{money(p.packagePrice)}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
