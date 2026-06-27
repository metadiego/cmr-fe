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

import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Can } from "@/components/kit/can";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import {
  fullName,
  initials,
  ageFrom,
  colorFromString,
} from "@/components/clientes/helpers";

export default function PacienteDetailPage() {
  const t = useTranslations("patients");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [editOpen, setEditOpen] = React.useState(false);

  const { state, reload } = useResource<Paciente>(() => getPaciente(id), [id]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
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
    </div>
  );
}

function PacienteDetail({ p, onEdit }: { p: Paciente; onEdit: () => void }) {
  const t = useTranslations("patients");
  const age = ageFrom(p.fechaNacimiento);

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
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {fullName(p)}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {p.cedula && (
              <Badge variant="outline" className="font-mono">
                ID {p.cedula}
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
          </div>
        </div>

        <Can permiso="pacientes.update">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <HugeiconsIcon icon={PencilEdit02Icon} className="size-4" />
            {t("edit")}
          </Button>
        </Can>
      </div>

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
          <InfoRow label={t("form.numeroHistoria")} value={p.numeroHistoria} />
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
    <section className="rounded-lg border bg-card p-5">
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
  if (sexo === "M") return t("form.sexoM");
  if (sexo === "F") return t("form.sexoF");
  if (sexo === "otro") return t("form.sexoOtro");
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
