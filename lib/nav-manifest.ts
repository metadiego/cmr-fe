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
  // Citas
  { path: "/citas", labelKey: "nav.citas" },
  { path: "/personal", labelKey: "nav.personal" },
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
  { path: "/inventario/recepcion-factura", labelKey: "nav.recepcionFactura" },
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
