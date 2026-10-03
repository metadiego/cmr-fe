"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { updatePersonal, type Personal, type CargoCatalogo, type StaffEditable } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Editor COMPLETO de la ficha de personal (handoff personal-crud-completo): identidad (nombre, apellido,
// especialidad, teléfono, email, sexo, color) + cargo + capacidades, con un único Guardar. La baja/reactivar
// (active) es su propio botón para que sea un gesto consciente. `initials` NO se edita: el BE las recalcula.
// Los centros van en su bloque aparte (regla del BE: endpoint propio).
const NO_CARGO = "__none__";

export function FichaEditor({
  persona,
  cargoCatalogo,
  capacidadOpciones,
  centro,
  onChanged,
}: {
  persona: Personal;
  cargoCatalogo: CargoCatalogo[];
  capacidadOpciones: string[];
  centro?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const p = persona as Personal & { sex?: string | null; color?: string | null };
  const [name, setName] = React.useState(persona.name ?? "");
  const [lastName, setLastName] = React.useState(persona.lastName ?? "");
  const [specialty, setSpecialty] = React.useState(persona.specialty ?? "");
  const [phone, setPhone] = React.useState(persona.phone ?? "");
  const [email, setEmail] = React.useState(persona.email ?? "");
  const [sex, setSex] = React.useState(p.sex ?? "");
  const [color, setColor] = React.useState(p.color || "#4a90d9");
  const [cargo, setCargo] = React.useState(persona.jobTitle ?? "");
  const [caps, setCaps] = React.useState<string[]>(persona.capabilities ?? []);
  const [busy, setBusy] = React.useState(false);

  const cargoLabel = (clave: string) => {
    const c = cargoCatalogo.find((x) => x.slug === clave);
    if (c?.labelKey && tRoot.has(c.labelKey)) return tRoot(c.labelKey);
    return c?.name ?? clave;
  };
  const claves = cargoCatalogo.map((c) => c.slug);
  const cargos = cargo && !claves.includes(cargo) ? [...claves, cargo] : claves;
  const toggleCap = (c: string) => setCaps((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const norm = (s: string) => s.trim();
  const sucio =
    norm(name) !== (persona.name ?? "") ||
    norm(lastName) !== (persona.lastName ?? "") ||
    norm(specialty) !== (persona.specialty ?? "") ||
    norm(phone) !== (persona.phone ?? "") ||
    norm(email) !== (persona.email ?? "") ||
    (sex || "") !== (p.sex ?? "") ||
    (color || "") !== (p.color ?? "") ||
    cargo !== (persona.jobTitle ?? "") ||
    JSON.stringify([...caps].sort()) !== JSON.stringify([...(persona.capabilities ?? [])].sort());

  async function guardar() {
    if (busy || !sucio || !norm(name)) return;
    setBusy(true);
    try {
      const payload: StaffEditable = {
        name: norm(name),
        lastName: norm(lastName) || null,
        specialty: norm(specialty) || null,
        phone: norm(phone) || null,
        email: norm(email) || null,
        sex: sex || null,
        color: color || undefined,
        jobTitle: cargo || null,
        capabilities: caps,
      };
      await updatePersonal(persona.id, payload, centro);
      toast.success(t("guardado"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  async function cambiarActivo(active: boolean) {
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

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label={t("nombre")}><Input value={name} onChange={(e) => setName(e.target.value)} /></Campo>
        <Campo label={t("apellido")}><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></Campo>
        <Campo label={t("email")}><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        <Campo label={t("telefono")}><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Campo>
        <Campo label={t("especialidad")}><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} /></Campo>
        <Campo label={t("sexo")}>
          <Select value={sex || undefined} onValueChange={setSex}>
            <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="f">{t("sexoF")}</SelectItem>
              <SelectItem value="m">{t("sexoM")}</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label={t("cargo")}>
          <Select value={cargo || undefined} onValueChange={(v) => setCargo(v === NO_CARGO ? "" : v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder={t("cargoPlaceholder")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CARGO}>{t("cargoPlaceholder")}</SelectItem>
              {cargos.map((c) => <SelectItem key={c} value={c}>{cargoLabel(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Campo>
        <Campo label={t("color")}>
          <div className="flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5" aria-label={t("color")} />
            <span className="font-mono text-xs text-muted-foreground">{color}</span>
          </div>
        </Campo>
      </div>

      <div className="grid gap-2">
        <Label>{t("capacidades")}</Label>
        <div className="flex flex-wrap gap-2">
          {capacidadOpciones.map((c) => {
            const on = caps.includes(c);
            return (
              <button key={c} type="button" onClick={() => toggleCap(c)} className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
              )}>{c}</button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        {persona.active === false ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => cambiarActivo(true)}>{t("reactivar")}</Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => cambiarActivo(false)}>{t("darDeBaja")}</Button>
        )}
        <Button size="sm" onClick={guardar} disabled={!sucio || busy || !norm(name)}>{busy ? t("guardando") : t("guardarCambios")}</Button>
      </div>
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
