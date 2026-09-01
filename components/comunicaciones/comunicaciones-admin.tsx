"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listAlertas,
  resolverAlerta,
  descartarAlerta,
  marcarLeida,
  alertaHref,
  listPlantillas,
  listNotificaciones,
  crearPlantilla,
  type AlertasResponse,
  type Plantilla,
  type Notificacion,
  type CreatePlantillaPayload,
  type Alerta,
} from "@/lib/api/comunicaciones";
import { apiErrorMessage, toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Canales soportados por el BE (enum CreatePlantillaDto). Data-driven en el form; sin hardcode de texto.
const CANALES = ["email", "whatsapp", "sms", "impresa"] as const;
// Estados de una notificación enviada (enum NotificacionEntity) → color del badge.
const ESTADO_BADGE: Record<string, "secondary" | "outline" | "destructive"> = {
  enviada: "secondary",
  lista: "secondary",
  pendiente: "outline",
  fallida: "destructive",
};

const SEV_DOT: Record<string, string> = {
  info: "bg-info-foreground",
  warning: "bg-warning-foreground",
  critica: "bg-destructive",
};

// Página del dominio único Comunicaciones: Alertas (canal interno) + Plantillas
// (notificaciones salientes). Reusa lib/api/comunicaciones — sin duplicar lógica.
export function ComunicacionesAdmin() {
  const t = useTranslations("comunicaciones");
  const [mode, setMode] = React.useState<"alertas" | "notificaciones" | "plantillas">("alertas");

  return (
    <PageContainer>
      <PageHeader
        title={t("pageTitle")}
        description={t("pageHelp")}
        actions={
          <>
            <div className="inline-flex rounded-md border p-0.5">
              {(["alertas", "notificaciones", "plantillas"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`tab.${m}`)}
                </button>
              ))}
            </div>
          </>
        }
      />

      {mode === "alertas" ? (
        <AlertasPanel />
      ) : mode === "notificaciones" ? (
        <NotificacionesPanel />
      ) : (
        <PlantillasPanel />
      )}
    </PageContainer>
  );
}

function AlertasPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const router = useRouter();
  const { can } = useCan();
  const puedeResolver = can("alertas.resolver"); // gate cosmético; el BE aplica la autorización real
  const { state, reload, refresh } = useResource<AlertasResponse>(() => listAlertas());
  const alertas = state.kind === "ok" ? state.data.data : [];
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function open(a: Alerta) {
    const href = alertaHref(a);
    try { await marcarLeida(a.id); } catch { /* noop */ }
    refresh();
    if (href) router.push(href);
  }
  async function act(id: string, fn: (id: string) => Promise<unknown>) {
    setBusyId(id);
    try { await fn(id); refresh(); }
    catch (err) { toast.error(apiErrorMessage(err)); }
    finally { setBusyId(null); }
  }

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  if (state.kind === "fail")
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{tc("error")}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
      </div>
    );
  if (alertas.length === 0)
    return <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>;

  return (
    <div className="divide-y rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      {alertas.map((a) => {
        const clickable = !!alertaHref(a);
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", SEV_DOT[a.severidad] ?? "bg-muted")} />
            <button type="button" onClick={() => open(a)} className={cn("min-w-0 flex-1 text-left", clickable && "cursor-pointer")}>
              <p className="font-medium">{a.titulo}</p>
              {a.cuerpo && <p className="text-sm text-muted-foreground">{a.cuerpo}</p>}
            </button>
            {puedeResolver && (
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a.id, resolverAlerta)}>{t("resolver")}</Button>
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => act(a.id, descartarAlerta)}>{t("descartar")}</Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Bitácora de notificaciones enviadas (GET /comunicaciones/notificaciones). Antes `listNotificaciones`
// existía pero nunca se llamaba: sin UI no había forma de ver qué salió por WhatsApp/SMS/email.
function NotificacionesPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const { state, reload } = useResource<Notificacion[]>(() => listNotificaciones());
  const rows = state.kind === "ok" ? state.data : [];
  const fecha = (n: Notificacion) => {
    const iso = n.enviadaEn ?? n.createdAt;
    return iso ? new Date(iso).toLocaleString() : "—";
  };

  return (
    <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">{t("col.canal")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.destino")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.asunto")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
            <th className="px-3 py-2 font-semibold">{t("col.fecha")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {state.kind === "loading" && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
          )}
          {state.kind === "fail" && (
            <tr><td colSpan={5} className="px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">{tc("error")}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
            </td></tr>
          )}
          {state.kind === "ok" && rows.length === 0 && (
            <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("noNotificaciones")}</td></tr>
          )}
          {rows.map((n) => (
            <tr key={n.id} className="hover:bg-muted/30">
              <td className="px-3 py-2"><Badge variant="outline">{n.canal}</Badge></td>
              <td className="px-3 py-2 text-muted-foreground">{n.destino ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{n.asunto ?? "—"}</td>
              <td className="px-3 py-2">
                <Badge variant={ESTADO_BADGE[n.estado] ?? "outline"}>
                  {t.has(`estadoNotif.${n.estado}`) ? t(`estadoNotif.${n.estado}`) : n.estado}
                </Badge>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{fecha(n)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlantillasPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const { can } = useCan();
  const puedeConfig = can("notificaciones.config"); // gate cosmético; el BE es la autoridad
  const { state, reload } = useResource<Plantilla[]>(() => listPlantillas());
  const rows = state.kind === "ok" ? state.data : [];
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="space-y-3">
      {puedeConfig && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setCreateOpen(true)}>{t("nuevaPlantilla")}</Button>
        </div>
      )}
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.clave")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.canal")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.idioma")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.asunto")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={5} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">{t("noPlantillas")}</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{p.clave}</td>
                <td className="px-3 py-2"><Badge variant="outline">{p.canal}</Badge></td>
                <td className="px-3 py-2 uppercase text-muted-foreground">{p.idioma}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.asunto ?? "—"}</td>
                <td className="px-3 py-2"><Badge variant={p.activo ? "secondary" : "outline"}>{p.activo ? tc("active") : tc("inactive")}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PlantillaForm open={createOpen} onOpenChange={setCreateOpen} onSaved={reload} />
    </div>
  );
}

// Alta de plantilla (POST /comunicaciones/notificaciones/plantillas). Los canales salen del enum del
// BE (CANALES) — sin hardcode de texto suelto; el idioma default lo pone el BE si se deja vacío.
function PlantillaForm({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("comunicaciones");
  const EMPTY = { clave: "", canal: "whatsapp", idioma: "", asunto: "", cuerpo: "" };
  const [form, setForm] = React.useState(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function handleOpenChange(next: boolean) {
    if (!next) setForm(EMPTY);
    onOpenChange(next);
  }

  const canSubmit = !!form.clave.trim() && !!form.cuerpo.trim() && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const payload: CreatePlantillaPayload = {
        clave: form.clave.trim(),
        canal: form.canal as CreatePlantillaPayload["canal"],
        idioma: form.idioma.trim() || undefined,
        asunto: form.asunto.trim() || undefined,
        cuerpo: form.cuerpo.trim(),
      };
      await crearPlantilla(payload);
      toast.success(t("plantillaCreada"));
      handleOpenChange(false);
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={t("nuevaPlantilla")}
      description={t("nuevaPlantillaHelp")}
      submitting={submitting}
      canSubmit={canSubmit}
      onSubmit={onSubmit}
    >
      <Field label={t("col.clave")}>
        <Input
          value={form.clave}
          onChange={(e) => set("clave", e.target.value)}
          placeholder="cita_recordatorio"
          className="font-mono"
        />
      </Field>
      <Field label={t("col.canal")}>
        <Select value={form.canal} onValueChange={(v) => set("canal", v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANALES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("col.idioma")} hint={t("idiomaHint")}>
        <Input value={form.idioma} onChange={(e) => set("idioma", e.target.value)} placeholder="es" />
      </Field>
      <Field label={t("col.asunto")}>
        <Input value={form.asunto} onChange={(e) => set("asunto", e.target.value)} />
      </Field>
      <Field label={t("col.cuerpo")}>
        <Textarea rows={5} value={form.cuerpo} onChange={(e) => set("cuerpo", e.target.value)} />
      </Field>
    </FormDialog>
  );
}
