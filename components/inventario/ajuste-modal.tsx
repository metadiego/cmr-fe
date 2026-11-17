"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  ajustarExistencias,
  listMotivosMovimiento,
  listPresentaciones,
  listUnidades,
  type MotivoMovimiento,
} from "@/lib/api/inventario"
import { contarExistencias } from "@/lib/api/inventory-count"
import { ajusteDesdeConteo, deltaDelConteo } from "@/lib/inventario/ajuste"
import {
  adjustmentCheck,
  type AdjustmentField,
  type AdjustmentProblem,
} from "@/lib/inventario/adjustment-missing"
import {
  conteoPayload,
  presentacionesContables,
  totalEnBase,
  type PresentacionContable,
} from "@/lib/inventario/conteo-viales"
import { ConteoViales } from "@/components/inventario/conteo-viales"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FormDialog, Field } from "@/components/kit/form-dialog"
import { RequiredLegend } from "@/components/kit/required-mark"
import { useSubmit } from "@/components/kit/use-submit"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// AJUSTE DE EXISTENCIAS. Dos formas de decir lo mismo, y la gente usa la segunda:
//   · «entra/sale N» (rotura, merma, vencimiento) → cantidad + signo
//   · «conté X de verdad» (conteo físico)         → el FE calcula la diferencia
// El personal cuenta la nevera, no la resta: «de los nano en sistema tengo 55 y en la nevera 54».
// Los MOTIVOS salen del catálogo del BE, nunca de una lista escrita aquí: si mañana se agrega uno en la
// base, aparece solo. See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md

export interface AjusteObjetivo {
  productoId: string
  nombre: string
  almacenId: string | null
  almacenNombre?: string | null
  stockActual: number
  /** Clave de la unidad del stock (mg, ml…): rotula «Abierto (mg)» y decide si se puede previsualizar. */
  unidad?: string | null
}

type Modo = "movimiento" | "conteo"

export function AjusteModal({
  objetivo,
  centro,
  onClose,
  onHecho,
}: {
  objetivo: AjusteObjetivo
  centro?: string | null
  onClose: () => void
  onHecho: () => void
}) {
  const t = useTranslations("inventarioAjuste")
  const [motivos, setMotivos] = React.useState<MotivoMovimiento[]>([])
  const [modo, setModo] = React.useState<Modo>("movimiento")
  const [motivo, setMotivo] = React.useState("")
  const [cantidad, setCantidad] = React.useState("")
  const [signo, setSigno] = React.useState<"positivo" | "negativo">("negativo")
  const [contado, setContado] = React.useState("")
  const [notas, setNotas] = React.useState("")
  // Count by vials: the product's presentations with content, and the id of the stock unit (to know
  // whether the vial content can be added up here). Without such presentations the count is as before.
  const [viales, setViales] = React.useState<PresentacionContable[]>([])
  const [unidadBaseId, setUnidadBaseId] = React.useState<string | null>(null)
  const [cerrados, setCerrados] = React.useState<Record<string, string>>({})
  const [abiertos, setAbiertos] = React.useState("")

  React.useEffect(() => {
    let vivo = true
    Promise.all([
      listPresentaciones(objetivo.productoId, centro ?? undefined),
      listUnidades(),
    ])
      .then(([ps, us]) => {
        if (!vivo) return
        setViales(presentacionesContables(ps))
        const clave = objetivo.unidad?.toLowerCase()
        setUnidadBaseId(
          us.find((u) => u.slug.toLowerCase() === clave)?.id ?? null
        )
      })
      .catch(() => vivo && setViales([]))
    return () => {
      vivo = false
    }
  }, [objetivo.productoId, objetivo.unidad, centro])
  const porViales = modo === "conteo" && viales.length > 0
  const totalViales = porViales
    ? totalEnBase(viales, cerrados, abiertos, unidadBaseId)
    : null
  const payloadViales =
    porViales && objetivo.almacenId
      ? conteoPayload({
          productId: objetivo.productoId,
          warehouseId: objetivo.almacenId,
          presentaciones: viales,
          cerrados,
          abiertos,
        })
      : null

  React.useEffect(() => {
    let vivo = true
    listMotivosMovimiento(centro)
      .then((ms) => {
        if (!vivo) return
        const activos = ms.filter((m) => m.active !== false)
        setMotivos(activos)
      })
      .catch(() => setMotivos([]))
    return () => {
      vivo = false
    }
  }, [centro])

  // El conteo físico tiene su propio motivo en el catálogo: no se elige a mano.
  const motivosVisibles = React.useMemo(
    () => motivos.filter((m) => m.slug !== "conteo_fisico"),
    [motivos]
  )

  const nContado = Number(contado)
  const deltaConteo =
    modo === "conteo" && contado.trim() !== "" && Number.isFinite(nContado)
      ? deltaDelConteo(objetivo.stockActual, nContado)
      : null

  const nCantidad = Number(cantidad)
  const resultante = porViales
    ? (totalViales ?? objetivo.stockActual)
    : modo === "conteo"
      ? Number.isFinite(nContado)
        ? nContado
        : objetivo.stockActual
      : Number.isFinite(nCantidad) && cantidad.trim() !== ""
        ? objetivo.stockActual + (signo === "negativo" ? -nCantidad : nCantidad)
        : objetivo.stockActual

  const sinAlmacen = !objetivo.almacenId
  const check = adjustmentCheck({
    mode: modo,
    byVials: porViales,
    hasWarehouse: !sinAlmacen,
    quantity: cantidad,
    reason: motivo,
    counted: contado,
    stock: objetivo.stockActual,
    vialsCounted: payloadViales !== null,
    notes: notas,
  })
  const fieldLabel: Record<AdjustmentField, string> = {
    quantity: t("cantidad"),
    reason: t("motivo"),
    counted: t("contado"),
    vialCount: t("vialCount"),
    notes: t("notas"),
  }
  const problemText: Record<AdjustmentProblem, string> = {
    noWarehouse: t("sinAlmacen"),
    quantityInvalid: t("quantityInvalid"),
    noDifference: t("sinDiferencia"),
  }
  const missing = check.missing.map((f) => fieldLabel[f])

  // The button is disabled unless `adjustmentCheck` passes, so the throws below are only a backstop.
  async function guardar(): Promise<string> {
    if (!objetivo.almacenId) throw new Error(t("sinAlmacen"))
    if (porViales) {
      if (!payloadViales) throw new Error(t("vialCount"))
      const r = await contarExistencias(
        { ...payloadViales, notes: notas.trim() },
        centro
      )
      return r.difference === 0
        ? t("sinDiferencia")
        : t("vialesAjustado", { contado: r.contado, sistema: r.sistema })
    }
    let payload: {
      productId: string
      warehouseId: string
      quantity: number
      sign: "positivo" | "negativo"
      reason: string
      notes: string
    } | null
    if (modo === "conteo") {
      const c = ajusteDesdeConteo({
        productoId: objetivo.productoId,
        almacenId: objetivo.almacenId,
        stockActual: objetivo.stockActual,
        contado: nContado,
        notas: notas.trim(),
      })
      payload = c
        ? {
            productId: c.productoId,
            warehouseId: c.almacenId,
            quantity: c.cantidad,
            sign: c.signo,
            reason: c.motivo,
            notes: c.notas,
          }
        : null
    } else {
      payload = {
        productId: objetivo.productoId,
        warehouseId: objetivo.almacenId,
        quantity: nCantidad,
        sign: signo,
        reason: motivo,
        notes: notas.trim(),
      }
    }
    // Counted the same as the system: nothing to adjust and a zero is never sent.
    if (!payload) throw new Error(t("sinDiferencia"))
    await ajustarExistencias(payload, centro)
    return t("hecho")
  }

  const { submitting, submit } = useSubmit(guardar, {
    onSuccess: (msg) => {
      toast.success(msg)
      onHecho()
      onClose()
    },
  })

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={t("titulo")}
      description={`${objetivo.nombre}${objetivo.almacenNombre ? ` · ${objetivo.almacenNombre}` : ""}`}
      // A stock adjustment is irreversible: Enter in a field never fires it, only the button.
      onSubmit={() => {}}
      actions={[{ label: t("guardar"), onClick: () => submit() }]}
      submitting={submitting}
      submittingLabel={t("guardando")}
      cancelLabel={t("cancelar")}
      missing={missing}
      blocked={check.problem !== null}
      reason={check.problem ? problemText[check.problem] : null}
    >
      {sinAlmacen ? (
        <p className="rounded-md border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
          {t("sinAlmacen")}
        </p>
      ) : (
        <>
          {/* What is happening, in one line: from how much to how much. */}
          <div className="flex items-baseline gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("stockActual")}</span>
            <span className="font-mono font-semibold">
              {objetivo.stockActual}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-mono font-semibold text-primary">
              {resultante}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={modo === "movimiento" ? "default" : "outline"}
              size="sm"
              onClick={() => setModo("movimiento")}
            >
              {t("modoMovimiento")}
            </Button>
            <Button
              type="button"
              variant={modo === "conteo" ? "default" : "outline"}
              size="sm"
              onClick={() => setModo("conteo")}
            >
              {t("modoConteo")}
            </Button>
            {modo === "movimiento" && <RequiredLegend className="ml-auto text-xs text-muted-foreground" />}
          </div>

          {porViales ? (
            <Field label={t("vialCount")} required>
              <ConteoViales
                presentaciones={viales}
                cerrados={cerrados}
                abiertos={abiertos}
                unidad={objetivo.unidad}
                onCerrado={(id, v) => setCerrados((c) => ({ ...c, [id]: v }))}
                onAbiertos={setAbiertos}
              />
            </Field>
          ) : modo === "conteo" ? (
            <Field
              label={t("contado")}
              htmlFor="aj-contado"
              required
              hint={
                deltaConteo
                  ? t("diferencia", {
                      signo: deltaConteo.signo === "negativo" ? "−" : "+",
                      n: deltaConteo.cantidad,
                    })
                  : t("contadoAyuda")
              }
            >
              <Input
                id="aj-contado"
                type="number"
                step="any"
                min={0}
                inputMode="decimal"
                value={contado}
                onChange={(e) => {
                  const v = e.target.value
                  setContado(v.trim() !== "" && Number(v) < 0 ? "0" : v)
                }}
                placeholder={String(objetivo.stockActual)}
                aria-describedby="aj-contado-hint"
              />
            </Field>
          ) : (
            <>
              <div className="flex gap-3">
                <Field label={t("cantidad")} htmlFor="aj-cantidad" required className="flex-1">
                  <Input
                    id="aj-cantidad"
                    type="number"
                    step="any"
                    min="0"
                    inputMode="decimal"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                  />
                </Field>
                <div className="space-y-1.5">
                  <Label>{t("sentido")}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={signo === "negativo" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSigno("negativo")}
                    >
                      {t("resta")}
                    </Button>
                    <Button
                      type="button"
                      variant={signo === "positivo" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSigno("positivo")}
                    >
                      {t("suma")}
                    </Button>
                  </div>
                </div>
              </div>

              <Field label={t("motivo")} htmlFor="aj-motivo" required>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger id="aj-motivo">
                    <SelectValue placeholder={t("motivoPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {motivosVisibles.map((m) => (
                      <SelectItem key={m.slug} value={m.slug}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          {porViales && totalViales === null && payloadViales && (
            <p className="text-xs text-muted-foreground">
              {t("vialesSinVista")}
            </p>
          )}
          <Field label={t("notas")} htmlFor="aj-notas" required hint={t("notasAyuda")}>
            <Textarea
              id="aj-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder={t("notasPlaceholder")}
              rows={2}
              aria-describedby="aj-notas-hint"
            />
          </Field>
        </>
      )}
    </FormDialog>
  )
}
