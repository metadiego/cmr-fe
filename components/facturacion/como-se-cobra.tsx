"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getColumnasDeGrupo,
  crearColumnaFacturacion,
  actualizarColumnaFacturacion,
  ROLES_DE_FABRICA,
  type ColumnaFacturacion,
  type GrupoFacturacion,
} from "@/lib/api/grupos-facturacion";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Precio ilustrativo para el ejemplo en vivo del interruptor "¿multiplica?" — no es de ningún
// producto real, solo pedagógico (ver FE-HANDOFF-MULTIPLICADOR-GRUPOS-FACTURACION).
const PRECIO_EJEMPLO = 70;

const TIPOS_EXTRA = [
  { value: "numero", emoji: "🔢" },
  { value: "texto", emoji: "🔤" },
  { value: "select", emoji: "📋" },
] as const;

function esFabrica(rol: string): boolean {
  return (ROLES_DE_FABRICA as readonly string[]).includes(rol);
}

// Clave única (slug) a partir del nombre libre que tipea el admin, sin pisar claves existentes.
function uniqueClave(nombre: string, existentes: Set<string>): string {
  const base =
    nombre
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "campo";
  let clave = base;
  let n = 2;
  while (existentes.has(clave)) clave = `${base}_${n++}`;
  return clave;
}

// Pestaña "Cómo se cobra" de un grupo de facturación: qué campos extra se preguntan al facturar y
// cuáles multiplican el precio (rol 'multiplicador' vs 'informativo'). Sin vocabulario técnico —
// un admin sin contexto tiene que entenderla mirándola. Ver FE-HANDOFF-MULTIPLICADOR-GRUPOS-FACTURACION.
export function ComoSeCobra({
  grupo,
  grupos,
  label,
}: {
  grupo: GrupoFacturacion;
  grupos: GrupoFacturacion[];
  label: (labelKey: string, fallback: string) => string;
}) {
  const t = useTranslations("gruposFacturacion");
  const { state, reload } = useResource<ColumnaFacturacion[]>(
    () => getColumnasDeGrupo(grupo.clave),
    [grupo.clave],
  );
  const columnas = state.kind === "ok" ? state.data : [];
  const deFabrica = columnas.filter((c) => esFabrica(c.rol) && c.activo);
  const extra = columnas.filter((c) => !esFabrica(c.rol) && c.activo);

  const [toDelete, setToDelete] = React.useState<ColumnaFacturacion | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [copyFrom, setCopyFrom] = React.useState("");
  const [copying, setCopying] = React.useState(false);

  async function toggleMultiplica(col: ColumnaFacturacion, multiplica: boolean) {
    try {
      await actualizarColumnaFacturacion(col.id, {
        rol: multiplica ? "multiplicador" : "informativo",
      });
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function renombrar(col: ColumnaFacturacion, nombre: string) {
    const nuevo = nombre.trim();
    if (!nuevo || nuevo === col.labelKey) return;
    try {
      await actualizarColumnaFacturacion(col.id, { labelKey: nuevo });
      toast.success(t("fieldUpdated"));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function confirmarQuitar() {
    if (!toDelete) return;
    const col = toDelete;
    setToDelete(null);
    try {
      await actualizarColumnaFacturacion(col.id, { activo: false });
      toast.success(t("fieldRemoved"));
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function copiarDeGrupo() {
    if (!copyFrom) return;
    setCopying(true);
    try {
      const origenColumnas = await getColumnasDeGrupo(copyFrom);
      const origenExtra = origenColumnas.filter((c) => !esFabrica(c.rol) && c.activo);
      const clavesActuales = new Set(extra.map((c) => c.clave));
      const aCrear = origenExtra.filter((c) => !clavesActuales.has(c.clave));
      const origenLabel = label(
        grupos.find((g) => g.clave === copyFrom)?.labelKey ?? "",
        copyFrom,
      );
      if (aCrear.length === 0) {
        toast.message(t("copyNone", { origen: origenLabel }));
        return;
      }
      let ok = 0;
      for (const c of aCrear) {
        try {
          await crearColumnaFacturacion({
            grupoClave: grupo.clave,
            clave: c.clave,
            labelKey: c.labelKey,
            tipo: c.tipo,
            rol: c.rol,
            orden: c.orden,
            requerido: c.requerido,
            visible: c.visible,
          });
          ok++;
        } catch {
          // sigue con el resto de campos; el total copiado se reporta al final.
        }
      }
      toast.success(t("copyDone", { n: ok, origen: origenLabel }));
      setCopyFrom("");
      reload();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCopying(false);
    }
  }

  if (state.kind === "loading") {
    return <p className="p-4 text-sm text-muted-foreground">…</p>;
  }
  if (state.kind === "fail") {
    return <p className="p-4 text-sm text-destructive">{state.message}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3">
        <Select value={copyFrom} onValueChange={setCopyFrom}>
          <SelectTrigger className="h-9 w-60">
            <SelectValue placeholder={t("copyFromPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {grupos
              .filter((g) => g.clave !== grupo.clave)
              .map((g) => (
                <SelectItem key={g.id} value={g.clave}>
                  {label(g.labelKey, g.clave)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={copiarDeGrupo} disabled={!copyFrom || copying}>
          {t("copyFrom")}
        </Button>
      </div>

      {extra.length === 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning px-3 py-2 text-sm text-warning-foreground">
          ⚠️ {t("extraEmptyWarning")}
        </p>
      )}

      <div className="space-y-2">
        {extra.map((c) => (
          <CampoExtra
            key={`${c.id}:${c.labelKey}`}
            col={c}
            label={label}
            onToggle={toggleMultiplica}
            onRename={renombrar}
            onRemove={() => setToDelete(c)}
          />
        ))}
      </div>

      <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
        {t("addField")}
      </Button>

      <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{t("fabricaTitle")}</p>
        <div className="flex flex-wrap gap-1.5">
          {deFabrica.map((c) => (
            <span
              key={c.id}
              className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {label(c.labelKey, c.clave)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("fabricaHelp")}</p>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeFieldTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeFieldBody", {
                nombre: toDelete ? label(toDelete.labelKey, toDelete.clave) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarQuitar}>{t("removeField")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {creating && (
        <NuevoCampoDialog
          existentes={new Set(columnas.map((c) => c.clave))}
          grupoClave={grupo.clave}
          orden={columnas.length}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function CampoExtra({
  col,
  label,
  onToggle,
  onRename,
  onRemove,
}: {
  col: ColumnaFacturacion;
  label: (labelKey: string, fallback: string) => string;
  onToggle: (col: ColumnaFacturacion, multiplica: boolean) => void;
  onRename: (col: ColumnaFacturacion, nombre: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("gruposFacturacion");
  const [nombre, setNombre] = React.useState(label(col.labelKey, col.clave));
  const [prueba, setPrueba] = React.useState(2);
  const multiplica = col.rol === "multiplicador";

  return (
    <div className="space-y-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3">
      <div className="flex items-center justify-between gap-3">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => onRename(col, nombre)}
          className="h-9 max-w-xs font-medium"
        />
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
          {t("removeField")}
        </Button>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={multiplica} onCheckedChange={(v) => onToggle(col, v === true)} />
        <span>🔢 {t("multiplicaQuestion")}</span>
      </label>
      {multiplica ? (
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{t("tryWith")}</span>
            <Input
              type="number"
              min={1}
              value={prueba}
              onChange={(e) => setPrueba(Math.max(1, Number(e.target.value) || 1))}
              className="h-7 w-16 px-2 text-center"
            />
          </div>
          <p className="text-sm text-foreground">
            {t("multiplicaEjemplo", {
              precio: PRECIO_EJEMPLO,
              n: prueba,
              total: PRECIO_EJEMPLO * prueba,
            })}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t("informativoHint")}</p>
      )}
    </div>
  );
}

function NuevoCampoDialog({
  existentes,
  grupoClave,
  orden,
  onClose,
  onCreated,
}: {
  existentes: Set<string>;
  grupoClave: string;
  orden: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("gruposFacturacion");
  const [nombre, setNombre] = React.useState("");
  const [tipo, setTipo] = React.useState<(typeof TIPOS_EXTRA)[number]["value"]>("numero");
  const [multiplica, setMultiplica] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  async function crear() {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      await crearColumnaFacturacion({
        grupoClave,
        clave: uniqueClave(nombre, existentes),
        labelKey: nombre.trim(),
        tipo,
        rol: multiplica ? "multiplicador" : "informativo",
        orden,
      });
      toast.success(t("fieldAdded"));
      onCreated();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addFieldTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("fieldNameLabel")}</Label>
            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("fieldNamePlaceholder")}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("fieldTypeLabel")}</Label>
            <div className="flex gap-2">
              {TIPOS_EXTRA.map((op) => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setTipo(op.value)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                    tipo === op.value ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40",
                  )}
                >
                  <span className="mr-1.5">{op.emoji}</span>
                  {t(`fieldType_${op.value}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={multiplica} onCheckedChange={(v) => setMultiplica(v === true)} />
            <span>🔢 {t("multiplicaQuestion")}</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={crear} disabled={saving || !nombre.trim()}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
