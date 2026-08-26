"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, UserAccountIcon } from "@hugeicons/core-free-icons";

import { listPersonal, updatePersonal, type Personal } from "@/lib/api/personal";
import { getRoles, type Rol } from "@/lib/api/rbac";
import { inviteUser } from "@/lib/api/profiles";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// Ficha de personal: TODO en una pantalla, sin saltar. Lista a la izquierda, ficha de la persona a la
// derecha (identidad, cargo/capacidades y «Dar acceso al sistema»). El objetivo del dueño: uno o dos
// clics y ver el estado final aquí mismo, no un «guardado» a secas. Handoff ficha-de-personal-todo-en-una-pantalla.
// NOTA: el bloque «Centros de servicio» queda pendiente hasta que el BE exponga la LECTURA del set (hoy
// solo hay PUT; sin GET no se pueden precargar los checkboxes sin arriesgar borrar lo que no se ve).
const nombreDe = (p: Personal) => [p.nombre, p.apellido].filter(Boolean).join(" ").trim() || p.nombre;

export default function PersonalPage() {
  const t = useTranslations("personalFicha");
  const gate = useCentroGate();
  const listRes = useResource<Personal[]>(
    () => (gate.centro ? listPersonal({ limit: 100 }, gate.centro).then((r) => r.items) : Promise.resolve([])),
    [gate.centro],
  );
  const personal = React.useMemo(
    () => (listRes.state.kind === "ok" ? listRes.state.data : []),
    [listRes.state],
  );
  const rolesRes = useResource<Rol[]>(() => getRoles());
  const roles = rolesRes.state.kind === "ok" ? rolesRes.state.data : [];

  const [q, setQ] = React.useState("");
  const [selId, setSelId] = React.useState<string>("");

  // Cargos y capacidades: derivados de los valores REALES del personal (el catálogo GET /personal/cargos
  // colisiona con /personal/:id y da 400; hasta que el BE lo arregle, las opciones salen de los datos).
  const cargoOpciones = React.useMemo(
    () => [...new Set(personal.map((p) => p.cargo).filter((c): c is string => !!c))].sort(),
    [personal],
  );
  const capacidadOpciones = React.useMemo(
    () => [...new Set(personal.flatMap((p) => p.capacidades ?? []))].sort(),
    [personal],
  );

  const filtrados = personal
    .filter((p) => {
      const n = q.trim().toLowerCase();
      return !n || nombreDe(p).toLowerCase().includes(n) || (p.cargo ?? "").toLowerCase().includes(n);
    })
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b)));
  const sel = personal.find((p) => p.id === selId) ?? null;

  return (
    <div className="mx-auto w-full max-w-none px-6 py-8 2xl:px-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      {gate.necesitaPicker && <p className="mt-6 text-sm text-muted-foreground">{t("elegirCentro")}</p>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Lista */}
        <aside className="space-y-2">
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("buscar")} className="h-9 pl-8" />
          </div>
          {listRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("cargando")}</p>}
          <ul className="max-h-[70vh] space-y-1 overflow-auto">
            {filtrados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                    p.id === selId ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", p.id === selId ? "bg-primary-foreground/20" : "bg-primary/10 text-primary")}>
                    {(p.nombre?.[0] ?? "") + (p.apellido?.[0] ?? "")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{nombreDe(p)}</span>
                    <span className={cn("block truncate text-xs", p.id === selId ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {p.cargo || t("sinCargo")}{p.perfilId ? "" : ` · ${t("sinCuenta")}`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {filtrados.length === 0 && listRes.state.kind === "ok" && (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">{t("vacio")}</li>
            )}
          </ul>
        </aside>

        {/* Ficha */}
        <section>
          {sel ? (
            <FichaPersonal
              key={sel.id}
              persona={sel}
              cargoOpciones={cargoOpciones}
              capacidadOpciones={capacidadOpciones}
              roles={roles}
              centro={gate.centro}
              onChanged={() => listRes.reload()}
            />
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              {t("elegirPersona")}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function FichaPersonal({
  persona, cargoOpciones, capacidadOpciones, roles, centro, onChanged,
}: {
  persona: Personal;
  cargoOpciones: string[];
  capacidadOpciones: string[];
  roles: Rol[];
  centro?: string;
  onChanged: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [cargo, setCargo] = React.useState(persona.cargo ?? "");
  const [caps, setCaps] = React.useState<string[]>(persona.capacidades ?? []);
  const [busy, setBusy] = React.useState(false);
  const [darAcceso, setDarAcceso] = React.useState(false);

  const cargos = cargoOpciones.includes(cargo) || !cargo ? cargoOpciones : [...cargoOpciones, cargo];
  const sucio = cargo !== (persona.cargo ?? "") || JSON.stringify([...caps].sort()) !== JSON.stringify([...(persona.capacidades ?? [])].sort());

  function toggleCap(c: string) {
    setCaps((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }
  async function guardar() {
    if (busy || !sucio) return;
    setBusy(true);
    try {
      await updatePersonal(persona.id, { cargo: cargo || null, capacidades: caps }, centro);
      toast.success(t("guardado"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 rounded-xl border bg-card/60 p-6 shadow-sm">
      {/* Identidad */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
            {(persona.nombre?.[0] ?? "") + (persona.apellido?.[0] ?? "")}
          </span>
          <div>
            <div className="text-lg font-semibold">{nombreDe(persona)}</div>
            <div className="text-sm text-muted-foreground">{persona.email || (persona.perfilId ? t("conCuenta") : t("sinCuenta"))}</div>
          </div>
        </div>
      </div>

      {/* Cargo + capacidades */}
      <div className="space-y-4 border-t pt-4">
        <div className="grid gap-2">
          <Label>{t("cargo")}</Label>
          <Select value={cargo || undefined} onValueChange={setCargo}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t("cargoPlaceholder")} /></SelectTrigger>
            <SelectContent>
              {cargos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>{t("capacidades")}</Label>
          <div className="flex flex-wrap gap-2">
            {capacidadOpciones.map((c) => {
              const on = caps.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCap(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    on ? "border-primary/40 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={guardar} disabled={!sucio || busy}>{busy ? t("guardando") : t("guardarCambios")}</Button>
        </div>
      </div>

      {/* Acceso al sistema */}
      <div className="border-t pt-4">
        <Label className="mb-2 block">{t("acceso")}</Label>
        {persona.perfilId ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm">
            <HugeiconsIcon icon={UserAccountIcon} className="size-4 text-emerald-600 dark:text-emerald-400" />
            <span>{persona.email || t("conCuenta")}{persona.perfilId ? ` · ${t("aprobado")}` : ""}</span>
            <Link href="/admin" className="ml-auto text-xs font-medium text-primary hover:underline">{t("verUsuario")}</Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("sinCuentaAyuda")}</span>
            <Button size="sm" onClick={() => setDarAcceso(true)}>{t("darAcceso")}</Button>
          </div>
        )}
      </div>

      {darAcceso && (
        <DarAccesoDialog
          persona={persona}
          roles={roles}
          centro={centro}
          onClose={() => setDarAcceso(false)}
          onDone={() => { setDarAcceso(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function DarAccesoDialog({
  persona, roles, centro, onClose, onDone,
}: {
  persona: Personal;
  roles: Rol[];
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("personalFicha");
  const tRoot = useTranslations();
  const [email, setEmail] = React.useState(persona.email ?? "");
  const [rolClave, setRolClave] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function dar() {
    if (busy || !email.trim() || !rolClave) return;
    setBusy(true);
    try {
      // UNA sola llamada: crea la cuenta, la enlaza a la ficha (personalId), da el rol y asigna el centro.
      await inviteUser({
        email: email.trim(),
        nombre: persona.nombre,
        apellido: persona.apellido ?? undefined,
        personalId: persona.id,
        rolClave,
        centroId: centro,
        tipoAsignacion: "base",
        redirectTo: `${window.location.origin}/auth/set-password`,
      });
      toast.success(t("accesoDado", { nombre: nombreDe(persona) }));
      onDone();
    } catch (e) {
      // PERSONAL_YA_TIENE_CUENTA / PERSONAL_DE_OTRO_CENTRO / PERSONAL_NO_EXISTE → mensaje del BE (labelKey).
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("darAccesoTitulo", { nombre: nombreDe(persona) })}</DialogTitle>
          <DialogDescription>{t("darAccesoDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>{t("correo")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="persona@correo.com" autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label>{t("rol")}</Label>
            <Select value={rolClave || undefined} onValueChange={setRolClave}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("rolPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => <SelectItem key={r.id} value={r.clave}>{r.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{tRoot("common.cancel")}</Button>
          <Button onClick={dar} disabled={busy || !email.trim() || !rolClave}>{busy ? t("dando") : t("darAcceso")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
