"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, Menu01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { NAV_MANIFEST } from "@/lib/nav-manifest";
import {
  getAllMenu,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  type MenuItem,
} from "@/lib/api/menu";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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

const ROOT = "__root__";
const MAX_LEVELS = 4;
type Zone = "before" | "inside" | "after";

// ---- helpers de árbol (por `parentClave`; el orden lo da `orden`) ---------------------------------

function parentKey(it: MenuItem): string {
  return it.parentClave ?? ROOT;
}
function childrenOf(items: MenuItem[], parent: string | null): MenuItem[] {
  const k = parent ?? ROOT;
  return items
    .filter((i) => parentKey(i) === k)
    .sort((a, b) => a.orden - b.orden);
}
// Nivel del nodo (raíz = 1). `null` = raíz → 0 (para un padre inexistente).
function levelOfClave(items: MenuItem[], clave: string | null): number {
  let level = 0;
  let cur: string | null = clave;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const p = items.find((i) => i.clave === cur);
    level += 1;
    cur = p ? p.parentClave ?? null : null;
  }
  return level;
}
// Altura del subárbol de `node` (hoja = 1).
function heightOf(items: MenuItem[], node: MenuItem): number {
  const kids = childrenOf(items, node.clave);
  if (kids.length === 0) return 1;
  return 1 + Math.max(...kids.map((c) => heightOf(items, c)));
}
// ¿`target` es el propio `drag` o un descendiente suyo? (no se puede soltar dentro de sí mismo)
function isSelfOrDescendant(items: MenuItem[], drag: MenuItem, target: MenuItem): boolean {
  if (target.id === drag.id) return true;
  let cur: string | null = target.parentClave ?? null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (cur === drag.clave) return true;
    const p = items.find((i) => i.clave === cur);
    cur = p ? p.parentClave ?? null : null;
  }
  return false;
}

type MoveResult = { items: MenuItem[]; changed: { id: string; parentClave: string | null; orden: number }[] };

// Calcula el nuevo árbol tras soltar `dragId` en `zone` respecto de `targetId`. Devuelve null si el
// movimiento es inválido (dentro de sí mismo) y {error} si excede la profundidad máxima.
function applyMove(
  items: MenuItem[],
  dragId: string,
  targetId: string,
  zone: Zone,
): MoveResult | null | { error: "depth" } {
  const drag = items.find((i) => i.id === dragId);
  const target = items.find((i) => i.id === targetId);
  if (!drag || !target || dragId === targetId) return null;
  if (isSelfOrDescendant(items, drag, target)) return null;

  // Grupos por clave de padre (ROOT para las raíces), ordenados.
  const groups = new Map<string, MenuItem[]>();
  for (const it of items) {
    const k = parentKey(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  for (const arr of groups.values()) arr.sort((a, b) => a.orden - b.orden);

  // Quitar drag de su grupo actual.
  const fromKey = parentKey(drag);
  groups.set(fromKey, (groups.get(fromKey) ?? []).filter((i) => i.id !== dragId));

  let newParentClave: string | null;
  if (zone === "inside") {
    newParentClave = target.clave;
    const arr = (groups.get(target.clave) ?? []).slice();
    arr.push(drag);
    groups.set(target.clave, arr);
  } else {
    newParentClave = target.parentClave ?? null;
    const key = parentKey(target);
    const arr = (groups.get(key) ?? []).slice();
    const idx = arr.findIndex((i) => i.id === targetId);
    arr.splice(zone === "before" ? idx : idx + 1, 0, drag);
    groups.set(key, arr);
  }

  // Tope de 4 niveles: nivel del nuevo padre + altura del subárbol arrastrado.
  if (levelOfClave(items, newParentClave) + heightOf(items, drag) > MAX_LEVELS) {
    return { error: "depth" };
  }

  // Reconstruir con parentClave + orden nuevos; recolectar lo que cambió para persistir.
  const updated = items.map((i) => ({ ...i }));
  const byId = new Map(updated.map((i) => [i.id, i]));
  const changed: MoveResult["changed"] = [];
  for (const [k, arr] of groups.entries()) {
    const newParent = k === ROOT ? null : k;
    arr.forEach((node, orden) => {
      const u = byId.get(node.id)!;
      if ((u.parentClave ?? null) !== newParent || u.orden !== orden) {
        u.parentClave = newParent;
        u.orden = orden;
        changed.push({ id: u.id, parentClave: newParent, orden });
      }
    });
  }
  return { items: updated, changed };
}

// ---- componente --------------------------------------------------------------------------------

export function MenuEditor() {
  const t = useTranslations("menuEditor");
  const tRoot = useTranslations();
  const [items, setItems] = React.useState<MenuItem[] | null>(null);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ id: string; zone: Zone } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<MenuItem | null>(null);
  // Edición en línea del nombre libre (labelCustom).
  const [editing, setEditing] = React.useState<{ id: string; value: string } | null>(null);
  // Pila de deshacer: instantáneas del árbol (parentClave/orden/visible) antes de cada cambio.
  const [undoStack, setUndoStack] = React.useState<MenuItem[][]>([]);

  // No hace setState de forma síncrona (el rule react-hooks lo prohíbe dentro de efectos): el
  // estado solo se toca dentro de los handlers de la promesa.
  const load = React.useCallback(() => {
    getAllMenu()
      .then((list) => {
        setItems(list);
        setLoadErr(null);
      })
      .catch((e: unknown) => setLoadErr(apiErrorMessage(e)));
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  const label = React.useCallback(
    (it: MenuItem) => {
      // labelCustom (nombre libre) pisa la clave i18n; si no, traducir labelKey (o mostrarla cruda).
      const custom = it.labelCustom?.trim();
      if (custom) return custom;
      if (it.tipo === "separador") return t("separator");
      try {
        return tRoot.has(it.labelKey) ? tRoot(it.labelKey) : it.labelKey;
      } catch {
        return it.labelKey;
      }
    },
    [t, tRoot],
  );

  const snapshot = React.useCallback(() => {
    if (items) setUndoStack((s) => [...s, items.map((i) => ({ ...i }))]);
  }, [items]);

  async function persist(changed: { id: string; parentClave: string | null; orden: number }[]) {
    if (changed.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        changed.map((c) => updateMenuItem(c.id, { parentClave: c.parentClave, orden: c.orden })),
      );
      toast.success(t("saved"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      load(); // reponer el estado del servidor si algo falló
    } finally {
      setSaving(false);
    }
  }

  function handleDrop(targetId: string) {
    if (!items || !dragId) return;
    const zone = over?.zone ?? "after";
    const res = applyMove(items, dragId, targetId, zone);
    setDragId(null);
    setOver(null);
    if (!res) return;
    if ("error" in res) {
      toast.error(t("depthError", { n: MAX_LEVELS }));
      return;
    }
    snapshot();
    setItems(res.items);
    void persist(res.changed);
  }

  async function toggleVisible(it: MenuItem) {
    if (!items) return;
    snapshot();
    setItems(items.map((i) => (i.id === it.id ? { ...i, visible: !i.visible } : i)));
    try {
      await updateMenuItem(it.id, { visible: !it.visible });
    } catch (e) {
      toast.error(apiErrorMessage(e));
      load();
    }
  }

  async function addFromManifest(path: string, labelKey: string) {
    if (!items) return;
    // clave única derivada del path.
    const base = path.replace(/^\//, "").replace(/\//g, "-") || "home";
    let clave = base;
    let n = 2;
    const claves = new Set(items.map((i) => i.clave));
    while (claves.has(clave)) clave = `${base}-${n++}`;
    const orden = childrenOf(items, null).length;
    try {
      await createMenuItem({ clave, labelKey, path, parentClave: null, orden, visible: true });
      toast.success(t("added"));
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  // Genera una clave única a partir de una base.
  function uniqueClave(base: string): string {
    const claves = new Set((items ?? []).map((i) => i.clave));
    let clave = base;
    let n = 2;
    while (claves.has(clave)) clave = `${base}-${n++}`;
    return clave;
  }

  // Nuevo grupo (caja/dropdown sin ruta, tipo:'grupo'). Nace con un nombre por defecto → renómbralo.
  async function nuevoGrupo() {
    if (!items) return;
    const orden = childrenOf(items, null).length;
    try {
      await createMenuItem({
        clave: uniqueClave("grupo"),
        tipo: "grupo",
        labelCustom: t("newGroupName"),
        parentClave: null,
        orden,
        visible: true,
      });
      toast.success(t("groupAdded"));
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  // Separador (línea divisoria sin etiqueta ni ruta, tipo:'separador').
  async function agregarSeparador() {
    if (!items) return;
    const orden = childrenOf(items, null).length;
    try {
      await createMenuItem({
        clave: uniqueClave("sep"),
        tipo: "separador",
        parentClave: null,
        orden,
        visible: true,
      });
      toast.success(t("separatorAdded"));
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  // Guardar el nombre libre. Vacío → null (vuelve al labelKey i18n).
  async function saveRename() {
    if (!editing || !items) return;
    const { id, value } = editing;
    setEditing(null);
    const labelCustom = value.trim() || null;
    const target = items.find((i) => i.id === id);
    if (target && (target.labelCustom ?? null) === labelCustom) return; // sin cambios
    setItems(items.map((i) => (i.id === id ? { ...i, labelCustom } : i)));
    try {
      await updateMenuItem(id, { labelCustom });
      toast.success(t("saved"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      load();
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const it = toDelete;
    setToDelete(null);
    try {
      await deleteMenuItem(it.id);
      toast.success(t("deleted"));
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function undo() {
    const prev = undoStack[undoStack.length - 1];
    if (!prev || !items) return;
    setUndoStack((s) => s.slice(0, -1));
    setItems(prev);
    // Persistir las diferencias respecto al estado actual.
    const cur = new Map(items.map((i) => [i.id, i]));
    const changed = prev.filter((p) => {
      const c = cur.get(p.id);
      return c && ((c.parentClave ?? null) !== (p.parentClave ?? null) || c.orden !== p.orden || c.visible !== p.visible);
    });
    setSaving(true);
    try {
      await Promise.all(
        changed.map((p) => updateMenuItem(p.id, { parentClave: p.parentClave ?? null, orden: p.orden, visible: p.visible })),
      );
      toast.success(t("undone"));
    } catch (e) {
      toast.error(apiErrorMessage(e));
      load();
    } finally {
      setSaving(false);
    }
  }

  // Rutas del manifiesto que aún no están en el menú (por path).
  const availableRoutes = React.useMemo(() => {
    if (!items) return [];
    const present = new Set(items.map((i) => i.path));
    return NAV_MANIFEST.filter((r) => !present.has(r.path));
  }, [items]);

  function onRowDragOver(e: React.DragEvent, it: MenuItem) {
    if (!dragId || dragId === it.id) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const third = rect.height / 3;
    const zone: Zone = y < third ? "before" : y > rect.height - third ? "after" : "inside";
    setOver({ id: it.id, zone });
  }

  function renderNode(it: MenuItem, depth: number): React.ReactNode {
    const kids = items ? childrenOf(items, it.clave) : [];
    const isOver = over?.id === it.id;
    const esGrupo = it.tipo === "grupo";
    const esSeparador = it.tipo === "separador";
    const dragProps = {
      draggable: true,
      onDragStart: () => setDragId(it.id),
      onDragEnd: () => {
        setDragId(null);
        setOver(null);
      },
      onDragOver: (e: React.DragEvent) => onRowDragOver(e, it),
      onDrop: () => handleDrop(it.id),
      style: { marginLeft: depth * 20 },
    };
    const overCls = cn(
      dragId === it.id && "opacity-50",
      isOver && over?.zone === "inside" && "ring-2 ring-primary",
      isOver && over?.zone === "before" && "border-t-2 border-t-primary",
      isOver && over?.zone === "after" && "border-b-2 border-b-primary",
    );

    if (esSeparador) {
      return (
        <div key={it.id}>
          <div
            {...dragProps}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-1",
              overCls,
            )}
          >
            <span className="cursor-grab text-muted-foreground" aria-hidden>
              <HugeiconsIcon icon={Menu01Icon} className="size-4" />
            </span>
            <span className="h-px flex-1 bg-border" aria-hidden />
            <span className="text-xs text-muted-foreground">{t("separator")}</span>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100"
              aria-label={t("delete")}
              onClick={() => setToDelete(it)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={it.id}>
        <div
          {...dragProps}
          className={cn(
            "group relative flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm",
            esGrupo && "border-primary/30 bg-primary/5",
            overCls,
            !it.visible && "opacity-60",
          )}
        >
          <span className="cursor-grab text-muted-foreground" aria-hidden>
            <HugeiconsIcon icon={Menu01Icon} className="size-4" />
          </span>
          {editing?.id === it.id ? (
            <Input
              autoFocus
              value={editing.value}
              onChange={(e) => setEditing({ id: it.id, value: e.target.value })}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") setEditing(null);
              }}
              placeholder={t("renamePlaceholder")}
              className="h-7 flex-1"
            />
          ) : (
            <span
              className="flex-1 cursor-text truncate"
              title={t("renameHint")}
              onDoubleClick={() => setEditing({ id: it.id, value: it.labelCustom ?? "" })}
            >
              <span className={cn("font-medium", esGrupo && "font-semibold")}>{label(it)}</span>
              {!esGrupo && it.path && it.path !== "#" ? (
                <span className="ml-2 text-xs text-muted-foreground">{it.path}</span>
              ) : null}
            </span>
          )}
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            {t("visible")}
            <Switch checked={it.visible} onCheckedChange={() => toggleVisible(it)} />
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground opacity-0 group-hover:opacity-100"
            aria-label={t("delete")}
            onClick={() => setToDelete(it)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          </Button>
        </div>
        {kids.length > 0 ? (
          <div className="mt-1 flex flex-col gap-1">
            {kids.map((c) => renderNode(c, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="text-sm text-destructive">
        {loadErr} <Button variant="link" onClick={load}>{t("retry")}</Button>
      </div>
    );
  }
  if (!items) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  const roots = childrenOf(items, null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      {/* Árbol editable */}
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={nuevoGrupo} disabled={saving}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("newGroup")}
          </Button>
          <Button size="sm" variant="outline" onClick={agregarSeparador} disabled={saving}>
            {t("addSeparator")}
          </Button>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden />
          <Button size="sm" variant="outline" onClick={undo} disabled={saving || undoStack.length === 0}>
            {t("undo")}
          </Button>
          {saving ? <span className="text-xs text-muted-foreground">{t("saving")}</span> : null}
        </div>
        <div className="flex flex-col gap-1">
          {roots.map((r) => renderNode(r, 0))}
        </div>
      </div>

      {/* Panel: rutas disponibles del manifiesto */}
      <aside className="rounded-lg border bg-muted/30 p-3">
        <h2 className="text-sm font-semibold">{t("availableTitle")}</h2>
        <p className="mb-3 mt-1 text-xs text-muted-foreground">{t("availableHelp")}</p>
        <div className="flex flex-col gap-1">
          {availableRoutes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("availableEmpty")}</p>
          ) : (
            availableRoutes.map((r) => (
              <div
                key={r.path}
                className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm"
              >
                <span className="flex-1 truncate">
                  <span className="font-medium">{tRoot.has(r.labelKey) ? tRoot(r.labelKey) : r.labelKey}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.path}</span>
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={t("add")}
                  onClick={() => addFromManifest(r.path, r.labelKey)}
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </aside>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBody", { name: toDelete ? label(toDelete) : "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
