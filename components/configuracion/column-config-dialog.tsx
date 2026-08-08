"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  actualizarColumna,
  setComposicionRender,
  type ColumnaCatalogo,
  type UpdateColumnaInput,
  type Transicion,
} from "@/lib/api/tablero";
import { listProductos, type Producto } from "@/lib/api/inventario";
import { listGruposFacturacion } from "@/lib/api/grupos-facturacion";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp01Icon, ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Column `tipo` vocabulary (BE Swagger enum) + option sources (BE-documented).
// Listing a fixed contract enum in a control is not business hardcode.
const TIPOS = ["texto", "select", "toggle", "hora", "fecha", "badge", "accion", "derivado"];
const OPTION_SOURCES = ["medicos", "enfermeras", "tipos_cita", "estados"];

interface AccionRow {
  key: string;
  labelKey: string;
  icon?: string;
  kind?: string;
  href?: string;
}

// "Simple de configurar": configura UNA columna con controles amables (no JSON).
// Muestra la config específica según el `tipo`. Persiste con PUT /tablero/columnas/:id.
export function ColumnConfigDialog({
  col,
  tablero,
  renderEfectivo,
  labelActual,
  transiciones,
  onClose,
  onSaved,
}: {
  col: ColumnaCatalogo;
  // Tablero (servicio) en cuyo contexto se configura: el "Nombre en este servicio" es POR tablero.
  tablero: string;
  // Render EFECTIVO actual de la columna en este tablero (catálogo + override de composición): base
  // sobre la que se guarda el label para no perder min/dato/group/transition. null = sin override.
  renderEfectivo?: Record<string, unknown> | null;
  labelActual?: string; // nombre propio actual en este tablero (composición), "" si no tiene
  transiciones: Transicion[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const r = (col.render as Record<string, unknown> | null) ?? {};
  // "Nombre en este servicio" (render.label, POR tablero). Vacío = quitar el nombre propio.
  const [label, setLabel] = React.useState(labelActual ?? "");
  // Origen EFECTIVO por-tablero (composición sobre catálogo) para los ajustes POR SERVICIO (label +
  // productos del select). Se prefiere el override; si no hay, el catálogo.
  const rEf = (renderEfectivo as Record<string, unknown> | null) ?? r;
  // Select de productos_grupo (por servicio): grupo alterno o productos escogidos a mano EN ORDEN.
  const [grupoSel, setGrupoSel] = React.useState(String((rEf.grupoFacturacionId as string) ?? ""));
  const [productoIds, setProductoIds] = React.useState<string[]>(
    Array.isArray(rEf.productoIds) ? (rEf.productoIds as string[]).map(String) : [],
  );

  const [tipo, setTipo] = React.useState<string>(col.tipo);
  const [binding, setBinding] = React.useState(col.binding ?? "");
  const [editable, setEditable] = React.useState(!!col.editable);
  const [permiso, setPermiso] = React.useState(col.permiso ?? "");
  const [optionsSource, setOptionsSource] = React.useState((r.optionsSource as string) ?? "");
  const [writeBinding, setWriteBinding] = React.useState((r.writeBinding as string) ?? "");
  const [transition, setTransition] = React.useState((r.transition as string) ?? "");
  const [estampa, setEstampa] = React.useState((r.estampa as string) ?? "");
  const [group, setGroup] = React.useState((r.group as string) ?? "");
  const [compute, setCompute] = React.useState((r.compute as string) ?? "");
  const [actions, setActions] = React.useState<AccionRow[]>(
    Array.isArray(r.actions) ? (r.actions as AccionRow[]) : [],
  );
  // Celda de acción: enseñar bajo el botón a quién se asignó (p. ej. la enfermera), en vez de gastar
  // una columna entera de la tabla. `asignadoDe` dice de qué columna sale el nombre.
  const [mostrarAsignado, setMostrarAsignado] = React.useState(!!r.mostrarAsignado);
  const [asignadoDe, setAsignadoDe] = React.useState((r.asignadoDe as string) ?? "");
  const [busy, setBusy] = React.useState(false);

  // Preserva las claves NO gestionadas por este diálogo (group, postAccion, color,
  // background, ancho…): parte del render existente y solo setea/limpia las del tipo.
  function buildRender(): Record<string, unknown> | null {
    const base: Record<string, unknown> = { ...r };
    const setOrDel = (k: string, v: unknown) => {
      if (v == null || v === "") delete base[k];
      else base[k] = v;
    };
    if (tipo === "select") {
      setOrDel("optionsSource", optionsSource);
      setOrDel("writeBinding", writeBinding);
    } else if (tipo === "toggle") {
      setOrDel("transition", transition);
      setOrDel("estampa", estampa);
      setOrDel("group", group); // encadenamiento: mismo group → se encadenan
    } else if (tipo === "derivado") {
      setOrDel("compute", compute);
    } else if (tipo === "accion") {
      if (actions.length) base.actions = actions;
      else delete base.actions;
      setOrDel("mostrarAsignado", mostrarAsignado || "");
      setOrDel("asignadoDe", asignadoDe.trim());
    }
    return Object.keys(base).length ? base : null;
  }

  async function submit() {
    setBusy(true);
    try {
      const payload = {
        tipo,
        binding: binding.trim(),
        editable,
        permiso: permiso.trim() || undefined,
        render: buildRender(),
      } as unknown as UpdateColumnaInput;
      await actualizarColumna(col.id, payload);
      // Ajustes POR TABLERO (composición, no catálogo): "Nombre en este servicio" (render.label) y, para
      // un select de productos_grupo, el grupo alterno o los productos escogidos EN ORDEN (render.productoIds
      // gana sobre grupoFacturacionId, y este sobre el grupo del servicio). Se manda el render EFECTIVO
      // completo + estas llaves, para no perder optionsSource/writeBinding/min/dato/group/transition.
      const esProductosGrupo = tipo === "select" && optionsSource === "productos_grupo";
      const compRender: Record<string, unknown> = { ...(renderEfectivo ?? {}) };
      compRender.label = label.trim(); // "" = sin nombre propio (el BE lo trata como vacío)
      if (esProductosGrupo) {
        if (productoIds.length) compRender.productoIds = productoIds;
        else delete compRender.productoIds;
        if (grupoSel) compRender.grupoFacturacionId = grupoSel;
        else delete compRender.grupoFacturacionId;
      }
      await setComposicionRender(tablero, col.id, compRender);
      toast.success(t("saved"));
      onSaved();
      onClose();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${t("configure")}: ${tRoot(col.labelKey)}`}
      onSubmit={submit}
      submitting={busy}
      canSubmit={!busy && !!binding.trim()}
    >
      {/* Nombre propio del negocio para esta columna EN ESTE servicio (re-etiquetar sin desplegar). El
          marcador es el nombre actual traducido; vacío = volver al de siempre. */}
      <Field label={t("cfgLabel")} hint={t("cfgLabelHelp")}>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={tRoot(col.labelKey)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("colTipo")}>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIPOS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("colBinding")} hint={t("colBindingHint")}>
          <Input value={binding} onChange={(e) => setBinding(e.target.value)} placeholder="cita.motivo" />
        </Field>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={editable} onCheckedChange={(v) => setEditable(v === true)} />
          {t("colEditable")}
        </label>
        <Field label={t("cfgPermiso")} hint={t("cfgPermisoHint")}>
          <Input value={permiso} onChange={(e) => setPermiso(e.target.value)} placeholder="citas.update" />
        </Field>
      </div>

      {/* Config específica por tipo */}
      {tipo === "select" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgOptionsSource")}>
            <Select value={optionsSource} onValueChange={setOptionsSource}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {OPTION_SOURCES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cfgWriteBinding")} hint={t("cfgWriteBindingHint")}>
            <Input value={writeBinding} onChange={(e) => setWriteBinding(e.target.value)} placeholder="cita.medicoId" />
          </Field>
        </div>
      )}

      {/* Productos del select (por servicio): grupo alterno o productos escogidos a mano, en orden. */}
      {tipo === "select" && optionsSource === "productos_grupo" && (
        <ProductosGrupoConfig
          grupoSel={grupoSel}
          onGrupo={setGrupoSel}
          productoIds={productoIds}
          onProductoIds={setProductoIds}
        />
      )}

      {tipo === "toggle" && (
        <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgTransition")}>
            <Select value={transition} onValueChange={setTransition}>
              <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {transiciones.map((tr) => <SelectItem key={tr.clave} value={tr.clave}>{tr.clave}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("cfgEstampa")} hint={t("cfgEstampaHint")}>
            <Input value={estampa} onChange={(e) => setEstampa(e.target.value)} placeholder="llegadaEn" />
          </Field>
          <Field label={t("cfgGroup")} hint={t("cfgGroupHint")}>
            <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="flujo_atencion" />
          </Field>
        </div>
      )}

      {tipo === "derivado" && (
        <div className="rounded-md border bg-muted/30 p-3">
          <Field label={t("cfgCompute")} hint={t("cfgComputeHint")}>
            <Input value={compute} onChange={(e) => setCompute(e.target.value)} placeholder="esperaMin" />
          </Field>
        </div>
      )}

      {tipo === "accion" && (
        <>
          <AccionesEditor actions={actions} onChange={setActions} />
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={mostrarAsignado}
                onCheckedChange={(v) => setMostrarAsignado(v === true)}
              />
              <span>{t("cfgMostrarAsignado")}</span>
            </label>
            <p className="text-xs text-muted-foreground">{t("cfgMostrarAsignadoHelp")}</p>
            {mostrarAsignado && (
              <Input
                value={asignadoDe}
                onChange={(e) => setAsignadoDe(e.target.value)}
                placeholder={t("cfgAsignadoDe")}
              />
            )}
          </div>
        </>
      )}
    </FormDialog>
  );
}

// Config del select `productos_grupo` POR SERVICIO: elegir OTRO grupo de facturación, o escoger los
// productos a mano y ORDENARLOS (arrastrando). productoIds gana sobre el grupo. Con nada, el grupo del
// servicio. Handoff HANDOFF-select-de-productos-y-orden-columnas.
const GRUPO_SERVICIO = "__servicio__";
function ProductosGrupoConfig({
  grupoSel,
  onGrupo,
  productoIds,
  onProductoIds,
}: {
  grupoSel: string;
  onGrupo: (v: string) => void;
  productoIds: string[];
  onProductoIds: (v: string[]) => void;
}) {
  const t = useTranslations("configuracion.tableros");
  const tRoot = useTranslations();
  const gruposRes = useResource(() => listGruposFacturacion(), []);
  const poolRes = useResource<Producto[]>(() => listProductos({}), []);
  const grupos = gruposRes.state.kind === "ok" ? gruposRes.state.data : [];
  const pool = React.useMemo(() => (poolRes.state.kind === "ok" ? poolRes.state.data : []), [poolRes.state]);
  const prodMap = React.useMemo(() => new Map(pool.map((p) => [p.id, p] as const)), [pool]);
  const grupoLabel = (labelKey: string, fallback: string) => (labelKey && tRoot.has(labelKey) ? tRoot(labelKey) : fallback);

  const [q, setQ] = React.useState("");
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const chosen = new Set(productoIds);
  const resultados = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return pool
      .filter((p) => !chosen.has(p.id))
      .filter((p) => `${p.nombre} ${p.sku ?? ""}`.toLowerCase().includes(term))
      .slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pool, productoIds]);

  const add = (id: string) => { onProductoIds([...productoIds, id]); setQ(""); };
  const remove = (id: string) => onProductoIds(productoIds.filter((x) => x !== id));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= productoIds.length || from === to) return;
    const arr = productoIds.slice();
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    onProductoIds(arr);
  };
  const nombreDe = (id: string) => {
    const p = prodMap.get(id);
    return p ? { nombre: p.nombre, sku: p.sku } : { nombre: id.slice(0, 8), sku: "" };
  };

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("cfgProductosTitle")}</span>
      <Field label={t("cfgGrupoAlterno")}>
        <Select value={grupoSel || GRUPO_SERVICIO} onValueChange={(v) => onGrupo(v === GRUPO_SERVICIO ? "" : v)}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={GRUPO_SERVICIO}>{t("cfgGrupoServicio")}</SelectItem>
            {grupos.map((g) => (
              <SelectItem key={g.id} value={g.id}>{grupoLabel(g.labelKey, g.clave)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("cfgEscogeProductos")}</span>
        <div className="relative">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("cfgBuscarProducto")} />
          {resultados.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-background shadow-md">
              {resultados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => add(p.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                    <span className="font-mono text-xs text-muted-foreground">{p.sku || "—"}</span>
                    <span className="truncate">{p.nombre}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Elegidos, EN ORDEN: se arrastran (o ↑/↓) para ordenarlos; lo más usado primero. */}
        {productoIds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("cfgProductosHelp")}</p>
        ) : (
          <ul className="divide-y rounded-md border bg-background">
            {productoIds.map((id, i) => {
              const info = nombreDe(id);
              return (
                <li
                  key={id}
                  draggable
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIdx != null) move(dragIdx, i); setDragIdx(null); }}
                  className={"flex cursor-grab items-center gap-2 px-2.5 py-1.5 text-sm " + (dragIdx === i ? "opacity-50" : "")}
                >
                  <span className="text-muted-foreground">⠿</span>
                  <span className="font-mono text-xs text-muted-foreground">{info.sku || "—"}</span>
                  <span className="min-w-0 flex-1 truncate">{info.nombre}</span>
                  <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tRoot("tableroEditor.moveUp")}>
                    <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => move(i, i + 1)} disabled={i === productoIds.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label={tRoot("tableroEditor.moveDown")}>
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
                  </button>
                  <button type="button" onClick={() => remove(id)} className="text-destructive hover:opacity-70" aria-label={tRoot("common.remove")}>
                    <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {productoIds.length > 0 && <p className="text-[11px] text-muted-foreground">{t("cfgProductosHelp")}</p>}
      </div>
    </div>
  );
}

function AccionesEditor({ actions, onChange }: { actions: AccionRow[]; onChange: (a: AccionRow[]) => void }) {
  const t = useTranslations("configuracion.tableros");
  function patch(i: number, k: keyof AccionRow, v: string) {
    onChange(actions.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
  }
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("cfgActions")}</span>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...actions, { key: "", labelKey: "", kind: "link" }])}>
          {t("cfgAddAction")}
        </Button>
      </div>
      {actions.length === 0 && <p className="text-xs text-muted-foreground">{t("cfgNoActions")}</p>}
      {actions.map((a, i) => (
        <div key={i} className="grid grid-cols-2 gap-2 rounded-md border bg-background p-2">
          <Input value={a.key} onChange={(e) => patch(i, "key", e.target.value)} placeholder={t("cfgActionKey")} />
          <Input value={a.labelKey} onChange={(e) => patch(i, "labelKey", e.target.value)} placeholder={t("cfgActionLabel")} />
          <Select value={a.kind ?? "link"} onValueChange={(v) => patch(i, "kind", v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="link">{t("cfgKindLink")}</SelectItem>
              <SelectItem value="soon">{t("cfgKindSoon")}</SelectItem>
            </SelectContent>
          </Select>
          <Input value={a.icon ?? ""} onChange={(e) => patch(i, "icon", e.target.value)} placeholder={t("cfgActionIcon")} />
          {a.kind === "link" && (
            <Input className="col-span-2" value={a.href ?? ""} onChange={(e) => patch(i, "href", e.target.value)} placeholder="/clientes/:pacienteId" />
          )}
          <Button type="button" size="sm" variant="ghost" className="col-span-2 justify-self-end text-destructive" onClick={() => onChange(actions.filter((_, idx) => idx !== i))}>
            {t("cfgRemove")}
          </Button>
        </div>
      ))}
    </div>
  );
}
