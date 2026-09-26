"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getServicios, type Servicio } from "@/lib/api/servicios";
import { agendarVariosServicios } from "@/lib/api/frontdesk";
import { mostrarAvisos } from "@/lib/frontdesk/avisos";
import { toastError } from "@/lib/api/errors";
import { type Paciente } from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { TherapyDayPlanner, type PlannerService } from "@/components/agenda/therapy-day-planner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

// COMPOSICIÓN REUTILIZABLE: elegir paciente + terapias, VER los huecos reales en el planner y AGENDAR el
// día — todo en una pieza. La montan la ruta aparte (`/scheduling/therapy-day`) y el modal del calendario de
// «Citas de servicio», para no tener una ventana suelta por otro lado (una sola pieza, se edita una vez).
// Reserva por el MISMO endpoint del frontdesk (book-multiple) que el «Citar»: no duplica el motor de agenda.
export function TherapyDayScheduler({
  defaultDate,
  defaultPatient,
  centro,
  onBooked,
}: {
  defaultDate?: string;
  defaultPatient?: Paciente | null;
  centro?: string;
  onBooked?: () => void;
}) {
  const t = useTranslations("therapyPlanner");
  const tp = useTranslations("programarCitas");
  const tRoot = useTranslations();

  const [paciente, setPaciente] = React.useState<Paciente | null>(defaultPatient ?? null);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [date, setDate] = React.useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const servRes = useResource<Servicio[]>(() => getServicios(centro), [centro]);
  const servicios = servRes.state.kind === "ok" ? servRes.state.data : [];
  const chosen: PlannerService[] = servicios
    .filter((s) => sel.has(s.id))
    .map((s) => ({ id: s.id, name: s.name }));

  const nombre = paciente
    ? paciente.displayName || [paciente.firstName, paciente.lastName].filter(Boolean).join(" ").trim()
    : "";

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
    setTime("");
  }

  const canBook = !!paciente && sel.size > 0 && !!date && !submitting;

  async function book() {
    if (!paciente || sel.size === 0) return;
    setSubmitting(true);
    try {
      // Mismo motor que el «Citar»: agenda el cruce (cada terapia en la fecha) en una sola llamada. La `time`
      // es la del hueco elegido en el planner (opcional; el BE descuenta el cupo de esa franja, no bloquea).
      const { data, warnings } = await agendarVariosServicios(
        { patientId: paciente.id, serviceIds: [...sel], fechas: [date], time: time || undefined },
        centro,
      );
      const creadas = Array.isArray(data.creadas) ? data.creadas.length : 0;
      const omitidas = Number(data.omitidas ?? 0);
      toast.success(tp("resumen", { creadas, omitidas }));
      mostrarAvisos(warnings, tRoot); // cupo excedido / sin cupo — no bloquea
      if (data.aviso) toast.warning(tp("avisoDisponibilidad")); // disponibilidad excedida por servicio
      onBooked?.();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[22rem_1fr]">
      <aside className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{t("pickPatient")}</label>
          <PacienteSelect
            value={paciente}
            onChange={(p) => {
              setPaciente(p);
              setSel(new Set());
              setTime("");
            }}
          />
        </div>
        {paciente && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">{t("pickServices")}</label>
            <ul className="max-h-[55vh] space-y-1 overflow-auto rounded-md p-2 ring-1 ring-foreground/10">
              {servicios.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                    <Checkbox checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color ?? "#4a90d9" }}
                    />
                    <span className="min-w-0 truncate">{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className="space-y-4">
        <div className="rounded-md bg-card p-5 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          {!paciente ? (
            <p className="text-sm text-muted-foreground">{t("choosePatientFirst")}</p>
          ) : chosen.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noServices")}</p>
          ) : (
            <TherapyDayPlanner
              patient={{ id: paciente.id, name: nombre, record: paciente.medicalRecordNumber }}
              services={chosen}
              centro={centro}
              date={date}
              onDateChange={setDate}
              time={time}
              onTimeChange={setTime}
            />
          )}
        </div>
        {paciente && chosen.length > 0 && (
          <div className="flex items-center justify-end gap-3">
            <p className="text-xs text-muted-foreground">{t("bookHint")}</p>
            <Button onClick={book} disabled={!canBook}>
              {submitting ? tRoot("common.saving") : t("bookN", { n: sel.size })}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
