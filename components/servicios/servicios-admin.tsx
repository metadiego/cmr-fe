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
  getGruposFacturacion,
  type Servicio,
  type CreateServicioPayload,
  type UpdateServicioPorClavePayload,
  type GrupoFacturacion,
} from "@/lib/api/servicios";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { payloadBulkDirty } from "@/lib/servicios/bulk-diff";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { PageContainer } from "@/components/ui/page";

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
  "nombre",
  "color",
  "orden",
  "grupoFacturacionId",
  "productoId",
  "requiereTecnico",
  "requiereEnfermera",
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
      (porClave.get(s.clave) ?? porClave.set(s.clave, []).get(s.clave)!).push({ centro, s });
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
  return filas.sort((a, b) => (a.rep.orden ?? 0) - (b.rep.orden ?? 0) || a.rep.nombre.localeCompare(b.rep.nombre));
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
        const fallidos = resultados.filter((r) => !r.ok).map((r) => r.centro.nombre);
        if (fallidos.length > 0) {
          toast.warning(t("cargaParcial", { centros: fallidos.join(", ") }));
        }
        return unir(resultados);
      }
      if (!centro) return [];
      const uno = centros.find((c) => c.id === centro) ?? ({ id: centro, nombre: "" } as Centro);
      const ss = await getServicios(centro, { includeInactive: true });
      return ss
        .map<FilaServicio>((s) => ({ clave: s.clave, rep: s, entradas: [{ centro: uno, s }], diffs: new Set(), todos: false }))
        .sort((a, b) => (a.rep.orden ?? 0) - (b.rep.orden ?? 0) || a.rep.nombre.localeCompare(b.rep.nombre));
    },
    [esTodos, centro, centros],
  );
  const filas = state.kind === "ok" ? state.data : [];

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<FilaServicio | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const centroNombre = centros.find((c) => c.id === centro)?.nombre ?? "";

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
          if ((f.rep.orden ?? 0) === i) return Promise.resolve();
          return esTodos
            ? updateServicioPorClave(f.clave, { orden: i } as UpdateServicioPorClavePayload)
            : updateServicio(f.rep.id, { orden: i }, centro);
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
      await updateServicio(s.id, { activo: !s.activo }, centro);
      toast.success(s.activo ? t("deshabilitadoEn", { centro: centroNombre }) : t("habilitadoEn", { centro: centroNombre }));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const content = (
    <>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        {!embedded && <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>}
        <div className={"flex items-center gap-2 " + (embedded ? "w-full justify-between" : "")}>
          {centros.length > 1 && (
            <Select value={esTodos ? TODOS : centro} onValueChange={setCentroSel}>
              <SelectTrigger className="h-9 w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                {/* "Todos los centros" solo para quien puede editar multicentro (RBAC cosmético). */}
                {puedeMulti && <SelectItem value={TODOS}>{t("centro.todos")}</SelectItem>}
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
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
        </div>
      </div>
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {esTodos ? t("helpTodos") : t("helpMultiCentro")}
      </p>

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
                    {f.rep.nombre}
                    {f.diffs.has("nombre") && <DiffChip t={t} entradas={f.entradas} render={(s) => s.nombre} />}
                    {f.diffs.has("color") && <DiffChip t={t} entradas={f.entradas} render={(s) => s.color ?? "—"} />}
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{f.clave}</span>
                </td>
                <td className="px-3 py-2">
                  {f.rep.productoId ? <Badge variant="secondary">{t("tipoInventariable")}</Badge> : <Badge variant="outline">{t("tipoPuro")}</Badge>}
                  {f.diffs.has("productoId") && <DiffChip t={t} entradas={f.entradas} render={(s) => (s.productoId ? t("tipoInventariable") : t("tipoPuro"))} />}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[f.rep.requiereTecnico && t("tecnico"), f.rep.requiereEnfermera && t("enfermera")].filter(Boolean).join(" · ") || "—"}
                  {(f.diffs.has("requiereTecnico") || f.diffs.has("requiereEnfermera")) && (
                    <DiffChip t={t} entradas={f.entradas} render={(s) => [s.requiereTecnico && t("tecnico"), s.requiereEnfermera && t("enfermera")].filter(Boolean).join(" · ") || "—"} />
                  )}
                </td>
                <td className="px-3 py-2">
                  {f.todos ? (
                    // No hay bulk de Activo: es POR CENTRO. Se muestra la nota, no un toggle.
                    <span className="text-xs text-muted-foreground">{t("activoPorCentro")}</span>
                  ) : (
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <Switch
                        checked={f.rep.activo}
                        disabled={busyId === f.rep.id}
                        onCheckedChange={() => toggleActivo(f.rep)}
                        aria-label={t("field.activo")}
                      />
                      <span className={"text-xs " + (f.rep.activo ? "text-success-foreground" : "text-muted-foreground")}>
                        {f.rep.activo ? t("active") : t("inactive")}
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

  return embedded ? content : <PageContainer>{content}</PageContainer>;
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
              <b>{e.centro.nombre}:</b> {render(e.s)}
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
  nombre: string;
  color: string;
  orden: string;
  grupoFacturacionId: string;
  productoId: string;
  requiereTecnico: boolean;
  requiereEnfermera: boolean;
  badge: boolean;
  activo: boolean;
};
const EMPTY: FormState = {
  clave: "",
  nombre: "",
  color: "#3b82f6",
  orden: "",
  grupoFacturacionId: "",
  productoId: "",
  requiereTecnico: false,
  requiereEnfermera: false,
  badge: true,
  activo: true,
};

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
  const servicio = fila?.rep ?? null;
  const isEdit = !!servicio;
  const editandoTodos = isEdit && esTodos; // editar la clave en todos los centros

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [inicial, setInicial] = React.useState<FormState>(EMPTY);
  const [claveTouched, setClaveTouched] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [prevId, setPrevId] = React.useState<string | undefined>(undefined);
  const [prevOpen, setPrevOpen] = React.useState(false);
  // Re-sync en CADA apertura (no solo al cambiar de id): una edición cancelada
  // no puede reaparecer y colarse a todos los centros con "Aplicar a todos".
  if (open && (!prevOpen || servicio?.id !== prevId)) {
    setPrevId(servicio?.id);
    setClaveTouched(!!servicio);
    const inicialForm: FormState = servicio
      ? {
          clave: servicio.clave,
          nombre: servicio.nombre,
          color: servicio.color ?? "#3b82f6",
          orden: servicio.orden != null ? String(servicio.orden) : "",
          grupoFacturacionId: servicio.grupoFacturacionId ?? "",
          productoId: servicio.productoId ?? "",
          requiereTecnico: servicio.requiereTecnico,
          requiereEnfermera: servicio.requiereEnfermera,
          badge: servicio.badge,
          activo: servicio.activo,
        }
      : EMPTY;
    setForm(inicialForm);
    setInicial(inicialForm);
  }
  if (open !== prevOpen) setPrevOpen(open);

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  const claveEff = isEdit || claveTouched ? form.clave : slugify(form.nombre);
  const ordenValido = !form.orden.trim() || Number.isFinite(Number(form.orden));
  const canSubmit =
    form.nombre.trim().length > 0 && claveEff.trim().length > 0 && ordenValido && !submitting;

  // Payload común (sin activo ni clave) para editar la fila (un centro o multicentro).
  function payloadComun() {
    return {
      nombre: form.nombre.trim(),
      color: form.color,
      orden: form.orden.trim() ? Number(form.orden) : undefined,
      grupoFacturacionId: form.grupoFacturacionId || undefined,
      productoId: form.productoId || undefined,
      requiereTecnico: form.requiereTecnico,
      requiereEnfermera: form.requiereEnfermera,
      badge: form.badge,
    };
  }

  async function guardarUnCentro() {
    if (!servicio) return;
    setSubmitting(true);
    try {
      await updateServicio(servicio.id, { ...payloadComun(), activo: form.activo }, centro);
      toast.success(t("updated"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function guardarAlta() {
    setSubmitting(true);
    try {
      const payload = { clave: claveEff.trim(), ...payloadComun() } as CreateServicioPayload;
      const destinos = centros.length ? centros : [{ id: centro, nombre: "" } as Centro];
      const resultados = await Promise.allSettled(destinos.map((c) => createServicio(payload, c.id)));
      const fallos = resultados.map((r, i) => (r.status === "rejected" ? destinos[i].nombre : null)).filter(Boolean);
      if (fallos.length === destinos.length) {
        throw (resultados.find((r) => r.status === "rejected") as PromiseRejectedResult).reason;
      }
      if (fallos.length > 0) toast.warning(t("createdParcial", { centros: fallos.join(", ") }));
      else toast.success(t("createdTodos", { n: destinos.length }));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Multicentro: usa el endpoint CORRECTO por-clave (no itera updateServicio). Confirmación previa
  // con los centros afectados; luego toast con el resumen del diff que devuelve el BE.
  // SOLO viajan los campos que el usuario CAMBIÓ (dirty vs `inicial`): cambiar el color no arrastra
  // nombre/orden/grupo del centro representativo a los demás. Ver lib/servicios/bulk-diff.ts.
  async function guardarTodos() {
    if (!servicio) return;
    const payload = payloadBulkDirty(inicial, form);
    if (Object.keys(payload).length === 0) {
      toast.success(t("multiSinCambios"));
      setConfirmOpen(false);
      onOpenChange(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await updateServicioPorClave(
        servicio.clave,
        payload as UpdateServicioPorClavePayload,
        centro || undefined,
      );
      const conCambios = res.actualizados.filter((a) => Object.keys(a.cambios).length > 0).length;
      toast.success(conCambios > 0 ? t("multiAplicado", { n: conCambios }) : t("multiSinCambios"));
      setConfirmOpen(false);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit() {
    if (!canSubmit) return;
    if (editandoTodos) { setConfirmOpen(true); return; } // confirmar antes de tocar todos los centros
    if (isEdit) return void guardarUnCentro();
    return void guardarAlta();
  }

  // El alcance REAL del bulk: los centros donde la clave EXISTE (fila.entradas),
  // no todos mis centros — el BE actualiza solo filas con esa clave.
  const afectados = editandoTodos && fila?.entradas?.length ? fila.entradas.map((e) => e.centro) : centros;
  const nombresCentros = afectados.map((c) => c.nombre).filter(Boolean).join(", ");

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{isEdit ? (editandoTodos ? t("editTitleTodos") : t("editTitle")) : t("newTitle")}</SheetTitle>
            <SheetDescription>{editandoTodos ? t("formHelpTodos") : isEdit ? t("formHelp") : t("formHelpAlta")}</SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-4">
            <Field label={t("field.nombre")}>
              <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("field.clave")}>
                <Input
                  value={claveEff}
                  onChange={(e) => { setClaveTouched(true); set("clave", e.target.value); }}
                  disabled={isEdit}
                  className="font-mono"
                />
              </Field>
              <Field label={t("field.orden")}>
                <Input inputMode="numeric" value={form.orden} onChange={(e) => set("orden", e.target.value)} placeholder="0" />
              </Field>
            </div>
            <Field label={t("field.color")}>
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-9 w-16 cursor-pointer rounded border bg-transparent"
              />
            </Field>

            <Field label={t("field.grupo")} hint={t("field.grupoHint")}>
              <GrupoSelect value={form.grupoFacturacionId} onChange={(id) => set("grupoFacturacionId", id)} />
            </Field>

            <Field label={t("field.producto")} hint={t("field.productoHint")}>
              <ProductoPicker value={form.productoId} onChange={(id) => set("productoId", id)} placeholder={t("field.productoNone")} />
            </Field>

            <Toggle label={t("field.requiereTecnico")} checked={form.requiereTecnico} onChange={(v) => set("requiereTecnico", v)} />
            <Toggle label={t("field.requiereEnfermera")} checked={form.requiereEnfermera} onChange={(v) => set("requiereEnfermera", v)} />
            <Toggle label={t("field.badge")} checked={form.badge} onChange={(v) => set("badge", v)} />
            {/* Activo NO se edita en multicentro (es por centro); sí en un-centro. */}
            {isEdit && !editandoTodos && <Toggle label={t("field.activo")} checked={form.activo} onChange={(v) => set("activo", v)} />}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
            <Button onClick={onSubmit} disabled={!canSubmit}>{submitting ? tc("saving") : editandoTodos ? t("aplicarTodos") : tc("save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirmación de edición multicentro: deja claro a cuántos/qué centros aplica. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("multiConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("multiConfirmBody", { n: afectados.length, centros: nombresCentros })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={guardarTodos} disabled={submitting}>
              {t("multiConfirmOk")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Selector de grupo de facturación (catálogo del BE, data-driven). "" = sin grupo.
function GrupoSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useTranslations("servicios");
  const tRoot = useTranslations();
  const { state } = useResource<GrupoFacturacion[]>(() => getGruposFacturacion(), []);
  const grupos = (state.kind === "ok" ? state.data : []).filter((g) => g.activo !== false);
  const NONE = "__none__";
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full"><SelectValue placeholder={t("field.grupoNone")} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{t("field.grupoNone")}</SelectItem>
        {grupos.map((g) => (
          <SelectItem key={g.id} value={g.id}>{tRoot(g.labelKey)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-card px-3 py-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
