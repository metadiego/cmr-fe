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
  // Citas
  { path: "/citas", labelKey: "nav.citas" },
  { path: "/calendario", labelKey: "nav.calendario" },
  { path: "/citas/agenda/cupos", labelKey: "nav.cupos" },
  { path: "/citas/config/columnas", labelKey: "nav.columnasCitas" },
  // "Frontdesk" (/tablero/frontdesk) y "Atención" (/tablero/atencion) los sirve el BE en /me/menu; NO se
  // declaran aquí. Tampoco `/tablero/citas` (tablero inexistente) ni `/atencion` (alias): duplicaban ítems.
  // Clientes
  { path: "/clientes", labelKey: "nav.clientes" },
  { path: "/pacientes/disponibilidad-legado", labelKey: "nav.dispLegado" },
  { path: "/pacientes/cambio-protocolo", labelKey: "nav.cambioProtocolo" },
  { path: "/pacientes/disponibilidad-legado/preparacion", labelKey: "nav.preparacionLegado" },
  // Comunicaciones
  { path: "/comunicaciones", labelKey: "nav.comunicaciones" },
  // Facturación
  { path: "/facturacion", labelKey: "nav.facturacion" },
  { path: "/facturacion/general", labelKey: "nav.facturacion_general" },
  { path: "/facturacion/grupos", labelKey: "nav.gruposFacturacion" },
  { path: "/facturacion/devoluciones", labelKey: "nav.devoluciones" },
  { path: "/facturacion/reportes/consumo-insumos", labelKey: "nav.consumoInsumos" },
  { path: "/facturacion/ventas-por-grupo", labelKey: "nav.ventasPorGrupo" },
  { path: "/facturacion/ventas-por-usuario", labelKey: "nav.ventasPorUsuario" },
  { path: "/consultas", labelKey: "nav.facturacionConsultas" },
  { path: "/consultas/devoluciones", labelKey: "nav.devolucionesConsultas" },
  // Estadísticas (el BE ya siembra el ítem en /me/menu; aquí para dedup/manifiesto)
  { path: "/estadisticas/servicios", labelKey: "nav.estadisticas_servicios" },
  { path: "/estadisticas/diarias", labelKey: "nav.estadisticas_diarias" },
  // Cuadre de caja — destinos SEPARADOS por división (no mezclar). Tienen UI → "En desarrollo".
  { path: "/caja/consulta", labelKey: "nav.cajaConsultas" },
  { path: "/caja/general", labelKey: "nav.cajaGeneral" },
  { path: "/caja/cuadre-general", labelKey: "nav.cuadreGeneral" },
  // Inventario
  { path: "/inventario", labelKey: "nav.inventario" },
  { path: "/inventario/existencias", labelKey: "nav.inventario_existencias" },
  { path: "/inventario/viales", labelKey: "nav.inventario_viales" },
  { path: "/inventario/productos", labelKey: "nav.productos" },
  { path: "/inventario/proveedores", labelKey: "nav.proveedores" },
  { path: "/inventario/presentaciones-proveedor", labelKey: "nav.presentaciones" },
  { path: "/inventario/recibir-compra", labelKey: "nav.recibirCompra" },
  { path: "/inventario/recetas", labelKey: "nav.recetas" },
  { path: "/inventario/transferencias", labelKey: "nav.transferencias" },
  { path: "/inventario/planificacion", labelKey: "nav.planificacionCompras" },
  // Precios / Servicios
  { path: "/precios", labelKey: "nav.precios" },
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
