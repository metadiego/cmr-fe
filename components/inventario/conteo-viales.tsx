"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { PresentacionContable } from "@/lib/inventario/conteo-viales";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// The count of a product that is stocked in its base measure (mg) but lives in the fridge as vials:
// one row per presentation with content («Vial 60 mg / 3 mL: [16]») plus what is left in the open
// ones, in the base measure. The parent owns the values and sends them to the BE, which converts.
export function ConteoViales({
  presentaciones,
  cerrados,
  abiertos,
  unidad,
  onCerrado,
  onAbiertos,
}: {
  presentaciones: PresentacionContable[];
  cerrados: Record<string, string>;
  abiertos: string;
  unidad?: string | null;
  onCerrado: (presentationId: string, value: string) => void;
  onAbiertos: (value: string) => void;
}) {
  const t = useTranslations("inventarioAjuste");
  const clamp = (v: string) => (v.trim() !== "" && Number(v) < 0 ? "0" : v);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("vialesAyuda")}</p>
      {presentaciones.map((p) => (
        <div key={p.id} className="grid grid-cols-[1fr_7rem] items-center gap-3">
          <Label htmlFor={`cv-${p.id}`} className="font-normal">{p.name}</Label>
          <Input
            id={`cv-${p.id}`}
            type="number"
            min={0}
            step="1"
            inputMode="numeric"
            value={cerrados[p.id] ?? ""}
            onChange={(e) => onCerrado(p.id, clamp(e.target.value))}
            placeholder="0"
            aria-label={t("vialesCerrados", { presentacion: p.name })}
          />
        </div>
      ))}
      <div className="grid grid-cols-[1fr_7rem] items-center gap-3 border-t pt-3">
        <Label htmlFor="cv-abiertos" className="font-normal">{t("vialesAbiertos", { unidad: unidad || "—" })}</Label>
        <Input
          id="cv-abiertos"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          value={abiertos}
          onChange={(e) => onAbiertos(clamp(e.target.value))}
          placeholder="0"
        />
      </div>
    </div>
  );
}
