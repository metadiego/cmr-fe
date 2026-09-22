"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  PencilEdit02Icon,
  Call02Icon,
  WhatsappIcon,
  Mail01Icon,
  Location01Icon,
  Calendar03Icon,
  UserIcon,
  Alert01Icon,
} from "@hugeicons/core-free-icons";

import { toast } from "sonner";

import {
  getPaciente,
  updatePaciente,
  deletePaciente,
  type Paciente,
} from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
import { readCallOrigin, clearCallOrigin } from "@/lib/scheduling/call-origin";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Can } from "@/components/kit/can";
import { useCan } from "@/hooks/use-can";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import { CertificacionGastos } from "@/components/clientes/certificacion-gastos";
import { FichaCitas, FichaTerapias, FichaFacturacion, FichaUltimaVisita } from "@/components/clientes/ficha-tabs";
import {
  fullName,
  initials,
  ageFrom,
  colorFromString,
} from "@/components/clientes/helpers";
import { PageContainer, PageHeader } from "@/components/ui/page";

export default function PacienteDetailPage() {
  const t = useTranslations("patients");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editOpen, setEditOpen] = React.useState(false);
  // Set only when arriving here from the call-center bridge day view mid-call (see
  // lib/scheduling/call-origin.ts) — single-use, so it does not linger past this visit.
  const [callOrigin] = React.useState<string | null>(() => readCallOrigin());

  const { state, reload } = useResource<Paciente>(() => getPaciente(id), [id]);

  return (
    <PageContainer>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <button
          onClick={() => router.push("/patients")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          {t("title")}
        </button>
        {callOrigin && (
          <button
            onClick={() => {
              clearCallOrigin();
              router.push(callOrigin);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
          >
            <HugeiconsIcon icon={Call02Icon} className="size-4" />
            {t("backToCall")}
          </button>
        )}
      </div>

      {state.kind === "loading" && <DetailSkeleton />}

      {state.kind === "fail" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      {state.kind === "ok" && (
        <PacienteDetail
          p={state.data}
          onEdit={() => setEditOpen(true)}
          onChanged={reload}
          onDeleted={() => router.push("/patients")}
        />
      )}

      {state.kind === "ok" && (
        <PacienteFormSheet
          open={editOpen}
          paciente={state.data}
          onOpenChange={setEditOpen}
          onSaved={() => reload()}
        />
      )}
    </PageContainer>
  );
}

function PacienteDetail({
  p,
  onEdit,
  onChanged,
  onDeleted,
}: {
  p: Paciente;
  onEdit: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("patients");
  const tc = useTranslations("certificacionGastos");
  const format = useFormatter();
  const { can } = useCan();
  const puedeFactura = can("factura.read");
  const puedeCitas = can("citas.read");
  const puedeFrontdesk = can("frontdesk.read");
  const age = ageFrom(p.dateOfBirth);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const centroId = p.clinicId ?? undefined;

  async function deactivate() {
    setBusy(true);
    try {
      await deletePaciente(p.id, centroId);
      toast.success(t("deactivated"));
      onDeleted();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  async function reactivate() {
    setBusy(true);
    try {
      await updatePaciente(p.id, { active: true }, centroId);
      toast.success(t("reactivated"));
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="size-16 text-lg">
          <AvatarFallback
            style={{ backgroundColor: colorFromString(p.id), color: "white" }}
          >
            {initials(p)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <PageHeader
            title={`${fullName(p)}${p.medicalRecordNumber ? ` · ${p.medicalRecordNumber}` : ""}`}
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {[formatDate(format, p.dateOfBirth), sexoLabel(t, p.sex)].filter((v) => v && v !== "—").join(" · ")}
                </span>
                {p.active ? (
                  <Badge variant="secondary">{t("active")}</Badge>
                ) : (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
                {age !== null && (
                  <span className="text-sm text-muted-foreground">
                    {t("yearsOld", { age })}
                  </span>
                )}
              </span>
            }
            actions={
              <>
                {!p.active && (
                  <Can permiso="pacientes.update">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={reactivate}
                      disabled={busy}
                    >
                      {t("reactivate")}
                    </Button>
                  </Can>
                )}
                <Can permiso="pacientes.update">
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                    {t("edit")}
                  </Button>
                </Can>
                {p.active && (
                  <Can permiso="pacientes.delete">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmOpen(true)}
                      disabled={busy}
                    >
                      {t("deactivate")}
                    </Button>
                  </Can>
                )}
              </>
            }
          />
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeactivateBody", { name: fullName(p) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                deactivate();
              }}
              disabled={busy}
            >
              {t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Banda de avisos siempre visible (como la referencia): alertas, alergias, implantes. La ausencia
          también es información. (Se poblará con datos del BE cuando existan.) */}
      <div className="space-y-1 rounded-md border border-warning/40 bg-warning/40 px-4 py-3 text-sm">
        <AvisoRow label={t("hub.alerts")} value={t("hub.noAlerts")} />
        <AvisoRow label={t("hub.allergies")} value={t("hub.noAllergies")} />
        <AvisoRow label={t("hub.implants")} value={t("hub.noImplants")} />
      </div>

      {/* Ficha como hub. Cada pestaña llama SOLO a su endpoint; se pintan según permiso. */}
      <Tabs defaultValue="resumen">
        <TabsList className="mb-4">
          <TabsTrigger value="resumen">{t("tabs.summary")}</TabsTrigger>
          {puedeCitas && <TabsTrigger value="citas">{t("tabs.appointments")}</TabsTrigger>}
          {puedeFrontdesk && <TabsTrigger value="terapias">{t("tabs.therapies")}</TabsTrigger>}
          {puedeFactura && <TabsTrigger value="facturacion">{t("tabs.billing")}</TabsTrigger>}
          {puedeFactura && <TabsTrigger value="documentos">{t("tabs.documents")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <Card title={t("form.sectionContact")}>
              <InfoRow icon={Call02Icon} label={t("columns.phone")} value={p.phone} />
              <InfoRow icon={WhatsappIcon} label={t("form.whatsapp")} value={p.whatsapp} />
              <InfoRow icon={Mail01Icon} label={t("columns.email")} value={p.email} />
              <InfoRow
                icon={Location01Icon}
                label={t("form.direccion")}
                value={[p.address, p.zipCode].filter(Boolean).join(", ") || null}
              />
            </Card>

            <Card title={t("form.sectionPersonal")}>
              <InfoRow icon={UserIcon} label={t("form.sexo")} value={sexoLabel(t, p.sex)} />
              <InfoRow
                icon={Calendar03Icon}
                label={t("form.fechaNacimiento")}
                value={formatDate(format, p.dateOfBirth)}
              />
              <InfoRow icon={UserIcon} label={t("form.nacionalidad")} value={p.nationality} />
            </Card>

            <Card title={t("form.sectionClinical")}>
              <InfoRow label={t("form.record")} value={p.medicalRecordNumber} />
              {/* Médico del paciente: `doctorName` lo computa el BE (ya lo sirve /patients/:id); cast por el
                  hueco de tipos hasta que gen:api lo traiga. */}
              <InfoRow label={t("form.medico")} value={(p as unknown as { doctorName?: string | null }).doctorName} />
              <InfoRow label={t("form.aseguradora")} value={p.insurer} />
            </Card>
          </div>
          <div className="mt-6"><FichaUltimaVisita pacienteId={p.id} centro={centroId} /></div>
        </TabsContent>

        {puedeCitas && (
          <TabsContent value="citas"><FichaCitas pacienteId={p.id} centro={centroId} /></TabsContent>
        )}
        {puedeFrontdesk && (
          <TabsContent value="terapias"><FichaTerapias pacienteId={p.id} centro={centroId} /></TabsContent>
        )}
        {puedeFactura && (
          <TabsContent value="facturacion"><FichaFacturacion pacienteId={p.id} centro={centroId} /></TabsContent>
        )}
        {puedeFactura && (
          <TabsContent value="documentos">
            {/* «Documentos» del paciente. Por ahora: la Certificación de gastos (un documento, no una
                pestaña propia). Aquí se irán sumando otros documentos. */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">{tc("title")}</h2>
              <CertificacionGastos pacienteId={p.id} centro={centroId} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AvisoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <HugeiconsIcon icon={Alert01Icon} className="mt-0.5 size-4 shrink-0 text-warning-foreground/70" />
      <span><span className="font-semibold">{label}</span> <span className="text-muted-foreground">{value}</span></span>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <h2 className="mb-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <dl className="space-y-3">{children}</dl>
    </section>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: typeof Call02Icon;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon ? (
        <HugeiconsIcon
          icon={icon}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
      ) : (
        <span className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm">{value?.trim() ? value : "—"}</dd>
      </div>
    </div>
  );
}

function sexoLabel(
  t: ReturnType<typeof useTranslations>,
  sexo: Paciente["sex"],
): string | null {
  if (sexo === "femenino") return t("form.sexoFemenino");
  if (sexo === "masculino") return t("form.sexoMasculino");
  if (sexo === "otro") return t("form.sexoOtro");
  if (sexo === "desconocido") return t("form.sexoDesconocido");
  return null;
}

// Date of birth is a calendar DAY, not an instant: parsed at UTC noon and rendered with
// the UTC-pinned `dayLong` format so it follows the app language and never slips a day.
function formatDate(
  format: ReturnType<typeof useFormatter>,
  value: string | null | undefined,
): string | null {
  const d = parseDayUTC(value);
  return d ? format.dateTime(d, "dayLong") : null;
}

function DetailSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="size-16 animate-pulse rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
