"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  updatePersonal,
  getStaffExtensions,
  setStaffExtensions,
  type Personal,
  type StaffEditable,
  type StaffExtension,
} from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { EmailInput } from "@/components/email-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { useSaveSection } from "@/components/personal/save-group";
import { normalizeResponsibilities, showsSpecialty } from "@/lib/personal/responsibilities";

// The editable identity fields of a staff record. Saved by the record's single "Save" (save-group.tsx).
// Phone, sex and color are not shown: nothing reads them and nobody filled them (production,
// 14-nov-2026); the API still accepts them. Specialty only for doctors. `initials` is not edited: the
// BE recomputes it. What the person does and where is the «Puestos» section (staff-positions-section);
// the BE keeps job title and responsibilities in step with it, so they are read here, never edited.

export function FichaEditor({
  persona,
  centro,
}: {
  persona: Personal;
  centro?: string;
}) {
  const t = useTranslations("personalFicha");
  const [name, setName] = React.useState(persona.name ?? "");
  const [lastName, setLastName] = React.useState(persona.lastName ?? "");
  const [specialty, setSpecialty] = React.useState(persona.specialty ?? "");
  const [email, setEmail] = React.useState(persona.email ?? "");
  const withSpecialty = showsSpecialty(persona.jobTitle, normalizeResponsibilities(persona.capabilities), persona.specialty);

  const norm = (s: string) => s.trim();
  const dirty =
    norm(name) !== (persona.name ?? "") ||
    norm(lastName) !== (persona.lastName ?? "") ||
    norm(specialty) !== (persona.specialty ?? "") ||
    norm(email) !== (persona.email ?? "");

  useSaveSection("fields", dirty, async () => {
    if (!norm(name)) throw new Error(t("nameRequired"));
    const payload: StaffEditable = {
      name: norm(name),
      lastName: norm(lastName) || null,
      specialty: norm(specialty) || null,
      email: norm(email) || null,
    };
    await updatePersonal(persona.id, payload, centro);
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label={t("nombre")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Campo>
        <Campo label={t("apellido")}><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Campo>
        <Campo label={t("email")}><EmailInput value={email} onValueChange={setEmail} /></Campo>
        {withSpecialty && (
          <Campo label={t("especialidad")}><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Campo>
        )}
      </div>

      <StaffExtensionsSection staffId={persona.id} centro={centro} />
    </div>
  );
}

/** Deactivate / reactivate: its own deliberate action, not part of "Save". */
export function StaffActiveButton({ persona, centro, onChanged }: { persona: Personal; centro?: string; onChanged: () => void }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);

  async function setActive(active: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await updatePersonal(persona.id, { active }, centro);
      toast.success(active ? t("reactivado") : t("dadoDeBaja"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return persona.active === false ? (
    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setActive(true)}>{t("reactivar")}</Button>
  ) : (
    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => setActive(false)}>{t("darDeBaja")}</Button>
  );
}

// One extension per phone system (BE #553): replaces the loose "extension" field (deprecated; the BE
// still mirrors it from `ucm-bayamon`). Its own endpoint, `PUT .../extensions`, replaces the whole list;
// it saves with the record's single "Save". Known phone systems are suggested, any other can be typed.
const CENTRALES_CONOCIDAS = ["ucm-bayamon", "3cx"];
type ExtensionRow = StaffExtension;
const cleanRows = (rows: ExtensionRow[]) =>
  rows.map((r) => ({ pbx: r.pbx.trim().toLowerCase(), extension: r.extension.trim() })).filter((r) => r.pbx && r.extension);

function StaffExtensionsSection({ staffId, centro }: { staffId: string; centro?: string }) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const res = useResource<StaffExtension[]>(() => getStaffExtensions(staffId, centro), [staffId, centro]);
  const [rows, setRows] = React.useState<StaffExtension[] | null>(null);
  const [prevData, setPrevData] = React.useState<StaffExtension[] | null>(null);
  const [saved, setSaved] = React.useState<StaffExtension[]>([]);
  const data = res.state.kind === "ok" ? res.state.data : null;
  // Adjusted during render (no effect): a fresh load replaces whatever was being edited.
  if (data !== prevData) {
    setPrevData(data);
    setRows(data);
    setSaved(data ?? []);
  }

  const dirty = rows !== null && JSON.stringify(cleanRows(rows)) !== JSON.stringify(cleanRows(saved));
  useSaveSection("extensions", dirty, async () => {
    const clean = cleanRows(rows ?? []);
    if (new Set(clean.map((r) => r.pbx)).size !== clean.length) throw new Error(t("extensionesCentralDuplicada"));
    const result = await setStaffExtensions(staffId, clean, centro);
    setRows(result);
    setSaved(result);
  });

  if (res.state.kind === "loading" || rows === null) return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (res.state.kind === "fail") return <p className="text-sm text-destructive">{res.state.message}</p>;

  function setRow(i: number, patch: Partial<StaffExtension>) {
    setRows((prev) => (prev ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    setRows((prev) => (prev ?? []).filter((_, idx) => idx !== i));
  }
  function add() {
    setRows((prev) => [...(prev ?? []), { pbx: "", extension: "" }]);
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <Label>{t("extensionesTitulo")}</Label>
      <datalist id="centrales-conocidas">
        {CENTRALES_CONOCIDAS.map((c) => <option key={c} value={c} />)}
      </datalist>
      <div className="space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("extensionesVacio")}</p>}
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              list="centrales-conocidas"
              placeholder={t("extensionesCentral")}
              value={r.pbx}
              onChange={(e) => setRow(i, { pbx: e.target.value })}
              className="flex-1"
            />
            <Input
              placeholder={t("extension")}
              value={r.extension}
              maxLength={20}
              inputMode="numeric"
              onChange={(e) => setRow(i, { extension: e.target.value })}
              className="w-32"
            />
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground" onClick={() => remove(i)} aria-label={t("extensionesQuitar")}>
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("extensionesAgregar")}
      </Button>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
