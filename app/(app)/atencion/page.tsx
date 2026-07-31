import { redirect } from "next/navigation";

// Alias de retrocompatibilidad: el vertical de Atención al Paciente vive en /tablero/atencion (clave
// `atencion` del motor de tableros, que es lo que sirve el menú del BE). Esta ruta /atencion ya NO
// aparece en el menú (se quitó del manifiesto); se conserva solo por si alguien tiene la URL guardada,
// redirigiendo al destino correcto. Antes redirigía a /tablero/citas, un tablero que no existe.
export default function AtencionPage() {
  redirect("/tablero/atencion");
}
