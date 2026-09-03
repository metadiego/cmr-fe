// Paleta de rutas reales de la app para el EDITOR DE MENÚ (components/configuracion/menu-editor.tsx).
//
// OJO: esta lista YA NO arma la barra lateral. Desde la decisión «los accesos los decide el frontend»
// (docs/specs/accesos-los-decide-el-frontend.md) la barra se construye desde el catálogo del BE
// (`GET /menu`) filtrado por permisos — ver hooks/use-menu.ts y lib/nav/nav-groups.ts. Aquí solo
// queda como sugerencias de rutas registrables: el editor ofrece las que aún no están en el catálogo
// para que un admin las dé de alta como DATO (sin desplegar el frontend). Añadir una página nueva a
// esta paleta es opcional (comodidad del editor); no hace falta para que el ítem aparezca en la barra.
export interface NavRoute {
  path: string;
  labelKey: string;
}

export const NAV_MANIFEST: NavRoute[] = [
  { path: "/dashboard", labelKey: "nav.dashboard" },
  // Citas → Scheduling (route-reorg Phase 1)
  { path: "/scheduling/appointments", labelKey: "nav.citas" },
  { path: "/configuration/staff", labelKey: "nav.personal" },
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
  { path: "/communications", labelKey: "nav.comunicaciones" },
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
  { path: "/reports/services", labelKey: "nav.estadisticas_servicios" },
  { path: "/reports/daily", labelKey: "nav.estadisticas_diarias" },
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
  { path: "/configuration/services", labelKey: "nav.servicios_config" },
  // Configuración / Admin → Configuration (route-reorg Phase 1)
  { path: "/services/nursing-panel", labelKey: "nav.panelEnfermeria" },
  { path: "/configuration/invoice", labelKey: "nav.configFactura" },
  { path: "/configuration/numbering", labelKey: "nav.configNumeracion" },
  { path: "/configuration/required-fields", labelKey: "nav.requisitos_servicio" },
  { path: "/configuration/formats", labelKey: "nav.configFormatos" },
  { path: "/configuration/boards", labelKey: "nav.constructorTableros" },
  { path: "/configuration/menu", labelKey: "nav.menuEditor" },
  { path: "/configuration/nursing-panel", labelKey: "nav.panelEnfermeriaConfig" },
  { path: "/configuration/patient-fields", labelKey: "nav.datosPaciente" },
  { path: "/configuration/audit", labelKey: "nav.auditoria" },
  { path: "/admin", labelKey: "nav.admin" },
  { path: "/configuration/preferences/appearance", labelKey: "nav.appearance" },
  { path: "/configuration/board-modules", labelKey: "nav.tableroModulos" },
];
