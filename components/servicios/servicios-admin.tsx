"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { useDragReorder, DRAG_GRIP } from "@/hooks/use-drag-reorder";

import {
  getServicios,
  createServicio,
  updateServicio,
  updateServicioPorClave,
  type Servicio,
  type CreateServicioPayload,
  type UpdateServicioPorClavePayload,
} from "@/lib/api/servicios";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { payloadBulkDirty } from "@/lib/servicios/bulk-diff";
import { ColorField, Toggle, GrupoSelect, StartStepField, PrimaryPackageRuleSelect } from "@/components/servicios/servicio-form-fields";
import { FormSheet } from "@/components/kit/form-sheet";
import { Field } from "@/components/kit/field";
import { useConfirm } from "@/components/kit/confirm-host";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import { missingFields } from "@/lib/forms/missing";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useMe, isAdmin } from "@/hooks/use-me";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { PageContainer, PageHeader } from "@/components/ui/page";

// slug estable para la clave (= clave del tablero/pestaña).
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Selector de centro con opción especial "Todos los centros" (edición multicentro por clave).
const TODOS = "__todos__";

// Campos que se comparan entre centros para marcar "≠ por centro" en modo Todos.
const CAMPOS_DIFF = [
  "name",
  "color",
  "sortOrder",
  "billingGroupId",
  "productId",
  "requiresTechnician",
  "requiresNurse",
  "badge",
] as const;
type CampoDiff = (typeof CAMPOS_DIFF)[number];

// Fila de la tabla: un servicio por CLAVE. En modo un-centro `entradas` tiene 1; en "Todos" tiene la
// fila de cada centro, y `diffs` marca los campos que difieren entre centros.
type FilaServicio = {
  clave: string;
  rep: Servicio; // representativo (defaults del editor)
  entradas: { centro: Centro; s: Servicio }[];
  diffs: Set<CampoDiff>;
  todos: boolean;
};

function unir(listas: { centro: Centro; ss: Servicio[] }[]): FilaServicio[] {
  const porClave = new Map<string, { centro: Centro; s: Servicio }[]>();
  for (const { centro, ss } of listas) {
    for (const s of ss) {
      (porClave.get(s.slug) ?? porClave.set(s.slug, []).get(s.slug)!).push({ centro, s });
    }
  }
  const filas: FilaServicio[] = [];
  for (const [clave, entradas] of porClave) {
    const diffs = new Set<CampoDiff>();
    for (const campo of CAMPOS_DIFF) {
      const vals = new Set(entradas.map((e) => JSON.stringify((e.s as Record<string, unknown>)[campo] ?? null)));
      if (vals.size > 1) diffs.add(campo);
    }
    filas.push({ clave, rep: entradas[0].s, entradas, diffs, todos: true });
  }
  return filas.sort((a, b) => (a.rep.sortOrder ?? 0) - (b.rep.sortOrder ?? 0) || a.rep.name.localeCompare(b.rep.name));
}

// Servicios (config = pestañas de frontdesk). "Todos los centros" (RBAC servicios.multicentro) edita
// la MISMA clave en todos los centros de una vez, vía PUT /servicios/por-clave/:clave (el BE devuelve
// el diff por centro). `activo` sigue siendo POR CENTRO (no hay bulk). Reuso, no duplicar.
export function ServiciosAdmin({ embedded }: { embedded?: boolean } = {}) {
  const t = useTranslations("servicios");
  const tc = useTranslations("common");
  const { can } = useCan();
  const meState = useMe();
  // Espejo del contrato BE: rol admin + permiso fino (con solo el perm, el BE responde 403).
  const puedeMulti =
    can("servicios.multicentro") && meState.kind === "ok" && isAdmin(meState.me);

  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = React.useMemo(
    () => (centrosRes.state.kind === "ok" ? centrosRes.state.data : []),
    [centrosRes.state],
  );
  const [centroSel, setCentroSel] = React.useState("");
  const esTodos = centroSel === TODOS && puedeMulti;
  // El sentinela __todos__ JAMÁS puede caer como id de centro (se enviaría como X-Tenant-ID).
  const centro =
    centroSel === TODOS ? (esTodos ? "" : centros[0]?.id || "") : centroSel || centros[0]?.id || "";

  // Config = ver TODOS (incl. apagados). En "Todos" se une la lista de cada centro por clave.
  const { state, reload } = useResource<FilaServicio[]>(
    async () => {
      if (esTodos) {
        if (!centros.length) return [];
        const resultados = await Promise.all(
          centros.map((c) =>
            getServicios(c.id, { includeInactive: true })
              .then((ss) => ({ centro: c, ss, ok: true }))
              .catch(() => ({ centro: c, ss: [] as Servicio[], ok: false })),
          ),
        );
        // Un centro que no cargó NO desaparece en silencio: se avisa (la unión quedaría incompleta
        // y un guardado bulk igual tocaría ese centro en el BE).
        const fallidos = resultados.filter((r) => !r.ok).map((r) => r.centro.name);
        if (fallidos.length > 0) {
          toast.warning(t("cargaParcial", { centros: fallidos.join(", ") }));
        }
        return unir(resultados);
      }
      if (!centro) return [];
      const uno = centros.find((c) => c.id === centro) ?? ({ id: centro, name: "" } as Centro);
      const ss = await getServicios(centro, { includeInactive: true });
      return ss
        .map<FilaServicio>((s) => ({ clave: s.slug, rep: s, entradas: [{ centro: uno, s }], diffs: new Set(), todos: false }))
        .sort((a, b) => (a.rep.sortOrder ?? 0) - (b.rep.sortOrder ?? 0) || a.rep.name.localeCompare(b.rep.name));
    },
    [esTodos, centro, centros],
  );
  const filas = state.kind === "ok" ? state.data : [];

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FilaServicio | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const centroNombre = centros.find((c) => c.id === centro)?.name ?? "";

  // Orden de los servicios = orden de las PESTAÑAS del Frontdesk (nada rígido, configurable). Arrastrar
  // una fila renumera el `orden` (0..n) y lo persiste al instante: en "Todos" por clave (multicentro),
  // en un centro solo ahí. El tablero ordena las pestañas por este `orden`.
  const [busyOrden, setBusyOrden] = React.useState(false);
  async function reordenar(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= filas.length || to >= filas.length) return;
    const arr = filas.slice();
    const [x] = arr.splice(from, 1);
    arr.splice(to, 0, x);
    setBusyOrden(true);
    try {
      await Promise.all(
        arr.map((f, i) => {
          if ((f.rep.sortOrder ?? 0) === i) return Promise.resolve();
          return esTodos
            ? updateServicioPorClave(f.clave, { sortOrder: i } as UpdateServicioPorClavePayload)
            : updateServicio(f.rep.id, { sortOrder: i }, centro);
        }),
      );
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyOrden(false);
    }
  }
  const { dragProps, rowClass } = useDragReorder(reordenar, !busyOrden);

  // Activo por centro (solo modo un-centro): apagar aquí = este centro no ofrece el servicio.
  async function toggleActivo(s: Servicio) {
    setBusyId(s.id);
    try {
      await updateServicio(s.id, { active: !s.active }, centro);
      toast.success(s.active ? t("deshabilitadoEn", { centro: centroNombre }) : t("habilitadoEn", { centro: centroNombre }));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  // Selector de centro + alta: en la página va en las actions del PageHeader; embedded conserva su
  // propia barra (ver más abajo), sin PageHeader.
  const toolbar = (
    <>
      {centros.length > 1 && (
        <Select value={esTodos ? TODOS : centro} onValueChange={setCentroSel}>
          <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* "Todos los centros" solo para quien puede editar multicentro (RBAC cosmético). */}
            {puedeMulti && <SelectItem value={TODOS}>{t("centro.todos")}</SelectItem>}
            {centros.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {/* Alta siempre por-centro-en-todos (flujo actual); en modo Todos se oculta para no confundir. */}
      {!esTodos && (
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("new")}
        </Button>
      )}
    </>
  );
  const ayuda = esTodos ? t("helpTodos") : t("helpMultiCentro");

  const content = (
    <>
      {embedded && (
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex w-full items-center justify-between gap-2">
            {toolbar}
          </div>
        </div>
      )}
      {embedded && <p className="mb-6 max-w-2xl text-sm text-muted-foreground">{ayuda}</p>}

      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.tipo")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.requisitos")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={6} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {state.kind === "ok" && filas.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t("empty")}</td></tr>
            )}
            {filas.map((f, i) => (
              <tr key={f.clave} {...dragProps(i)} className={"hover:bg-muted/30 transition " + rowClass(i)}>
                {/* Asa para arrastrar y reordenar las pestañas del Frontdesk. */}
                <td className="w-8 px-2 py-2 text-center">
                  <span className={"select-none text-base leading-none text-muted-foreground " + (busyOrden ? "opacity-30" : "cursor-grab")} title={t("ordenArrastrar")} aria-hidden>
                    {DRAG_GRIP}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: f.rep.color ?? "#94a3b8" }} />
                    {f.rep.name}
                    {f.diffs.has("name") && <DiffChip t={t} entradas={f.entradas} render={(s) => s.name} />}
                    {f.diffs.has("color") && <DiffChip t={t} entradas={f.entradas} render={(s) => s.color ?? "—"} />}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.clave}</span>
                </td>
                <td className="px-3 py-2">
                  {f.rep.productId ? <Badge variant="secondary">{t("tipoInventariable")}</Badge> : <Badge variant="outline">{t("tipoPuro")}</Badge>}
                  {f.diffs.has("productId") && <DiffChip t={t} entradas={f.entradas} render={(s) => (s.productId ? t("tipoInventariable") : t("tipoPuro"))} />}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[f.rep.requiresTechnician && t("tecnico"), f.rep.requiresNurse && t("enfermera")].filter(Boolean).join(" · ") || "—"}
                  {(f.diffs.has("requiresTechnician") || f.diffs.has("requiresNurse")) && (
                    <DiffChip t={t} entradas={f.entradas} render={(s) => [s.requiresTechnician && t("tecnico"), s.requiresNurse && t("enfermera")].filter(Boolean).join(" · ") || "—"} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {f.todos ? (
                    // No hay bulk de Activo: es POR CENTRO. Se muestra la nota, no un toggle.
                    <span className="text-xs text-muted-foreground">{t("activoPorCentro")}</span>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <Switch
                        checked={f.rep.active}
                        disabled={busyId === f.rep.id}
                        onCheckedChange={() => toggleActivo(f.rep)}
                        aria-label={t("field.activo")}
                      />
                      <span className={"text-xs " + (f.rep.active ? "text-success-foreground" : "text-muted-foreground")}>
                        {f.rep.active ? t("active") : t("inactive")}
                      </span>
                    </label>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(f); setOpen(true); }}>
                    {tc("edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ServicioForm
        open={open}
        fila={editing}
        esTodos={esTodos}
        centro={centro}
        centros={centros}
        onOpenChange={setOpen}
        onSaved={reload}
      />
    </>
  );

  return embedded ? (
    content
  ) : (
    <PageContainer>
      <PageHeader title={t("title")} description={ayuda} actions={toolbar} />
      {content}
    </PageContainer>
  );
}

// Indicador "≠ por centro" con tooltip que lista el valor de cada centro (data-driven).
function DiffChip({
  t,
  entradas,
  render,
}: {
  t: ReturnType<typeof useTranslations>;
  entradas: { centro: Centro; s: Servicio }[];
  render: (s: Servicio) => React.ReactNode;
}) {
  return (
    <Tooltip
      content={
        <span className="flex flex-col gap-0.5 text-left">
          {entradas.map((e) => (
            <span key={e.centro.id}>
              <b>{e.centro.name}:</b> {render(e.s)}
            </span>
          ))}
        </span>
      }
    >
      <Badge variant="outline" className="ml-1.5 cursor-help border-warning/40 text-[10px] text-warning-foreground">
        {t("difPorCentro")}
      </Badge>
    </Tooltip>
  );
}

type FormState = {
  clave: string;
  claveTouched: boolean; // the key was typed by hand (otherwise it follows the name)
  nombre: string;
  color: string;
  orden: string;
  grupoFacturacionId: string;
  productoId: string;
  requiereTecnico: boolean;
  requiereEnfermera: boolean;
  badge: boolean;
  allowSessionFixWithoutPackage: boolean;
  primaryPackageRule: "row" | "most_delivered";
  activo: boolean;
  startStep: string; // startStepMinutes as typed ("" = every slot)
};
const EMPTY: FormState = {
  clave: "",
  claveTouched: false,
  nombre: "",
  color: "#3b82f6",
  orden: "",
  grupoFacturacionId: "",
  productoId: "",
  requiereTecnico: false,
  requiereEnfermera: false,
  badge: true,
  allowSessionFixWithoutPackage: false,
  primaryPackageRule: "row",
  activo: true,
  startStep: "",
};

function toForm(servicio: Servicio | null): FormState {
  if (!servicio) return EMPTY;
  return {
    clave: servicio.slug,
    claveTouched: true,
    nombre: servicio.name,
    color: servicio.color ?? "#3b82f6",
    orden: servicio.sortOrder != null ? String(servicio.sortOrder) : "",
    grupoFacturacionId: servicio.billingGroupId ?? "",
    productoId: servicio.productId ?? "",
    requiereTecnico: servicio.requiresTechnician,
    requiereEnfermera: servicio.requiresNurse,
    badge: servicio.badge,
    allowSessionFixWithoutPackage: servicio.allowSessionFixWithoutPackage,
    primaryPackageRule: servicio.primaryPackageRule ?? "row",
    activo: servicio.active,
    startStep: servicio.startStepMinutes != null ? String(servicio.startStepMinutes) : "",
  };
}

function ServicioForm({
  open,
  fila,
  esTodos,
  centro,
  centros,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  fila: FilaServicio | null;
  esTodos: boolean;
  centro: string; // centro seleccionado (editar SU fila en modo un-centro)
  centros: Centro[]; // alta = crear en TODOS los centros
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("servicios");
  const tc = useTranslations("common");
  const confirm = useConfirm();
  const servicio = fila?.rep ?? null;
  const isEdit = !!servicio;
  const editandoTodos = isEdit && esTodos; // editar la clave en todos los centros

  // Reset on EVERY open (not only on another id): a cancelled edit must not come back and slip into
  // every center through "Apply to all". `inicial` is the baseline for the dirty-only bulk payload.
  const inicial = toForm(servicio);
  const [form, update] = useDialogForm<FormState>(() => toForm(servicio), open, servicio?.id);
  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    update({ [k]: v } as Partial<FormState>);
  }

  const claveEff = isEdit || form.claveTouched ? form.clave : slugify(form.nombre);
  const ordenValido = !form.orden.trim() || Number.isFinite(Number(form.orden));
  const missing = missingFields([
    [t("field.nombre"), form.nombre.trim().length > 0],
    [t("field.clave"), claveEff.trim().length > 0],
  ]);

  // Payload común (sin activo ni clave) para editar la fila (un centro o multicentro).
  function payloadComun() {
    return {
      name: form.nombre.trim(),
      color: form.color,
      sortOrder: form.orden.trim() ? Number(form.orden) : undefined,
      billingGroupId: form.grupoFacturacionId || undefined,
      productId: form.productoId || undefined,
      requiresTechnician: form.requiereTecnico,
      requiresNurse: form.requiereEnfermera,
      badge: form.badge,
      allowSessionFixWithoutPackage: form.allowSessionFixWithoutPackage,
      primaryPackageRule: form.primaryPackageRule,
      startStepMinutes: Number(form.startStep) > 0 ? Number(form.startStep) : null,
    };
  }

  // Three saves, one guard: multi-center (PUT por-clave, the CORRECT endpoint — it does not iterate
  // updateServicio; only the fields the user CHANGED travel, see lib/servicios/bulk-diff.ts), one
  // center, or create in every center.
  const { submitting, submit } = useSubmit(
    async () => {
      if (editandoTodos && servicio) {
        const payload = payloadBulkDirty(inicial, form);
        const res = await updateServicioPorClave(servicio.slug, payload as UpdateServicioPorClavePayload, centro || undefined);
        const conCambios = res.actualizados.filter((a) => Object.keys(a.cambios).length > 0).length;
        toast.success(conCambios > 0 ? t("multiAplicado", { n: conCambios }) : t("multiSinCambios"));
      } else if (servicio) {
        await updateServicio(servicio.id, { ...payloadComun(), active: form.activo }, centro);
        toast.success(t("updated"));
      } else {
        const payload = { slug: claveEff.trim(), ...payloadComun() } as CreateServicioPayload;
        const destinos = centros.length ? centros : [{ id: centro, name: "" } as Centro];
        const resultados = await Promise.allSettled(destinos.map((c) => createServicio(payload, c.id)));
        const fallos = resultados.map((r, i) => (r.status === "rejected" ? destinos[i].name : null)).filter(Boolean);
        if (fallos.length === destinos.length) {
          throw (resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason;
        }
        if (fallos.length > 0) toast.warning(t("createdParcial", { centros: fallos.join(", ") }));
        else toast.success(t("createdTodos", { n: destinos.length }));
      }
    },
    {
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
      onError: (err) => {
        toast.error(apiErrorMessage(err));
        return true;
      },
    },
  );

  // El alcance REAL del bulk: los centros donde la clave EXISTE (fila.entradas),
  // no todos mis centros — el BE actualiza solo filas con esa clave.
  const afectados = editandoTodos && fila?.entradas?.length ? fila.entradas.map((e) => e.centro) : centros;
  const nombresCentros = afectados.map((c) => c.name).filter(Boolean).join(", ");

  // Multi-center: nothing changed → say so and close (nothing to send); otherwise confirm which
  // centers it touches before saving. `asking` stops a second Enter/click from queueing a second prompt.
  const asking = React.useRef(false);
  async function onSubmit() {
    if (editandoTodos) {
      if (asking.current) return;
      if (Object.keys(payloadBulkDirty(inicial, form)).length === 0) {
        toast.success(t("multiSinCambios"));
        onOpenChange(false);
        return;
      }
      asking.current = true;
      const ok = await confirm({
        title: t("multiConfirmTitle"),
        description: t("multiConfirmBody", { n: afectados.length, centros: nombresCentros }),
        confirmLabel: t("multiConfirmOk"),
      }).finally(() => (asking.current = false));
      if (!ok) return;
    }
    await submit();
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={isEdit ? (editandoTodos ? t("editTitleTodos") : t("editTitle")) : t("newTitle")}
      description={editandoTodos ? t("formHelpTodos") : isEdit ? t("formHelp") : t("formHelpAlta")}
      onSubmit={onSubmit}
      submitLabel={editandoTodos ? t("aplicarTodos") : tc("save")}
      submitting={submitting}
      missing={missing}
      blocked={!ordenValido}
      reason={ordenValido ? null : t("sortOrderInvalid")}
    >
      <Field label={t("field.nombre")} htmlFor="service-name" required>
        <Input id="service-name" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("field.clave")} htmlFor="service-key" required={!isEdit}>
          <Input
            id="service-key"
            value={claveEff}
            onChange={(e) => update({ claveTouched: true, clave: e.target.value })}
            disabled={isEdit}
            className="font-mono"
          />
        </Field>
        <Field label={t("field.orden")} htmlFor="service-order">
          <Input id="service-order" inputMode="numeric" value={form.orden} onChange={(e) => set("orden", e.target.value)} placeholder="0" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ColorField id="service-color" label={t("field.color")} value={form.color} onChange={(v) => set("color", v)} />
        <StartStepField id="service-start-step" value={form.startStep} onChange={(v) => set("startStep", v)} />
      </div>

      <Field label={t("field.grupo")} htmlFor="service-group" hint={t("field.grupoHint")}>
        <GrupoSelect id="service-group" value={form.grupoFacturacionId} onChange={(id) => set("grupoFacturacionId", id)} />
      </Field>

      <Field label={t("field.producto")} htmlFor="service-product" hint={t("field.productoHint")}>
        <ProductoPicker id="service-product" value={form.productoId} onChange={(id) => set("productoId", id)} placeholder={t("field.productoNone")} />
      </Field>

      <Toggle label={t("field.requiereTecnico")} checked={form.requiereTecnico} onChange={(v) => set("requiereTecnico", v)} />
      <Toggle label={t("field.requiereEnfermera")} checked={form.requiereEnfermera} onChange={(v) => set("requiereEnfermera", v)} />
      <Toggle label={t("field.badge")} checked={form.badge} onChange={(v) => set("badge", v)} />
      {/* Igual que Activo: es por centro (cada fila Láser Bayamón/Caguas es su propio servicio),
          no se edita en "aplicar a todos los centros". Handoff HANDOFF-sesiones-sin-paquete-listo.md. */}
      {!editandoTodos && (
        <Toggle
          label={t("field.allowSessionFixWithoutPackage")}
          hint={t("field.allowSessionFixWithoutPackageHint")}
          checked={form.allowSessionFixWithoutPackage}
          onChange={(v) => set("allowSessionFixWithoutPackage", v)}
        />
      )}
      {/* Igual que allowSessionFixWithoutPackage: es por centro, no entra en "aplicar a todos". */}
      {!editandoTodos && (
        <PrimaryPackageRuleSelect id="service-primary-rule" value={form.primaryPackageRule} onChange={(v) => set("primaryPackageRule", v)} />
      )}
      {/* Activo NO se edita en multicentro (es por centro); sí en un-centro. */}
      {isEdit && !editandoTodos && <Toggle label={t("field.activo")} checked={form.activo} onChange={(v) => set("activo", v)} />}
    </FormSheet>
  );
}
