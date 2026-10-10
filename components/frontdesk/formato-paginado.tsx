"use client"

import * as React from "react"
import { useTranslations } from "next-intl"

import type { FormatoArmado, FormatoSeccion } from "@/lib/api/formatos"
import {
  SeccionInner,
  type LabelFn,
} from "@/components/frontdesk/formato-secciones"
import { Button } from "@/components/ui/button"
import {
  imprimirFormato,
  PieFormato,
} from "@/components/frontdesk/formato-parts"

// Layout "paginas": an external order form reproduced sheet by sheet (Mía Compounding's
// "Patient-Specific Compounded Sterile Preparation Order Form"). Each sheet has the form's own logo and
// title, its own full-page watermark (render.marcasAgua[i]; the last one repeats), its sections, and a
// small «Actualización» note. `salto_pagina` sections split the sheets. Orientation from
// render.orientacion. Everything is inline-styled: the sheet is printed from a separate window that
// only has the base print CSS.

const IN = 96 // px per inch on screen and in the print window

// One sheet's content shrinks (CSS zoom) just enough to fit the page when the text runs long, so nothing
// is ever cut at the bottom. The zoom is an inline style, so it travels to the print window too.
function useFitToPage(
  ref: React.RefObject<HTMLDivElement | null>,
  deps: React.DependencyList
) {
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.zoom = "1"
    const box = el.parentElement
    if (!box) return
    const ratio = box.clientHeight / el.scrollHeight
    if (ratio < 1)
      el.style.zoom = String(Math.max(0.6, Math.floor(ratio * 1000) / 1000))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-measure when the document changes
  }, deps)
}

function Hoja({
  children,
  height,
  deps,
}: {
  children: React.ReactNode
  height: number
  deps: React.DependencyList
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  useFitToPage(ref, deps)
  return (
    <div style={{ height, overflow: "hidden" }}>
      <div
        ref={ref}
        style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}
      >
        {children}
      </div>
    </div>
  )
}

export function FormatoPaginado({
  d,
  label,
  onVolver,
}: {
  d: FormatoArmado
  label: LabelFn
  onVolver: () => void
}) {
  const t = useTranslations("frontdesk")
  const printRef = React.useRef<HTMLDivElement>(null)
  const render = d.render ?? {}
  const horizontal = render.orientacion === "horizontal"
  const w = (horizontal ? 11 : 8.5) * IN
  const h = (horizontal ? 8.5 : 11) * IN
  const marcas = render.marcasAgua ?? []

  const paginas: FormatoSeccion[][] = [[]]
  for (const s of d.sections ?? []) {
    if (s.tipo === "salto_pagina") paginas.push([])
    else paginas[paginas.length - 1].push(s)
  }
  const campos = d.fields ?? []

  const pageCss = `@page{size:letter ${horizontal ? "landscape" : "portrait"};margin:0}
body{margin:0}.formato-pagina{break-after:page;page-break-after:always;box-shadow:none!important;margin:0!important}
.formato-pagina:last-child{break-after:auto;page-break-after:auto}`

  return (
    <div className="space-y-3">
      <div className="no-print flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onVolver}>
          {t("volver")}
        </Button>
        <Button
          size="sm"
          onClick={() =>
            imprimirFormato(
              printRef.current,
              d.title || t("imprimirPdf"),
              pageCss
            )
          }
        >
          {t("imprimirPdf")}
        </Button>
      </div>
      <div className="overflow-auto rounded-lg border bg-muted/40 p-3">
        <div ref={printRef}>
          {paginas.map((secciones, i) => {
            const marca = marcas.length
              ? marcas[Math.min(i, marcas.length - 1)]
              : null
            return (
              <div
                key={i}
                className="formato-pagina"
                style={{
                  position: "relative",
                  width: w,
                  height: h,
                  overflow: "hidden",
                  background: "#fff",
                  color: "#000",
                  margin: "0 auto 16px",
                  boxShadow: "0 1px 4px rgba(0,0,0,.15)",
                  fontFamily: "system-ui,-apple-system,Arial,sans-serif",
                }}
              >
                {marca && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={marca}
                    alt=""
                    loading="eager"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      maxWidth: "none",
                      maxHeight: "none",
                      objectFit: "fill",
                      zIndex: 0,
                    }}
                  />
                )}
                <div
                  style={{
                    position: "relative",
                    zIndex: 1,
                    padding: "0.3in 0.45in 0.28in",
                    boxSizing: "border-box",
                  }}
                >
                  <Hoja height={h - 0.58 * IN} deps={[d, i]}>
                    <div
                      style={{
                        position: "relative",
                        textAlign: "center",
                        minHeight: 30,
                      }}
                    >
                      {render.logo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={render.logo}
                          alt=""
                          loading="eager"
                          style={{
                            position: "absolute",
                            left: 0,
                            top: -4,
                            height: 22,
                            maxHeight: 22,
                            width: "auto",
                          }}
                        />
                      )}
                      <h2
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          margin: "6px 0 0",
                        }}
                      >
                        {d.title}
                      </h2>
                    </div>
                    {i === 0 && campos.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <SeccionInner
                          s={{
                            clave: "fields",
                            tipo: "campos",
                            campos,
                            etiquetaNormal: true,
                            tamano: 13,
                          }}
                          label={label}
                        />
                      </div>
                    )}
                    {secciones.map((s, j) => (
                      <div
                        key={s.clave ?? j}
                        style={{ marginTop: 8, breakInside: "avoid" }}
                      >
                        <SeccionInner s={s} label={label} />
                      </div>
                    ))}
                    <div style={{ flex: "1 1 auto" }} />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 16,
                      }}
                    >
                      {render.actualizacion && (
                        <div
                          style={{
                            fontSize: 8,
                            color: "#999",
                            whiteSpace: "pre-line",
                            lineHeight: 1.2,
                          }}
                        >
                          {render.actualizacion}
                        </div>
                      )}
                      {!render.ocultarPie && <PieFormato pie={d.footer} />}
                    </div>
                  </Hoja>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
