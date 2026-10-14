"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  getEhrConfig,
  setEhrConfig,
  type EhrConfig,
} from "@/lib/api/ehr-integration"
import { toastError } from "@/lib/api/errors"
import { useResource } from "@/hooks/use-resource"
import { useCentroPantalla } from "@/hooks/use-centro-pantalla"
import { ConfigGuard } from "@/components/configuracion/config-guard"
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector"
import { EhrOrphans } from "@/components/configuracion/ehr-orphans"
import { Switch } from "@/components/ui/switch"
import { getPrintHub, type CenterPrinter } from "@/lib/api/print-hub"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageContainer, PageHeader } from "@/components/ui/page"

// Configuración → el interruptor «enchufe» del enganche con el EHR (cmr-ehr), POR CENTRO. Encendido:
// al marcar Presente en Atención se empuja el paciente al EHR (lo hace el BE) y el FE exige antes los 5
// datos. Apagado: no pasa nada. Handoff be-ehr-integration-presente-handoff.
export default function EhrIntegrationConfigPage() {
  const t = useTranslations("ehrIntegration")
  const estado = useCentroPantalla(
    "ehr-integration.config",
    "ehr-integration.config"
  )

  return (
    <ConfigGuard permiso="ehr-integration.config">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={<CentroPantallaSelector estado={estado} />}
        />
        {estado.cargando ? null : estado.centroActivo ? (
          <div className="space-y-8">
            <EhrToggle
              centroId={estado.fetchCentroId}
              puedeEscribir={estado.puedeEscribir}
            />
            <EhrOrphans
              centroId={estado.fetchCentroId}
              puedeEscribir={estado.puedeEscribir}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("elegirCentro")}</p>
        )}
      </PageContainer>
    </ConfigGuard>
  )
}

// Dos interruptores INDEPENDIENTES (cmr-be PR #393): Consultas y Servicios prenden/apagan por
// separado — uno no prende el otro. Cada uno manda SOLO su propio campo al PUT (nunca el objeto
// completo), para no pisar el otro tipo por accidente.
function EhrToggle({
  centroId,
  puedeEscribir,
}: {
  centroId?: string
  puedeEscribir: boolean
}) {
  const t = useTranslations("ehrIntegration")
  const tRoot = useTranslations()
  const { state } = useResource<EhrConfig>(
    () => getEhrConfig(centroId),
    [centroId]
  )

  if (state.kind === "fail")
    return <p className="text-sm text-destructive">{state.message}</p>
  if (state.kind === "loading")
    return (
      <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
    )

  return (
    <div className="space-y-3">
      <EhrSwitchRow
        campo="enabledForConsultations"
        valorInicial={state.data.enabledForConsultations}
        label={t("toggleLabelConsultas")}
        help={t("toggleHelpConsultas")}
        centroId={centroId}
        puedeEscribir={puedeEscribir}
      />
      <EhrSwitchRow
        campo="enabledForServices"
        valorInicial={state.data.enabledForServices}
        label={t("toggleLabelServicios")}
        help={t("toggleHelpServicios")}
        centroId={centroId}
        puedeEscribir={puedeEscribir}
      />
      <ClaimPrinterRow
        valorInicial={state.data.claimCodePrinterId ?? null}
        centroId={centroId}
        puedeEscribir={puedeEscribir}
      />
    </div>
  )
}

function EhrSwitchRow({
  campo,
  valorInicial,
  label,
  help,
  centroId,
  puedeEscribir,
}: {
  campo: "enabledForConsultations" | "enabledForServices"
  valorInicial: boolean
  label: string
  help: string
  centroId?: string
  puedeEscribir: boolean
}) {
  const t = useTranslations("ehrIntegration")
  const tRoot = useTranslations()
  // Estado local con rollback: si el PUT falla, se vuelve al último valor bueno del servidor.
  const [on, setOn] = React.useState(valorInicial)
  const [busy, setBusy] = React.useState(false)

  async function cambiar(next: boolean) {
    if (busy || !puedeEscribir) return
    const prev = on
    setOn(next)
    setBusy(true)
    try {
      await setEhrConfig({ [campo]: next }, centroId)
      toast.success(t("saved"))
    } catch (e) {
      setOn(prev) // rollback
      toastError(e, tRoot)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-md bg-card p-5 shadow-sm ring-1 shadow-[rgba(16,32,64,0.06)] ring-foreground/10">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <Switch
        checked={on}
        onCheckedChange={cambiar}
        disabled={busy || !puedeEscribir}
      />
    </div>
  )
}

const NONE = "__none__"

// Printer for the EHR claim code ticket: the center's printers (the print hub configuration). The branch
// hub prints it from the app's print queue, with nobody's screen involved. Handoff codigo-de-alta-del-ehr.
function ClaimPrinterRow({
  valorInicial,
  centroId,
  puedeEscribir,
}: {
  valorInicial: string | null
  centroId?: string
  puedeEscribir: boolean
}) {
  const t = useTranslations("ehrIntegration")
  const tRoot = useTranslations()
  const printersRes = useResource<CenterPrinter[]>(
    () =>
      centroId
        ? getPrintHub(centroId)
            .then((h) => h?.printers ?? [])
            .catch(() => [])
        : Promise.resolve([]),
    [centroId]
  )
  const printers = printersRes.state.kind === "ok" ? printersRes.state.data : []
  const [value, setValue] = React.useState<string | null>(valorInicial)
  const [busy, setBusy] = React.useState(false)

  async function cambiar(next: string) {
    const id = next === NONE ? null : next
    const prev = value
    setValue(id)
    setBusy(true)
    try {
      await setEhrConfig({ claimCodePrinterId: id }, centroId)
      toast.success(t("saved"))
    } catch (e) {
      setValue(prev)
      toastError(e, tRoot)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-md bg-card p-5 shadow-sm ring-1 shadow-[rgba(16,32,64,0.06)] ring-foreground/10">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{t("claimPrinterLabel")}</p>
        <p className="text-xs text-muted-foreground">
          {printers.length ? t("claimPrinterHelp") : t("claimPrinterNone")}
        </p>
      </div>
      <Select
        value={value ?? NONE}
        onValueChange={cambiar}
        disabled={busy || !puedeEscribir || printers.length === 0}
      >
        <SelectTrigger className="w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t("claimPrinterUnset")}</SelectItem>
          {printers.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} · {p.printerHost}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
