# Handoff FE → BE: hoja de enfermería BPC-157 llenada en el iPad

Pedido del dueño (24-nov-2026): la «Hoja de enfermería BPC-157 — registro de aplicación y
seguimiento» se llena en el iPad desde el panel de enfermería, **igual que la de GLP-1** (cmr-be #658,
#659, #660, #665). Foto del papel: `.personal/formatos-legacy/WhatsApp Image 2026-11-24 at 9.11.16 AM.jpeg`.

## Lo verificado (24-nov-2026)

- El formato `bpc157_enfermeria` ya existe en `src/scripts/datos/formatos/arquetipo-5-listas-de-cotejo.ts`
  (origin/main de cmr-be) y **coincide con el papel**: campos paciente, record, fecha, hora,
  n.º de aplicación/dosis, cantidad (mL), sitio, tratamiento recurrente; 5 grupos y 11 preguntas;
  «Comentarios del paciente», «Observaciones de enfermería», firmas y leyenda.
- Prod, `GET /api/v2/formats`: `bpc157_enfermeria fillable=false` y `glp1_adherencia fillable=true`.
- Prod, `GET /api/v2/services`: el servicio «BPC» ya declara el report `bpc157_enfermeria` en `formActions`.
- El FE es genérico (`fillableSlugsFrom`, `fillableReportsFor`, `SheetEditor`): en cuanto el BE
  devuelva `fillable=true`, la hoja aparece en el panel de enfermería sin tocar el FE, salvo el punto 3.

## Lo que falta en el BE

1. **Hacerla llenable**, como en `glp1_adherencia`: que `FIRMAS` lleve `origen: 'answers.nurse'` y
   `'answers.recordedAt'`, y que los campos a mano se impriman con lo guardado.
2. **Sugerencias**, todas editables en el iPad. Las fuentes las deciden ustedes; esto es una propuesta:
   - `hora` → la hora de la visita;
   - n.º de aplicación → `session.serviceVisitNumber`;
   - `cantidad` → la dosis de la visita (`session.lastDose`), si viene en mL;
   - `recurrente` → `null` salvo que exista una fuente real;
   - `sitio` → sin sugerencia.
3. **Dos textos libres, no uno.** El contrato de GLP-1 tiene un solo `additionalNotes`, y esta hoja
   tiene dos: «Comentarios del paciente» y «Observaciones de enfermería». Proponemos que cada
   sección `OBSERVACIONES` tenga una clave y que el body lleve `notes: [{ key, value }]`, con su
   etiqueta tomada del formato. `additionalNotes` se mantiene por compatibilidad con GLP-1.
   Decidan ustedes y avisen: el FE adapta el editor (hoy la etiqueta del área es fija).
4. **Panel de enfermería:** confirmar que las visitas BPC llegan al panel (sección o
   `selfClaim`), igual que GLP-1, Vitales e IV.

Permisos, centro (`X-Tenant-ID` + `centerIds`), auditoría y comentarios en DB: igual que en #658.
