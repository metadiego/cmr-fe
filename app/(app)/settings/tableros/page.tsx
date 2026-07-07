"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getTableros, type TableroRegistro } from "@/lib/api/tablero";
import { useResource } from "@/hooks/use-resource";
import { PersonalizarTablero } from "@/components/tablero/personalizar-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Settings › Tableros — user personalization of a board (density + per-column
// colour), OUT of the operational board UI. Pick a board, tweak your view; it
// only affects you.
export default function SettingsTablerosPage() {
  const t = useTranslations("settingsTableros");
  const tRoot = useTranslations();
  const { state } = useResource<TableroRegistro[]>(() => getTableros());
  const boards = (state.kind === "ok" ? state.data : []).filter((b) => b.esVertical !== false && b.activo);
  const [picked, setPicked] = React.useState<string>("");
  const tablero = picked || boards[0]?.clave || "";

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>

      <div className="mt-6 rounded-xl border bg-card/60 p-6 shadow-sm backdrop-blur">
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("selectBoard")}
        </label>
        <Select value={tablero} onValueChange={setPicked}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t("selectBoard")} />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.clave} value={b.clave}>
                {tRoot(b.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {tablero && (
          <div className="mt-6 border-t pt-6">
            <PersonalizarTablero tablero={tablero} />
          </div>
        )}
      </div>
    </div>
  );
}
