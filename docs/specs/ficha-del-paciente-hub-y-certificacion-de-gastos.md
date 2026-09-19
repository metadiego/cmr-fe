# La ficha del paciente como centro de todo — arranque (BE listo: certificación de gastos)

El dueño quiere nuestra ficha de paciente como la de referencia
(`cmr-ehr-fe-web.vercel.app/patients/:id`): una sola pantalla que ES el paciente, con su historial
completo y todo lo que se hace con él, incluida la **Certificación de Gastos** del legado.

Spec del BE: `cmr-be/docs/specs/la-ficha-del-paciente-es-el-centro-de-todo.md`.

## Layout de la referencia (revisado con navegador real)

- Cabecera: iniciales, **Nombre · # récord**, fecha de nacimiento y sexo; acciones a la derecha.
- Banda de avisos siempre visible (alertas, alergias, implantes) — dice «Sin … conocidas» cuando no
  hay: la ausencia también es información.
- Pestañas + un botón primario a la derecha.
- Resumen = tarjeta de demográficos con **Editar** + tarjeta de última visita clicable.
- Listas simples: FECHA · TIPO · ESTADO, cada fila entra al detalle.

Nuestras pestañas: **Resumen · Citas · Terapias · Facturación · Documentos · Certificación de
gastos**.

## Lo que el BE ya sirve para cada pestaña (nada de esto hay que pedirlo)

| Pestaña | Endpoint |
|---|---|
| Resumen | `GET /patients/:id` (trae `doctorName` y `doctorClinicName`), `GET /patients/:id/remaining` |
| Citas | `GET /appointments?patientId=` — y el alta que ya usáis |
| Terapias | `GET /frontdesk/patients/:id/history`, `/agenda` |
| Facturación | `GET /invoices?patientId=`, `GET /invoices/patient-summary` (general) |
| Certificación | **nuevo**, abajo |

## Nuevo: certificación de gastos (desplegado y probado en producción)

```
GET /api/v1/facturas/certificacion-gastos?pacienteId=&desde=&hasta=[&centroId=]
GET /api/v2/invoices/expenses-certificate?patientId=&desde=&hasta=
```

Respuesta real (Bayamón, paciente con historia): 3 conceptos y **total 6.833,66**. Forma:

```json
{
  "paciente": { "id": "…", "nombre": "MIGUEL MAISONETT MARQUEZ", "record": "…", "docId": "…" },
  "desde": "2026-01-01", "hasta": "2026-12-31",
  "conceptos": [ { "clave": "consulta", "labelKey": "facturacion.grupo.consulta", "total": 20, "devoluciones": 0, "facturas": 1 } ],
  "total": 20, "devoluciones": 0,
  "cuadre": { "totalFacturas": 20, "totalDesglose": 20, "diferencia": 0, "cuadra": true }
}
```

- El **concepto es el grupo de facturación** (dato, no código): un servicio nuevo aparece solo. El
  nombre se pinta con su `labelKey`.
- **Las devoluciones ya están restadas** en cada concepto y en el total: el papel dice lo que el
  paciente gastó de verdad.
- Entran **consultas y facturación general**: es lo que pagó.
- `cuadre.cuadra === false` no debería pasar nunca; si pasa, **no se imprime**: es que el desglose no
  cuadra con las facturas.

**Del documento se encarga el FE**: «persona autorizada» y el trato Señor/Señora son campos del
papel, no datos del paciente (así es en el legado: se escriben al imprimir). El pie con la firma de
la clínica y el periodo, igual.

## Lo que falta (FE)

1. La pantalla con el layout de arriba, usando toda el ancho, con nuestro diseño.
2. Cada pestaña llama SOLO a su endpoint (nada de recomponer a mano lo que el BE ya suma).
3. Certificación: selector de rango (por defecto el año en curso), tabla de conceptos, total, y el
   botón de imprimir con los dos campos del documento.
4. RBAC: cada pestaña se pinta si su permiso lo permite (`citas.read`, `factura.read`,
   `frontdesk.read`); la certificación con `factura.read`.
