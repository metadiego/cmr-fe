import { CuadreCaja } from "@/components/caja/cuadre-caja";

// Caja / Cuadre — separa Consulta y General (sin mezclar) y opera por cajero, con consolidado de
// gerencia. Toda la lógica vive en el cliente (gate de centro + RBAC); ver la spec del FE.
export default function CajaPage() {
  return <CuadreCaja />;
}
