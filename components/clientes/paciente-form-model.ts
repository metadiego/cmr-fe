import type { Paciente, CreatePacientePayload } from "@/lib/api/pacientes";
import { ApiError } from "@/lib/api/types";

// Modelo PURO del formulario de paciente: el estado de trabajo y sus mapeos a/desde el API.
// Extraído de paciente-form-sheet.tsx para bajarlo del techo de tamaño (max-lines) y poder
// marcar en el formulario los campos que el BE rechaza. Handoff alta-de-paciente-mostrar-el-error.

export type Sexo = NonNullable<Paciente["sex"]>;
// Runtime whitelist of the values the BE accepts on write. Legacy patients still hold codes like
// "0"/"1" (the BE v2 backfill has NOT run yet); those are coerced to "" on load so a plain edit
// never re-submits an invalid value → avoids a 400. See docs/plans/pacientes-v2-migracion-fe.md.
export const SEXO_VALUES: readonly Sexo[] = [
  "femenino",
  "masculino",
  "otro",
  "desconocido",
];

// Editable fields (the form's working state). Strings throughout; trimmed and pruned to the API
// payload on submit.
export type FormState = {
  nombres: string;
  apellidos: string;
  docId: string;
  sexo: "" | Sexo;
  fechaNacimiento: string;
  nacionalidad: string;
  telefono: string;
  whatsapp: string;
  email: string;
  direccion: string;
  zipcode: string;
  record: string;
  aseguradora: string;
  medicoId: string; // médico del paciente (doctorId); se asigna/cambia aquí y el walk-in lo trae de aquí.
};

export const EMPTY: FormState = {
  nombres: "",
  apellidos: "",
  docId: "",
  sexo: "",
  fechaNacimiento: "",
  nacionalidad: "",
  telefono: "",
  whatsapp: "",
  email: "",
  direccion: "",
  zipcode: "",
  record: "",
  aseguradora: "",
  medicoId: "",
};

export function fromPaciente(p: Paciente): FormState {
  return {
    nombres: p.firstName ?? "",
    apellidos: p.lastName ?? "",
    docId: p.documentId ?? "",
    sexo: SEXO_VALUES.includes(p.sex as Sexo) ? (p.sex as Sexo) : "",
    fechaNacimiento: p.dateOfBirth?.slice(0, 10) ?? "",
    nacionalidad: p.nationality ?? "",
    telefono: p.phone ?? "",
    whatsapp: p.whatsapp ?? "",
    email: p.email ?? "",
    direccion: p.address ?? "",
    zipcode: p.zipCode ?? "",
    record: p.medicalRecordNumber ?? "",
    aseguradora: p.insurer ?? "",
    medicoId: p.doctorId ?? "",
  };
}

// Drop empty strings so optional fields aren't sent as "".
export function toPayload(f: FormState): CreatePacientePayload {
  const t = (s: string) => (s.trim() ? s.trim() : undefined);
  return {
    firstName: f.nombres.trim(),
    lastName: t(f.apellidos),
    documentId: t(f.docId),
    sex: f.sexo || undefined,
    dateOfBirth: t(f.fechaNacimiento),
    nationality: t(f.nacionalidad),
    phone: t(f.telefono),
    whatsapp: t(f.whatsapp),
    email: t(f.email),
    address: t(f.direccion),
    zipCode: t(f.zipcode),
    medicalRecordNumber: t(f.record),
    insurer: t(f.aseguradora),
    doctorId: t(f.medicoId),
  };
}

// Clave del API (v2 en inglés, y algún alias en español que aún pueda venir en un error) → campo del
// formulario, para marcar en rojo el que el BE rechazó (`error.details`, p. ej. "property lastName ...").
const API_TO_FIELD: Record<string, keyof FormState> = {
  firstname: "nombres",
  nombres: "nombres",
  lastname: "apellidos",
  apellido: "apellidos",
  apellidos: "apellidos",
  documentid: "docId",
  docid: "docId",
  sex: "sexo",
  sexo: "sexo",
  dateofbirth: "fechaNacimiento",
  fechanacimiento: "fechaNacimiento",
  nationality: "nacionalidad",
  nacionalidad: "nacionalidad",
  phone: "telefono",
  telefono: "telefono",
  whatsapp: "whatsapp",
  email: "email",
  address: "direccion",
  direccion: "direccion",
  zipcode: "zipcode",
  zip: "zipcode",
  medicalrecordnumber: "record",
  record: "record",
  insurer: "aseguradora",
  aseguradora: "aseguradora",
  doctorid: "medicoId",
  medicoid: "medicoId",
};

// Extrae de un error 400 (`error.details`) los campos del formulario a marcar. Usa `field` si viene;
// si no, saca el nombre de mensajes tipo "property lastName should not exist".
export function camposDeError(err: unknown): (keyof FormState)[] {
  if (!(err instanceof ApiError) || !err.details?.length) return [];
  const out = new Set<keyof FormState>();
  for (const d of err.details) {
    const raw = d.field ?? d.message.match(/property (\w+)/)?.[1];
    const campo = raw ? API_TO_FIELD[raw.toLowerCase()] : undefined;
    if (campo) out.add(campo);
  }
  return [...out];
}
