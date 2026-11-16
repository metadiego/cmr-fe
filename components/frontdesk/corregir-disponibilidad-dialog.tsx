"use client";

import { useTranslations } from "next-intl";

import { ajustarDisponibilidad, paqueteTotales, type PaqueteDisponibilidad } from "@/lib/api/frontdesk";
import { fixAvailabilityInvalid, fixAvailabilityMissing } from "@/lib/frontdesk/fix-availability-missing";
import { Input } from "@/components/ui/input";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { RequiredLegend } from "@/components/kit/required-mark";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

// "Fix availability" dialog (GAP C) — PATCH …/paquetes/:id/ajuste. Fixes sessions when billing got them
// wrong; updates the balance (does not rewrite the invoice). RBAC: whoever opens it already passed the
// `frontdesk.disponibilidad.editar` gate. Extracted from frontdesk-board.tsx (size ceiling).
export function CorregirDisponibilidadDialog({
  paquete,
  centro,
  onClose,
  onDone,
}: {
  paquete: PaqueteDisponibilidad | null; // null = closed (dialog controlled by the parent)
  centro?: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("frontdesk");
  const { entregadas, totales } = paquete ? paqueteTotales(paquete) : { entregadas: 0, totales: 0 };
  // The package carries its multiplier breakdown (areas×days) → the doctor picks the combination
  // (2×12 vs 1×24), not a bare total: send `multiplicadores`, not `totalSessions` — sending only the
  // total leaves areas and days out of step (handoff areas-y-dias-en-el-kit).
  const tieneMult = !!(paquete?.multiplicadores && Object.keys(paquete.multiplicadores).length > 0);
  const [form, setForm] = useDialogForm(
    () => ({
      valor: paquete ? String(totales) : "",
      valoresMult: paquete?.multiplicadores
        ? Object.fromEntries(Object.entries(paquete.multiplicadores).map(([k, v]) => [k, String(v)]))
        : ({} as Record<string, string>),
    }),
    paquete != null,
    paquete?.id ?? null,
  );
  const state = { multipliers: tieneMult ? form.valoresMult : null, total: form.valor, delivered: entregadas };
  const multLabel = (k: string) => (t.has(`mult.${k}`) ? t(`mult.${k}`) : k);
  const missing = fixAvailabilityMissing(state).map((f) =>
    f === "totalSessions" ? t("corregirSesiones") : multLabel(f.slice("mult.".length)),
  );
  const problem = fixAvailabilityInvalid(state);
  const reason = !paquete?.id
    ? t("fixAvailabilityNoPackageId")
    : problem === "belowDelivered"
      ? t("corregirMenorConsumido", { n: entregadas })
      : problem === "multiplierNotPositive"
        ? t("fixAvailabilityMultiplierPositive")
        : null;

  const { submitting, submit } = useSubmit(
    async () => {
      if (!paquete?.id) return;
      if (tieneMult) {
        const multiplicadores = Object.fromEntries(Object.entries(form.valoresMult).map(([k, v]) => [k, Number(v)]));
        await ajustarDisponibilidad(paquete.id, { multiplicadores }, centro);
      } else {
        await ajustarDisponibilidad(paquete.id, { totalSessions: Number(form.valor) }, centro);
      }
    },
    {
      successMessage: t("corregirOk"),
      onSuccess: () => {
        onClose();
        onDone();
      },
    },
  );

  const multKeys = Object.keys(form.valoresMult);
  return (
    <FormDialog
      open={paquete != null}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={t("corregirTitulo")}
      description={t("corregirDesc")}
      onSubmit={() => submit()}
      submitLabel={t("corregirGuardar")}
      submitting={submitting}
      missing={missing}
      reason={reason}
      // Filled but unacceptable values, or a package without id, kept the button disabled before too.
      blocked={problem != null || !paquete?.id}
    >
      {paquete && (
        <>
          <div className="rounded-md bg-card px-3 py-2 text-sm ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <span className="font-medium">{paquete.productoNombre ?? paquete.sku ?? "—"}</span>
          </div>
          {tieneMult ? (
            <div className="flex flex-wrap gap-3">
              {multKeys.map((k) => (
                <Field key={k} label={multLabel(k)} htmlFor={`corregir-mult-${k}`} required className="space-y-1">
                  <Input
                    id={`corregir-mult-${k}`}
                    type="number"
                    min={1}
                    value={form.valoresMult[k]}
                    onChange={(e) => setForm((s) => ({ ...s, valoresMult: { ...s.valoresMult, [k]: e.target.value } }))}
                    className="w-24"
                  />
                </Field>
              ))}
              {multKeys.length >= 3 && <RequiredLegend className="basis-full text-xs text-muted-foreground" />}
            </div>
          ) : (
            <Field label={t("corregirSesiones")} htmlFor="corregir-sesiones" required className="space-y-1">
              <Input
                id="corregir-sesiones"
                type="number"
                min={entregadas}
                value={form.valor}
                aria-invalid={problem === "belowDelivered"}
                onChange={(e) => setForm({ valor: e.target.value })}
              />
            </Field>
          )}
        </>
      )}
    </FormDialog>
  );
}
