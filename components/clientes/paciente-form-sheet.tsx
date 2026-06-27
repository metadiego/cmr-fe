"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createPaciente,
  updatePaciente,
  type Paciente,
  type CreatePacientePayload,
} from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Sexo = "M" | "F" | "otro";

// Editable fields (the form's working state). Strings throughout; trimmed and
// pruned to the API payload on submit.
type FormState = {
  nombres: string;
  apellidos: string;
  cedula: string;
  sexo: "" | Sexo;
  fechaNacimiento: string;
  nacionalidad: string;
  telefono: string;
  whatsapp: string;
  email: string;
  direccion: string;
  zipcode: string;
  numeroHistoria: string;
  aseguradora: string;
};

const EMPTY: FormState = {
  nombres: "",
  apellidos: "",
  cedula: "",
  sexo: "",
  fechaNacimiento: "",
  nacionalidad: "",
  telefono: "",
  whatsapp: "",
  email: "",
  direccion: "",
  zipcode: "",
  numeroHistoria: "",
  aseguradora: "",
};

function fromPaciente(p: Paciente): FormState {
  return {
    nombres: p.nombres ?? "",
    apellidos: p.apellidos ?? "",
    cedula: p.cedula ?? "",
    sexo: (p.sexo as Sexo | null) ?? "",
    fechaNacimiento: p.fechaNacimiento?.slice(0, 10) ?? "",
    nacionalidad: p.nacionalidad ?? "",
    telefono: p.telefono ?? "",
    whatsapp: p.whatsapp ?? "",
    email: p.email ?? "",
    direccion: p.direccion ?? "",
    zipcode: p.zipcode ?? "",
    numeroHistoria: p.numeroHistoria ?? "",
    aseguradora: p.aseguradora ?? "",
  };
}

// Drop empty strings so optional fields aren't sent as "".
function toPayload(f: FormState): CreatePacientePayload {
  const t = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    nombres: f.nombres.trim(),
    apellidos: t(f.apellidos),
    cedula: t(f.cedula),
    sexo: f.sexo || undefined,
    fechaNacimiento: t(f.fechaNacimiento),
    nacionalidad: t(f.nacionalidad),
    telefono: t(f.telefono),
    whatsapp: t(f.whatsapp),
    email: t(f.email),
    direccion: t(f.direccion),
    zipcode: t(f.zipcode),
    numeroHistoria: t(f.numeroHistoria),
    aseguradora: t(f.aseguradora),
  };
}

// Slide-in create/edit form for a patient. `paciente` null → create mode.
export function PacienteFormSheet({
  open,
  paciente,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  paciente?: Paciente | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (saved: Paciente) => void;
}) {
  const t = useTranslations("patients.form");
  const tc = useTranslations("common");
  const isEdit = !!paciente;

  const [form, setForm] = React.useState<FormState>(
    paciente ? fromPaciente(paciente) : EMPTY,
  );
  const [submitting, setSubmitting] = React.useState(false);

  // The center a NEW patient is created in. Writes are tenant-scoped; master /
  // multi-center users have no auto-locked center, so they must choose one.
  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const needsCentro = !isEdit && centros.length > 1;
  const [centroSel, setCentroSel] = React.useState<string>("");
  // Effective center: explicit choice → active-center cookie → the only center.
  const effectiveCentro =
    centroSel ||
    getActiveCentro() ||
    (centros.length === 1 ? centros[0].id : "");

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(paciente ? fromPaciente(paciente) : EMPTY);
    onOpenChange(next);
  }

  const canSubmit =
    form.nombres.trim().length > 0 &&
    !submitting &&
    (!needsCentro || !!effectiveCentro);

  async function onSubmit() {
    if (!form.nombres.trim()) return;
    if (needsCentro && !effectiveCentro) return;
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      let saved: Paciente;
      if (isEdit) {
        saved = await updatePaciente(
          paciente!.id,
          payload,
          paciente!.clinicId ?? undefined,
        );
      } else {
        saved = await createPaciente(payload, effectiveCentro || undefined);
        // Remember the chosen center so follow-up requests (e.g. opening the
        // new patient's detail) stay in the same tenant.
        if (effectiveCentro) setActiveCentro(effectiveCentro);
      }
      toast.success(isEdit ? t("updated") : t("created"));
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>{t("help")}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {needsCentro && (
            <Section title={t("sectionCentro")}>
              <Field label={t("centro")} required>
                <Select
                  value={effectiveCentro || undefined}
                  onValueChange={setCentroSel}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("centroPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>
          )}

          <Section title={t("sectionPersonal")}>
            <Grid>
              <Field label={t("nombres")} required>
                <Input
                  value={form.nombres}
                  onChange={(e) => set("nombres", e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("apellidos")}>
                <Input
                  value={form.apellidos}
                  onChange={(e) => set("apellidos", e.target.value)}
                />
              </Field>
              <Field label={t("cedula")}>
                <Input
                  value={form.cedula}
                  onChange={(e) => set("cedula", e.target.value)}
                />
              </Field>
              <Field label={t("sexo")}>
                <Select
                  value={form.sexo || undefined}
                  onValueChange={(v) => set("sexo", v as Sexo)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("sexoPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">{t("sexoM")}</SelectItem>
                    <SelectItem value="F">{t("sexoF")}</SelectItem>
                    <SelectItem value="otro">{t("sexoOtro")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("fechaNacimiento")}>
                <Input
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) => set("fechaNacimiento", e.target.value)}
                />
              </Field>
              <Field label={t("nacionalidad")}>
                <Input
                  value={form.nacionalidad}
                  onChange={(e) => set("nacionalidad", e.target.value)}
                />
              </Field>
            </Grid>
          </Section>

          <Section title={t("sectionContact")}>
            <Grid>
              <Field label={t("telefono")}>
                <Input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </Field>
              <Field label={t("whatsapp")}>
                <Input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </Field>
              <Field label={t("email")}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label={t("zipcode")}>
                <Input
                  value={form.zipcode}
                  onChange={(e) => set("zipcode", e.target.value)}
                />
              </Field>
              <Field label={t("direccion")} full>
                <Input
                  value={form.direccion}
                  onChange={(e) => set("direccion", e.target.value)}
                />
              </Field>
            </Grid>
          </Section>

          <Section title={t("sectionClinical")}>
            <Grid>
              <Field label={t("numeroHistoria")}>
                <Input
                  value={form.numeroHistoria}
                  onChange={(e) => set("numeroHistoria", e.target.value)}
                />
              </Field>
              <Field label={t("aseguradora")}>
                <Input
                  value={form.aseguradora}
                  onChange={(e) => set("aseguradora", e.target.value)}
                />
              </Field>
            </Grid>
          </Section>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
