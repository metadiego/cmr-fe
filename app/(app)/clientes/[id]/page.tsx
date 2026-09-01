"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
} from "@hugeicons/core-free-icons";

import { toast } from "sonner";

import {
  getPaciente,
  updatePaciente,
  deletePaciente,
  type Paciente,
} from "@/lib/api/pacientes";
import { toastError } from "@/lib/api/errors";
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
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
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

  const { state, reload } = useResource<Paciente>(() => getPaciente(id), [id]);

  return (
    <PageContainer>
      <button
        onClick={() => router.push("/clientes")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        {t("title")}
      </button>

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
          onDeleted={() => router.push("/clientes")}
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
  const age = ageFrom(p.fechaNacimiento);
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
      await updatePaciente(p.id, { activo: true }, centroId);
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
            title={fullName(p)}
            description={
              <span className="inline-flex flex-wrap items-center gap-2">
                {p.docId && (
                  <Badge variant="outline" className="font-mono">
                    ID {p.docId}
                  </Badge>
                )}
                {p.activo ? (
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
                {!p.activo && (
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
                {p.activo && (
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

      {/* Sections */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Card title={t("form.sectionContact")}>
          <InfoRow icon={Call02Icon} label={t("columns.phone")} value={p.telefono} />
          <InfoRow icon={WhatsappIcon} label={t("form.whatsapp")} value={p.whatsapp} />
          <InfoRow icon={Mail01Icon} label={t("columns.email")} value={p.email} />
          <InfoRow
            icon={Location01Icon}
            label={t("form.direccion")}
            value={[p.direccion, p.zipcode].filter(Boolean).join(", ") || null}
          />
        </Card>

        <Card title={t("form.sectionPersonal")}>
          <InfoRow icon={UserIcon} label={t("form.sexo")} value={sexoLabel(t, p.sexo)} />
          <InfoRow
            icon={Calendar03Icon}
            label={t("form.fechaNacimiento")}
            value={formatDate(p.fechaNacimiento)}
          />
          <InfoRow icon={UserIcon} label={t("form.nacionalidad")} value={p.nacionalidad} />
        </Card>

        <Card title={t("form.sectionClinical")}>
          <InfoRow label={t("form.record")} value={p.record} />
          <InfoRow label={t("form.aseguradora")} value={p.aseguradora} />
        </Card>
      </div>
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
  sexo: Paciente["sexo"],
): string | null {
  if (sexo === "femenino") return t("form.sexoFemenino");
  if (sexo === "masculino") return t("form.sexoMasculino");
  if (sexo === "otro") return t("form.sexoOtro");
  if (sexo === "desconocido") return t("form.sexoDesconocido");
  return null;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
