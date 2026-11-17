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
  type PanelSeccionAdmin,
  type PanelContador,
  type CreatePanelSeccionPayload,
} from "@/lib/api/paneles";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { getActiveCentro } from "@/lib/tenant";
import { todayPR } from "@/lib/format/fecha";
import { apiErrorMessage } from "@/lib/api/errors";
import { missingFields } from "@/lib/forms/missing";
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
import { Field } from "@/components/kit/field";
import { FormFooter } from "@/components/kit/form-footer";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";

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
function fromSeccion(s: PanelSeccionAdmin): FormState {
  return {
    clave: s.slug,
    labelKey: s.labelKey,
    color: s.color ?? "",
    audio: s.audio ?? "",
    capacidad: s.capacity ?? "",
    asignaA: s.assignsTo ?? ASIGNA_A[0],
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
  const { state } = useResource<PanelSeccionAdmin[]>(
    () => getPanelSecciones(clave, { includeInactive: true }, centro),
    [clave, centro, nonce],
  );
  const secciones = React.useMemo(
    () => (state.kind === "ok" ? [...state.data].sort((a, b) => a.sortOrder - b.sortOrder) : []),
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
      for (const p of personalState.data) for (const c of p.capabilities ?? []) set.add(c);
    }
    return set.size > 0 ? [...set].sort() : CAPACIDADES_FALLBACK;
  }, [personalState]);

  // Contador de avisos del día por sección (suma sobre el personal). `todayPR()`, no toISOString
  // (UTC): después de las 8pm AST ya es "mañana" en UTC y contaría el día equivocado.
  const hoy = todayPR();
  const { state: contState } = useResource<PanelContador[]>(
    () => getPanelContadores(clave, hoy, centro).catch(() => []),
    [clave, centro, hoy, nonce],
  );
  const contadorDe = (claveSeccion: string) => {
    if (contState.kind !== "ok") return 0;
    return contState.data.reduce((sum, c) => sum + (c.bySection?.[claveSeccion] ?? 0), 0);
  };

  // Selección / formulario. `creando` = alta (clave editable); si no, edición de la seleccionada.
  const [selId, setSelId] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  function seleccionar(s: PanelSeccionAdmin) {
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
    const ordenes = arr.map((s, i) => ({ id: s.id, sortOrder: i }));
    try {
      await reordenarSecciones(clave, ordenes, centro);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  async function toggle(s: PanelSeccionAdmin, campo: "visible" | "active") {
    try {
      await updatePanelSeccion(s.id, { [campo]: !s[campo] }, centro);
      reload();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  }

  const missing = missingFields([
    [t("clave"), !!form.clave.trim()],
    [t("labelKey"), !!form.labelKey.trim()],
  ]);

  const { submitting: saving, submit: guardar } = useSubmit(
    async () => {
      const payload: CreatePanelSeccionPayload = {
        slug: form.clave.trim(),
        labelKey: form.labelKey.trim(),
        color: form.color.trim() || null,
        audio: form.audio.trim() || null,
        capacity: form.capacidad || undefined,
        assignsTo: (form.asignaA || ASIGNA_A[0]) as (typeof ASIGNA_A)[number],
        visible: form.visible,
      };
      if (creando) {
        await createPanelSeccion(clave, payload, centro);
        return t("creada");
      }
      if (!selId) throw new Error("no section selected"); // unreachable: the form shows only when creating or editing
      // When editing the slug is not sent (it is unique/immutable).
      const { slug: _slug, ...rest } = payload;
      void _slug;
      await updatePanelSeccion(selId, rest, centro);
      return t("guardada");
    },
    {
      onSuccess: (message) => {
        toast.success(message);
        setCreando(false);
        reload();
      },
      onError: (e) => {
        toast.error(apiErrorMessage(e));
        return true;
      },
    },
  );

  // Delete with an expected 409 (it has history): show the message and offer to deactivate instead.
  const confirm = useConfirm();
  async function borrar(s: PanelSeccionAdmin) {
    const nombre = tRoot.has(s.labelKey) ? tRoot(s.labelKey) : s.labelKey;
    const ok = await confirm({
      title: t("borrarTitulo"),
      description: t("borrarCuerpo", { nombre }),
      confirmLabel: t("borrar"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePanelSeccion(s.id, centro);
      toast.success(t("borrada"));
      if (selId === s.id) nueva();
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // The 409 carries the history count in its message. Offer to deactivate instead.
        toast.error(e.message, {
          action: {
            label: t("desactivar"),
            onClick: () => void toggle(s, "active"),
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
          <p className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
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
                  !s.active && "opacity-60",
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
                  <span className="ml-2 text-xs text-muted-foreground">{contadorDe(s.slug)}</span>
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
                  <Switch checked={s.active} onCheckedChange={() => toggle(s, "active")} />
                </span>
                {puedeBorrar && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground"
                    aria-label={t("borrar")}
                    onClick={(e) => {
                      e.stopPropagation();
                      void borrar(s);
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
            <Field label={t("clave")} htmlFor="panel-section-key" hint={t("claveHint")} required={creando}>
              <Input
                id="panel-section-key"
                aria-describedby="panel-section-key-hint"
                value={form.clave}
                onChange={(e) => set("clave", e.target.value)}
                disabled={!creando}
                placeholder="intravenoso"
                className="font-mono"
              />
            </Field>
            <Field label={t("labelKey")} htmlFor="panel-section-label-key" hint={t("labelKeyHint")} required>
              <Input
                id="panel-section-label-key"
                aria-describedby="panel-section-label-key-hint"
                value={form.labelKey}
                onChange={(e) => set("labelKey", e.target.value)}
                placeholder="panel.seccion.intravenoso"
                className="font-mono"
              />
            </Field>
            <Field label={t("color")} htmlFor="panel-section-color">
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  aria-label={t("color")}
                  value={/^#/.test(form.color) ? form.color : "#3b82f6"}
                  onChange={(e) => set("color", e.target.value)}
                  className="h-9 w-12 p-1"
                />
                <Input
                  id="panel-section-color"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder="#3b82f6"
                />
              </div>
            </Field>
            <Field label={t("audio")} htmlFor="panel-section-audio" hint={t("audioHint")}>
              <Input
                id="panel-section-audio"
                aria-describedby="panel-section-audio-hint"
                value={form.audio}
                onChange={(e) => set("audio", e.target.value)}
                placeholder="alarma"
              />
            </Field>
            <Field label={t("capacidad")} htmlFor="panel-section-capacity" hint={t("capacidadHint")}>
              <Select value={form.capacidad || undefined} onValueChange={(v) => set("capacidad", v)}>
                <SelectTrigger id="panel-section-capacity" aria-describedby="panel-section-capacity-hint" className="w-full">
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
            </Field>
            <Field label={t("asignaA")} htmlFor="panel-section-assigns-to" hint={t("asignaAHint")}>
              <Select value={form.asignaA} onValueChange={(v) => set("asignaA", v)}>
                <SelectTrigger id="panel-section-assigns-to" aria-describedby="panel-section-assigns-to-hint" className="w-full">
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
            </Field>
            <div className="flex items-center justify-between">
              <Label htmlFor="panel-section-visible" className="text-sm">{t("visible")}</Label>
              <Switch id="panel-section-visible" checked={form.visible} onCheckedChange={(v) => set("visible", v)} />
            </div>
            {/* Inline side panel, not a dialog: the footer alone, no cancel. Enter does not save here. */}
            <FormFooter
              primary={{ label: tRoot("common.save"), onClick: () => guardar() }}
              missing={missing}
              submitting={saving}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("elegirAyuda")}</p>
        )}
      </aside>
    </div>
  );
}
