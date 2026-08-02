// Registro CURADO de iconos para el menú (nombre estable ↔ icono HugeIcons). El BE guarda el
// `icon` como texto (el nombre de esta lista); el FE lo resuelve aquí. Agregar un icono = una línea.
import {
  Home01Icon,
  Calendar03Icon,
  UserGroupIcon,
  UserMultipleIcon,
  DollarCircleIcon,
  Invoice01Icon,
  Calculator01Icon,
  PackageIcon,
  Store01Icon,
  ShoppingCart01Icon,
  Tag01Icon,
  Settings02Icon,
  DashboardSquare01Icon,
  Stethoscope02Icon,
  TestTube01Icon,
  Medicine01Icon,
  ChartLineData01Icon,
  Notification01Icon,
  File01Icon,
  Folder01Icon,
} from "@hugeicons/core-free-icons";

export type MenuIconObj = typeof Home01Icon;

// El `name` es la clave que se persiste en `menu_items.icon`. NO renombrar los existentes.
export const MENU_ICONS: { name: string; icon: MenuIconObj }[] = [
  { name: "home", icon: Home01Icon },
  { name: "calendar", icon: Calendar03Icon },
  { name: "users", icon: UserGroupIcon },
  { name: "patients", icon: UserMultipleIcon },
  { name: "money", icon: DollarCircleIcon },
  { name: "invoice", icon: Invoice01Icon },
  { name: "calculator", icon: Calculator01Icon },
  { name: "package", icon: PackageIcon },
  { name: "store", icon: Store01Icon },
  { name: "cart", icon: ShoppingCart01Icon },
  { name: "tag", icon: Tag01Icon },
  { name: "settings", icon: Settings02Icon },
  { name: "dashboard", icon: DashboardSquare01Icon },
  { name: "stethoscope", icon: Stethoscope02Icon },
  { name: "lab", icon: TestTube01Icon },
  { name: "medicine", icon: Medicine01Icon },
  { name: "chart", icon: ChartLineData01Icon },
  { name: "bell", icon: Notification01Icon },
  { name: "file", icon: File01Icon },
  { name: "folder", icon: Folder01Icon },
];

const MAP: Record<string, MenuIconObj> = Object.fromEntries(
  MENU_ICONS.map((i) => [i.name, i.icon]),
);

// Resuelve el nombre guardado a su icono; null si no hay nombre o no está en el catálogo.
export function resolveMenuIcon(name?: string | null): MenuIconObj | null {
  return name ? MAP[name] ?? null : null;
}
