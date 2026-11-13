"use client";

import { isMine } from "@/lib/auth/who-did-it";
import { useCan } from "@/hooks/use-can";
import * as React from "react";
import { sentenceCase } from "@/lib/format/text";
import { useFormatter, useTranslations, useLocale } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon, Add01Icon, Globe02Icon } from "@hugeicons/core-free-icons";

import { getEventos, getCategorias, type CalendarioEvento, type CalendarioCategoria } from "@/lib/api/calendario";
import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { useResource } from "@/hooks/use-resource";
import { isAdmin, useMe } from "@/hooks/use-me";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useCreateClinic } from "@/hooks/use-create-clinic";
import { EventoModal } from "@/components/calendario/evento-modal";
import { cn } from "@/lib/utils";
import { useFillViewportHeight } from "@/hooks/use-fill-viewport-height";
import { PillsSkeleton } from "@/components/kit/skeletons";
import { AgendaSkeleton, DiaRowsSkeleton, LegendDotsSkeleton } from "@/components/calendario/calendario-skeleton";
import { parseDayUTC } from "@/lib/format/fecha";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// El color de la categoría es una clave SEMÁNTICA (no un hex) → se mapea a la paleta una vez, como la
// campanita. `dot` para el punto, `chip` para la píldora del evento.
const COLOR: Record<string, { chip: string; dot: string }> = {
  rojo: { chip: "bg-destructive/10 text-destructive border-destructive/30", dot: "bg-destructive" },
  azul: { chip: "bg-info text-info-foreground border-info/40", dot: "bg-info-foreground" },
  violeta: { chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30", dot: "bg-violet-500" },
  ambar: { chip: "bg-warning text-warning-foreground border-warning/40", dot: "bg-warning-foreground" },
  gris: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/60" },
  verde: { chip: "bg-success text-success-foreground border-success/40", dot: "bg-success-foreground" },
};
type Vista = "mes" | "semana" | "dia" | "agenda";
const VISTAS: Vista[] = ["mes", "semana", "dia", "agenda"];

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
  const format = useFormatter();
  const me = useMe();
  const { can } = useCan(); // calendario.absences: accept / dismiss the absence chip (BE #558)

  // Every clinic where the person holds calendario.read, narrowed by the clinic filter (handoff
  // clinic-read-scope); company-wide events always come along. A new event is born in ONE clinic.
  const filter = useClinicFilter("calendario.read");
  const create = useCreateClinic("calendario.create", filter.choice);
  const puedeCrear = create.canCreate;
  // Edit/delete run in the EVENT's clinic, with the permission held THERE (the BE re-checks).
  const updRes = useResource<Centro[]>(() => getCentrosDondePuedo("calendario.update"), []);
  const delRes = useResource<Centro[]>(() => getCentrosDondePuedo("calendario.delete"), []);
  const idsOf = (r: typeof updRes) => new Set(r.state.kind === "ok" ? r.state.data.map((c) => c.id) : []);
  const updIds = idsOf(updRes);
  const delIds = idsOf(delRes);
  // A company-wide event has no clinic to check beyond holding the permission somewhere.
  const allowedIn = (ids: Set<string>, ev: CalendarioEvento) =>
    ev.isGlobal || !ev.clinicId ? ids.size > 0 : ids.has(ev.clinicId);

  // «Cada uno toca lo suyo»: editar/borrar solo eventos PROPIOS, salvo admin. Los del legado no traen
  // autor (creadoPor null, legacyId) → solo admin. El BE re-comprueba (403 con motivo), así que esto solo
  // evita ofrecer un botón que va a fallar. Handoff calendario-selector-de-centro §«Cada uno toca lo suyo».
  const esAdmin = me.kind === "ok" && isAdmin(me.me);
  // The author is the PERSON (staff id), not the login or the profile: see lib/auth/who-did-it.ts.
  const esMio = (ev?: CalendarioEvento) => isMine(ev?.createdBy, me.kind === "ok" ? me.me : null);
  // Staff absences are projected read-only rows (see lib/api/calendario.ts): they don't belong to
  // calendar_events, so editing/deleting them here 404s — only Disponibilidad can change them.
  const puedeTocar = (ev: CalendarioEvento, ids: Set<string>) =>
    ev.origin !== "staff_absence" && allowedIn(ids, ev) && (esAdmin || esMio(ev));
  // The event's clinic, shown when the screen spans more than one; company-wide ones say so.
  const clinicLabel = (ev: CalendarioEvento) =>
    ev.isGlobal || !ev.clinicId ? t("global") : (ev.clinicName || filter.nameOf(ev.clinicId));
  const showClinic = filter.showColumn;

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

  const eventosRes = useResource<CalendarioEvento[]>(
    () => getEventos(desde, hasta, filter.choice),
    [desde, hasta, filter.choiceKey],
  );
  const catsRes = useResource<CalendarioCategoria[]>(() => getCategorias());
  const eventos = eventosRes.state.kind === "ok" ? eventosRes.state.data : [];
  // First load or a range/centre change: the cells show placeholder pills, never an empty grid.
  const cargandoEventos = eventosRes.state.kind === "loading";
  const cats = catsRes.state.kind === "ok" ? catsRes.state.data : [];
  const catPorId = new Map(cats.map((c) => [c.id, c]));
  const catLabel = (c?: CalendarioCategoria) =>
    c ? (c.name ?? (c.labelKey && tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.slug ?? "")) : "";
  const colorDe = (ev: CalendarioEvento) => {
    const c = ev.categoryId ? catPorId.get(ev.categoryId) : undefined;
    return (c && COLOR[c.color]) || COLOR.gris;
  };
  const eventosDe = (d: string) => eventos.filter((e) => e.day <= d && d <= (e.endDay || e.day));

  const [modal, setModal] = React.useState<{ evento?: CalendarioEvento; dia: string } | null>(null);

  // Título según la vista.
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, o).format(d);
  // Period title through the named formats (they pin UTC, so feed them the cursor's day at UTC noon),
  // sentence-cased: "Octubre de 2026", never the CSS `capitalize` "Octubre De 2026".
  const asDay = (d: Date) => parseDayUTC(ymd(d)) ?? d;
  const titulo = sentenceCase(
    vista === "mes" ? format.dateTime(asDay(cursor), "monthYear")
    : vista === "semana" ? `${format.dateTime(asDay(domingoDeLaSemana(cursor)), "dayMonth")} – ${format.dateTime(asDay(addDias(domingoDeLaSemana(cursor), 6)), "dayMonthYear")}`
    : vista === "dia" ? format.dateTime(asDay(cursor), "dayWeekdayLong")
    : t("proximos"),
    locale,
  );

  function irRel(delta: number) {
    if (vista === "mes") setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));
    else if (vista === "semana") setCursor(addDias(cursor, delta * 7));
    else if (vista === "dia") setCursor(addDias(cursor, delta));
  }
  const diasSemanaLbl = Array.from({ length: 7 }, (_, i) => fmt(new Date(2026, 10, 1 + i), { weekday: "short" }));

  const modalCommon = { cats, catLabel, tRoot, tc, t };

  // Month and week grids run to the bottom of the window (desktop), leaving room for the legend
  // below; their rows stretch to share the height, and scroll inside the grid if it gets too short.
  // One ref per grid: the two are different elements, and a shared ref would keep measuring the
  // one that just unmounted when the view switches.
  const monthRef = React.useRef<HTMLDivElement>(null);
  const weekRef = React.useRef<HTMLDivElement>(null);
  const monthHeight = useFillViewportHeight(monthRef, { enabled: vista === "mes" });
  const weekHeight = useFillViewportHeight(weekRef, { enabled: vista === "semana" });
  const gridHeight = vista === "mes" ? monthHeight : vista === "semana" ? weekHeight : undefined;

  return (
    <PageContainer>
      <PageHeader title={t("pageTitle")} />

      {/* View tabs: they switch how the same events are laid out, so they get their own row. */}
      <Tabs value={vista} onValueChange={(v) => setVista(v as Vista)}>
        <TabsList>
          {VISTAS.map((v) => (
            <TabsTrigger key={v} value={v}>{t(`vista.${v}`)}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Toolbar: period navigation + center filter on the left, the create action on the right. */}
      <div className="flex flex-wrap items-center gap-2">
        {vista !== "agenda" && (
          <>
            <Button variant="outline" size="icon" onClick={() => irRel(-1)} aria-label={t("anterior")}>
              <HugeiconsIcon icon={ArrowLeft01Icon} />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>{t("hoy")}</Button>
            <Button variant="outline" size="icon" onClick={() => irRel(1)} aria-label={t("siguiente")}>
              <HugeiconsIcon icon={ArrowRight01Icon} />
            </Button>
          </>
        )}
        <h2 className="px-1 text-lg font-semibold">{titulo}</h2>

        {eventosRes.state.kind === "fail" && <span className="text-sm text-destructive">{eventosRes.state.message}</span>}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {puedeCrear && (
            <Button onClick={() => setModal({ dia: hoyStr() })}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t("nuevo")}
            </Button>
          )}
        </div>
      </div>

      {/* MES */}
      {vista === "mes" && (
        <div
          ref={monthRef}
          aria-busy={cargandoEventos || undefined}
          style={gridHeight ? { height: gridHeight, gridTemplateRows: "auto repeat(6, minmax(104px, 1fr))" } : undefined}
          className={cn("grid grid-cols-7 gap-px rounded-md ring-1 ring-foreground/10 bg-border", gridHeight ? "overflow-y-auto" : "overflow-hidden")}
        >
          {cargandoEventos && <span className="sr-only">{tc("loading")}</span>}
          {diasSemanaLbl.map((d, i) => (
            <div key={i} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{d}</div>
          ))}
          {celdasMes.map((cel, idx) => {
            const ds = ymd(cel);
            const delMes = cel.getMonth() === cursor.getMonth();
            const evs = eventosDe(ds);
            return (
              <button key={ds} type="button" onClick={() => puedeCrear && setModal({ dia: ds })}
                className={cn("min-h-[104px] overflow-hidden bg-background p-1.5 text-left align-top transition-colors hover:bg-accent/30", !delMes && "bg-muted/20 text-muted-foreground")}>
                <div className={cn("mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs font-medium", ds === hoyStr() && "bg-primary text-primary-foreground")}>{cel.getDate()}</div>
                {cargandoEventos ? (delMes && <PillsSkeleton seed={idx} />) : (
                <div className="space-y-0.5">
                  {evs.slice(0, 4).map((ev) => <Pill key={ev.id} ev={ev} col={colorDe(ev)} clinic={showClinic ? clinicLabel(ev) : ""} onClick={() => setModal({ evento: ev, dia: ev.day })} />)}
                  {evs.length > 4 && <div className="px-1 text-[10px] text-muted-foreground">+{evs.length - 4}</div>}
                </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* SEMANA */}
      {vista === "semana" && (
        <div
          ref={weekRef}
          aria-busy={cargandoEventos || undefined}
          style={gridHeight ? { height: gridHeight, gridTemplateRows: "auto minmax(240px, 1fr)" } : undefined}
          className={cn("grid grid-cols-7 gap-px rounded-md ring-1 ring-foreground/10 bg-border", gridHeight ? "overflow-y-auto" : "overflow-hidden")}
        >
          {cargandoEventos && <span className="sr-only">{tc("loading")}</span>}
          {celdasSemana.map((cel) => (
            <div key={ymd(cel)} className="bg-muted/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {fmt(cel, { weekday: "short" })} {cel.getDate()}
            </div>
          ))}
          {celdasSemana.map((cel, idx) => {
            const ds = ymd(cel);
            const evs = eventosDe(ds);
            return (
              <button key={ds} type="button" onClick={() => puedeCrear && setModal({ dia: ds })}
                className={cn(gridHeight ? "min-h-0 overflow-y-auto" : "min-h-[420px]", "bg-background p-1.5 text-left align-top transition-colors hover:bg-accent/30", ds === hoyStr() && "ring-1 ring-inset ring-primary/40")}>
                {cargandoEventos ? <PillsSkeleton seed={idx} max={4} /> : (
                <div className="space-y-1">
                  {evs.map((ev) => <Pill key={ev.id} ev={ev} col={colorDe(ev)} clinic={showClinic ? clinicLabel(ev) : ""} onClick={() => setModal({ evento: ev, dia: ev.day })} />)}
                  {evs.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
                </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* DÍA */}
      {vista === "dia" && (
        <div className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
          <div className="divide-y">
            {cargandoEventos ? (
              <DiaRowsSkeleton />
            ) : eventosDe(ymd(cursor)).length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">{t("sinEventos")}</p>
            ) : (
              eventosDe(ymd(cursor)).map((ev) => <Fila key={ev.id} ev={ev} col={colorDe(ev)} clinic={showClinic ? clinicLabel(ev) : ""} cat={catLabel(catPorId.get(ev.categoryId ?? ""))} onClick={() => setModal({ evento: ev, dia: ev.day })} t={t} />)
            )}
          </div>
        </div>
      )}

      {/* AGENDA (próximos) */}
      {vista === "agenda" && (
        <div className="space-y-4">
          {cargandoEventos ? <AgendaSkeleton /> : (() => {
            const dias = [...new Set(eventos.map((e) => e.day))].sort();
            if (dias.length === 0) return <p className="rounded-md bg-card px-4 py-10 text-center text-sm text-muted-foreground ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">{t("sinProximos")}</p>;
            return dias.map((d) => (
              <div key={d}>
                <div className="mb-1 text-sm font-semibold capitalize">{fmt(new Date(d + "T12:00:00"), { weekday: "long", day: "numeric", month: "long" })}</div>
                <div className="divide-y overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                  {eventos.filter((e) => e.day === d).map((ev) => <Fila key={ev.id} ev={ev} col={colorDe(ev)} clinic={showClinic ? clinicLabel(ev) : ""} cat={catLabel(catPorId.get(ev.categoryId ?? ""))} onClick={() => setModal({ evento: ev, dia: ev.day })} t={t} />)}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Leyenda */}
      {(catsRes.state.kind === "loading" || cats.length > 0) && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {catsRes.state.kind === "loading" && <LegendDotsSkeleton />}
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
          puedeEditar={modal.evento ? puedeTocar(modal.evento, updIds) : puedeCrear}
          puedeBorrar={modal.evento ? puedeTocar(modal.evento, delIds) : false}
          puedeAusencias={can("calendario.absences")}
          createCenters={create.centers}
          defaultClinicId={create.defaultClinicId}
          showClinic={showClinic}
          clinicLabel={clinicLabel}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); eventosRes.refresh(); }}
          {...modalCommon}
        />
      )}
    </PageContainer>
  );
}

// `clinic`: the event's clinic when the screen spans several ("" otherwise): in the tooltip and after the title.
function Pill({ ev, col, clinic, onClick }: { ev: CalendarioEvento; col: { chip: string }; clinic: string; onClick: () => void }) {
  return (
    <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[11px] font-medium", col.chip)} title={clinic ? `${ev.title} · ${clinic}` : ev.title}>
      {ev.isGlobal && <HugeiconsIcon icon={Globe02Icon} className="size-3 shrink-0" />}
      {ev.time && <span className="shrink-0 tabular-nums opacity-80">{ev.time}</span>}
      <span className="truncate">{ev.title}</span>
      {clinic && !ev.isGlobal && <span className="ml-auto shrink-0 truncate pl-1 text-[10px] opacity-70">{clinic}</span>}
    </div>
  );
}

function Fila({ ev, col, clinic, cat, onClick, t }: { ev: CalendarioEvento; col: { dot: string }; clinic: string; cat: string; onClick: () => void; t: ReturnType<typeof useTranslations> }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/40">
      <span className={cn("size-2.5 shrink-0 rounded-full", col.dot)} />
      <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">{ev.time ? (ev.endTime ? `${ev.time}–${ev.endTime}` : ev.time) : t("todoDia")}</span>
      <span className="min-w-0 flex-1">
        <span className="truncate font-medium">{ev.title}</span>
        {cat && <span className="ml-2 text-xs text-muted-foreground">{cat}</span>}
      </span>
      {clinic && <Badge variant="outline" className="shrink-0">{clinic}</Badge>}
      {ev.isGlobal && <HugeiconsIcon icon={Globe02Icon} className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}
