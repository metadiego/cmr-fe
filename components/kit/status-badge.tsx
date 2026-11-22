"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

// Status pill coloured by meaning: done = green, in progress / upcoming = blue, needs attention =
// amber, cancelled / voided = red. Labels come from the existing catalogues; unknown values show raw.
// A new status value gets its tone HERE, once, never a per-screen className.
type Tone = "success" | "info" | "warning" | "destructive" | "secondary";
const TONE: Record<string, Tone> = {
  // appointments
  atendida: "success",
  programada: "info",
  confirmada: "info",
  presente: "info",
  triage: "info",
  en_consulta: "info",
  no_show: "warning",
  reprogramada: "secondary",
  cancelada: "destructive",
  // therapy sessions
  asistido: "success",
  en_terapia: "info",
  pendiente: "secondary",
  // invoices
  emitida: "success",
  borrador: "secondary",
  devuelta_parcial: "warning",
  devuelta_total: "destructive",
  anulada: "destructive",
  // treatment transfers
  aplicada: "success",
  // login sessions
  open: "info",
  closed: "secondary",
  // format sheets filled on screen (GLP-1 nursing sheet)
  saved: "success",
  pending: "warning",
  // API keys (lib/api-keys/key-status.ts): never used = needs attention (the cleanup target)
  active: "success",
  neverUsed: "warning",
  expired: "secondary",
  revoked: "destructive",
};
const LABEL_NS = {
  appointment: "citas.estado",
  therapy: "servicios.estado",
  invoice: "facturacionList.estado",
  transfer: "patients.transferTreatment.status",
  session: "auditSessions.status",
  sheet: "formSheet.home",
  apiKey: "admin.apiKeys.status",
} as const;

export function StatusBadge({ kind, value }: { kind: keyof typeof LABEL_NS; value?: string | null }) {
  const t = useTranslations();
  if (!value) return <span className="text-muted-foreground">—</span>;
  const key = `${LABEL_NS[kind]}.${value}`;
  return <Badge variant={TONE[value] ?? "secondary"}>{t.has(key) ? t(key) : value}</Badge>;
}
