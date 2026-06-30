"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import {
  listCitas,
  getTiposCita,
  ESTADOS,
  type Cita,
  type TipoCita,
  type EstadoCita,
} from "@/lib/api/citas";
import { getMedicos, type Personal } from "@/lib/api/personal";
import { getPaciente, type Paciente } from "@/lib/api/pacientes";
import { useResource, type ResourceState } from "@/hooks/use-resource";
import type { Paginated } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Can } from "@/components/kit/can";
import { CitaFormSheet } from "@/components/citas/cita-form-sheet";
import { CitaActions } from "@/components/citas/cita-actions";
import { CitaBoard } from "@/components/citas/cita-board";

const ALL = "__all__";

// Dot color per appointment state, for a quick visual scan of the agenda.
const ESTADO_COLOR: Record<EstadoCita, string> = {
  programada: "bg-slate-400",
  confirmada: "bg-blue-500",
  presente: "bg-amber-500",
  triage: "bg-violet-500",
  en_consulta: "bg-indigo-500",
  atendida: "bg-emerald-500",
  no_show: "bg-rose-500",
  cancelada: "bg-zinc-400",
  reprogramada: "bg-orange-500",
};

function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function CitasPage() {
  const t = useTranslations("appointments");
  const [fecha, setFecha] = React.useState(todayISO);
  const [estado, setEstado] = React.useState<string>(ALL);
  const [medico, setMedico] = React.useState<string>(ALL);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [view, setView] = React.useState<"list" | "board">("list");

  // Reference data (small, loaded once) to resolve ids → names.
  const tiposRes = useResource<TipoCita[]>(() => getTiposCita());
  const medicosRes = useResource<Personal[]>(() => getMedicos());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  const tipoName = (id: string) => tipos.find((x) => x.id === id)?.nombre ?? "—";
  const medicoName = (id: string | null) => {
    const m = medicos.find((x) => x.id === id);
    return m ? [m.nombre, m.apellido].filter(Boolean).join(" ") : "—";
  };

  const { state, reload } = useResource<Paginated<Cita>>(
    () =>
      listCitas({
        fecha,
        estado: estado === ALL ? undefined : (estado as EstadoCita),
        medicoId: medico === ALL ? undefined : medico,
      }),
    [fecha, estado, medico],
  );

  // Realtime (interim): poll every 15s. SSE (/citas/stream) is pending BE
  // header-less auth (native EventSource can't send the Bearer token).
  React.useEffect(() => {
    const id = setInterval(reload, 15000);
    return () => clearInterval(id);
  }, [reload]);

  const citas = state.kind === "ok" ? state.data.items : [];
  // Resolve patient names for the day's appointments (the list only has ids).
  const pacientes = usePacienteMap(citas.map((c) => c.pacienteId));
  const pacienteName = (id: string) => {
    const p = pacientes[id];
    return p ? [p.nombres, p.apellidos].filter(Boolean).join(" ") : "…";
  };

  // Sort by time (nulls last) for the agenda view.
  const rows: ResourceState<Cita[]> =
    state.kind === "ok"
      ? {
          kind: "ok",
          data: [...citas].sort((a, b) =>
            (a.hora ?? "99").localeCompare(b.hora ?? "99"),
          ),
        }
      : state;

  const columns: Column<Cita>[] = [
    {
      key: "hora",
      header: t("columns.time"),
      cell: (c) => <span className="font-mono">{c.hora ?? "—"}</span>,
    },
    {
      key: "patient",
      header: t("columns.patient"),
      cell: (c) => <span className="font-medium">{pacienteName(c.pacienteId)}</span>,
    },
    { key: "type", header: t("columns.type"), cell: (c) => tipoName(c.tipoCitaId) },
    { key: "doctor", header: t("columns.doctor"), cell: (c) => medicoName(c.medicoId) },
    {
      key: "estado",
      header: t("columns.status"),
      cell: (c) => (
        <span className="inline-flex items-center gap-2">
          <span className={`size-2 rounded-full ${ESTADO_COLOR[c.estado]}`} />
          {t(`estados.${c.estado}`)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (c) => <CitaActions cita={c} onChanged={reload} />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Can permiso="citas.create">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        </Can>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 inline-flex rounded-md border p-0.5">
            <Button
              size="sm"
              variant={view === "list" ? "secondary" : "ghost"}
              onClick={() => setView("list")}
            >
              {t("viewList")}
            </Button>
            <Button
              size="sm"
              variant={view === "board" ? "secondary" : "ghost"}
              onClick={() => setView("board")}
            >
              {t("viewBoard")}
            </Button>
          </div>
          <Input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-auto"
          />
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t("filterState")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStates")}</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`estados.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={medico} onValueChange={setMedico}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("filterDoctor")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allDoctors")}</SelectItem>
              {medicos.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {[m.nombre, m.apellido].filter(Boolean).join(" ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {view === "list" ? (
          <DataTable
            columns={columns}
            state={rows}
            getRowKey={(c) => c.id}
            onReload={reload}
            labels={{ empty: t("empty") }}
          />
        ) : state.kind === "fail" ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : (
          <CitaBoard
            citas={citas}
            pacienteName={pacienteName}
            tipoName={tipoName}
            medicoName={medicoName}
            onChanged={reload}
          />
        )}
      </div>

      <CitaFormSheet
        open={createOpen}
        defaultFecha={fecha}
        onOpenChange={setCreateOpen}
        onSaved={() => reload()}
      />
    </div>
  );
}

// Resolves a set of patient ids → Paciente, fetched in parallel and cached by
// the id set. The citas list only carries ids, so we hydrate names here.
function usePacienteMap(ids: string[]): Record<string, Paciente> {
  const unique = Array.from(new Set(ids)).sort();
  const key = unique.join(",");
  const { state } = useResource<Record<string, Paciente>>(async () => {
    if (unique.length === 0) return {};
    const list = await Promise.all(
      unique.map((id) => getPaciente(id).catch(() => null)),
    );
    const map: Record<string, Paciente> = {};
    for (const p of list) if (p) map[p.id] = p;
    return map;
  }, [key]);
  return state.kind === "ok" ? state.data : {};
}
