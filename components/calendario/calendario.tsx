"use client";

import * as React from "react";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Add01Icon, Globe02Icon } from "@hugeicons/core-free-icons";

import {
  getEventos,
  getCategorias,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  type CalendarioEvento,
  type CalendarioCategoria,
  type CrearEventoPayload,
} from "@/lib/api/calendario";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { apiErrorLabel } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

// El color de la categoría es una clave SEMÁNTICA (no un hex) → se mapea a la paleta una vez, como la
// campanita. `dot` para el punto, `chip` para la píldora del evento.
const COLOR: Record<string, { chip: string; dot: string }> = {
  rojo: { chip: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30", dot: "bg-red-500" },
  azul: { chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30", dot: "bg-sky-500" },
  violeta: { chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30", dot: "bg-violet-500" },
  ambar: { chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-500" },
  gris: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/60" },
  verde: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
};

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hoyStr = () => ymd(new Date());

// Rejilla del mes: 42 celdas desde el domingo previo al día 1.
function gridDelMes(anio: number, mes: number): Date[] {
  const primero = new Date(anio, mes, 1);
  const inicio = new Date(anio, mes, 1 - primero.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

export function Calendario() {
  const t = useTranslations("calendario");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const { can } = useCan();
  const puedeCrear = can("calendario.create");
  const puedeEditar = can("calendario.update");
  const puedeBorrar = can("calendario.delete");

  const hoy = new Date();
  const [anio, setAnio] = React.useState(hoy.getFullYear());
  const [mes, setMes] = React.useState(hoy.getMonth());

  const celdas = gridDelMes(anio, mes);
  const desde = ymd(celdas[0]);
  const hasta = ymd(celdas[41]);

  const eventosRes = useResource<CalendarioEvento[]>(() => getEventos(desde, hasta), [desde, hasta]);
  const catsRes = useResource<CalendarioCategoria[]>(() => getCategorias());
  const eventos = eventosRes.state.kind === "ok" ? eventosRes.state.data : [];
  const cats = catsRes.state.kind === "ok" ? catsRes.state.data : [];
  const catPorId = new Map(cats.map((c) => [c.id, c]));
  const catLabel = (c?: CalendarioCategoria) =>
    c ? (c.nombre ?? (c.labelKey && tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.clave ?? "")) : "";
  const colorDe = (ev: CalendarioEvento) => {
    const c = ev.categoriaId ? catPorId.get(ev.categoriaId) : undefined;
    return (c && COLOR[c.color]) || COLOR.gris;
  };

  // Eventos que solapan un día (día ≤ d ≤ díaFin).
  const eventosDe = (d: string) =>
    eventos.filter((e) => e.dia <= d && d <= (e.diaFin || e.dia));

  const [modal, setModal] = React.useState<{ evento?: CalendarioEvento; dia: string } | null>(null);

  const nombreMes = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(anio, mes, 1));
  const diasSemana = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 10, 1 + i)), // 2026-11-01 = domingo
  );

  function irMes(delta: number) {
    const d = new Date(anio, mes + delta, 1);
    setAnio(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <div className="w-full px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{nombreMes}</h1>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" onClick={() => irMes(-1)} aria-label={t("mesAnterior")}>
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setAnio(hoy.getFullYear()); setMes(hoy.getMonth()); }}>{t("hoy")}</Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => irMes(1)} aria-label={t("mesSiguiente")}>
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </Button>
        </div>
        {eventosRes.state.kind === "fail" && (
          <span className="text-sm text-destructive">{eventosRes.state.message}</span>
        )}
        {puedeCrear && (
          <Button size="sm" className="ml-auto" onClick={() => setModal({ dia: hoyStr() })}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("nuevo")}
          </Button>
        )}
      </div>

      {/* Rejilla del mes */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
        {diasSemana.map((d, i) => (
          <div key={i} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
        {celdas.map((cel) => {
          const ds = ymd(cel);
          const delMes = cel.getMonth() === mes;
          const esHoy = ds === hoyStr();
          const evs = eventosDe(ds);
          return (
            <button
              key={ds}
              type="button"
              onClick={() => puedeCrear && setModal({ dia: ds })}
              className={cn(
                "min-h-[104px] bg-background p-1.5 text-left align-top transition-colors hover:bg-accent/30",
                !delMes && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", esHoy && "bg-primary text-primary-foreground")}>
                {cel.getDate()}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 4).map((ev) => {
                  const col = colorDe(ev);
                  return (
                    <div
                      key={ev.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); setModal({ evento: ev, dia: ev.dia }); }}
                      className={cn("flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium", col.chip)}
                      title={ev.titulo}
                    >
                      {ev.esGlobal && <HugeiconsIcon icon={Globe02Icon} className="size-3 shrink-0" />}
                      {ev.hora && <span className="shrink-0 tabular-nums opacity-80">{ev.hora}</span>}
                      <span className="truncate">{ev.titulo}</span>
                    </div>
                  );
                })}
                {evs.length > 4 && <div className="px-1 text-[10px] text-muted-foreground">+{evs.length - 4}</div>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Leyenda de categorías (colores del catálogo del BE, no una lista escrita) */}
      {cats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {cats.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-full", (COLOR[c.color] || COLOR.gris).dot)} />
              {catLabel(c)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5"><HugeiconsIcon icon={Globe02Icon} className="size-3" /> {t("global")}</span>
        </div>
      )}

      {modal && (
        <EventoModal
          key={modal.evento?.id ?? modal.dia}
          inicial={modal}
          cats={cats}
          catLabel={catLabel}
          puedeEditar={modal.evento ? puedeEditar : puedeCrear}
          puedeBorrar={puedeBorrar}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); eventosRes.reload(); }}
          tRoot={tRoot}
          tc={tc}
          t={t}
        />
      )}
    </div>
  );
}

function EventoModal({
  inicial, cats, catLabel, puedeEditar, puedeBorrar, onClose, onSaved, tRoot, tc, t,
}: {
  inicial: { evento?: CalendarioEvento; dia: string };
  cats: CalendarioCategoria[];
  catLabel: (c?: CalendarioCategoria) => string;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  onClose: () => void;
  onSaved: () => void;
  tRoot: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
}) {
  const ev = inicial.evento;
  const [titulo, setTitulo] = React.useState(ev?.titulo ?? "");
  const [dia, setDia] = React.useState(ev?.dia ?? inicial.dia);
  const [diaFin, setDiaFin] = React.useState(ev?.diaFin ?? "");
  const [todoDia, setTodoDia] = React.useState(ev ? !ev.hora : true);
  const [hora, setHora] = React.useState(ev?.hora ?? "");
  const [horaFin, setHoraFin] = React.useState(ev?.horaFin ?? "");
  const [categoriaId, setCategoriaId] = React.useState(ev?.categoriaId ?? "");
  const [descripcion, setDescripcion] = React.useState(ev?.descripcion ?? "");
  const [esGlobal, setEsGlobal] = React.useState(!!ev?.esGlobal);
  const [busy, setBusy] = React.useState(false);

  const soloLectura = !puedeEditar;

  async function guardar() {
    if (soloLectura || !titulo.trim() || busy) return;
    setBusy(true);
    const payload: CrearEventoPayload = {
      dia,
      diaFin: diaFin || null,
      hora: todoDia ? null : (hora || null),
      horaFin: todoDia ? null : (horaFin || null),
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      categoriaId: categoriaId || null,
      esGlobal,
    };
    try {
      if (ev) await actualizarEvento(ev.id, payload);
      else await crearEvento(payload);
      toast.success(t("guardado"));
      onSaved();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }
  async function borrar() {
    if (!ev || busy) return;
    if (!window.confirm(t("borrarConfirm"))) return;
    setBusy(true);
    try {
      await eliminarEvento(ev.id);
      toast.success(t("borrado"));
      onSaved();
    } catch (e) {
      toast.error(apiErrorLabel(e, tRoot));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{ev ? t("editarTitulo") : t("nuevoTitulo")}</DialogTitle>
          <DialogDescription>{t("modalDesc")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Campo label={t("field.titulo")}>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={soloLectura} autoFocus />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label={t("field.dia")}><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} disabled={soloLectura} /></Campo>
            <Campo label={t("field.diaFin")}><Input type="date" value={diaFin} onChange={(e) => setDiaFin(e.target.value)} disabled={soloLectura} /></Campo>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={todoDia} onChange={(e) => setTodoDia(e.target.checked)} disabled={soloLectura} />
            {t("field.todoDia")}
          </label>
          {!todoDia && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label={t("field.hora")}><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={soloLectura} /></Campo>
              <Campo label={t("field.horaFin")}><Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} disabled={soloLectura} /></Campo>
            </div>
          )}
          <Campo label={t("field.categoria")}>
            <Select value={categoriaId} onValueChange={setCategoriaId} disabled={soloLectura}>
              <SelectTrigger><SelectValue placeholder={t("field.selCategoria")} /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{catLabel(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </Campo>
          <Campo label={t("field.descripcion")}>
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} disabled={soloLectura} />
          </Campo>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={esGlobal} onChange={(e) => setEsGlobal(e.target.checked)} disabled={soloLectura} />
            {t("field.global")}
          </label>
          <div className="flex justify-between gap-2 pt-1">
            <div>
              {ev && puedeBorrar && (
                <Button variant="outline" size="sm" onClick={borrar} disabled={busy} className="text-destructive">{tc("delete")}</Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
              {!soloLectura && (
                <Button size="sm" onClick={guardar} disabled={busy || !titulo.trim()}>{busy ? tc("loading") : tc("save")}</Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
