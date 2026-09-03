import { GruposAdmin } from "@/components/facturacion/grupos-admin";

// Administración de Grupos de facturación (crear/editar + membresía de productos). Toda la lógica
// vive en el cliente (RBAC cosmético + gate). See docs/specs/fe-grupos-facturacion-admin-handoff.md.
export default function GruposFacturacionPage() {
  return <GruposAdmin />;
}
