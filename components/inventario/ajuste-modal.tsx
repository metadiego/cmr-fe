"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  ajustarExistencias,
  listMotivosMovimiento,
  type MotivoMovimiento,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { ajusteDesdeConteo, deltaDelConteo } from "@/lib/inventario/ajuste";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// AJUSTE DE EXISTENCIAS. Dos formas de decir lo mismo, y la gente usa la segunda:
//   · «entra/sale N» (rotura, merma, vencimiento) → cantidad + signo
//   · «conté X de verdad» (conteo físico)         → el FE calcula la diferencia
// El personal cuenta la nevera, no la resta: «de los nano en sistema tengo 55 y en la nevera 54».
// Los MOTIVOS salen del catálogo del BE, nunca de una lista escrita aquí: si mañana se agrega uno en la
// base, aparece solo. See cmr-be/docs/specs/ajuste-de-inventario-handoff-fe.md

export interface AjusteObjetivo {
  productoId: string;
  nombre: string;
  almacenId: string | null;
  almacenNombre?: string | null;
  stockActual: number;
}

type Modo = "movimiento" | "conteo";

export function AjusteModal({
  objetivo,
  centro,
  onClose,
  onHecho,
}: {
  objetivo: AjusteObjetivo;
  centro?: string | null;
  onClose: () => void;
  onHecho: () => void;
}) {
  const t = useTranslations("inventarioAjuste");
  const [motivos, setMotivos] = React.useState<MotivoMovimiento[]>([]);
  const [modo, setModo] = React.useState<Modo>("movimiento");
  const [motivo, setMotivo] = React.useState("");
  const [cantidad, setCantidad] = React.useState("");
  const [signo, setSigno] = React.useState<"positivo" | "negativo">("negativo");
  const [contado, setContado] = React.useState("");
  const [notas, setNotas] = React.useState("");
  const [guardando, setGuardando] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    listMotivosMovimiento(centro)
      .then((ms) => {
        if (!vivo) return;
        const activos = ms.filter((m) => m.activo !== false);
        setMotivos(activos);
      })
      .catch(() => setMotivos([]));
    return () => {
      vivo = false;
    };
  }, [centro]);

  // El conteo físico tiene su propio motivo en el catálogo: no se elige a mano.
  const motivosVisibles = React.useMemo(
    () => motivos.filter((m) => m.clave !== "conteo_fisico"),
    [motivos],
  );

  const nContado = Number(contado);
  const deltaConteo =
    modo === "conteo" && contado.trim() !== "" && Number.isFinite(nContado)
      ? deltaDelConteo(objetivo.stockActual, nContado)
      : null;

  const nCantidad = Number(cantidad);
  const resultante =
    modo === "conteo"
      ? Number.isFinite(nContado)
        ? nContado
        : objetivo.stockActual
      : Number.isFinite(nCantidad) && cantidad.trim() !== ""
        ? objetivo.stockActual + (signo === "negativo" ? -nCantidad : nCantidad)
        : objetivo.stockActual;

  const sinAlmacen = !objetivo.almacenId;
  const puedeGuardar =
    !guardando &&
    !sinAlmacen &&
    notas.trim() !== "" &&
    (modo === "conteo"
      ? deltaConteo !== null
      : motivo !== "" && Number.isFinite(nCantidad) && nCantidad > 0);

  async function guardar() {
    if (!objetivo.almacenId) return;
    setGuardando(true);
    try {
      const payload =
        modo === "conteo"
          ? ajusteDesdeConteo({
              productoId: objetivo.productoId,
              almacenId: objetivo.almacenId,
              stockActual: objetivo.stockActual,
              contado: nContado,
              notas: notas.trim(),
            })
          : {
              productoId: objetivo.productoId,
              almacenId: objetivo.almacenId,
              cantidad: nCantidad,
              signo,
              motivo,
              notas: notas.trim(),
            };
      if (!payload) {
        // Contó lo mismo que dice el sistema: no hay nada que ajustar y no se manda un cero.
        toast.info(t("sinDiferencia"));
        setGuardando(false);
        return;
      }
      await ajustarExistencias(payload, centro);
      toast.success(t("hecho"));
      onHecho();
      onClose();
    } catch (e) {
      toast.error(apiErrorMessage(e));
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("titulo")}</DialogTitle>
          <DialogDescription>
            {objetivo.nombre}
            {objetivo.almacenNombre ? ` · ${objetivo.almacenNombre}` : ""}
          </DialogDescription>
        </DialogHeader>

        {sinAlmacen ? (
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            {t("sinAlmacen")}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Qué está pasando, en una línea: de cuánto a cuánto. */}
            <div className="flex items-baseline gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("stockActual")}</span>
              <span className="font-mono font-semibold">{objetivo.stockActual}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-semibold text-primary">{resultante}</span>
            </div>

            <div className="flex gap-2">
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
            </div>

            {modo === "conteo" ? (
              <div className="space-y-2">
                <Label htmlFor="aj-contado">{t("contado")}</Label>
                <Input
                  id="aj-contado"
                  type="number"
                  step="any"
                  min={0}
                  inputMode="decimal"
                  value={contado}
                  onChange={(e) => { const v = e.target.value; setContado(v.trim() !== "" && Number(v) < 0 ? "0" : v); }}
                  placeholder={String(objetivo.stockActual)}
                />
                <p className="text-xs text-muted-foreground">
                  {deltaConteo
                    ? t("diferencia", {
                        signo: deltaConteo.signo === "negativo" ? "−" : "+",
                        n: deltaConteo.cantidad,
                      })
                    : t("contadoAyuda")}
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="aj-cantidad">{t("cantidad")}</Label>
                    <Input
                      id="aj-cantidad"
                      type="number"
                      step="any"
                      min="0"
                      inputMode="decimal"
                      value={cantidad}
                      onChange={(e) => setCantidad(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label htmlFor="aj-motivo">{t("motivo")}</Label>
                  <Select value={motivo} onValueChange={setMotivo}>
                    <SelectTrigger id="aj-motivo">
                      <SelectValue placeholder={t("motivoPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {motivosVisibles.map((m) => (
                        <SelectItem key={m.clave} value={m.clave}>
                          {m.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="aj-notas">{t("notas")}</Label>
              <Textarea
                id="aj-notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder={t("notasPlaceholder")}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{t("notasAyuda")}</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={guardando}>
            {t("cancelar")}
          </Button>
          <Button onClick={guardar} disabled={!puedeGuardar}>
            {guardando ? t("guardando") : t("guardar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
