// Resolución PURA de las banderas de prioridad del paciente (oxígeno, silla de ruedas…): el BE
// guarda `icon`/`color` como claves libres de texto y el FE decide a qué ícono/clase se traducen —
// agregar una bandera nueva = una línea en cada mapa. Ver docs/specs/alertas-de-prioridad-del-paciente.md
// en cmr-be y HANDOFF-banderas-de-prioridad-del-paciente.md.
import {
  LungsIcon,
  WheelchairIcon,
  EarIcon,
  EyeIcon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";

export type PriorityFlagIconObj = typeof LungsIcon;

// `name` es la clave que persiste `priority_flag_types.icon`. NO renombrar las existentes.
const ICONS: Record<string, PriorityFlagIconObj> = {
  oxygen: LungsIcon,
  wheelchair: WheelchairIcon,
  ear: EarIcon,
  eye: EyeIcon,
};

// Sin ícono conocido (o ninguno): un genérico de alerta, nunca una celda vacía — una bandera de
// prioridad sin ícono reconocible sigue siendo una bandera que alguien debe ver.
export function resolvePriorityFlagIcon(icon?: string | null): PriorityFlagIconObj {
  return (icon && ICONS[icon]) || Alert02Icon;
}

// Claves disponibles para el selector del admin del catálogo (Configuración → Prioridades).
export const PRIORITY_FLAG_ICON_KEYS: string[] = Object.keys(ICONS);

export const PRIORITY_FLAG_COLOR_KEYS: string[] = ["green", "amber", "red", "blue", "violet", "gray"];

// `color` es una clave SEMÁNTICA (green/amber/red/blue/violet/gray), no un hex — el BE la define
// así a propósito para que cada cliente la traduzca a su paleta. bg/text/ring de un solo golpe.
const COLOR_CLASSES: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 ring-emerald-600/20 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-600/20 dark:text-amber-400",
  red: "bg-destructive/15 text-destructive ring-destructive/20",
  blue: "bg-blue-500/15 text-blue-700 ring-blue-600/20 dark:text-blue-400",
  violet: "bg-violet-500/15 text-violet-700 ring-violet-600/20 dark:text-violet-400",
  gray: "bg-muted text-muted-foreground ring-foreground/10",
};

export function resolvePriorityFlagColorClass(color?: string | null): string {
  return (color && COLOR_CLASSES[color]) || COLOR_CLASSES.gray;
}
