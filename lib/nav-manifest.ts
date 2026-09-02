// Manifiesto de rutas reales de la app. Durante el desarrollo queremos TODO a mano en el menú
// sin depender de que cada página esté registrada en el menú del BE (que es RBAC-driven y se
// organiza después). El header fusiona esto con el menú del BE, deduplicando por `path`; los
// items del BE mandan (traen su permiso/orden). Estos son el "catch-all" para no perder páginas.
// Al agregar una página nueva, añade su ruta aquí. `labelKey` = clave i18n completa.
export interface NavRoute {
  path: string;
  labelKey: string;
}

export const NAV_MANIFEST: NavRoute[] = [
  { path: "/dashboard", labelKey: "nav.dashboard" },
  // Citas → Scheduling (route-reorg Phase 1)
  { path: "/scheduling/appointments", labelKey: "nav.citas" },
  { path: "/personal", labelKey: "nav.personal" },
  { path: "/scheduling/calendar", labelKey: "nav.calendario" },
  { path: "/scheduling/slots", labelKey: "nav.cupos" },
  // Board-column config rides here on an interim path; Phase 1 configuration moves it to /configuration/boards/columns.
  { path: "/scheduling/appointments/config/columnas", labelKey: "nav.columnasCitas" },
  // "Frontdesk" (/tablero/frontdesk) y "Atención" (/tablero/atencion) los sirve el BE en /me/menu; NO se
  // declaran aquí. Tampoco `/tablero/citas` (tablero inexistente) ni `/atencion` (alias): duplicaban ítems.
  // Clientes → Patients (route-reorg Phase 1)
  { path: "/patients", labelKey: "nav.clientes" },
  { path: "/patients/legacy-availability", labelKey: "nav.dispLegado" },
  { path: "/patients/protocol-change", labelKey: "nav.cambioProtocolo" },
  { path: "/patients/legacy-availability/preparation", labelKey: "nav.preparacionLegado" },
  // Comunicaciones
  { path: "/comunicaciones", labelKey: "nav.comunicaciones" },
  // Facturación → Billing (route-reorg Phase 1)
  { path: "/billing/invoices", labelKey: "nav.facturacion" },
  { path: "/billing/invoices/new", labelKey: "nav.facturacion_general" },
  { path: "/billing/groups", labelKey: "nav.gruposFacturacion" },
  { path: "/billing/returns", labelKey: "nav.devoluciones" },
  { path: "/reports/supply-consumption", labelKey: "nav.consumoInsumos" },
  { path: "/reports/sales-by-group", labelKey: "nav.ventasPorGrupo" },
  { path: "/reports/sales-by-user", labelKey: "nav.ventasPorUsuario" },
  { path: "/billing/consultations", labelKey: "nav.facturacionConsultas" },
  { path: "/billing/consultations/returns", labelKey: "nav.devolucionesConsultas" },
  // Estadísticas (el BE ya siembra el ítem en /me/menu; aquí para dedup/manifiesto)
  { path: "/estadisticas/servicios", labelKey: "nav.estadisticas_servicios" },
  { path: "/estadisticas/diarias", labelKey: "nav.estadisticas_diarias" },
  // Cuadre de caja — destinos SEPARADOS por división (no mezclar). Tienen UI → "En desarrollo".
  { path: "/billing/cash/consultation", labelKey: "nav.cajaConsultas" },
  { path: "/billing/cash/general", labelKey: "nav.cajaGeneral" },
  { path: "/billing/cash/summary", labelKey: "nav.cuadreGeneral" },
  // Inventario → Inventory (route-reorg Phase 1)
  { path: "/inventory", labelKey: "nav.inventario" },
  { path: "/inventory/stock", labelKey: "nav.inventario_existencias" },
  { path: "/inventory/vials", labelKey: "nav.inventario_viales" },
  { path: "/inventory/products", labelKey: "nav.productos" },
  { path: "/inventory/suppliers", labelKey: "nav.proveedores" },
  { path: "/inventory/supplier-presentations", labelKey: "nav.presentaciones" },
  { path: "/inventory/receive-purchase", labelKey: "nav.recibirCompra" },
  { path: "/inventory/invoice-reception", labelKey: "nav.recepcionFactura" },
  { path: "/inventory/recipes", labelKey: "nav.recetas" },
  { path: "/inventory/transfers", labelKey: "nav.transferencias" },
  { path: "/inventory/planning", labelKey: "nav.planificacionCompras" },
  // Precios / Servicios
  { path: "/inventory/prices", labelKey: "nav.precios" },
  { path: "/servicios", labelKey: "nav.servicios_config" },
  // Configuración / Admin
  { path: "/panel/enfermeria", labelKey: "nav.panelEnfermeria" },
  { path: "/configuracion/factura", labelKey: "nav.configFactura" },
  { path: "/configuracion/numeracion", labelKey: "nav.configNumeracion" },
  { path: "/configuracion/requeridos", labelKey: "nav.requisitos_servicio" },
  { path: "/configuracion/formatos", labelKey: "nav.configFormatos" },
  { path: "/configuracion/tableros", labelKey: "nav.constructorTableros" },
  { path: "/configuracion/menu", labelKey: "nav.menuEditor" },
  { path: "/configuracion/panel-enfermeria", labelKey: "nav.panelEnfermeriaConfig" },
  { path: "/configuracion/datos-paciente", labelKey: "nav.datosPaciente" },
  { path: "/auditoria", labelKey: "nav.auditoria" },
  { path: "/admin", labelKey: "nav.admin" },
  { path: "/settings/appearance", labelKey: "nav.appearance" },
  { path: "/settings/tablero-modulos", labelKey: "nav.tableroModulos" },
  { path: "/settings/tableros", labelKey: "nav.tablerosSettings" },
];
