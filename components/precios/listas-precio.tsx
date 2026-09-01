"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listTiposPrecio,
  createTipoPrecio,
  updateTipoPrecio,
  deleteTipoPrecio,
  type TipoPrecio,
} from "@/lib/api/precios";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// slug estable a partir del nombre (clave que exige el BE). "Navidad en Julio" → "navidad_en_julio".
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Gestión de LISTAS de precio (tipos). Crear/renombrar/activar-desactivar. CRUD BE verificado.
// `onClone(nombre)`: crea la lista clonando de otra con ajuste ±$/% (delega en Derivar).
export function ListasPrecio({
  onChange,
  onClone,
}: {
  onChange?: () => void;
  onClone?: (nombre: string) => void;
}) {
  const t = useTranslations("precios.listas");
  const tc = useTranslations("common");
  const { state, reload } = useResource<TipoPrecio[]>(() => listTiposPrecio());
  const listas = state.kind === "ok" ? state.data : [];

  const [nombre, setNombre] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");

  async function crear() {
    const n = nombre.trim();
    if (!n || busy) return;
    setBusy(true);
    try {
      await createTipoPrecio({ clave: slugify(n), nombre: n });
      toast.success(t("created", { nombre: n }));
      setNombre("");
      reload();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function renombrar(id: string) {
    const n = editName.trim();
    if (!n) return;
    setBusy(true);
    try {
      await updateTipoPrecio(id, { nombre: n });
      toast.success(t("renamed"));
      setEditId(null);
      reload();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActivo(l: TipoPrecio) {
    setBusy(true);
    try {
      if (l.activo === false) {
        await updateTipoPrecio(l.id, { activo: true });
      } else {
        await deleteTipoPrecio(l.id); // baja lógica
      }
      reload();
      onChange?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Crear nueva lista */}
      <div className="flex flex-wrap items-end gap-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("newName")}</span>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crear()}
            placeholder={t("newPlaceholder")}
            className="max-w-sm"
          />
          {nombre.trim() && (
            <span className="text-[11px] text-muted-foreground">
              {t("claveHint", { clave: slugify(nombre) })}
            </span>
          )}
        </label>
        <div className="flex gap-2">
          <Button onClick={crear} disabled={!nombre.trim() || busy}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("createEmpty")}
          </Button>
          {onClone && (
            <Button
              variant="outline"
              disabled={!nombre.trim() || busy}
              onClick={() => onClone(nombre.trim())}
            >
              {t("createClone")}
            </Button>
          )}
        </div>
      </div>

      {/* Tabla de listas */}
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.clave")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  {tc("loading")}
                </td>
              </tr>
            )}
            {state.kind === "ok" && listas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            )}
            {listas.map((l) => {
              const esRegular = l.clave === "regular";
              const activo = l.activo !== false;
              return (
                <tr key={l.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">
                    {editId === l.id ? (
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renombrar(l.id);
                          if (e.key === "Escape") setEditId(null);
                        }}
                        className="h-7 max-w-xs"
                      />
                    ) : (
                      (l.nombre ?? l.clave)
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.clave}</td>
                  <td className="px-3 py-2">
                    <Badge variant={activo ? "secondary" : "outline"}>
                      {activo ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {editId === l.id ? (
                        <>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => renombrar(l.id)}>
                            {tc("save")}
                          </Button>
                          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditId(null)}>
                            {tc("cancel")}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditId(l.id);
                              setEditName(l.nombre ?? "");
                            }}
                          >
                            {tc("edit")}
                          </Button>
                          {/* La lista 'regular' no se desactiva (es el precio base). */}
                          {!esRegular && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              className={activo ? "text-destructive hover:text-destructive" : ""}
                              onClick={() => toggleActivo(l)}
                            >
                              {activo ? t("deactivate") : t("activate")}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
