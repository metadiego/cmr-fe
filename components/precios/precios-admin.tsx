"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { PencilEdit01Icon, Tick01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listCatalogoPrecios,
  listTiposPrecio,
  listPreciosByPresentacion,
  createPrecio,
  updatePrecio,
  type PrecioCatalogoRow,
  type PrecioFuente,
  type TipoPrecio,
} from "@/lib/api/precios";
import type { Paginated } from "@/lib/api/types";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DerivarPrecios } from "@/components/precios/derivar-precios";

const PAGE_SIZE = 50;
const money = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const FUENTE_VARIANT: Record<PrecioFuente, "default" | "secondary" | "outline" | "destructive"> = {
  oferta: "default",
  precio: "secondary",
  base: "outline",
  ninguno: "destructive",
};

export function PreciosAdmin() {
  const t = useTranslations("precios");
  const tc = useTranslations("common");

  const [mode, setMode] = React.useState<"catalogo" | "derivar">("catalogo");
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  // "" = precio efectivo (default); un id = lista concreta (regular/mayorista/…).
  const [tipoFiltro, setTipoFiltro] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const { state, reload } = useResource<Paginated<PrecioCatalogoRow>>(
    () =>
      listCatalogoPrecios({
        q: debounced,
        page,
        limit: PAGE_SIZE,
        tipoPrecioId: tipoFiltro || undefined,
      }),
    [debounced, page, tipoFiltro],
  );

  // Tipos de precio (listas). El "regular" es el fallback para POST.
  const tiposRes = useResource<TipoPrecio[]>(() => listTiposPrecio());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const regularTipoId = tipos.find((x) => x.clave === "regular")?.id ?? null;
  // Lista destino de una edición: la lista filtrada, o regular por defecto.
  const targetTipoId = tipoFiltro || regularTipoId;

  const rows = state.kind === "ok" ? state.data.items : [];
  const total = state.kind === "ok" ? state.data.pagination.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  function startEdit(row: PrecioCatalogoRow) {
    setEditingId(row.presentacionId);
    setDraft(row.precio != null ? String(row.precio) : "");
  }

  async function save(row: PrecioCatalogoRow) {
    const value = Number(draft);
    if (!draft.trim() || Number.isNaN(value) || value < 0) {
      toast.error(t("invalidPrice"));
      return;
    }
    setSaving(true);
    try {
      const listaId = row.tipoPrecioId ?? targetTipoId;
      // ¿Ya existe una fila de precio en esta lista para la presentación? → PUT; si no → POST.
      const filas = await listPreciosByPresentacion(row.presentacionId);
      const existente = listaId ? filas.find((f) => f.tipoPrecioId === listaId) : undefined;
      if (existente) {
        await updatePrecio(existente.id, { precio: value });
      } else {
        if (!targetTipoId) throw new Error(t("regularNotFound"));
        await createPrecio({
          presentacionId: row.presentacionId,
          tipoPrecioId: targetTipoId,
          precio: value,
        });
      }
      toast.success(t("saved"));
      setEditingId(null);
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <div className="inline-flex rounded-lg border p-0.5">
          {(["catalogo", "derivar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                mode === m
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`mode.${m}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      {mode === "derivar" ? (
        <DerivarPrecios onDone={reload} />
      ) : (
        <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="max-w-sm"
        />
        <Select value={tipoFiltro || "__efectivo__"} onValueChange={(v) => { setTipoFiltro(v === "__efectivo__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__efectivo__">{t("efectivo")}</SelectItem>
            {tipos.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.producto")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.sku")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.presentacion")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.precio")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.fuente")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  <td colSpan={6} className="px-3 py-3">
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                  </td>
                </tr>
              ))}
            {state.kind === "fail" && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center">
                  <p className="text-sm text-muted-foreground">{tc("error")}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
                    {tc("retry")}
                  </Button>
                </td>
              </tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {debounced ? t("noResults", { q: debounced }) : t("empty")}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isEditing = editingId === row.presentacionId;
              return (
                <tr key={row.presentacionId} className="group hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{row.nombre}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.sku ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.presentacionNombre}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {isEditing ? (
                      <Input
                        autoFocus
                        inputMode="decimal"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(row);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="h-7 w-28"
                      />
                    ) : row.precio != null ? (
                      money(row.precio)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={FUENTE_VARIANT[row.fuente]}>{t(`fuente.${row.fuente}`)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isEditing ? (
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" disabled={saving} onClick={() => save(row)}>
                          <HugeiconsIcon icon={Tick01Icon} className="size-4 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" disabled={saving} onClick={() => setEditingId(null)}>
                          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                        onClick={() => startEdit(row)}
                      >
                        <HugeiconsIcon icon={PencilEdit01Icon} className="size-4" />
                        {t("editPrice")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("totalCount", { total })}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>
              {tc("prev")}
            </Button>
            <span>{t("pageOf", { page, totalPages })}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((n) => Math.min(totalPages, n + 1))}>
              {tc("next")}
            </Button>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
