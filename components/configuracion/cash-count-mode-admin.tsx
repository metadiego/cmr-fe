"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getCashCountMode, setCashCountMode, type CashCountMode } from "@/lib/api/caja";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Un centro, su modo de conteo (BE #566). `modes` viene del GET — se pinta de ahí, nunca a mano
// (el handoff es explícito: no inventar las opciones). Sin `puedeEscribir`: solo lectura.
export function CashCountModeAdmin({
  centroId,
  puedeEscribir,
}: {
  centroId?: string; // undefined = el centro de la sesión
  puedeEscribir: boolean;
}) {
  const t = useTranslations("cashCountMode");
  const tRoot = useTranslations();
  const { state, refresh } = useResource(
    () => getCashCountMode(centroId ? [centroId] : undefined),
    [centroId],
  );
  const [busy, setBusy] = React.useState(false);

  if (state.kind === "loading") return <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>;
  if (state.kind === "fail") return <p className="text-sm text-destructive">{state.message}</p>;
  const row = state.data[0];
  if (!row) return null;

  async function cambiar(mode: CashCountMode) {
    setBusy(true);
    try {
      await setCashCountMode(row.clinicId, mode);
      toast.success(t("guardado"));
      refresh();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <h3 className="text-sm font-medium">{t("title")}</h3>
      <p className="text-xs text-muted-foreground">{t("help")}</p>
      {puedeEscribir ? (
        <Select value={row.mode} onValueChange={(v) => void cambiar(v as CashCountMode)} disabled={busy}>
          <SelectTrigger className="w-full sm:w-96"><SelectValue /></SelectTrigger>
          <SelectContent>
            {row.modes.map((m) => (
              <SelectItem key={m} value={m}>{tRoot(`caja.countMode.${m}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-sm font-medium">{tRoot(`caja.countMode.${row.mode}`)}</p>
      )}
    </div>
  );
}
