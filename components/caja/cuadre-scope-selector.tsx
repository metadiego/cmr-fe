"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Selector de alcance (solo gerencia): consolidado o un cajero concreto del día. Extraído de
// cuadre-caja.tsx (CLAUDE.md: nuevo archivo ceiling) — sin lógica propia, solo presenta.
export function CuadreScopeSelector({
  scope,
  onChange,
  opcionesCajero,
  meId,
  cerrado,
}: {
  scope: string;
  onChange: (v: string) => void;
  opcionesCajero: Array<{ usuarioId: string; nombre: string }>;
  meId: string | null;
  cerrado: boolean;
}) {
  const t = useTranslations("caja");
  return (
    <div className="flex items-center gap-2">
      <Label className="text-sm text-muted-foreground">{t("scope.label")}</Label>
      <Select value={scope} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="consolidated">{t("scope.consolidated")}</SelectItem>
          {opcionesCajero.length > 0 ? (
            opcionesCajero.map((c) => (
              <SelectItem key={c.usuarioId} value={`user:${c.usuarioId}`}>
                {c.usuarioId === meId ? `${c.nombre} · ${t("scope.mine")}` : c.nombre}
              </SelectItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              {t("cajeros.vacio")}
            </div>
          )}
        </SelectContent>
      </Select>
      {cerrado && <Badge variant="secondary">{t("status.cerrado")}</Badge>}
    </div>
  );
}
