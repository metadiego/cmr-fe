# Handoff FE — donde salga un paciente, sale su RÉCORD (ya en producción)

**Origen**: el dueño, 29-sep-2026, sobre `/scheduling/appointments/2026-10-01?tab=servicios`:
*«en la lista de los pacientes agrega el número de récord; es de suma importancia que en TODO lugar
donde se muestre un paciente, porque con ese número más el nombre es muy fácil identificar»*.

## Lo que ya podéis leer, sin pedir nada nuevo

**Toda** respuesta del API que lleve un `patientId` trae ahora, a su lado, la ficha mínima:

```json
{ "id": "04e4b4fe-…",
  "patientId": "6154a1be-…",
  "time": "07:00",
  "patient": { "id": "6154a1be-…",
               "medicalRecordNumber": "80909",
               "name": "LETICIA REXACH SANTIAGO" } }
```

- En `/api/v2`: **`patient.medicalRecordNumber`** y **`patient.name`** (el glosario ya tenía esas
  palabras; no se inventó ninguna).
- En v1 el bloque se llama `paciente`, con `record` y `nombre`.

**No hace falta cambiar ninguna llamada.** Se resuelve en el borde de la respuesta, igual que el
sobre `{ data, meta }`: los endpoints no cambiaron, ni sus parámetros, ni sus campos. Esto **suma**.

## Verificado en producción (29-sep, tras desplegar)

`GET /api/v2/frontdesk/sessions?desde=2026-10-01&hasta=2026-10-01` — la lista que lo motivó:

```
07:00 · 80909  · LETICIA REXACH SANTIAGO
07:00 · 102128 · NAZARIO GONZALEZ MERCADO
07:00 · 83160  · ESTEBAN LOPEZ SANCHEZ
07:00 · 102799 · CARMEN VEGA VEGA
08:00 · 102700 · GUILLERMINA AVILES OLIVERA
```

Y en **citas médicas**, que nadie tocó, `GET /api/v2/appointments?desde=2026-10-01`:

```
89759 · IRIS CRUZ RIVERA
81259 · JOSE ANTONIO CRESPO JIMENEZ
```

Esa es la gracia: **una pantalla nueva sale con el récord desde el primer día**, sin que nadie se
acuerde de añadirlo.

## Lo que hace falta del FE

1. **Enseñar el récord junto al nombre** donde hoy sale solo el nombre (o solo el id). Empezando por
   la vista de día de citas de servicio, que es la que lo motivó, y siguiendo por el resto:
   listados, modales, buscadores, impresiones.
2. **Dejar de pedir el paciente por separado** donde lo estuvierais haciendo fila a fila para sacar
   el nombre: ya viene en la misma respuesta, y eso quita una petición por fila.

## Dos cosas que hay que saber

- **`patient` puede venir `null`**: paciente borrado, o de otro centro (la ficha se busca dentro del
  centro activo, nunca se sirve la de un paciente ajeno). Pintadlo como «—», nunca reventéis.
- **`medicalRecordNumber` puede venir `null` con el nombre resuelto.** No es un fallo del API: son
  fichas que en NUESTRA base no tienen número de récord. En la lista del 1-oct son **5 de 29**:
  ALMA RODRIGUEZ CRUZ, JUAN ROLDAN HERNANDEZ, JUAN RIVERA MARCANO, IRMA RAMOS NIEVES y DIGNA REYES
  PACHE. Es un hueco de DATOS, y está avisado aparte al dueño; el FE solo tiene que tolerarlo.
