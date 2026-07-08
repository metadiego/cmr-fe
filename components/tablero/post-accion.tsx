"use client";

import * as React from "react";

import type { CitaFila } from "@/lib/api/agenda-dia";
import { NuevaCitaModal } from "./nueva-cita-modal";

// Props que recibe cualquier modal de "post-acción".
export interface PostAccionProps {
  tablero: string;
  fila: CitaFila;
  centroId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

// Registro GENÉRICO postAccion → modal. El motor (FlujoAtencion) lee
// `columna.render.postAccion` tras ejecutar la transición y enruta por VALOR a
// este registro. Otros tableros (servicios/frontdesk) registran su propia clave
// aquí sin tocar el engine. NO hardcodear "asistido → modal".
const REGISTRY: Record<string, React.ComponentType<PostAccionProps>> = {
  nueva_cita_prescripcion: NuevaCitaModal,
};

export function PostAccionHost({
  postAccion,
  ...props
}: { postAccion: string } & PostAccionProps) {
  const Comp = REGISTRY[postAccion];
  if (!Comp) return null;
  return <Comp {...props} />;
}
