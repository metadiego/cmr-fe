"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { toastError } from "@/lib/api/errors";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Declarative action menu for a board row: buttons come from the tablero's
// `transiciones` (filtered by state + permission), and the required payload
// fields come from `transicion.requiere`. Executes via POST /tablero/accion.
export function TableroAcciones({
  tablero,
  entidadId,
  estado,
  estados,
  transiciones,
  centroId,
  onDone,
}: {
  tablero: string;
  entidadId: string;
  estado: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  centroId?: string;
  onDone: () => void;
}) {
  const t = useTranslations("tableroBoard");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();

  const [pending, setPending] = React.useState<Transicion | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const isTerminal = estados.find((e) => e.clave === estado)?.esTerminal ?? false;
  const available = transiciones
    .filter((tr) => tr.activo !== false)
    .filter((tr) => !tr.permiso || can(tr.permiso))
    .filter((tr) => tr.desdeEstados.includes(estado) || (tr.desdeEstados.length === 0 && !isTerminal))
    .sort((a, b) => a.orden - b.orden);

  if (available.length === 0) return null;

  async function run(tr: Transicion, payload: Record<string, string>) {
    setBusy(true);
    try {
      await ejecutarAccion({ tablero, entidadId, accion: tr.clave, payload }, centroId);
      toast.success(tc("saved"));
      setPending(null);
      setValues({});
      onDone();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  function pick(tr: Transicion) {
    if (tr.requiere.length === 0 && !tr.confirmar) {
      void run(tr, {});
    } else {
      setValues({});
      setPending(tr);
    }
  }

  const canSubmit =
    !!pending && !busy && pending.requiere.every((f) => (values[f] ?? "").trim() !== "");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={busy} aria-label={t("actions")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map((tr) => (
            <DropdownMenuItem key={tr.clave} onSelect={() => pick(tr)}>
              {tRoot(tr.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending ? tRoot(pending.labelKey) : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pending?.requiere.map((field) => (
              <Field
                key={field}
                field={field}
                value={values[field] ?? ""}
                onChange={(v) => setValues((s) => ({ ...s, [field]: v }))}
              />
            ))}
            {pending && pending.requiere.length === 0 && pending.confirmar && (
              <p className="text-sm text-muted-foreground">{t("confirmAction")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>
              {tc("cancel")}
            </Button>
            <Button onClick={() => pending && run(pending, values)} disabled={!canSubmit}>
              {busy ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Renders the right input per required field clave (best-effort mapping).
function Field({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("tableroBoard");
  const KNOWN = ["motivo", "fecha", "hora", "enfermeraId"];
  const label = KNOWN.includes(field) ? t(`field.${field}`) : field;

  // enfermeraId → select of nurses.
  const isEnfermera = field === "enfermeraId";
  const enfRes = useResource<Personal[]>(
    () => (isEnfermera ? listPersonal({ capacidad: "enfermera", limit: 100 }).then((p) => p.items) : Promise.resolve([])),
    [isEnfermera],
  );
  const enfermeras = enfRes.state.kind === "ok" ? enfRes.state.data : [];

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {field === "motivo" ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : field === "fecha" ? (
        <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : field === "hora" ? (
        <Input type="time" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : isEnfermera ? (
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {enfermeras.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {[m.nombre, m.apellido].filter(Boolean).join(" ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
