// Mock de sesión y accesos por ítem de menú.
// En producción esto viene de GET /api/config/me/menu (usuarios-perfiles.md).
// Cada ítem tiene nivel: 'SIN_ACCESO' | 'LECTURA' | 'TOTAL'

export type NivelAcceso = 'SIN_ACCESO' | 'LECTURA' | 'TOTAL';

export const MOCK_USUARIO = {
  id: 'usr-demo',
  nombre: 'Usuario Demo',
  email: 'demo@agrosan.cl',
  perfil: 'Administrador'
};

// Tabla de accesos del perfil actual por clave de ítem de menú.
// Cambiar aquí para simular distintos perfiles en el mockup.
export const MOCK_ACCESOS: Record<string, NivelAcceso> = {
  // Configuración
  'config.paises':           'TOTAL',
  'config.grupos-mercado':   'TOTAL',
  'config.mercados':         'TOTAL',
  'config.regiones':         'TOTAL',
  'config.provincias':       'TOTAL',
  'config.comunas':          'TOTAL',
  'config.zonas':            'TOTAL',
  'config.puertos':          'TOTAL',
  'config.monedas':          'TOTAL',
  'config.temporadas':       'TOTAL',
  'config.tipos-embarque':   'TOTAL',
  'config.bodegas':          'TOTAL',
  'config.unidades-medida':  'TOTAL',
  'config.especies':         'TOTAL',
  'config.grupos-variedad':  'TOTAL',
  'config.variedades':       'TOTAL',
  'config.categorias':       'TOTAL',
  'config.calibres':         'TOTAL',
  'config.tipos-parametro':  'TOTAL',
  'config.parametros':       'TOTAL',
  'config.conceptos-cta-cte': 'TOTAL',
  'config.usuarios':         'TOTAL',
  'config.perfiles':         'TOTAL',
  // Operaciones
  'operaciones.materiales':  'TOTAL',
  'operaciones.recetas':     'TOTAL',
  'operaciones.movimientos': 'TOTAL',
  'operaciones.stock':       'LECTURA',
  // Compras / Ventas
  'compras.ordenes':         'TOTAL',
  'ventas.notas':            'LECTURA',
  'ventas.cobranza':         'SIN_ACCESO',
};
