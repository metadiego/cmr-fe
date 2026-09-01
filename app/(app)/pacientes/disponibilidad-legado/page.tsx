"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";

import {
  diagnosticoDisponibilidadLegado,
  aplicarDisponibilidadLegado,
  type DiagnosticoLegado,
  type CandidatoRecord,
} from "@/lib/api/pacientes";
import { ApiError } from "@/lib/api/types";
import { apiErrorLabel } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/ui/page";

// Cargar disponibilidad heredada del legado por número de récord. Como un récord puede corresponder a
// VARIAS personas, si el BE responde 409 RECORD_AMBIGUO NO se muestra error: se deja ELEGIR a la persona
// (candidatos) y se repite con pacienteId; aplicar usa ese mismo pacienteId. Handoff
// HANDOFF-record-ambiguo-elegir-persona. (Nota: la lectura real del legado hoy da 500 desde la nube —
// falta sqlcmd en el contenedor; el camino del 409 sí funciona.)
export default function DisponibilidadLegadoPage() {
  const t = useTranslations("pacientes.dispLegado");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const centro = useSearchParams().get("centro") ?? undefined;

  const [record, setRecord] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [candidatos, setCandidatos] = React.useState<CandidatoRecord[] | null>(null);
  const [diag, setDiag] = React.useState<DiagnosticoLegado | null>(null);
  const [pacienteId, setPacienteId] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null); // legado inaccesible u otro error no bloqueante

  function reset(soloResultado = false) {
    setCandidatos(null);
    setDiag(null);
    setAviso(null);
    if (!soloResultado) setPacienteId(null);
  }

  async function diagnosticar(rec: string, pid?: string) {
    const r = rec.trim();
    if (!r) return;
    setBusy(true);
    reset(true);
    try {
      const d = await diagnosticoDisponibilidadLegado(r, pid, centro);
      setDiag(d);
      setPacienteId(pid ?? d.paciente?.id ?? d.pacienteId ?? null);
      setCandidatos(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "RECORD_AMBIGUO") {
        // No es un fallo: es una pregunta. Mostrar los candidatos para elegir.
        const cands = (err.data?.candidatos as CandidatoRecord[] | undefined) ?? [];
        setCandidatos(cands);
        setPacienteId(null);
      } else if (err instanceof ApiError && err.code === "PACIENTE_NO_ES_DEL_RECORD") {
        // El id no corresponde a ese récord/centro (se cambió el récord sin limpiar la selección).
        toast.error(apiErrorLabel(err, tRoot));
        setPacienteId(null);
        // Volver a pedir el diagnóstico limpio para re-mostrar candidatos.
        void diagnosticar(r);
      } else {
        // 500 (legado inaccesible desde la nube) u otro: avisar sin romper.
        setAviso(apiErrorLabel(err, tRoot));
      }
    } finally {
      setBusy(false);
    }
  }

  async function aplicar() {
    if (!diag || !pacienteId) return;
    setBusy(true);
    try {
      await aplicarDisponibilidadLegado(record.trim(), { pacienteId, items: (diag.items as unknown[]) ?? [] }, centro);
      toast.success(t("aplicada"));
      reset();
      setRecord("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "PACIENTE_NO_ES_DEL_RECORD") {
        toast.error(apiErrorLabel(err, tRoot));
        void diagnosticar(record.trim()); // vuelve al paso de elegir
      } else {
        toast.error(apiErrorLabel(err, tRoot));
      }
    } finally {
      setBusy(false);
    }
  }

  const items = Array.isArray(diag?.items) ? (diag!.items as unknown[]) : [];

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      {/* Buscar por récord */}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); diagnosticar(record); }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("record")}</span>
          <Input value={record} onChange={(e) => { setRecord(e.target.value); }} placeholder={t("recordPlaceholder")} className="h-9 w-[200px]" inputMode="numeric" />
        </label>
        <Button type="submit" className="h-9" disabled={busy || !record.trim()}>{t("buscar")}</Button>
      </form>

      {aviso && (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
          <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-4 shrink-0" />
          <span>{aviso}</span>
        </div>
      )}

      {/* Récord ambiguo: elegir a la persona (no es error). */}
      {candidatos && (
        <div className="rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="flex items-center gap-2 text-sm font-medium">
            <HugeiconsIcon icon={UserMultiple02Icon} className="size-4 text-primary" />
            {t("ambiguoTitulo", { record: record.trim(), n: candidatos.length })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("ambiguoAyuda")}</p>
          <ul className="mt-3 space-y-2">
            {candidatos.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => diagnosticar(record, c.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left hover:border-primary/50 hover:bg-accent/40 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {[c.nombres, c.apellidos].filter(Boolean).join(" ") || t("sinNombre")}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {/* Desempate: id abreviado + datos que distingan (mismos nombres en 53 casos). */}
                      #{c.record} · ID {String(c.id).slice(0, 8)}
                      {c.telefono ? ` · ${c.telefono}` : ""}
                      {c.fechaNacimiento ? ` · ${String(c.fechaNacimiento).slice(0, 10)}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary">{t("elegir")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Revisar y confirmar la carga para la persona elegida. */}
      {diag && !candidatos && (
        <div className="rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("cargarPara")}</div>
              <div className="text-lg font-semibold">
                {[diag.paciente?.nombres, diag.paciente?.apellidos].filter(Boolean).join(" ") || t("sinNombre")}
              </div>
              <div className="text-xs text-muted-foreground">#{diag.record}{pacienteId ? ` · ID ${pacienteId.slice(0, 8)}` : ""}</div>
            </div>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
              {t("nItems", { n: items.length })}
            </span>
          </div>

          {items.length > 0 ? (
            <ul className="mt-3 divide-y rounded-md ring-1 ring-foreground/10 text-sm">
              {items.map((it, i) => (
                <li key={i} className="px-3 py-2">
                  <ItemResumen it={it} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">{t("sinItems")}</p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => reset()}>{tc("cancel")}</Button>
            <Button onClick={aplicar} disabled={busy || !pacienteId || items.length === 0}>{t("confirmar")}</Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

// Resumen defensivo de un ítem de disponibilidad (la forma exacta la sirve el BE al leer el legado).
function ItemResumen({ it }: { it: unknown }) {
  if (it && typeof it === "object") {
    const o = it as Record<string, unknown>;
    const nombre = (o.servicio ?? o.nombre ?? o.producto ?? o.terapia) as string | undefined;
    const cant = (o.sesiones ?? o.cantidad ?? o.disponibles) as number | undefined;
    if (nombre != null || cant != null) {
      return (
        <span className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{nombre != null ? String(nombre) : "—"}</span>
          {cant != null && <span className="tabular-nums font-medium">{String(cant)}</span>}
        </span>
      );
    }
  }
  return <span className="text-muted-foreground">{String(it)}</span>;
}
