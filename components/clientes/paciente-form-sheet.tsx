"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
  Building06Icon,
  UserCircleIcon,
  Call02Icon,
  Stethoscope02Icon,
} from "@hugeicons/core-free-icons";

import {
  createPaciente,
  updatePaciente,
  getRecordDueno,
  getConfigAltaPacientes,
  type Paciente,
  type CreatePacientePayload,
  type RecordDueno,
} from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";
import { toastError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

// Derived from the API contract so it never drifts from schema.d.ts.
type Sexo = NonNullable<Paciente["sex"]>;
// Runtime whitelist of the values the BE accepts on write. Typed as Sexo[] so TS
// errors if any value drops out of the API enum. Legacy patients still hold codes
// like "0"/"1" (the BE v2 backfill has NOT run yet); those are coerced to "" on
// load so a plain edit never re-submits an invalid value → avoids a 400 (BE rejects
// non-enum sexo). See docs/plans/pacientes-v2-migracion-fe.md.
const SEXO_VALUES: readonly Sexo[] = [
  "femenino",
  "masculino",
  "otro",
  "desconocido",
];

// Editable fields (the form's working state). Strings throughout; trimmed and
// pruned to the API payload on submit.
type FormState = {
  nombres: string;
  apellidos: string;
  docId: string;
  sexo: "" | Sexo;
  fechaNacimiento: string;
  nacionalidad: string;
  telefono: string;
  whatsapp: string;
  email: string;
  direccion: string;
  zipcode: string;
  record: string;
  aseguradora: string;
};

const EMPTY: FormState = {
  nombres: "",
  apellidos: "",
  docId: "",
  sexo: "",
  fechaNacimiento: "",
  nacionalidad: "",
  telefono: "",
  whatsapp: "",
  email: "",
  direccion: "",
  zipcode: "",
  record: "",
  aseguradora: "",
};

function fromPaciente(p: Paciente): FormState {
  return {
    nombres: p.firstName ?? "",
    apellidos: p.lastName ?? "",
    docId: p.documentId ?? "",
    sexo: SEXO_VALUES.includes(p.sex as Sexo) ? (p.sex as Sexo) : "",
    fechaNacimiento: p.dateOfBirth?.slice(0, 10) ?? "",
    nacionalidad: p.nationality ?? "",
    telefono: p.phone ?? "",
    whatsapp: p.whatsapp ?? "",
    email: p.email ?? "",
    direccion: p.address ?? "",
    zipcode: p.zipCode ?? "",
    record: p.medicalRecordNumber ?? "",
    aseguradora: p.insurer ?? "",
  };
}

// Drop empty strings so optional fields aren't sent as "".
function toPayload(f: FormState): CreatePacientePayload {
  const t = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    firstName: f.nombres.trim(),
    lastName: t(f.apellidos),
    documentId: t(f.docId),
    sex: f.sexo || undefined,
    dateOfBirth: t(f.fechaNacimiento),
    nationality: t(f.nacionalidad),
    phone: t(f.telefono),
    whatsapp: t(f.whatsapp),
    email: t(f.email),
    address: t(f.direccion),
    zipCode: t(f.zipcode),
    medicalRecordNumber: t(f.record),
    insurer: t(f.aseguradora),
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
  const tRoot = useTranslations();
  const isEdit = !!paciente;

  const [form, setForm] = React.useState<FormState>(
    paciente ? fromPaciente(paciente) : EMPTY,
  );
  const [submitting, setSubmitting] = React.useState(false);
  // Validación en línea del email SOLO tras salir del campo (patrón moderno: no acusar mientras
  // se escribe). Es un aviso NO bloqueante — el BE es la autoridad final del formato.
  const [emailTouched, setEmailTouched] = React.useState(false);
  const emailInvalido =
    !!form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

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
  // Tenant every request of THIS form goes to (edit stays in the patient's center).
  const tenant = isEdit
    ? (paciente?.clinicId ?? undefined)
    : effectiveCentro || undefined;

  // Required fields come from the BE per-center config (default telefono/zipcode/
  // sexo) — nothing hardcoded here; the BE enforces on save either way. If the
  // config can't load we mark nothing and let the BE answer with `campos`.
  const { state: configState } = useResource(
    () => getConfigAltaPacientes(tenant),
    [tenant, open],
  );
  const requeridos = React.useMemo(
    () =>
      new Set(
        configState.kind === "ok" ? configState.data.requiredFields : [],
      ),
    [configState],
  );
  const req = (campo: keyof FormState) => requeridos.has(campo);
  // Only fields this form captures can gate the submit; anything else the
  // center requires is the BE's final word (surfaced via the 400 toast).
  const faltantes = [...requeridos].filter(
    (campo) =>
      campo in form && !form[campo as keyof FormState].trim(),
  );

  // ── Async duplicate check of the manual record number ──────────────────────
  // Debounced 400 ms (patrón paciente-select). Keyed by tenant+record so a stale
  // response never labels the current value; the "checking" spinner is DERIVED
  // (no result yet for the current key), never set synchronously in the effect
  // (patrón programar-citas-modal / react-hooks/set-state-in-effect).
  const recordLimpio = form.record.trim();
  const recordKey = `${tenant ?? ""}|${recordLimpio}`;
  // No tenant yet (multi-center create before picking a centro): checking would
  // hit the BE unscoped/400 and could accuse a duplicate from ANOTHER center.
  // recordKey includes the tenant, so picking a centro re-checks automatically.
  // Editing and keeping the patient's own record: nothing to check either.
  const needsCheck =
    open &&
    !!recordLimpio &&
    !!tenant &&
    !(isEdit && recordLimpio === (paciente?.medicalRecordNumber ?? ""));
  // res null = the check failed (silent: the BE re-validates on save with 409).
  const [recordCheck, setRecordCheck] = React.useState<{
    key: string;
    res: RecordDueno | null;
  } | null>(null);
  React.useEffect(() => {
    if (!needsCheck) return;
    let cancel = false;
    const timer = setTimeout(() => {
      getRecordDueno(recordLimpio, tenant)
        .then((res) => {
          if (!cancel) setRecordCheck({ key: recordKey, res });
        })
        .catch(() => {
          if (!cancel) setRecordCheck({ key: recordKey, res: null });
        });
    }, 400);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [needsCheck, recordKey, recordLimpio, tenant]);

  // Owner surfaced by the live check (only when it matches the CURRENT value),
  // or by the BE's 409 on save (race fallback). Own record never counts.
  const checkVigente =
    recordCheck && recordCheck.key === recordKey ? recordCheck.res : null;
  const checkingRecord =
    needsCheck && (!recordCheck || recordCheck.key !== recordKey);
  // The 409 fallback owner is KEYED by tenant+record: switching centro or
  // editing the number invalidates it (otherwise a stale red alert from centro A
  // would contradict a green "available" check in centro B).
  const [duenoServer, setDuenoServer] = React.useState<{
    key: string;
    dueno: NonNullable<RecordDueno["dueno"]>;
  } | null>(null);
  const duenoLive =
    checkVigente?.dueno && checkVigente.dueno.id !== paciente?.id
      ? checkVigente.dueno
      : null;
  const dueno =
    duenoLive ?? (duenoServer?.key === recordKey ? duenoServer.dueno : null);
  const recordDisponible = needsCheck && !!checkVigente && !dueno;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  function resetFormState() {
    setForm(paciente ? fromPaciente(paciente) : EMPTY);
    setRecordCheck(null);
    setDuenoServer(null);
    setEmailTouched(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetFormState();
    onOpenChange(next);
  }

  const canSubmit =
    form.nombres.trim().length > 0 &&
    faltantes.length === 0 &&
    !dueno &&
    !checkingRecord &&
    !submitting &&
    (!needsCentro || !!effectiveCentro);

  async function onSubmit() {
    if (!canSubmit) return;
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
      // Reset BEFORE closing: Radix controlled sheets don't fire onOpenChange
      // for programmatic prop changes, so without this the next open shows the
      // saved patient's data AND a false blocking duplicate alert on their own
      // record number.
      resetFormState();
      onOpenChange(false);
    } catch (err) {
      const dueno =
        err instanceof ApiError && err.code === "PACIENTE_RECORD_DUPLICADO"
          ? (err.data?.dueno as NonNullable<RecordDueno["dueno"]> | undefined)
          : undefined;
      if (dueno && typeof dueno === "object" && "firstName" in dueno) {
        // Race fallback: someone took the record between the live check and
        // the save — same big alert, keyed to this tenant+record.
        setDuenoServer({ key: recordKey, dueno });
      } else if (
        err instanceof ApiError &&
        err.code === "PACIENTE_CAMPOS_OBLIGATORIOS" &&
        Array.isArray(err.data?.campos)
      ) {
        // Name the fields (a center can require fields this form doesn't show).
        toast.error(
          t("camposFaltantes", {
            campos: (err.data.campos as string[]).join(", "),
          }),
        );
      } else {
        toastError(err, tRoot);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
          <SheetDescription>{t("help")}</SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {needsCentro && (
            <Section title={t("sectionCentro")} icon={Building06Icon}>
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
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Section>
          )}

          <Section title={t("sectionPersonal")} icon={UserCircleIcon}>
            <Grid>
              <Field label={t("nombres")} required>
                <Input
                  value={form.nombres}
                  onChange={(e) => set("nombres", e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t("apellidos")} required={req("apellidos")}>
                <Input
                  value={form.apellidos}
                  onChange={(e) => set("apellidos", e.target.value)}
                />
              </Field>
              <Field label={t("docId")} required={req("docId")}>
                <Input
                  value={form.docId}
                  onChange={(e) => set("docId", e.target.value)}
                />
              </Field>
              <Field label={t("sexo")} required={req("sexo")}>
                <Select
                  value={form.sexo || undefined}
                  onValueChange={(v) => set("sexo", v as Sexo)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("sexoPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="femenino">{t("sexoFemenino")}</SelectItem>
                    <SelectItem value="masculino">{t("sexoMasculino")}</SelectItem>
                    <SelectItem value="otro">{t("sexoOtro")}</SelectItem>
                    <SelectItem value="desconocido">{t("sexoDesconocido")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("fechaNacimiento")} required={req("fechaNacimiento")}>
                <Input
                  type="date"
                  value={form.fechaNacimiento}
                  onChange={(e) => set("fechaNacimiento", e.target.value)}
                />
              </Field>
              <Field label={t("nacionalidad")} required={req("nacionalidad")}>
                <Input
                  value={form.nacionalidad}
                  onChange={(e) => set("nacionalidad", e.target.value)}
                />
              </Field>
            </Grid>
          </Section>

          <Section title={t("sectionContact")} icon={Call02Icon}>
            <Grid>
              <Field label={t("telefono")} required={req("telefono")}>
                <Input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => set("telefono", e.target.value)}
                />
              </Field>
              <Field label={t("whatsapp")} required={req("whatsapp")}>
                <Input
                  type="tel"
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </Field>
              <Field
                label={t("email")}
                required={req("email")}
                hint={emailTouched && emailInvalido ? t("emailInvalido") : undefined}
              >
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  aria-invalid={emailTouched && emailInvalido}
                  className={emailTouched && emailInvalido ? "border-destructive" : undefined}
                />
              </Field>
              <Field label={t("zipcode")} required={req("zipcode")}>
                <Input
                  value={form.zipcode}
                  onChange={(e) => set("zipcode", e.target.value)}
                />
              </Field>
              <Field label={t("direccion")} full required={req("direccion")}>
                <Input
                  value={form.direccion}
                  onChange={(e) => set("direccion", e.target.value)}
                />
              </Field>
            </Grid>
          </Section>

          <Section title={t("sectionClinical")} icon={Stethoscope02Icon}>
            <Grid>
              <Field label={t("record")} required={req("record")}>
                <div className="relative">
                  <Input
                    value={form.record}
                    onChange={(e) => set("record", e.target.value)}
                    aria-invalid={!!dueno}
                    className={dueno ? "pr-8 border-destructive" : "pr-8"}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    {checkingRecord ? (
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="size-4 animate-spin text-muted-foreground"
                      />
                    ) : recordDisponible ? (
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        strokeWidth={2}
                        className="size-4 text-success"
                      />
                    ) : null}
                  </span>
                </div>
              </Field>
              <Field label={t("aseguradora")} required={req("aseguradora")}>
                <Input
                  value={form.aseguradora}
                  onChange={(e) => set("aseguradora", e.target.value)}
                />
              </Field>
            </Grid>
            {dueno && (
              <Alert variant="destructive">
                <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
                <AlertTitle>{t("recordDuplicadoTitle")}</AlertTitle>
                <AlertDescription>
                  {t("recordDuplicadoBody", {
                    record: dueno.medicalRecordNumber ?? recordLimpio,
                    nombre: `${dueno.firstName}${dueno.lastName ? ` ${dueno.lastName}` : ""}`,
                    estado: dueno.active
                      ? t("recordDuenoActivo")
                      : t("recordDuenoInactivo"),
                  })}
                </AlertDescription>
              </Alert>
            )}
          </Section>
          </div>

          <SheetFooter className="flex-row items-center gap-2 border-t px-6 py-4">
            <span className="mr-auto text-xs text-muted-foreground">
              <span className="text-destructive">*</span> {t("requiredLegend")}
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className="size-4 animate-spin"
                  />
                  {tc("saving")}
                </>
              ) : (
                tc("save")
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: Parameters<typeof HugeiconsIcon>[0]["icon"];
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {icon ? <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" /> : null}
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
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {hint ? <p className="text-xs text-destructive">{hint}</p> : null}
    </div>
  );
}
