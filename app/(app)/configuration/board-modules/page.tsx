"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { getTableros, type TableroRegistro } from "@/lib/api/tablero";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { ModalModulosConfig } from "@/components/configuracion/modal-modulos-config";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Settings › Módulos del modal (ADMIN, gate `tablero.admin`). Conectar/desconectar
// módulos pluggables del modal de post-acción por tablero (hoy: Agendar cita).
// Reusable: sirve para cualquier tablero con modal.
export default function SettingsModalModulosPage() {
  const t = useTranslations("settingsModulos");
  const tRoot = useTranslations();
  const { can, ready } = useCan();

  const { state } = useResource<TableroRegistro[]>(() => getTableros());
  const boards = (state.kind === "ok" ? state.data : []).filter((b) => b.isVertical !== false && b.active);
  const [picked, setPicked] = React.useState<string>("");
  const tablero = picked || boards[0]?.slug || "";

  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const [pickedCentro, setPickedCentro] = React.useState<string>("");
  const active = getActiveCentro();
  const centroId = pickedCentro || (active && centros.some((c) => c.id === active) ? active : centros[0]?.id) || "";

  if (ready && !can("tablero.admin")) {
    return (
      <PageContainer>
        <p className="text-center text-sm text-muted-foreground">{t("noAccess")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="rounded-md bg-card p-6 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10 backdrop-blur">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("selectBoard")}
            </label>
            <Select value={tablero} onValueChange={setPicked}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectBoard")} />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {tRoot(b.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("selectCenter")}
            </label>
            <Select value={centroId} onValueChange={setPickedCentro}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectCenter")} />
              </SelectTrigger>
              <SelectContent>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {tablero && centroId && (
          <div className="mt-6 border-t pt-6">
            <ModalModulosConfig tablero={tablero} centroId={centroId} />
          </div>
        )}
      </div>
    </PageContainer>
  );
}
