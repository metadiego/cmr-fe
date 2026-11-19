"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
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
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useCreateClinic } from "@/hooks/use-create-clinic";
import { createClinicReady } from "@/lib/create-clinic";
import { missingFields } from "@/lib/forms/missing";
import { isClinicViewAll } from "@/lib/tenant";
import { CreateClinicField } from "@/components/kit/create-clinic-field";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
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
  // Every clinic where the person reads alerts, narrowed by the filter (clinic-read-scope).
  const clinics = useClinicFilter("alertas.read");
  const { state, reload, refresh } = useResource<AlertasResponse>(
    () => listAlertas(clinics.choice),
    [clinics.choiceKey],
  );
  const alertas = state.kind === "ok" ? state.data.data : [];
  const clinicOf = (a: Alerta) => a.clinicName || clinics.nameOf(a.clinicId) || "—";
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

  let body: React.ReactNode;
  if (state.kind === "loading") body = <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  else if (state.kind === "fail")
    body = (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{tc("error")}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
      </div>
    );
  else if (alertas.length === 0)
    body = <p className="rounded-md border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  else body = <AlertasRows alertas={alertas} clinicOf={clinics.showColumn ? clinicOf : null} busyId={busyId} puedeResolver={puedeResolver} onOpen={open} onAct={act} />;

  return (
    <>
      {body}
    </>
  );
}

function AlertasRows({
  alertas,
  clinicOf,
  busyId,
  puedeResolver,
  onOpen,
  onAct,
}: {
  alertas: Alerta[];
  /** The row's clinic name, or null when the person reads only one clinic (no badge). */
  clinicOf: ((a: Alerta) => string) | null;
  busyId: string | null;
  puedeResolver: boolean;
  onOpen: (a: Alerta) => void;
  onAct: (id: string, fn: (id: string) => Promise<unknown>) => void;
}) {
  const t = useTranslations("comunicaciones");
  return (
    <div className="divide-y rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      {alertas.map((a) => {
        const clickable = !!alertaHref(a);
        return (
          <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30">
            <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", SEV_DOT[a.severity] ?? "bg-muted")} />
            <button type="button" onClick={() => onOpen(a)} className={cn("min-w-0 flex-1 text-left", clickable && "cursor-pointer")}>
              <p className="font-medium">{a.title}</p>
              {a.body && <p className="text-sm text-muted-foreground">{a.body}</p>}
            </button>
            {clinicOf && <Badge variant="outline" className="mt-0.5 shrink-0">{clinicOf(a)}</Badge>}
            {puedeResolver && (
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => onAct(a.id, resolverAlerta)}>{t("resolver")}</Button>
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => onAct(a.id, descartarAlerta)}>{t("descartar")}</Button>
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
  const format = useFormatter();
  // Every clinic where the person reads notifications, narrowed by the filter (clinic-read-scope).
  const clinics = useClinicFilter("notificaciones.read");
  const { state, reload } = useResource<Notificacion[]>(
    () => listNotificaciones(undefined, clinics.choice),
    [clinics.choiceKey],
  );
  const rows = state.kind === "ok" ? state.data : [];
  const cols = 5 + (clinics.showColumn ? 1 : 0);
  const fecha = (n: Notificacion) => {
    const iso = n.sentAt ?? n.createdAt;
    return iso ? format.dateTime(new Date(iso), "dateAndTime") : "—";
  };

  return (
    <>
      <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              {clinics.showColumn && <th className="px-3 py-2 font-semibold">{t("col.centro")}</th>}
              <th className="px-3 py-2 font-semibold">{t("col.canal")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.destino")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.asunto")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.estado")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.fecha")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr><td colSpan={cols} className="px-3 py-8 text-center text-muted-foreground">{tc("loading")}</td></tr>
            )}
            {state.kind === "fail" && (
              <tr><td colSpan={cols} className="px-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">{tc("error")}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={reload}>{tc("retry")}</Button>
              </td></tr>
            )}
            {state.kind === "ok" && rows.length === 0 && (
              <tr><td colSpan={cols} className="px-3 py-8 text-center text-muted-foreground">{t("noNotificaciones")}</td></tr>
            )}
            {rows.map((n) => (
              <tr key={n.id} className="hover:bg-muted/30">
                {clinics.showColumn && (
                  <td className="px-3 py-2">
                    <Badge variant="outline">{n.clinicName || clinics.nameOf(n.clinicId) || "—"}</Badge>
                  </td>
                )}
                <td className="px-3 py-2"><Badge variant="outline">{n.channel}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{n.destination ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{n.subject ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={ESTADO_BADGE[n.status] ?? "outline"}>
                    {t.has(`estadoNotif.${n.status}`) ? t(`estadoNotif.${n.status}`) : n.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{fecha(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PlantillasPanel() {
  const t = useTranslations("comunicaciones");
  const tc = useTranslations("common");
  const { can } = useCan();
  const puedeConfig = can("notificaciones.config"); // gate cosmético; el BE es la autoridad
  const clinics = useClinicFilter("notificaciones.read");
  const { state, reload } = useResource<(Plantilla & { clinicName?: string | null })[]>(
    () => listPlantillas(clinics.choice ?? undefined),
    [clinics.choiceKey],
  );
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
              <th className="px-3 py-2 font-semibold">{t("col.centro")}</th>
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
            {state.kind === "ok" && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t("noPlantillas")}</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono text-xs">{p.slug}</td>
                <td className="px-3 py-2"><Badge variant="outline">{p.channel}</Badge></td>
                <td className="px-3 py-2 uppercase text-muted-foreground">{p.language}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.subject ?? "—"}</td>
                <td className="px-3 py-2"><Badge variant={p.active ? "secondary" : "outline"}>{p.active ? tc("active") : tc("inactive")}</Badge></td>
                <td className="px-3 py-2"><Badge variant="outline">{p.clinicName || clinics.nameOf(p.clinicId) || "—"}</Badge></td>
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
  const tRoot = useTranslations();
  const [form, update] = useDialogForm(
    () => ({ clave: "", canal: "whatsapp", idioma: "", asunto: "", cuerpo: "", clinicPicked: "" }),
    open,
  );

  // The clinic it is created in: the top bar's; on «Ambos» the form asks (lib/create-clinic.ts).
  const create = useCreateClinic("notificaciones.config", null);
  const clinicId = form.clinicPicked || create.defaultClinicId;
  const viewAll = isClinicViewAll();
  const clinicReady = createClinicReady(clinicId, create.centers.length, viewAll);
  // The clinic counts as a missing field only where a picker is shown; otherwise the list is still loading.
  const clinicPicker = create.centers.length > 1;
  const clinicsLoading = !clinicReady && !clinicPicker;

  const missing = missingFields([
    [t("col.clave"), !!form.clave.trim()],
    [t("col.cuerpo"), !!form.cuerpo.trim()],
    [tRoot("createClinic.label"), clinicReady || !clinicPicker],
  ]);

  const { submitting, submit } = useSubmit(
    async () => {
      const payload: CreatePlantillaPayload = {
        slug: form.clave.trim(),
        channel: form.canal as CreatePlantillaPayload["channel"],
        language: form.idioma.trim() || undefined,
        subject: form.asunto.trim() || undefined,
        body: form.cuerpo.trim(),
      };
      await crearPlantilla(payload, clinicId || undefined);
    },
    {
      successMessage: t("plantillaCreada"),
      onSuccess: () => {
        onOpenChange(false);
        onSaved();
      },
    },
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t("nuevaPlantilla")}
      description={t("nuevaPlantillaHelp")}
      missing={missing}
      blocked={clinicsLoading}
      // Blocked because the clinic list is still loading, or because it failed or came back empty.
      reason={clinicsLoading ? (create.loading ? tRoot("common.loading") : t("noClinicToCreate")) : null}
      submitting={submitting}
      onSubmit={() => submit()}
    >
      {/* Three required fields only when the clinic picker shows (Clave, Cuerpo, Centro). */}
      {clinicPicker && <RequiredLegend />}
      <Field label={t("col.clave")} htmlFor="template-key" required>
        <Input
          id="template-key"
          value={form.clave}
          onChange={(e) => update({ clave: e.target.value })}
          placeholder="cita_recordatorio"
          className="font-mono"
        />
      </Field>
      <Field label={t("col.canal")} htmlFor="template-channel">
        <Select value={form.canal} onValueChange={(v) => update({ canal: v })}>
          <SelectTrigger id="template-channel" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CANALES.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label={t("col.idioma")} htmlFor="template-language" hint={t("idiomaHint")}>
        <Input
          id="template-language"
          aria-describedby="template-language-hint"
          value={form.idioma}
          onChange={(e) => update({ idioma: e.target.value })}
          placeholder="es"
        />
      </Field>
      <Field label={t("col.asunto")} htmlFor="template-subject">
        <Input id="template-subject" value={form.asunto} onChange={(e) => update({ asunto: e.target.value })} />
      </Field>
      <Field label={t("col.cuerpo")} htmlFor="template-body" required>
        <Textarea id="template-body" rows={5} value={form.cuerpo} onChange={(e) => update({ cuerpo: e.target.value })} />
      </Field>
      <CreateClinicField
        centers={create.centers}
        value={clinicId}
        onChange={(id) => update({ clinicPicked: id })}
        show={viewAll}
        disabled={submitting}
        required
      />
    </FormDialog>
  );
}
