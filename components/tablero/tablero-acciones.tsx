"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";

import { ejecutarAccion, type Transicion } from "@/lib/api/tablero";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import { listPersonal, type Personal } from "@/lib/api/personal";
import { boardActionMissing } from "@/lib/board/board-action-missing";
import { availableTransitions } from "@/lib/board/available-transitions";
import { refusalRefreshesRow } from "@/lib/lifecycle/allowed-actions";
import { useCan } from "@/hooks/use-can";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FormDialog } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Declarative action menu for a board row: buttons come from the tablero's `transiciones`, drawn from
// the row's `allowedActions` when it carries them (cmr-be 4a) and by state + permission otherwise
// (lib/board/available-transitions.ts). The required payload fields come from `formFields`. Executes
// via POST /board/action with the transition's slug (the backend accepts slugs and action keys).
export function TableroAcciones({
  tablero,
  entidadId,
  estado,
  estados,
  transiciones,
  centroId,
  allowedActions,
  onDone,
}: {
  tablero: string;
  entidadId: string;
  estado: string;
  estados: EstadoCitaCatalogo[];
  transiciones: Transicion[];
  centroId?: string;
  /** The row's `allowedActions`; null/undefined when the row does not carry them. */
  allowedActions?: readonly string[] | null;
  onDone: () => void;
}) {
  const t = useTranslations("tableroBoard");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can } = useCan();

  const [pending, setPending] = React.useState<Transicion | null>(null);
  // Re-initialised whenever the dialog opens or another transition is picked.
  const [values, setValues] = useDialogForm<Record<string, string>>(() => ({}), !!pending, pending?.slug);

  const { submitting, submit } = useSubmit(
    (tr: Transicion, payload: Record<string, string>) =>
      ejecutarAccion({ boardSlug: tablero, entityId: entidadId, action: tr.slug, payload }, centroId),
    {
      successMessage: tc("saved"),
      onSuccess: () => {
        setPending(null);
        onDone();
      },
      // The row moved under us: close the dialog and redraw the row (the toast still says why).
      onError: (err) => {
        if (refusalRefreshesRow(err)) {
          setPending(null);
          onDone();
        }
        return false;
      },
    },
  );

  const isTerminal = estados.find((e) => e.slug === estado)?.isTerminal ?? false;
  const available = availableTransitions(transiciones, {
    status: estado,
    isTerminal,
    allowed: allowedActions ?? null,
    can,
  });

  if (available.length === 0) return null;

  function pick(tr: Transicion) {
    if (tr.formFields.length === 0 && !tr.requiresConfirmation) {
      void submit(tr, {});
    } else {
      setPending(tr);
    }
  }

  const fieldLabel = (field: string) => (KNOWN_FIELDS.includes(field) ? t(`field.${field}`) : field);
  const fields = pending?.formFields ?? [];
  const missing = boardActionMissing(fields, values).map(fieldLabel);
  const run = () => (pending ? submit(pending, values) : undefined);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={submitting} aria-label={t("actions")}>
            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {available.map((tr) => (
            <DropdownMenuItem key={tr.slug} onSelect={() => pick(tr)}>
              {tRoot(tr.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <FormDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending ? tRoot(pending.labelKey) : ""}
        size="md"
        onSubmit={run}
        submitting={submitting}
        missing={missing}
      >
        {fields.length >= 3 && <RequiredLegend />}
        {fields.map((field) => (
          <Field key={field} label={fieldLabel(field)} required>
            <FieldInput
              field={field}
              value={values[field] ?? ""}
              onChange={(v) => setValues({ [field]: v })}
            />
          </Field>
        ))}
        {pending && fields.length === 0 && pending.requiresConfirmation && (
          <p className="text-sm text-muted-foreground">{t("confirmAction")}</p>
        )}
      </FormDialog>
    </>
  );
}

const KNOWN_FIELDS = ["motivo", "fecha", "hora", "enfermeraId"];

// Renders the right input per required field clave (best-effort mapping).
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: string;
  value: string;
  onChange: (v: string) => void;
}) {
  // enfermeraId → select of nurses.
  const isEnfermera = field === "enfermeraId";
  const enfRes = useResource<Personal[]>(
    () => (isEnfermera ? listPersonal({ capacidad: "enfermera", limit: 100 }).then((p) => p.items) : Promise.resolve([])),
    [isEnfermera],
  );
  const enfermeras = enfRes.state.kind === "ok" ? enfRes.state.data : [];

  return field === "motivo" ? (
    <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
  ) : field === "fecha" ? (
    <DatePicker value={value} onChange={onChange} />
  ) : field === "hora" ? (
    <TimePicker value={value} onChange={onChange} />
  ) : isEnfermera ? (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {enfermeras.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            {[m.name, m.lastName].filter(Boolean).join(" ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <Input value={value} onChange={(e) => onChange(e.target.value)} />
  );
}
