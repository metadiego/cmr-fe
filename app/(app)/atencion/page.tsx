import { redirect } from "next/navigation";

// Back-compat alias: Atención al Paciente = the "citas" vertical of the generic
// board. Once the BE menu points to /tablero/citas this alias is unused.
export default function AtencionPage() {
  redirect("/tablero/citas");
}
