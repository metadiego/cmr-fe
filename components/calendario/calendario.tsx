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
import { useMe } from "@/hooks/use-me";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
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
type Vista = "mes" | "semana" | "dia" | "agenda";

const p2 = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const hoyStr = () => ymd(new Date());
const addDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const domingoDeLaSemana = (d: Date) => addDias(d, -d.getDay());

function gridDelMes(anio: number, mes: number): Date[] {
  const primero = new Date(anio, mes, 1);
  const inicio = addDias(primero, -primero.getDay());
  return Array.from({ length: 42 }, (_, i) => addDias(inicio, i));
}

export function Calendario() {
  const t = useTranslations("calendario");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const me = useMe();

  // Selector de centro EN la pantalla (patrón único, no en el nav): lee/escribe por permiso, sin tocar
  // la sesión. Handoff selector-de-centro-en-la-pantalla.
  const centro = useCentroPantalla("calendario.read", "calendario.create");
  const puedeEscribir = centro.puedeEscribir;
  const puedeCrear = puedeEscribir;

  // «Cada uno toca lo suyo»: editar/borrar solo eventos PROPIOS, salvo admin. Los del legado no traen
  // autor (creadoPor null, legacyId) → solo admin. El BE re-comprueba (403 con motivo), así que esto solo
  // evita ofrecer un botón que va a fallar. Handoff calendario-selector-de-centro §«Cada uno toca lo suyo».
  const esAdmin = me.kind === "ok" && (me.me.isMaster || me.me.accessMode === "admin" || me.me.roles.some((r) => r === "admin" || r === "super_admin"));
  const miId = me.kind === "ok" ? me.me.perfilId : null;
  const miUserId = me.kind === "ok" ? me.me.id : null;
  const esMio = (ev?: CalendarioEvento) => !!ev?.creadoPor && (ev.creadoPor === miId || ev.creadoPor === miUserId);
  const puedeTocar = (ev?: CalendarioEvento) => puedeEscribir && (esAdmin || esMio(ev));

  const [vista, setVista] = React.useState<Vista>("mes");
  const [cursor, setCursor] = React.useState(new Date());

  // Rango a pedir según la vista.
  const { desde, hasta, celdasMes, celdasSemana } = React.useMemo(() => {
    if (vista === "mes") {
      const g = gridDelMes(cursor.getFullYear(), cursor.getMonth());
      return { desde: ymd(g[0]), hasta: ymd(g[41]), celdasMes: g, celdasSemana: [] as Date[] };
    }
    if (vista === "semana") {
      const ini = domingoDeLaSemana(cursor);
      const g = Array.from({ length: 7 }, (_, i) => addDias(ini, i));
      return { desde: ymd(g[0]), hasta: ymd(g[6]), celdasMes: [] as Date[], celdasSemana: g };
    }
    if (vista === "dia") {
      return { desde: ymd(cursor), hasta: ymd(cursor), celdasMes: [], celdasSemana: [cursor] };
    }
    // agenda: hoy → +45 días
    const h = new Date();
    return { desde: ymd(h), hasta: ymd(addDias(h, 45)), celdasMes: [], celdasSemana: [] };
  }, [vista, cursor]);

  // Solo mandar centroId al VER OTRO centro; en el de la sesión va sin parámetro (lo resuelve el BE).
  const fetchCentroId = centro.fetchCentroId;
  const eventosRes = useResource<CalendarioEvento[]>(() => getEventos(desde, hasta, fetchCentroId), [desde, hasta, fetchCentroId]);
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
  const eventosDe = (d: string) => eventos.filter((e) => e.dia <= d && d <= (e.diaFin || e.dia));

  const [modal, setModal] = React.useState<{ evento?: CalendarioEvento; dia: string } | null>(null);

  // Título según la vista.
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o).format(d);
  const titulo =
    vista === "mes" ? fmt(cursor, { month: "long", year: "numeric" })
    : vista === "semana" ? `${fmt(domingoDeLaSemana(cursor), { day: "numeric", month: "short" })} – ${fmt(addDias(domingoDeLaSemana(cursor), 6), { day: "numeric", month: "short", year: "numeric" })}`
    : vista === "dia" ? fmt(cursor, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : t("proximos");

  function irRel(delta: number) {
    if (vista === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (vista === "semana") setCursor(addDias(cursor, delta * 7));
    else if (vista === "dia") setCursor(addDias(cursor, delta));
  }
  const diasSemanaLbl = Array.from({ length: 7 }, (_, i) => fmt(new Date(2026, 10, 1 + i), { weekday: "short" }));

  // Al CREAR en un centro ≠ sesión, el evento debe nacer allí → pasar centroId. En el de la sesión, sin él.
  const centroIdCrear = centro.centroIdCrear;
  const modalCommon = { cats, catLabel, tRoot, tc, t };

  return (
    <div className="w-full px-6 py-8">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold capitalize tracking-tight">{titulo}</h1>
        {vista !== "agenda" && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" onClick={() => irRel(-1)} aria-label={t("anterior")}>
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>{t("hoy")}</Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => irRel(1)} aria-label={t("siguiente")}>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
            </Button>
          </div>
        )}
        {/* Selector de vista */}
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(["mes", "semana", "dia", "agenda"] as Vista[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              className={cn("rounded px-2.5 py-1 font-medium transition-colors", vista === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {t(`vista.${v}`)}
            </button>
          ))}
        </div>
        {eventosRes.state.kind === "fail" && <span className="text-sm text-destructive">{eventosRes.state.message}</span>}

        {/* Selector de centro EN la pantalla (patrón único). Solo si hay más de uno; el de la sesión preseleccionado. */}
        <CentroPantallaSelector estado={centro} />

        {puedeCrear && (
          <Button size="sm" className="ml-auto" onClick={() => setModal({ dia: hoyStr() })}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("nuevo")}
          </Button>
        )}
      </div>

      {/* MES */}
      {vista === "mes" && (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {diasSemanaLbl.map((d, i) => (
            <div key={i} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
          {celdasMes.map((cel) => {
            const ds = ymd(cel);
            const delMes = cel.getMonth() === cursor.getMonth();
            const evs = eventosDe(ds);
            return (
              <button key={ds} type="button" onClick={() => puedeCrear && setModal({ dia: ds })}
                className={cn("min-h-[104px] bg-background p-1.5 text-left align-top transition-colors hover:bg-accent/30", !delMes && "bg-muted/20 text-muted-foreground")}>
                <div className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", ds === hoyStr() && "bg-primary text-primary-foreground")}>{cel.getDate()}</div>
                <div className="space-y-0.5">
                  {evs.slice(0, 4).map((ev) => <Pill key={ev.id} ev={ev} col={colorDe(ev)} onClick={() => setModal({ evento: ev, dia: ev.dia })} />)}
                  {evs.length > 4 && <div className="px-1 text-[10px] text-muted-foreground">+{evs.length - 4}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* SEMANA */}
      {vista === "semana" && (
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border bg-border">
          {celdasSemana.map((cel) => (
            <div key={ymd(cel)} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {fmt(cel, { weekday: "short" })} {cel.getDate()}
            </div>
          ))}
          {celdasSemana.map((cel) => {
            const ds = ymd(cel);
            const evs = eventosDe(ds);
            return (
              <button key={ds} type="button" onClick={() => puedeCrear && setModal({ dia: ds })}
                className={cn("min-h-[420px] bg-background p-1.5 text-left align-top transition-colors hover:bg-accent/30", ds === hoyStr() && "ring-1 ring-inset ring-primary/40")}>
                <div className="space-y-1">
                  {evs.map((ev) => <Pill key={ev.id} ev={ev} col={colorDe(ev)} onClick={() => setModal({ evento: ev, dia: ev.dia })} />)}
                  {evs.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* DÍA */}
      {vista === "dia" && (
        <div className="rounded-xl border">
          <div className="divide-y">
            {eventosDe(ymd(cursor)).length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("sinEventos")}</p>
            ) : (
              eventosDe(ymd(cursor)).map((ev) => <Fila key={ev.id} ev={ev} col={colorDe(ev)} cat={catLabel(catPorId.get(ev.categoriaId ?? ""))} onClick={() => setModal({ evento: ev, dia: ev.dia })} t={t} />)
            )}
          </div>
        </div>
      )}

      {/* AGENDA (próximos) */}
      {vista === "agenda" && (
        <div className="space-y-4">
          {(() => {
            const dias = [...new Set(eventos.map((e) => e.dia))].sort();
            if (dias.length === 0) return <p className="rounded-xl border px-4 py-10 text-center text-sm text-muted-foreground">{t("sinProximos")}</p>;
            return dias.map((d) => (
              <div key={d}>
                <div className="mb-1 text-sm font-semibold capitalize">{fmt(new Date(d + "T12:00:00"), { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="divide-y rounded-xl border">
                  {eventos.filter((e) => e.dia === d).map((ev) => <Fila key={ev.id} ev={ev} col={colorDe(ev)} cat={catLabel(catPorId.get(ev.categoriaId ?? ""))} onClick={() => setModal({ evento: ev, dia: ev.dia })} t={t} />)}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Leyenda */}
      {cats.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {cats.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-full", (COLOR[c.color] || COLOR.gris).dot)} />{catLabel(c)}</span>
          ))}
          <span className="inline-flex items-center gap-1.5"><HugeiconsIcon icon={Globe02Icon} className="size-3" /> {t("global")}</span>
        </div>
      )}

      {modal && (
        <EventoModal
          key={modal.evento?.id ?? modal.dia}
          inicial={modal}
          puedeEditar={modal.evento ? puedeTocar(modal.evento) : puedeCrear}
          puedeBorrar={modal.evento ? puedeTocar(modal.evento) : false}
          centroIdCrear={centroIdCrear}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); eventosRes.reload(); }}
          {...modalCommon}
        />
      )}
    </div>
  );
}

function Pill({ ev, col, onClick }: { ev: CalendarioEvento; col: { chip: string }; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium", col.chip)} title={ev.titulo}>
      {ev.esGlobal && <HugeiconsIcon icon={Globe02Icon} className="size-3 shrink-0" />}
      {ev.hora && <span className="shrink-0 tabular-nums opacity-80">{ev.hora}</span>}
      <span className="truncate">{ev.titulo}</span>
    </div>
  );
}

function Fila({ ev, col, cat, onClick, t }: { ev: CalendarioEvento; col: { dot: string }; cat: string; onClick: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40">
      <span className={cn("size-2.5 shrink-0 rounded-full", col.dot)} />
      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">{ev.hora ? (ev.horaFin ? `${ev.hora}–${ev.horaFin}` : ev.hora) : t("todoDia")}</span>
      <span className="min-w-0 flex-1">
        <span className="truncate font-medium">{ev.titulo}</span>
        {cat && <span className="ml-2 text-xs text-muted-foreground">{cat}</span>}
      </span>
      {ev.esGlobal && <HugeiconsIcon icon={Globe02Icon} className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function EventoModal({
  inicial, cats, catLabel, puedeEditar, puedeBorrar, centroIdCrear, onClose, onSaved, tRoot, tc, t,
}: {
  inicial: { evento?: CalendarioEvento; dia: string };
  cats: CalendarioCategoria[];
  catLabel: (c?: CalendarioCategoria) => string;
  puedeEditar: boolean;
  puedeBorrar: boolean;
  centroIdCrear?: string; // al crear en un centro ≠ sesión, el evento nace allí
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
      dia, diaFin: diaFin || null,
      hora: todoDia ? null : (hora || null), horaFin: todoDia ? null : (horaFin || null),
      titulo: titulo.trim(), descripcion: descripcion.trim() || null,
      categoriaId: categoriaId || null, esGlobal,
    };
    try {
      // El centroId solo viaja al CREAR en otro centro; editar no cambia el centro del evento.
      if (ev) await actualizarEvento(ev.id, payload);
      else await crearEvento(centroIdCrear ? { ...payload, centroId: centroIdCrear } : payload);
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
          <Campo label={t("field.titulo")}><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={soloLectura} autoFocus /></Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label={t("field.dia")}><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} disabled={soloLectura} /></Campo>
            <Campo label={t("field.diaFin")}><Input type="date" value={diaFin} onChange={(e) => setDiaFin(e.target.value)} disabled={soloLectura} /></Campo>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={todoDia} onChange={(e) => setTodoDia(e.target.checked)} disabled={soloLectura} />{t("field.todoDia")}</label>
          {!todoDia && (
            <div className="grid grid-cols-2 gap-3">
              <Campo label={t("field.hora")}><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={soloLectura} /></Campo>
              <Campo label={t("field.horaFin")}><Input type="time" value={horaFin} onChange={(e) => setHoraFin(e.target.value)} disabled={soloLectura} /></Campo>
            </div>
          )}
          <Campo label={t("field.categoria")}>
            <Select value={categoriaId} onValueChange={setCategoriaId} disabled={soloLectura}>
              <SelectTrigger><SelectValue placeholder={t("field.selCategoria")} /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{catLabel(c)}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label={t("field.descripcion")}><Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} disabled={soloLectura} /></Campo>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={esGlobal} onChange={(e) => setEsGlobal(e.target.checked)} disabled={soloLectura} />{t("field.global")}</label>
          <div className="flex justify-between gap-2 pt-1">
            <div>{ev && puedeBorrar && <Button variant="outline" size="sm" onClick={borrar} disabled={busy} className="text-destructive">{tc("delete")}</Button>}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>{tc("cancel")}</Button>
              {!soloLectura && <Button size="sm" onClick={guardar} disabled={busy || !titulo.trim()}>{busy ? tc("loading") : tc("save")}</Button>}
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
