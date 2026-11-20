"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { purgarAuditoria, type AuditResumen } from "@/lib/api/auditoria";
import { apiErrorMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/kit/confirm-host";
import { Panel, Stat, StatGrid } from "@/components/kit/panel";

// Summary tiles (counts) + purge button (admin) over the audit log's current date range. Split
// out of auditoria-log.tsx at its file-size ceiling (CLAUDE.md rule 2) — diagnosis without
// dragging the table along. Built from the kit (Panel/StatGrid/Stat — rule 10), not a hand-rolled card.
export function ResumenCards({ resumen, admin }: { resumen: AuditResumen; admin: boolean }) {
  const t = useTranslations("auditoria");
  const format = useFormatter();
  const nf = (n: number) => format.number(n, "integer");
  const ok = resumen.porResultado.find((r) => r.resultado === "ok")?.total ?? 0;
  const err = resumen.porResultado.find((r) => r.resultado === "error")?.total ?? 0;
  const topDom = [...resumen.porDominio].sort((a, b) => b.total - a.total)[0];
  const descartados = resumen.descartadosDelProceso.reduce((s, d) => s + d.total, 0);

  return (
    <Panel title={t("resumenTitle")} actions={admin ? <PurgaButton /> : undefined}>
      <StatGrid>
        <Stat label={t("card.total")} value={nf(resumen.total)} />
        <Stat label={t("card.ok")} value={nf(ok)} />
        <Stat label={t("card.error")} value={nf(err)} tone={err > 0 ? "danger" : undefined} />
        {topDom ? (
          <Stat
            label={t("card.topDominio")}
            value={t.has(`dominio.${topDom.dominio}`) ? t(`dominio.${topDom.dominio}`) : topDom.dominio}
            hint={nf(topDom.total)}
          />
        ) : null}
        {admin && descartados > 0 ? (
          <Stat label={t("card.descartados")} value={nf(descartados)} hint={t("card.descartadosSub")} />
        ) : null}
      </StatGrid>
    </Panel>
  );
}

// Purga irreversible, multi-pasada (completa:false → volver a llamar). Confirmación explícita con
// los umbrales. yaEnCurso no es error. Exige admin sin X-Tenant-ID (lo pone la API con tenant null).
function PurgaButton() {
  const t = useTranslations("auditoria");
  const confirm = useConfirm();
  const [purgando, setPurgando] = React.useState(false);
  const asking = React.useRef(false); // a double click must not queue a second prompt

  async function purgar() {
    if (asking.current) return;
    asking.current = true;
    const ok = await confirm({
      title: t("purga.titulo"),
      description: t("purga.cuerpo"),
      confirmLabel: t("purga.confirmar"),
      cancelLabel: t("purga.cancelar"),
      destructive: true,
    }).finally(() => (asking.current = false));
    if (!ok) return;
    setPurgando(true);
    let errores = 0;
    let mutaciones = 0;
    try {
      // Multi-pasada: repetir mientras el BE diga completa:false (queda backlog). Tope de pasadas
      // por seguridad; si sigue incompleta, avisar para volver a correr.
      for (let pasada = 0; pasada < 20; pasada++) {
        const r = await purgarAuditoria();
        if (r.yaEnCurso) {
          toast.info(t("purga.enCurso"));
          return;
        }
        errores += r.errores;
        mutaciones += r.mutaciones;
        if (r.completa) {
          toast.success(t("purga.ok", { errores, mutaciones }));
          return;
        }
      }
      toast.warning(t("purga.parcial", { errores, mutaciones }));
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setPurgando(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={purgar} disabled={purgando}>
      {purgando ? t("purga.corriendo") : t("purga.boton")}
    </Button>
  );
}
