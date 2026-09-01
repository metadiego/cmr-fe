"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listUnidades,
  listClasificaciones,
  listPresentacionesProveedor,
  deletePresentacionProveedor,
  type Unidad,
  type Clasificacion,
  type PresentacionProveedor,
} from "@/lib/api/inventario";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PPFormSheet } from "@/components/inventario/pp-form-sheet";

export function PresentacionesProveedorAdmin() {
  const t = useTranslations("inventario.pp");
  const tc = useTranslations("common");

  const unidadesRes = useResource<Unidad[]>(() => listUnidades());
  const fabricantesRes = useResource<Clasificacion[]>(() =>
    listClasificaciones("fabricante"),
  );
  const marcasRes = useResource<Clasificacion[]>(() => listClasificaciones("marca"));

  const unidades = unidadesRes.state.kind === "ok" ? unidadesRes.state.data : [];
  const fabricantes =
    fabricantesRes.state.kind === "ok" ? fabricantesRes.state.data : [];
  const marcas = marcasRes.state.kind === "ok" ? marcasRes.state.data : [];

  const nameById = new Map<string, string>();
  [...unidades, ...fabricantes, ...marcas].forEach((x) => nameById.set(x.id, x.nombre));

  const [productoId, setProductoId] = React.useState("");

  const ppRes = useResource<PresentacionProveedor[]>(
    () => (productoId ? listPresentacionesProveedor(productoId) : Promise.resolve([])),
    [productoId],
  );
  const items = ppRes.state.kind === "ok" ? ppRes.state.data : [];

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<PresentacionProveedor | null>(null);
  const [deleting, setDeleting] = React.useState<PresentacionProveedor | null>(null);
  const [busy, setBusy] = React.useState(false);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(p: PresentacionProveedor) {
    setEditing(p);
    setSheetOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deletePresentacionProveedor(deleting.id);
      toast.success(t("deleted"));
      setDeleting(null);
      ppRes.reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {productoId && (
          <Button size="sm" onClick={openNew}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        )}
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="mb-6 max-w-md">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          {t("producto")}
        </label>
        <ProductoPicker
          value={productoId}
          onChange={(id) => setProductoId(id)}
          placeholder={t("selectProducto")}
        />
      </div>

      {!productoId ? (
        <p className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {t("pickProducto")}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.marcaFab")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.concentracion")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.factorABase")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.sku")}</th>
                <th className="px-3 py-2 font-semibold">{t("col.activo")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {ppRes.state.kind === "loading" && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {tc("loading")}
                  </td>
                </tr>
              )}
              {ppRes.state.kind === "ok" && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </td>
                </tr>
              )}
              {items.map((p) => {
                const marcaFab = [
                  p.marcaId ? nameById.get(p.marcaId) : null,
                  p.fabricanteId ? nameById.get(p.fabricanteId) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const conc =
                  p.concentracion != null
                    ? `${p.concentracion} ${p.unidadConcentracionId ? (nameById.get(p.unidadConcentracionId) ?? "") : ""}`.trim()
                    : "—";
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">{p.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{marcaFab || "—"}</td>
                    <td className="px-3 py-2 tabular-nums">{conc}</td>
                    <td className="px-3 py-2 tabular-nums font-medium">
                      {p.factorABase ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{p.sku ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={p.activo ? "secondary" : "outline"}>
                        {p.activo ? t("active") : t("inactive")}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                          {tc("edit")}
                        </Button>
                        {p.activo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleting(p)}
                          >
                            {t("deactivate")}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {productoId && (
        <PPFormSheet
          open={sheetOpen}
          productoId={productoId}
          presentacion={editing}
          fabricantes={fabricantes}
          marcas={marcas}
          unidades={unidades}
          onOpenChange={setSheetOpen}
          onSaved={ppRes.reload}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deactivateBody", { name: deleting?.nombre ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              {t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
