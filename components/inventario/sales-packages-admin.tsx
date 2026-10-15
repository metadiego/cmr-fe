"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";

import {
  createSalesPackage,
  listSalesPackages,
  retireSalesPackage,
  updateSalesPackage,
  type SalesPackage,
} from "@/lib/api/sales-packages";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { cn } from "@/lib/utils";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// USD with an explicit locale: digits only, identical in es and en (CLAUDE.md rule 3b).
const money = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

// Sales packages of a center (Inventario → Paquetes de venta). The regular price, savings and % come
// from the BE (catalog price × sessions); this screen never computes them. Retiring keeps the row
// (invoices name it) and it can be reactivated. Handoff paquetes-de-venta-handoff-fe.md.
export function SalesPackagesAdmin() {
  const t = useTranslations("salesPackages");
  const tRoot = useTranslations();
  const { can } = useCan();
  const estado = useCentroPantalla("precios.read", "precios.create");
  const centroId = estado.centroActivo || undefined;
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<SalesPackage | "new" | null>(null);

  const { state, reload } = useResource<SalesPackage[]>(
    () => (centroId ? listSalesPackages({ centroId, includeInactive: true }) : Promise.resolve([])),
    [centroId],
  );
  const all = state.kind === "ok" ? state.data : [];
  const rows = (showInactive ? all : all.filter((p) => p.active)).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const canCreate = estado.puedeEscribir && can("precios.create");
  const canUpdate = estado.puedeEscribir && can("precios.update");
  const canRetire = estado.puedeEscribir && can("precios.delete");

  async function toggleActive(p: SalesPackage) {
    try {
      if (p.active) await retireSalesPackage(p.id, centroId);
      else await updateSalesPackage(p.id, { active: true }, centroId);
      toast.success(t(p.active ? "retired" : "reactivated"));
      reload();
    } catch (err) {
      toastError(err, tRoot);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <CentroPantallaSelector estado={estado} />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={showInactive} onCheckedChange={setShowInactive} />
              {t("showInactive")}
            </label>
            {canCreate && (
              <Button size="sm" onClick={() => setEditing("new")}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
                {t("new")}
              </Button>
            )}
          </>
        }
      />

      <div className="overflow-x-auto rounded-lg bg-card ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.name")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.product")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.sessions")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.regular")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.package")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("col.savings")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.active")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-3 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}
            {state.kind === "fail" && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-destructive">{state.message}</td>
              </tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className={cn(!p.active && "opacity-60")}>
                <td className="px-3 py-2 font-medium">{p.name}</td>
                <td className="px-3 py-2">
                  {p.productName ?? "—"}
                  {p.productSku && <span className="ml-1.5 font-mono text-xs text-muted-foreground">{p.productSku}</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.sessions}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{money(p.regularPrice)}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{money(p.packagePrice)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-success">
                  {money(p.savings)}
                  {p.savingsPct != null && <span className="ml-1 text-xs">({p.savingsPct}%)</span>}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={p.active ? "secondary" : "outline"}>{t(p.active ? "active" : "inactive")}</Badge>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {canUpdate && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing(p)} aria-label={t("edit")}>
                      <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
                    </Button>
                  )}
                  {(p.active ? canRetire : canUpdate) && (
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(p)}>
                      {t(p.active ? "retire" : "reactivate")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <SalesPackageDialog
          key={editing === "new" ? "new" : editing.id}
          pkg={editing === "new" ? null : editing}
          centroId={centroId}
          centroIdCrear={estado.centroIdCrear}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </PageContainer>
  );
}

function SalesPackageDialog({
  pkg,
  centroId,
  centroIdCrear,
  onClose,
  onSaved,
}: {
  pkg: SalesPackage | null;
  centroId?: string;
  centroIdCrear?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("salesPackages");
  const tRoot = useTranslations();
  const [name, setName] = React.useState(pkg?.name ?? "");
  const [productId, setProductId] = React.useState(pkg?.productId ?? "");
  const [sessions, setSessions] = React.useState(pkg ? String(pkg.sessions) : "");
  const [price, setPrice] = React.useState(pkg ? String(pkg.packagePrice) : "");
  const [sortOrder, setSortOrder] = React.useState(pkg ? String(pkg.sortOrder) : "");
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    const body = {
      name: name.trim(),
      productId,
      sessions: Number(sessions),
      packagePrice: Number(price),
      ...(sortOrder.trim() ? { sortOrder: Number(sortOrder) } : {}),
    };
    try {
      if (pkg) await updateSalesPackage(pkg.id, body, centroId);
      else await createSalesPackage({ ...body, ...(centroIdCrear ? { centerId: centroIdCrear } : {}) }, centroId);
      toast.success(t("saved"));
      onSaved();
    } catch (err) {
      // The BE sends every failure at once (labelKey + failures[]); toastError lists them.
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{pkg ? t("editTitle") : t("newTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t("col.name")}</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePh")} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">{t("col.product")}</span>
            <ProductoPicker value={productId} onChange={(id) => setProductId(id)} soloFisicos={false} placeholder={pkg?.productName ?? t("productPh")} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("col.sessions")}</span>
            <Input type="number" min={1} value={sessions} onChange={(e) => setSessions(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("col.package")}</span>
            <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("sortOrder")}</span>
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </label>
          <p className="self-end text-xs text-muted-foreground sm:col-span-2">{t("regularHint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            {tRoot("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy || !name.trim() || !productId || !sessions || !price}>
            {tRoot("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
