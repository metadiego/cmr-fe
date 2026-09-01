"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Menu01Icon, Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";

import {
  getPanelSecciones,
  createPanelSeccion,
  updatePanelSeccion,
  deletePanelSeccion,
  reordenarSecciones,
  getPanelContadores,
  ASIGNA_A,
  type PanelSeccion,
  type PanelContador,
  type CreatePanelSeccionPayload,
} from "@/lib/api/paneles";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { getActiveCentro } from "@/lib/tenant";
import { apiErrorMessage } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useMe, isAdmin } from "@/hooks/use-me";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Capacidades por defecto SÓLO si el centro aún no tiene personal cargado (el BE hace el mismo
// fallback). Con personal, el desplegable sale de sus capacidades reales — nada quemado.
const CAPACIDADES_FALLBACK = ["enfermera", "tecnico", "medico"];

type FormState = {
  clave: string;
  labelKey: string;
  color: string;
  audio: string;
  capacidad: string;
  asignaA: string;
  visible: boolean;
};
function fromSeccion(s: PanelSeccion): FormState {
  return {
    clave: s.clave,
    labelKey: s.labelKey,
    color: s.color ?? "",
    audio: s.audio ?? "",
    capacidad: s.capacidad ?? "",
    asignaA: s.asignaA ?? ASIGNA_A[0],
    visible: s.visible,
  };
}
const EMPTY: FormState = {
  clave: "",
  labelKey: "",
  color: "#3b82f6",
  audio: "",
  capacidad: "",
  asignaA: ASIGNA_A[0],
  visible: true,
};

export function PanelSeccionesAdmin({ clave }: { clave: string }) {
  const t = useTranslations("panelAdmin");
  const tRoot = useTranslations();
  const centro = getActiveCentro() ?? undefined;
  const me = useMe();
  const puedeBorrar = me.kind === "ok" && isAdmin(me.me); // borrar exige rol admin (el BE también lo valida)
  const { can } = useCan();
  const puedeConfig = can("panel.config");

  const [nonce, setNonce] = React.useState(0);
  const reload = () => setNonce((n) => n + 1);
  const { state } = useResource<PanelSeccion[]>(
    () => getPanelSecciones(clave, { includeInactive: true }, centro),
    [clave, centro, nonce],
  );
  const secciones = React.useMemo(
    () => (state.kind === "ok" ? [...state.data].sort((a, b) => a.orden - b.orden) : []),
    [state],
  );

  // Capacidades reales del personal del centro (data-driven).
  const { state: personalState } = useResource<Personal[]>(
    () => listPersonal({ limit: 100 }).then((p) => p.items),
    [centro],
  );
  const capacidades = React.useMemo(() => {
    const set = new Set<string>();
    if (personalState.kind === "ok") {
      for (const p of personalState.data) for (const c of p.capacidades ?? []) set.add(c);
    }
    return set.size > 0 ? [...set].sort() : CAPACIDADES_FALLBACK;
  }, [personalState]);

  // Contador de avisos del día por sección (suma sobre el personal).
  const hoy = new Date().toISOString().slice(0, 10);
  const { state: contState } = useResource<PanelContador[]>(
    () => getPanelContadores(clave, hoy, centro).catch(() => []),
    [clave, centro, hoy, nonce],
  );
  const contadorDe = (claveSeccion: string) => {
    if (contState.kind !== "ok") return 0;
    return contState.data.reduce((sum, c) => sum + (c.porSeccion?.[claveSeccion] ?? 0), 0);
  };

  // Selección / formulario. `creando` = alta (clave editable); si no, edición de la seleccionada.
  const [selId, setSelId] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  function seleccionar(s: PanelSeccion) {
    setCreando(false);
    setSelId(s.id);
    setForm(fromSeccion(s));
  }
  function nueva() {
    setCreando(true);
    setSelId(null);
    setForm(EMPTY);
  }

  // DnD nativo (lista plana): reordenar y persistir en bloque al soltar.
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  async function onDrop(targetId: string) {
    setOverId(null);
    if (!dragId || dragId === targetId) return setDragId(null);
    const arr = [...secciones];
    const from = arr.findIndex((s) => s.id === dragId);
    const to = arr.findIndex((s) => s.id === targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const ordenes = arr.map((s, i) => ({ id: s.id, orden: i }));
    try {
      await reordenarSecciones(clave, ordenes, centro);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function toggle(s: PanelSeccion, campo: "visible" | "activo") {
    try {
      await updatePanelSeccion(s.id, { [campo]: !s[campo] }, centro);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function guardar() {
    if (!form.clave.trim() || !form.labelKey.trim()) return;
    setSaving(true);
    const payload: CreatePanelSeccionPayload = {
      clave: form.clave.trim(),
      labelKey: form.labelKey.trim(),
      color: form.color.trim() || null,
      audio: form.audio.trim() || null,
      capacidad: form.capacidad || undefined,
      asignaA: (form.asignaA || ASIGNA_A[0]) as (typeof ASIGNA_A)[number],
      visible: form.visible,
    };
    try {
      if (creando) {
        await createPanelSeccion(clave, payload, centro);
        toast.success(t("creada"));
      } else if (selId) {
        // En edición no se manda la clave (es única/inmutable).
        const { clave: _clave, ...rest } = payload;
        void _clave;
        await updatePanelSeccion(selId, rest, centro);
        toast.success(t("guardada"));
      }
      setCreando(false);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  // Borrado con 409 esperado (tiene histórico): mostrar el mensaje y ofrecer desactivar.
  const [toDelete, setToDelete] = React.useState<PanelSeccion | null>(null);
  async function confirmarBorrado() {
    if (!toDelete) return;
    const s = toDelete;
    setToDelete(null);
    try {
      await deletePanelSeccion(s.id, centro);
      toast.success(t("borrada"));
      if (selId === s.id) nueva();
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // El 409 trae el conteo del histórico en el mensaje. Ofrecer desactivar en su lugar.
        toast.error(e.message, {
          action: {
            label: t("desactivar"),
            onClick: () => void toggle(s, "activo"),
          },
        });
      } else {
        toast.error(apiErrorMessage(e));
      }
    }
  }

  if (!puedeConfig) {
    return <p className="text-sm text-muted-foreground">{t("noPermission")}</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      {/* Izquierda: lista de secciones arrastrable */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">{t("secciones")}</h2>
          <Button size="sm" onClick={nueva}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("nueva")}
          </Button>
        </div>
        {state.kind === "loading" ? (
          <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
        ) : state.kind === "fail" ? (
          <p className="text-sm text-destructive">{state.message}</p>
        ) : secciones.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            {t("vacio")}
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {secciones.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => setDragId(s.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverId(s.id);
                }}
                onDrop={() => onDrop(s.id)}
                onClick={() => seleccionar(s)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border bg-card px-2 py-1.5 text-sm",
                  selId === s.id && "ring-2 ring-primary",
                  overId === s.id && dragId && "border-primary",
                  dragId === s.id && "opacity-50",
                  !s.activo && "opacity-60",
                )}
              >
                <span className="cursor-grab text-muted-foreground" aria-hidden>
                  <HugeiconsIcon icon={Menu01Icon} className="size-4" />
                </span>
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color ?? "var(--muted)" }}
                  aria-hidden
                />
                <span className="flex-1 truncate">
                  <span className="font-medium">
                    {tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.labelKey}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">{contadorDe(s.clave)}</span>
                </span>
                <span
                  className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("visible")}
                  <Switch checked={s.visible} onCheckedChange={() => toggle(s, "visible")} />
                </span>
                <span
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  {t("activa")}
                  <Switch checked={s.activo} onCheckedChange={() => toggle(s, "activo")} />
                </span>
                {puedeBorrar && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground"
                    aria-label={t("borrar")}
                    onClick={(e) => {
                      e.stopPropagation();
                      setToDelete(s);
                    }}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Derecha: formulario de la sección seleccionada / alta */}
      <aside className="rounded-md bg-card p-4 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <h2 className="mb-3 text-sm font-semibold">
          {creando ? t("nueva") : selId ? t("editar") : t("elegir")}
        </h2>
        {creando || selId ? (
          <div className="space-y-3">
            <Campo label={t("clave")} hint={t("claveHint")}>
              <Input
                value={form.clave}
                onChange={(e) => set("clave", e.target.value)}
                disabled={!creando}
                placeholder="intravenoso"
                className="font-mono"
              />
            </Campo>
            <Campo label={t("labelKey")} hint={t("labelKeyHint")}>
              <Input
                value={form.labelKey}
                onChange={(e) => set("labelKey", e.target.value)}
                placeholder="panel.seccion.intravenoso"
                className="font-mono"
              />
            </Campo>
            <Campo label={t("color")}>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={/^#/.test(form.color) ? form.color : "#3b82f6"}
                  onChange={(e) => set("color", e.target.value)}
                  className="h-9 w-12 p-1"
                />
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} placeholder="#3b82f6" />
              </div>
            </Campo>
            <Campo label={t("audio")} hint={t("audioHint")}>
              <Input value={form.audio} onChange={(e) => set("audio", e.target.value)} placeholder="alarma" />
            </Campo>
            <Campo label={t("capacidad")} hint={t("capacidadHint")}>
              <Select value={form.capacidad || undefined} onValueChange={(v) => set("capacidad", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("capacidadPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {capacidades.map((c) => (
                    <SelectItem key={c} value={c}>
                      {tRoot.has(`capacidades.${c}`) ? tRoot(`capacidades.${c}`) : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label={t("asignaA")} hint={t("asignaAHint")}>
              <Select value={form.asignaA} onValueChange={(v) => set("asignaA", v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASIGNA_A.map((a) => (
                    <SelectItem key={a} value={a}>
                      {t(`asigna.${a.split(".")[1]}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t("visible")}</Label>
              <Switch checked={form.visible} onCheckedChange={(v) => set("visible", v)} />
            </div>
            <Button
              className="w-full"
              onClick={guardar}
              disabled={saving || !form.clave.trim() || !form.labelKey.trim()}
            >
              {saving ? tRoot("common.saving") : tRoot("common.save")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("elegirAyuda")}</p>
        )}
      </aside>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("borrarTitulo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("borrarCuerpo", {
                nombre: toDelete
                  ? tRoot.has(toDelete.labelKey)
                    ? tRoot(toDelete.labelKey)
                    : toDelete.labelKey
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tRoot("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarBorrado}>{t("borrar")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Campo({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
