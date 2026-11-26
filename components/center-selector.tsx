"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useMe } from "@/hooks/use-me";
import { getMyCentrosOperativos, type Centro } from "@/lib/api/centers";
import { getMyPreferences } from "@/lib/api/preferences";
import { getActiveCentro, isClinicViewAll, setActiveCentro, setClinicViewAll } from "@/lib/tenant";
import { urlAfterCenterSwitch } from "@/lib/navigation/after-center-switch";
import { apiErrorMessage } from "@/lib/api/errors";
import { shortCenterNames } from "@/lib/centers/short-names";
import { cn } from "@/lib/utils";

// The top bar's active-center picker: «which center am I looking at, and which one do I work in»,
// as a segmented control (Bayamón | Caguas | Ambos). A center sets the X-Tenant-ID cookie; «Ambos»
// keeps that working center and widens reads to every center of the person
// (docs/specs/selector-de-centros-arriba.md). The page reloads so everything refetches. It offers only
// the OPERATIONAL centers (where the person holds a role), and hides itself with only one.
const ALL = "__all__";

export function CenterSelector() {
  const me = useMe();
  const t = useTranslations("nav");
  const [centros, setCentros] = React.useState<Centro[]>([]);
  // Acento de color por centro (spec acento-de-color-por-centro): un punto de color junto al nombre
  // del centro para que el usuario multi-centro sepa de un vistazo en cuál está parado. Sale del motor
  // de preferencias por capas (effective.colorPorCentro); default del sistema Bayamón azul/Caguas verde.
  const [colores, setColores] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (me.kind !== "ok") return;
    let active = true;
    getMyCentrosOperativos()
      .then((list) => active && setCentros(list))
      .catch((err) => active && toast.error(apiErrorMessage(err)));
    getMyPreferences()
      .then((p) => active && setColores(p.effective?.colorPorCentro ?? {}))
      .catch(() => {}); // el acento es apoyo, no bloquea el switcher si falla
    return () => {
      active = false;
    };
  }, [me.kind]);

  // Se enseña solo si hay MÁS DE UN centro operativo — con uno no hay nada que elegir.
  if (centros.length <= 1) return null;

  const current = isClinicViewAll()
    ? ALL
    : (getActiveCentro() ?? (me.kind === "ok" ? me.me.activeClinicId : null) ?? "");
  const dot = (id: string) =>
    colores[id] ? (
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
        style={{ backgroundColor: colores[id] }}
      />
    ) : null;
  // «AMBOS»: one dot split into every clinic's color, so it reads as all of them together.
  const both = centros.map((c) => colores[c.id]).filter(Boolean);
  const allDot =
    both.length > 0 ? (
      <span
        aria-hidden
        className="inline-block size-2.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
        style={{
          background:
            both.length === 1
              ? both[0]
              : `linear-gradient(90deg, ${both.map((c, i) => `${c} ${(i * 100) / both.length}% ${((i + 1) * 100) / both.length}%`).join(", ")})`,
        }}
      />
    ) : null;

  function onChange(id: string) {
    if (id === ALL) {
      // The working center (X-Tenant-ID, where writes go) stays; only the reads widen.
      const working = getActiveCentro() ?? (me.kind === "ok" ? me.me.activeClinicId : null);
      if (working) setActiveCentro(working);
      setClinicViewAll(true);
      window.location.reload();
      return;
    }
    setClinicViewAll(false);
    setActiveCentro(id);
    // Full page load so everything refetches under the new tenant — but not always in place: a record
    // of the previous center goes back to its list, and a `?centro=` is re-pinned (see the helper).
    const { pathname, search } = window.location;
    const next = urlAfterCenterSwitch(pathname, search, id);
    if (next === pathname + search) window.location.reload();
    else window.location.assign(next);
  }

  const labels = shortCenterNames(centros.map((c) => c.name));
  const options = [
    ...centros.map((c, i) => ({ id: c.id, label: labels[i], title: c.name, mark: dot(c.id) })),
    { id: ALL, label: t("bothCenters"), title: t("bothCenters"), mark: allDot },
  ];

  return <CenterSegments options={options} current={current} label={t("center")} onSelect={onChange} />;
}

export interface CenterSegment {
  id: string;
  label: string;
  title: string;
  mark: React.ReactNode;
}

/** The segmented control itself, without data loading: one radio per center plus «Ambos». */
export function CenterSegments({
  options,
  current,
  label,
  onSelect,
}: {
  options: CenterSegment[];
  current: string;
  label: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-9 shrink-0 overflow-hidden rounded-md border bg-background"
    >
      {options.map((o, i) => {
        const selected = o.id === current;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.title}
            onClick={() => !selected && onSelect(o.id)}
            className={cn(
              "flex items-center gap-1.5 px-2 text-sm sm:px-3 whitespace-nowrap transition-colors",
              "focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i > 0 && "border-l",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            {o.mark}
            {/* Phone width: the top bar also holds search, alerts and the user menu. */}
            <span className="sm:hidden">{o.label.slice(0, 3)}</span>
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
