"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PencilEdit02Icon,
  Call02Icon,
  WhatsappIcon,
  Mail01Icon,
  Location01Icon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons";

import {
  getPaciente,
  updatePaciente,
  deletePaciente,
  type Paciente,
} from "@/lib/api/pacientes";
import { readCallOrigin, clearCallOrigin } from "@/lib/scheduling/call-origin";
import { parseDayUTC } from "@/lib/format/fecha";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Can } from "@/components/kit/can";
import { useConfirm } from "@/components/kit/confirm-host";
import { useSubmit } from "@/components/kit/use-submit";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import { CertificacionGastos } from "@/components/clientes/certificacion-gastos";
import { FichaCitas, FichaTerapias, FichaFacturacion, FichaUltimaVisita } from "@/components/clientes/ficha-tabs";
import { FichaAsistencia } from "@/components/clientes/ficha-asistencia";
import { FichaCambioProtocolo } from "@/components/clientes/ficha-cambio-protocolo";
import { PriorityFlagsBadges } from "@/components/clientes/priority-flags-badges";
import { OldRecordSuggestionBanner } from "@/components/clientes/old-record-suggestion-banner";
import { Panel } from "@/components/clientes/record-ui";
import { PatientRecordSkeleton } from "@/components/clientes/patient-record-skeleton";
import { PatientMergeButton } from "@/components/clientes/patient-merge-dialog";
import {
  fullName,
  initials,
  ageFrom,
  colorFromString,
} from "@/components/clientes/helpers";
import { PageContainer } from "@/components/ui/page";
import { useTabRoute } from "@/hooks/use-tab-route";
import { PATIENT_TABS } from "@/lib/nav/tab-routes";

// The patient record. Each tab is its own path (/patients/<id>/appointments, /patients/<id>/billing — see
// lib/nav/tab-routes.ts), and this is the layout of every tab route, so switching tabs keeps the record
// mounted instead of fetching the patient again.
export default function PatientRecordLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("patients");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editOpen, setEditOpen] = React.useState(false);
  // Set only when arriving here from the call-center bridge day view mid-call (see
  // lib/scheduling/call-origin.ts) — single-use, so it does not linger past this visit.
  const [callOrigin] = React.useState<string | null>(() => readCallOrigin());

  // The BE finds the record by id in every center the person can read. `?centro=` only comes from links
  // saved before that; it still narrows the lookup to that center.
  const centroPedido = useSearchParams().get("centro");
  const { state, reload } = useResource<Paciente>(
    () => getPaciente(id, undefined, { centerIds: centroPedido ? [centroPedido] : undefined }),
    [id, centroPedido],
  );

  return (
    <PageContainer>
      {/* No generic "Back" link: the top bar's breadcrumb (Clientes) and the browser's Back cover it.
          Returning to an ongoing call is a task, not navigation, so that one stays. */}
      {callOrigin && (
        <div className="mb-6">
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
        </div>
      )}

      {state.kind === "loading" && <PatientRecordSkeleton />}

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
      {children}
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
  const format = useFormatter();
  const { can } = useCan();
  const puedeFactura = can("factura.read");
  const puedeCitas = can("citas.read");
  const puedeFrontdesk = can("frontdesk.read");
  const puedeProtocolo = can("tratamiento.cambio_protocolo");
  const puedeAsistencia = can("estadisticas.read");
  const [requestedTab, selectTab] = useTabRoute(PATIENT_TABS);
  // A tab this person may not see (e.g. a shared link to /billing) opens the summary instead.
  const allowed: Record<(typeof PATIENT_TABS.tabs)[number], boolean> = {
    summary: true,
    appointments: puedeCitas,
    therapies: puedeFrontdesk,
    attendance: puedeAsistencia,
    billing: puedeFactura,
    documents: puedeFactura,
    "protocol-change": puedeProtocolo,
  };
  const tab = allowed[requestedTab] ? requestedTab : "summary";
  const age = ageFrom(p.dateOfBirth);
  const centroId = p.clinicId ?? undefined;
  const confirm = useConfirm();

  const deactivation = useSubmit(() => deletePaciente(p.id, centroId), {
    successMessage: t("deactivated"),
    onSuccess: onDeleted,
  });
  const reactivation = useSubmit(() => updatePaciente(p.id, { active: true }, centroId), {
    successMessage: t("reactivated"),
    onSuccess: onChanged,
  });
  const busy = deactivation.submitting || reactivation.submitting;

  async function deactivate() {
    const ok = await confirm({
      title: t("confirmDeactivateTitle"),
      description: t("confirmDeactivateBody", { name: fullName(p) }),
      confirmLabel: t("deactivate"),
      cancelLabel: t("cancel"),
    });
    if (ok) await deactivation.submit();
  }

  const doctorName = (p as unknown as { doctorName?: string | null }).doctorName;
  const canUpdate = can("pacientes.update");
  const canDelete = can("pacientes.delete");
  const showMore = p.active ? canDelete : canUpdate;

  return (
    <div className="space-y-6">
      {/* Header card: identity on the left, actions on the right, the alerts band as its footer. */}
      <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar className="size-14 text-base font-semibold">
              <AvatarFallback style={{ backgroundColor: colorFromString(p.id), color: "white" }}>
                {initials(p)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight">{fullName(p)}</h1>
                {p.active ? (
                  <Badge variant="secondary">{t("active")}</Badge>
                ) : (
                  <Badge variant="outline">{t("inactive")}</Badge>
                )}
                <PriorityFlagsBadges patientId={p.id} centroId={centroId} />
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                {[
                  p.medicalRecordNumber ? `#${p.medicalRecordNumber}` : null,
                  formatDate(format, p.dateOfBirth),
                  age !== null ? t("yearsOld", { age }) : null,
                  sexoLabel(t, p.sex),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Can permiso="pacientes.update">
              <Button size="sm" onClick={onEdit}>
                <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                {t("edit")}
              </Button>
            </Can>
            <Can permiso="pacientes.merge">
              <PatientMergeButton
                current={{ id: p.id, name: fullName(p), record: p.medicalRecordNumber ?? null }}
                centerId={centroId}
                onMerged={onChanged}
              />
            </Can>
            {showMore && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={t("moreActions")} disabled={busy}>
                    <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {p.active ? (
                    <DropdownMenuItem variant="destructive" onSelect={() => void deactivate()}>
                      {t("deactivate")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => void reactivation.submit()}>
                      {t("reactivate")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

      </section>

      <OldRecordSuggestionBanner
        patientId={p.id}
        centroId={centroId}
        recordActual={p.medicalRecordNumber}
        onReemplazado={onChanged}
      />

      {/* The record as a hub. Each tab calls ONLY its own endpoint; tabs are shown by permission. */}
      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList variant="line" className="mb-5 overflow-x-auto">
          <TabsTrigger value="summary">{t("tabs.summary")}</TabsTrigger>
          {puedeCitas && <TabsTrigger value="appointments">{t("tabs.appointments")}</TabsTrigger>}
          {puedeFrontdesk && <TabsTrigger value="therapies">{t("tabs.therapies")}</TabsTrigger>}
          {puedeAsistencia && <TabsTrigger value="attendance">{t("tabs.attendance")}</TabsTrigger>}
          {puedeFactura && <TabsTrigger value="billing">{t("tabs.billing")}</TabsTrigger>}
          {puedeFactura && <TabsTrigger value="documents">{t("tabs.documents")}</TabsTrigger>}
          {puedeProtocolo && <TabsTrigger value="protocol-change">{t("tabs.protocolChange")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="summary">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <DataCard
                title={t("form.sectionPersonal")}
                action={
                  canUpdate ? (
                    <Button variant="ghost" size="sm" onClick={onEdit}>
                      <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
                      {t("edit")}
                    </Button>
                  ) : undefined
                }
              >
                <Field label={t("form.nombres")} value={p.firstName} />
                <Field label={t("form.apellidos")} value={p.lastName} />
                <Field label={t("form.fechaNacimiento")} value={formatDate(format, p.dateOfBirth)} />
                <Field label={t("form.sexo")} value={sexoLabel(t, p.sex)} />
                <Field label={t("form.nacionalidad")} value={p.nationality} />
              </DataCard>

              <DataCard title={t("form.sectionContact")}>
                <Field icon={Call02Icon} label={t("columns.phone")} value={p.phone} />
                <Field icon={WhatsappIcon} label={t("form.whatsapp")} value={p.whatsapp} />
                <Field icon={Mail01Icon} label={t("columns.email")} value={p.email} />
                <Field
                  icon={Location01Icon}
                  label={t("form.direccion")}
                  value={[p.address, p.zipCode].filter(Boolean).join(", ") || null}
                />
              </DataCard>
            </div>

            <div className="space-y-6">
              <DataCard title={t("form.sectionClinical")} columns={1}>
                <Field label={t("form.record")} value={p.medicalRecordNumber} />
                {/* `doctorName` is computed by the BE (already served by /patients/:id); cast until gen:api has it. */}
                <Field label={t("form.medico")} value={doctorName} />
                <Field label={t("form.aseguradora")} value={p.insurer} />
              </DataCard>
              <FichaUltimaVisita pacienteId={p.id} />
            </div>
          </div>
        </TabsContent>

        {puedeCitas && (
          <TabsContent value="appointments"><FichaCitas pacienteId={p.id} /></TabsContent>
        )}
        {puedeFrontdesk && (
          <TabsContent value="therapies"><FichaTerapias pacienteId={p.id} pacienteNombre={fullName(p)} record={p.medicalRecordNumber} centro={centroId} /></TabsContent>
        )}
        {puedeAsistencia && (
          <TabsContent value="attendance"><FichaAsistencia pacienteId={p.id} centro={centroId} /></TabsContent>
        )}
        {puedeFactura && (
          <TabsContent value="billing"><FichaFacturacion pacienteId={p.id} centro={centroId} /></TabsContent>
        )}
        {puedeFactura && (
          <TabsContent value="documents">
            {/* The patient's documents. For now: the expense certification (a document, not a tab of
                its own). Other documents will be added here. */}
            <CertificacionGastos pacienteId={p.id} centro={centroId} />
          </TabsContent>
        )}
        {puedeProtocolo && (
          <TabsContent value="protocol-change">
            <FichaCambioProtocolo pacienteId={p.id} centro={centroId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// A section of the record: titled header row, then label/value cells separated by hairlines. The
// list is pulled down 1px under `overflow-hidden` so the last row's rule does not double the border.
function DataCard({
  title,
  action,
  columns = 2,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  columns?: 1 | 2;
  children: React.ReactNode;
}) {
  return (
    <Panel title={title} actions={action}>
      <dl className={cn("-mb-px grid", columns === 2 && "sm:grid-cols-2")}>{children}</dl>
    </Panel>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon?: typeof Call02Icon;
  label: string;
  value?: string | null;
}) {
  const shown = value?.trim();
  return (
    <div className="flex min-w-0 items-start gap-3 border-b px-5 py-3.5">
      {icon && <HugeiconsIcon icon={icon} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
      <div className="min-w-0">
        <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
        <dd className={cn("mt-1 truncate text-sm", !shown && "text-muted-foreground")}>{shown || "—"}</dd>
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
