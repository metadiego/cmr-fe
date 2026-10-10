"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  cancelarSesion,
  repararSesion,
  type PendienteEntrega,
  type FrontdeskColumna,
  type FrontdeskFila,
  type Sesion,
} from "@/lib/api/frontdesk";
import type { Servicio } from "@/lib/api/servicios";
import { fmtHora, POSTACCION_PROGRAMAR, STAMP_FIELD } from "@/components/frontdesk/frontdesk-board.helpers";
import { editarCelda, ejecutarAccion, type Opcion, type Transicion } from "@/lib/api/tablero";
import { useCan } from "@/hooks/use-can";
import { usePersistenciaToast } from "@/hooks/use-persistencia-toast";
import { toastError } from "@/lib/api/errors";
import { FormatosModal } from "@/components/frontdesk/formatos-modal";
import { PanelNotificarModal } from "@/components/frontdesk/panel-notificar-modal";
import { PriorityFlagsBadges } from "@/components/clientes/priority-flags-badges";
import { SesionesCell } from "@/components/frontdesk/sesiones-cell";
import { MedicionCell } from "@/components/frontdesk/medicion-cell";
import { RowMenu } from "@/components/frontdesk/row-menu";
import { HistorialModal } from "@/components/frontdesk/historial-modal";
import { ComprasModal } from "@/components/frontdesk/compras-modal";
import { DosisAvisoDialog } from "@/components/frontdesk/dosis-aviso-dialog";
import { parseAcciones, type ReportAccion } from "@/lib/frontdesk/acciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { Tick02Icon, Notification03Icon, ShoppingCart01Icon } from "@hugeicons/core-free-icons";

// Fila de una sesión del frontdesk (extraída de frontdesk-board.tsx, que vivía sobre su propio
// límite de líneas — este componente por sí solo pasaba las 700). Incluye sus celdas, el flujo de
// pasos, el menú de acciones y los modales que solo ella usa (historial, compras, transferir
// tratamiento). Handoff: HANDOFF-banderas-de-prioridad-del-paciente.md (celda "paciente" ahora
// también deja ver/asignar/quitar banderas de prioridad, sin abrir la ficha).
export function FilaSesion({
  fila,
  sesion,
  colsRender,
  flujoCols,
  flujo,
  transiciones,
  estadoDe,
  servicio,
  tablero,
  fecha,
  optionsByCol,
  saldoDosis,
  centro,
  sinSaldo,
  canReparar,
  estados,
  onChanged,
  onProgramar,
}: {
  fila: FrontdeskFila;
  sesion?: Sesion;
  colsRender: ({ kind: "col"; col: FrontdeskColumna } | { kind: "flujo" })[];
  flujoCols: FrontdeskColumna[];
  flujo: { clave: string; labelKey: string; color?: string | null }[];
  transiciones: Transicion[];
  estadoDe: (clave: string) => { labelKey: string; color?: string | null } | undefined;
  servicio?: Servicio;
  tablero: string;
  fecha: string;
  optionsByCol: Record<string, Opcion[]>;
  saldoDosis: PendienteEntrega[];
  centro?: string;
  sinSaldo: boolean;
  canReparar: boolean;
  estados: { clave: string; label: string }[];
  onChanged: () => void;
  onProgramar: (ctx: { pacienteId: string; pacienteNombre?: string; servicioId?: string }) => void;
}) {
  const t = useTranslations("frontdesk");
  const tRoot = useTranslations();
  const { can } = useCan();
  const notifyPersistencia = usePersistenciaToast();
  const [busy, setBusy] = React.useState(false);
  const [historialOpen, setHistorialOpen] = React.useState(false);
  const [comprasOpen, setComprasOpen] = React.useState(false);
  const [notificarCfg, setNotificarCfg] = React.useState<{ panel: string; seccion: string } | null>(null);
  // Reports del servicio (HILT/MLS, o formatos genéricos): se listan PLANOS en el menú de Acciones,
  // cada uno abre su documento imprimible. Handoff HANDOFF-formato-laser-hilt-mls (§3).
  const reportsAcc = React.useMemo(() => (parseAcciones(servicio?.formActions).reports ?? []), [servicio]);
  const [formatoReport, setFormatoReport] = React.useState<ReportAccion | null>(null);
  // Reflejo OPTIMISTA local del select (por columna): muestra el valor elegido al instante, sin
  // esperar las 2 idas al servidor (guardar + refetch). Se limpia si la escritura falla.
  const [pendSelect, setPendSelect] = React.useState<Record<string, string>>({});
  // Cartel CENTRADO (no bloqueante) cuando el usuario elige una dosis que el paciente NO compró teniendo
  // dosis compradas pendientes. Guarda todo lo necesario para confirmar/revertir sin recalcular. El dueño
  // lo pidió a la vista (no un toast abajo): que se dé cuenta cuando aún puede corregir. Handoff §1.
  const [dosisAviso, setDosisAviso] = React.useState<{
    clave: string;
    valor: string;
    etiqueta: string;
    prev: string;
    eligiendo: string;
    comprado: { nombre: string; n: number }[];
  } | null>(null);
  // Verdad del flujo: el `estado` top-level que ahora manda el BE en cada fila (PR #195). Antes el FE lo
  // deducía de los sellos y pintaba ASISTIDO en filas que estaban en terapia; ya no se deduce.
  const estadoActual = String(fila.estado ?? fila.fd_estado ?? sesion?.status ?? "");
  const cancelada = estadoActual === "cancelada";
  const pacienteNombre = String(fila.paciente ?? fila.fd_paciente ?? fila.fac_paciente ?? "");

  // Devuelve true SOLO si la acción tuvo éxito. Así quien encadena un postAccion (p. ej. abrir "Programar
  // citas" tras Asistido) no lo dispara cuando la acción falló (sesión caducada, requerido faltante): antes
  // el `.then` corría igual y parecía que había asistido sin haberlo hecho (QA-002). El error se avisa con
  // un toast (mensaje del BE, i18n); si la sesión expiró, el cliente muestra el aviso y va al login.
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await fn();
      onChanged();
      return true;
    } catch (err) {
      toastError(err, tRoot);
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Etiqueta humana de una columna para el toast de certificación (label propio → i18n → clave cruda).
  const etiquetaCol = (c: FrontdeskColumna): string =>
    (c as { label?: string | null }).label ?? (tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.clave);
  // Guardar una celda CERTIFICANDO: escribe y muestra el toast con lo que quedó en la base (verde) o el
  // motivo (rojo); onChanged() re-lee la fila, así una escritura fallida revierte sola a la verdad.
  // Handoff HANDOFF-toast-que-certifica-la-persistencia.
  async function guardarCelda(columna: string, valor: unknown, etiqueta?: string) {
    const { persistencia } = await editarCelda({ boardSlug: tablero, entityId: fila.id, column: columna, value: valor }, centro);
    notifyPersistencia(persistencia, etiqueta);
    return persistencia;
  }

  function celda(c: FrontdeskColumna) {
    const v = fila[c.clave];
    // Campana data-driven (columna fd_notificar): abre el modal para avisar al panel. panel/sección
    // salen del render de la columna (sin hardcode). Solo si hay sesión con paciente.
    const rk = (c.render as { kind?: string } | null)?.kind;
    // Nombre del paciente + sus banderas de prioridad (oxígeno, silla de ruedas…): se ven Y SE
    // APLICAN/QUITAN aquí mismo, en frente del paciente — pedido explícito del dueño, 07-oct-2026:
    // nunca como si fuera un diagnóstico escondido en la ficha. Mismo componente que la ficha del
    // paciente (su propio fetch del catálogo + de las banderas de ESTE paciente, un clic = un cambio).
    if (c.clave === "fd_paciente") {
      const nombre = v == null || v === "" ? "—" : String(v);
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{nombre}</span>
          {sesion?.patientId && <PriorityFlagsBadges patientId={sesion.patientId} centroId={centro} />}
        </span>
      );
    }
    // Carrito de compras (columna fd_compras, tipo accion): muestra las sesiones compradas EL DÍA DEL
    // TABLERO (número ya resuelto en la fila; null = celda en blanco, NUNCA "0") y al hacer clic abre el
    // historial completo de compras del paciente. El icono es clicable aunque no haya compras ese día.
    if (rk === "compras") {
      if (!sesion?.patientId) return <span className="text-muted-foreground">—</span>;
      const n = v == null || v === "" ? null : String(v);
      return (
        <button
          type="button"
          onClick={() => setComprasOpen(true)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm tabular-nums transition-colors hover:bg-muted"
          aria-label={t("compras.titulo")}
          title={t("compras.titulo")}
        >
          <HugeiconsIcon icon={ShoppingCart01Icon} className="size-4 text-muted-foreground" />
          {n != null && <span className="font-semibold">{n}</span>}
        </button>
      );
    }
    if (rk === "notificar") {
      if (!sesion?.patientId) return <span className="text-muted-foreground">—</span>;
      const rc = (c.render ?? {}) as { panel?: string; seccion?: string };
      return (
        <button
          type="button"
          onClick={() => setNotificarCfg({ panel: rc.panel ?? "enfermeria", seccion: rc.seccion ?? "" })}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t("notificarAlPanel")}
          title={t("notificarAlPanel")}
        >
          <HugeiconsIcon icon={Notification03Icon} className="size-4" />
        </button>
      );
    }
    if (c.clave === "fd_estado") {
      const e = estadoDe(String(v ?? ""));
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge
            variant="secondary"
            className="gap-1.5 font-medium"
            style={e?.color ? { backgroundColor: `${e.color}22`, color: e.color } : undefined}
          >
            {e ? tRoot(e.labelKey) : String(v ?? "—")}
          </Badge>
          {sinSaldo && <Badge variant="destructive" className="text-[10px]">{t("sinSaldo")}</Badge>}
        </span>
      );
    }
    if (c.clave === "fd_sesiones") {
      return (
        <SesionesCell
          display={v == null || v === "" ? "—" : String(v)}
          servicio={servicio}
          pacienteId={sesion?.patientId}
          centro={centro}
        />
      );
    }
    // Select editable (p. ej. DOSIS): opciones data-driven del grupo del servicio; escribe vía
    // editarCelda (writeBinding sesion.productoAplicadoId, evento auditable, PR #138).
    if (c.tipo === "select" && c.editable) {
      const ops = optionsByCol[c.clave] ?? [];
      // El board puede devolver el VALOR (id, p.ej. dosis) o el NOMBRE resuelto (p.ej. técnico
      // = tecnico.nombre). Se normaliza al `value` de la opción (matcheando por value O por label)
      // para que el Select (radix) lo muestre. `value` SIEMPRE definido (string "" si no hay) →
      // el Select queda SIEMPRE controlado (evita el bug uncontrolled↔controlled que lo dejaba EN
      // BLANCO al asignar en vivo). Verificado con logs 2026-07-23.
      // Preferir el VALOR crudo (`<col>__valor`, el id que persiste la entidad, p. ej. dosis→
      // productoAplicadoId) sobre el label (`<col>`), que puede venir null si el BE no resuelve el nombre.
      const rawVal = fila[`${c.clave}__valor`] ?? v;
      const raw = rawVal == null ? "" : String(rawVal);
      const delBoard = ops.find((o) => o.value === raw || o.label === raw)?.value ?? "";
      // El valor MOSTRADO: el optimista local si existe, si no el del board (normalizado a opción).
      const shown = pendSelect[c.clave] ?? delBoard;
      // DOSIS (optionsSource productos_grupo): enriquecer las opciones con el SALDO de ESTE paciente.
      // El id de la dosis (value de la opción) == productoId del sobre pendiente → se cruzan directo.
      // Compradas primero, con "— quedan N" (o "— sin saldo" si se agotó); el resto del catálogo va en
      // un grupo "Otras dosis" sin número. Nunca se esconde ni se bloquea una dosis. Contrato del handoff.
      const esDosis = (c.render as { optionsSource?: string } | null)?.optionsSource === "productos_grupo";
      const saldoMap = new Map<string, PendienteEntrega>();
      if (esDosis) for (const s of saldoDosis) if (s.productId) saldoMap.set(String(s.productId), s);
      const agotada = (val: string) => {
        const s = saldoMap.get(val);
        return !!s && Number(s.pendiente ?? 0) <= 0;
      };
      const etiquetaDosis = (o: Opcion) => {
        const s = saldoMap.get(o.value);
        if (!s) return o.label;
        const n = Number(s.pendiente ?? 0);
        return `${o.label} — ${n > 0 ? t("dosis.quedan", { n }) : t("dosis.sinSaldo")}`;
      };
      const compradas = esDosis ? ops.filter((o) => saldoMap.has(o.value)) : [];
      const otras = esDosis ? ops.filter((o) => !saldoMap.has(o.value)) : ops;
      const conSaldo = esDosis && compradas.length > 0;
      const shownOpt = ops.find((o) => o.value === shown);
      const label = shownOpt ? (esDosis ? etiquetaDosis(shownOpt) : shownOpt.label) : (raw || undefined);
      // Gate data-driven: si la columna declara render.requiereEstado, el select se deshabilita hasta que
      // la sesión alcanzó ese estado (p. ej. técnico bloqueado hasta 'presente'). Genérico, sin hardcode.
      const reqEstado = (c.render as { requiereEstado?: string } | null)?.requiereEstado;
      const estadoNoCumplido = !!reqEstado && !(sesion && STAMP_FIELD[reqEstado] && sesion[STAMP_FIELD[reqEstado]]);
      return (
        <Select
          value={shown}
          disabled={busy || cancelada || ops.length === 0 || estadoNoCumplido}
          onValueChange={(valor) => {
            setPendSelect((p) => ({ ...p, [c.clave]: valor })); // reflejo instantáneo
            // Eligió una dosis que el paciente NO compró teniendo compradas pendientes → cartel CENTRADO,
            // no bloqueante (§1). Reflejamos la elección mientras decide y DIFERIMOS la escritura al confirmar.
            if (esDosis && conSaldo && !saldoMap.has(valor)) {
              setDosisAviso({
                clave: c.clave,
                valor,
                etiqueta: etiquetaCol(c),
                prev: shown,
                eligiendo: ops.find((o) => o.value === valor)?.label ?? valor,
                comprado: compradas.map((o) => ({
                  nombre: o.label,
                  n: Number(saldoMap.get(o.value)?.pendiente ?? 0),
                })),
              });
              return;
            }
            // Dosis agotada: NO bloquear (lo decidió el dueño) — avisar que se aplicará en negativo.
            if (esDosis && agotada(valor)) toast.warning(t("dosis.avisoSinSaldo"));
            run(async () => {
              try {
                return await guardarCelda(c.clave, valor, etiquetaCol(c));
              } catch (e) {
                // Si falla la escritura, revierte el reflejo optimista.
                setPendSelect((p) => {
                  const n = { ...p };
                  delete n[c.clave];
                  return n;
                });
                throw e;
              }
            });
          }}
        >
          <SelectTrigger size="sm" className="h-8 w-40">
            <SelectValue placeholder={ops.length ? t("elegir") : t("sinOpciones")}>{label}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {conSaldo ? (
              <>
                {/* Las dosis que compró, primero, con su saldo. */}
                {compradas.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{etiquetaDosis(o)}</SelectItem>
                ))}
                {/* El resto del catálogo, en un grupo aparte y sin número (se pueden elegir igual). */}
                {otras.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>{t("dosis.otras")}</SelectLabel>
                      {otras.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </>
            ) : (
              ops.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      );
    }
    if (c.tipo === "medicion" && c.render) {
      return (
        <MedicionCell
          col={c}
          sesion={sesion}
          disabled={busy || cancelada}
          onSave={(valor) => run(() => guardarCelda(c.clave, valor, etiquetaCol(c)))}
        />
      );
    }
    // Toggle SUELTO (sin group): badge HH:MM si está sellado; si no, botón que dispara su transición
    // (render.transition). Los agrupados no llegan aquí (colapsan en el Flujo).
    if (c.tipo === "toggle") {
      const r = (c.render ?? {}) as { transition?: string; labelKey?: string };
      const stamp = (v as string | null) ?? null;
      if (cancelada) return <span className="text-xs text-muted-foreground">—</span>;
      if (stamp) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[11px] font-semibold text-success-foreground">
            <HugeiconsIcon icon={Tick02Icon} className="size-3" />
            {fmtHora(stamp)}
          </span>
        );
      }
      return (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="h-6 rounded-full px-2 text-[11px]"
          onClick={() =>
            // Vía CANÓNICA del builder: POST /tablero/accion (la entidad es implícita en el tablero;
            // acepta claves reusadas de Atención como 'consulta'/'atender').
            run(() => ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action: r.transition ?? c.clave }, centro))
          }
        >
          {tRoot(r.labelKey ?? c.labelKey)}
        </Button>
      );
    }
    // Texto editable con DATALIST (render.datalist + optionsSource, p. ej. fd_protocolo): input con
    // sugerencias del endpoint PERO texto libre permitido (un valor nuevo es válido). Guarda al blur/Enter
    // vía editarCelda; la lista de opciones crece sola con el uso. Contrato: HANDOFF-columna-datalist-protocolo.
    if (c.tipo === "texto" && c.editable && (c.render as { datalist?: boolean } | null)?.datalist) {
      const r = (c.render ?? {}) as { placeholder?: string };
      const ops = optionsByCol[c.clave] ?? [];
      const listId = `dl-${c.clave}-${fila.id}`;
      const actualRaw = v == null ? "" : String(v);
      const guardar = (valor: string) => {
        const nuevo = valor.trim();
        if (nuevo === actualRaw) return; // sin cambios
        setPendSelect((p) => ({ ...p, [c.clave]: nuevo }));
        run(async () => {
          try {
            return await guardarCelda(c.clave, nuevo, etiquetaCol(c));
          } catch (e) {
            setPendSelect((p) => { const n = { ...p }; delete n[c.clave]; return n; });
            throw e;
          }
        });
      };
      return (
        <>
          <Input
            list={listId}
            defaultValue={pendSelect[c.clave] ?? actualRaw}
            placeholder={r.placeholder ?? t("elegir")}
            disabled={busy || cancelada}
            className="h-8 w-44"
            onBlur={(e) => guardar(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
          />
          <datalist id={listId}>
            {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </datalist>
        </>
      );
    }
    return <span>{v == null || v === "" ? "—" : String(v)}</span>;
  }

  // Pasos del flujo: PREFERIR los toggles agrupados del BE (render.group + transition + valor=sello en la
  // fila, PR paridad-Atención); fallback a estados∩transiciones + entidad unida (tableros sin toggles).
  const pasos = flujoCols.length
    ? flujoCols.map((c, i) => {
        const r = (c.render ?? {}) as { transition?: string; labelKey?: string; postAccion?: string; revert?: string; color?: string };
        const trans = r.transition ?? c.clave;
        return {
          key: trans,
          estado: c.clave, // estado destino (clave de la columna) → matchea formAcciones.campos[].en
          // Etiqueta: la del ESTADO del flujo (Presente/En terapia/Asistido) — en frontdesk todo es
          // terapia; "consulta" es de Atención (médicos). Fallback a la etiqueta de la columna.
          labelKey: flujo[i]?.labelKey ?? r.labelKey ?? c.labelKey,
          // Color del paso (data-driven). Prioridad: color EXPLÍCITO de la columna (`c.color`, configurable
          // por API cuando el BE lo persista/exponga) → render.color → color del estado del flujo por
          // orden (flujo[i]) → por clave/transición. Evita el gris con el desajuste en_consulta/en_terapia.
          color: (c as { color?: string | null }).color ?? r.color ?? flujo[i]?.color ?? estadoDe(c.clave)?.color ?? estadoDe(trans)?.color ?? null,
          stamp: (fila[c.clave] as string | null) ?? null,
          postAccion: r.postAccion ?? null, // data-driven: qué abrir tras la acción (p. ej. programar citas)
          // Reversa data-driven del MISMO board: clave de acción para deshacer este sello (p. ej.
          // desasistir → devolver consumo). El BE la declara en el render de la columna, igual que
          // `transition` para el avance. Si no la declara, el sello no es reversible (no hay afordancia).
          revert: r.revert ?? null,
        };
      })
    : flujo.map((p) => ({
        key: p.clave,
        estado: p.clave,
        labelKey: p.labelKey,
        color: p.color ?? null,
        stamp: sesion ? ((sesion[STAMP_FIELD[p.clave]] as string | null) ?? null) : null,
        postAccion: null as string | null,
        revert: null as string | null,
      }));

  // Acciones de MENÚ data-driven: transiciones que aplican desde el estado actual y que NO son parte del
  // flujo (avance/reversa ya viven en los pills) ni el Cancelar dedicado. Aquí cae `reactivar` desde
  // 'cancelada' (segunda oportunidad, PR #195): el FE la pinta sola sin hardcode. RBAC = BE (permiso).
  const pasoKeys = new Set<string>();
  for (const p of pasos) {
    pasoKeys.add(p.key);
    if (p.revert) pasoKeys.add(p.revert);
  }
  const accionesMenu = transiciones
    .filter(
      (tr) =>
        tr.active !== false &&
        // Solo transiciones SIN payload extra: el menú plano no recoge formularios. Esto excluye el
        // cancelar/anular dedicado (que exige `motivo` → tiene su propio diálogo) sin hardcodear su nombre,
        // y deja pasar recuperaciones como `reactivar`. `requiere`/`desdeEstados` pueden venir NULL del BE
        // (p. ej. reactivar.requiere=null) → coerción a arreglo antes de leer .length/.includes (sin
        // asumir el shape del BE; evita el crash "Cannot read properties of null (reading 'length')").
        (tr.formFields?.length ?? 0) === 0 &&
        !pasoKeys.has(tr.slug) &&
        ((tr.fromStatuses?.length ?? 0) === 0 || (tr.fromStatuses ?? []).includes(estadoActual)) &&
        (!tr.permissionSlug || can(tr.permissionSlug)),
    )
    .map((tr) => ({
      clave: tr.slug,
      label: tr.labelKey && tRoot.has(tr.labelKey) ? tRoot(tr.labelKey) : (t.has(tr.slug) ? t(tr.slug) : tr.slug),
      confirmar: tr.requiresConfirmation,
    }));

  // Campos requeridos por servicio (data-driven, servicio.formAcciones). Para un estado destino, los que
  // faltan por llenar en la sesión (sesion.datos[clave]) → bloquean esa transición (p. ej. áreas para asistir).
  const camposReq = ((servicio as { formActions?: { campos?: { clave: string; labelKey?: string; en?: string; requerido?: boolean }[] } } | undefined)?.formActions?.campos ?? []);
  const faltantesPara = (estado: string): string[] => {
    const datos = (sesion?.data as Record<string, unknown> | null | undefined) ?? {};
    // Un campo requerido puede vivir en la MEDICIÓN (sesion.datos[clave], p. ej. aplicadas/cantidad) o
    // en un SELECT sobre la sesión resuelto en la fila (fd_<clave>, p. ej. dosis→fd_dosis,
    // enfermera→fd_enfermera, sesiones→fd_sesiones). Se considera lleno si CUALQUIERA tiene valor.
    const lleno = (clave: string): boolean => {
      // Un select editable persiste el id en `<col>__valor` (p. ej. fd_dosis__valor); el label
      // (`fd_dosis`) puede venir null. Se considera lleno si CUALQUIER fuente tiene valor.
      const fuentes = [
        datos[clave], fila[clave], fila[`fd_${clave}`],
        fila[`${clave}__valor`], fila[`fd_${clave}__valor`],
      ];
      return fuentes.some((v) => v != null && v !== "" && v !== "—");
    };
    return camposReq
      .filter((c) => c.requerido && c.en === estado)
      .filter((c) => !lleno(c.clave))
      .map((c) => (c.labelKey && tRoot.has(c.labelKey) ? tRoot(c.labelKey) : c.clave));
  };

  // Flujo estilo AP-Board: por paso, un pill (hora si está sellado; acción si es el siguiente; punto si
  // futuro) coloreado por el estado, con la ETIQUETA del estado debajo, y conectores entre pasos.
  // Se muestra SIEMPRE, también en CANCELADA (sus sellos son historia): en cancelada no hay paso
  // accionable ni deshacer, solo se ven las horas ya selladas y puntos grises. (Regresión del commit
  // 7310358 que pintaba "—"; restaurado.)
  // Paso accionable = el SIGUIENTE según el `estado` del BE (handoff §2), NO deducido de los sellos. Se
  // ubica el estado actual en la secuencia del flujo (`flujo`, orden presente→en_terapia→asistido) y el
  // punteado va en la posición siguiente. `pasos[i]` corresponde a `flujo[i]` por construcción, así que la
  // posición sirve de índice de `pasos`. NO se usa la clave de transición de la columna para decidir el
  // siguiente: en frontdesk esas claves son reusadas de Atención ('consulta'/'atender') y no casan con las
  // claves de la definición ('en_terapia'/'asistido'); la posición por estado es la señal fiable.
  //   pendiente/'' (pre-flujo) → primer paso · asistido (último) → ninguno · cancelada → ninguno ·
  //   estado fuera del flujo (terminal desconocido) → ninguno (no ofrece 'Presente' por error).
  const curIdx = flujo.findIndex((f) => f.clave === estadoActual);
  const preFlujo = curIdx === -1 && (estadoActual === "" || estadoActual === "pendiente");
  const nextPos = cancelada ? -1 : preFlujo ? 0 : curIdx >= 0 && curIdx + 1 < flujo.length ? curIdx + 1 : -1;
  // Solo si la posición cae dentro de `pasos` (guarda ante un eventual desajuste flujo/columnas del BE).
  const nextIdx = nextPos >= 0 && nextPos < pasos.length ? nextPos : -1;
  const flujoCell = (
    <div className="flex items-start gap-0">
      {pasos.map((paso, i) => {
        const hecho = !!paso.stamp;
        const siguiente = i === nextIdx; // accionable ahora, según el estado del BE (nunca si cancelada)
        const faltan = siguiente ? faltantesPara(paso.estado) : [];
        const bloqueadoPorCampos = siguiente && faltan.length > 0;
        const esUltimoHecho = hecho && !(pasos[i + 1] && pasos[i + 1].stamp);
        const reversa = esUltimoHecho ? paso.revert : null;
        const puedeDeshacer = !!reversa && !busy && !cancelada;
        const col = paso.color ?? undefined;
        const avanzar = () => {
          if (bloqueadoPorCampos) { toast.warning(t("faltanCampos", { campos: faltan.join(", ") })); return; }
          run(() => ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action: paso.key }, centro)).then((ok) => {
            // Solo tras un avance EXITOSO se dispara el postAccion (p. ej. abrir "Programar citas"); si
            // falló, ya se mostró el toast de error y NO se simula que la acción ocurrió.
            if (ok && paso.postAccion === POSTACCION_PROGRAMAR && sesion?.patientId) {
              onProgramar({ pacienteId: sesion.patientId, pacienteNombre, servicioId: servicio?.id });
            }
          });
        };
        const deshacer = () => {
          if (!puedeDeshacer || !reversa) return;
          toast(t("deshacerPregunta", { paso: tRoot(paso.labelKey) }), {
            action: { label: t("deshacer"), onClick: () => run(() => ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action: reversa }, centro)) },
          });
        };
        return (
          <React.Fragment key={paso.key}>
            {i > 0 && <span className="mt-3 h-px w-4 shrink-0" style={{ backgroundColor: hecho && col ? col : "var(--border)" }} aria-hidden />}
            <div className="flex min-w-16 flex-col items-center gap-1">
              {hecho ? (
                <button
                  type="button"
                  disabled={!puedeDeshacer}
                  onClick={deshacer}
                  title={puedeDeshacer ? t("deshacerPregunta", { paso: tRoot(paso.labelKey) }) : tRoot(paso.labelKey)}
                  className={"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums " + (puedeDeshacer ? "cursor-pointer" : "cursor-default")}
                  style={col ? { backgroundColor: col, color: "#fff" } : undefined}
                >
                  <HugeiconsIcon icon={Tick02Icon} className="size-3" />
                  {fmtHora(paso.stamp)}
                </button>
              ) : siguiente ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={avanzar}
                  title={faltan.length > 0 ? t("faltanCampos", { campos: faltan.join(", ") }) : tRoot(paso.labelKey)}
                  className="inline-flex items-center rounded-full border-2 border-dashed px-2.5 py-1 text-[11px] font-semibold"
                  style={col ? { borderColor: col, color: col } : undefined}
                >
                  {tRoot(paso.labelKey)}
                </button>
              ) : (
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden>·</span>
              )}
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{tRoot(paso.labelKey)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <tr className={"hover:bg-muted/30 " + (cancelada ? "opacity-50" : "")}>
      {colsRender.map((item, i) =>
        item.kind === "flujo" ? (
          <td key={`flujo-${i}`} className="px-3 py-2">{flujoCell}</td>
        ) : (
          <td key={item.col.clave} className="px-3 py-2">{celda(item.col)}</td>
        ),
      )}
      <td className="px-3 py-2 text-right">
        <RowMenu
          disabled={busy}
          cancelada={cancelada}
          canReparar={canReparar}
          estados={estados}
          conHistorial={!!sesion?.patientId}
          onHistorial={() => setHistorialOpen(true)}
          reports={sesion?.patientId ? reportsAcc.map((r) => ({ id: r.id, label: r.labelKey && tRoot.has(r.labelKey) ? tRoot(r.labelKey) : (r.name ?? r.id) })) : []}
          onReport={(id) => { const r = reportsAcc.find((x) => x.id === id); if (r) setFormatoReport(r); }}
          accionesMenu={accionesMenu}
          onAccion={(clave) => run(() => ejecutarAccion({ boardSlug: tablero, entityId: fila.id, action: clave }, centro))}
          onProgramar={sesion?.patientId ? () => onProgramar({ pacienteId: sesion.patientId!, pacienteNombre, servicioId: servicio?.id }) : undefined}
          onCancelar={(motivo) => run(() => cancelarSesion(fila.id, motivo, centro))}
          onReparar={(payload) => run(() => repararSesion(fila.id, payload, centro))}
        />
        {sesion?.patientId && (
          <HistorialModal
            open={historialOpen}
            onOpenChange={setHistorialOpen}
            pacienteId={sesion.patientId}
            pacienteNombre={pacienteNombre}
            servicioId={servicio?.id}
            servicioNombre={servicio?.name}
            centro={centro}
          />
        )}
        {sesion?.patientId && (
          <ComprasModal
            open={comprasOpen}
            onOpenChange={setComprasOpen}
            pacienteId={sesion.patientId}
            pacienteNombre={pacienteNombre}
            servicioId={servicio?.id}
            servicioNombre={servicio?.name}
            fecha={fecha}
            centro={centro}
          />
        )}
        {sesion?.patientId && servicio && (
          <FormatosModal
            open={!!formatoReport}
            onOpenChange={(o) => !o && setFormatoReport(null)}
            initialReport={formatoReport ?? undefined}
            servicioNombre={servicio.name}
            formAcciones={servicio.formActions}
            pacienteNombre={pacienteNombre}
            sesionNN={fila["fd_sesiones"] != null ? String(fila["fd_sesiones"]) : undefined} servicioId={servicio?.id} pacienteId={sesion?.patientId}
            record={fila.fd_record != null ? String(fila.fd_record) : undefined}
            sesionId={fila.id} fecha={fecha}
            centro={centro}
            onHistorial={() => setHistorialOpen(true)}
          />
        )}
        {notificarCfg && sesion?.patientId && (
          <PanelNotificarModal
            open={!!notificarCfg}
            onOpenChange={(o) => !o && setNotificarCfg(null)}
            panelClave={notificarCfg.panel}
            seccion={notificarCfg.seccion}
            sesionId={fila.id}
            servicioNombre={servicio?.name ?? ""}
            pacienteNombre={pacienteNombre}
            enfermeras={optionsByCol["fd_enfermera"] ?? []}
            enfermeraActual={(() => { const raw = fila["fd_enfermera"]; const ops = optionsByCol["fd_enfermera"] ?? []; return ops.find((o) => o.value === raw || o.label === raw)?.value; })()}
            onAsignarEnfermera={(pid) => run(() => guardarCelda("fd_enfermera", pid, tRoot.has("tb.col.enfermera") ? tRoot("tb.col.enfermera") : t("enfermera")))}
            centro={centro}
          />
        )}
        {/* Cartel CENTRADO: dosis no comprada. No bloquea; dos salidas claras (§1 del handoff). */}
        <DosisAvisoDialog
          aviso={dosisAviso}
          onClose={() => setDosisAviso(null)}
          onUsarComprada={() => {
            // Volver a lo comprado: revierte el reflejo a lo que había y no escribe nada.
            const prev = dosisAviso?.prev ?? "";
            const clave = dosisAviso?.clave;
            if (clave) {
              setPendSelect((p) => {
                const n = { ...p };
                if (prev) n[clave] = prev;
                else delete n[clave];
                return n;
              });
            }
            setDosisAviso(null);
          }}
          onAplicarIgual={() => {
            const a = dosisAviso;
            setDosisAviso(null);
            if (!a) return;
            // El BE registra el descuido `dosis_no_comprada` al asistir y sale en la lista.
            run(async () => {
              try {
                return await guardarCelda(a.clave, a.valor, a.etiqueta);
              } catch (e) {
                setPendSelect((p) => {
                  const n = { ...p };
                  delete n[a.clave];
                  return n;
                });
                throw e;
              }
            });
          }}
        />
      </td>
    </tr>
  );
}
