import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Catálogo de ítems de menú (2026-10-07, reorganización de permisos).
//   - `grupo` = nivel superior del menú; `seccion` = submódulo. La matriz de
//     perfiles agrupa por grupo → sección y ordena por `orden` (bloques
//     globales: grupo×1000 + sección×100 + ítem, para que el orden sea el del
//     menú y cada grupo/sección quede contiguo).
//   - `tipo`: PANTALLA (3 niveles), ACCION (Sí/No → TOTAL), REPORTE (Sí/No →
//     LECTURA). `esAccion` se deriva de `tipo` en el upsert (compat).
//   - Permisos por mantenedor: el genérico CONFIG_MANTENEDORES se desglosa en
//     un CONFIG_* por catálogo (ver backfill más abajo); Artículos/Recetas/
//     Tipos de Movimiento salen de OPER_MATERIALES a ítems propios.
type ItemTipo = 'PANTALLA' | 'ACCION' | 'REPORTE'
const itemsMenu: Array<{ codigo: string; nombre: string; grupo: string; seccion: string; ruta: string | null; tipo: ItemTipo; orden: number }> = [
  // ── Inicio ──────────────────────────────────────────────────────────────
  { codigo: 'DASHBOARD', nombre: 'Dashboard', grupo: 'Inicio', seccion: 'Inicio', ruta: '/dashboard', tipo: 'PANTALLA', orden: 1000 },

  // ── Gestión Comercial › Compras ─────────────────────────────────────────
  { codigo: 'COMPRAS_SOLICITUDES', nombre: 'Solicitud de Inspección', grupo: 'Gestión Comercial', seccion: 'Compras', ruta: '/dashboard/compras/solicitudes', tipo: 'PANTALLA', orden: 2110 },
  { codigo: 'COMPRAS_OC', nombre: 'Órdenes de Compra', grupo: 'Gestión Comercial', seccion: 'Compras', ruta: '/dashboard/compras/ordenes', tipo: 'PANTALLA', orden: 2120 },
  { codigo: 'OC_APROBACION', nombre: 'Aprobación de OC', grupo: 'Gestión Comercial', seccion: 'Compras', ruta: null, tipo: 'ACCION', orden: 2130 },
  { codigo: 'COMPRAS_INSTRUCTIVO', nombre: 'Instructivo de Embalaje', grupo: 'Gestión Comercial', seccion: 'Compras', ruta: '/dashboard/compras/instructivo-embalaje', tipo: 'PANTALLA', orden: 2140 },
  { codigo: 'COMPRAS_RECEPCION', nombre: 'Recepción de Stock', grupo: 'Gestión Comercial', seccion: 'Compras', ruta: '/dashboard/compras/recepciones', tipo: 'PANTALLA', orden: 2150 },

  // ── Gestión Comercial › Ventas ──────────────────────────────────────────
  { codigo: 'VENTAS_NV', nombre: 'Cierre Comercial', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: '/dashboard/ventas/cierre', tipo: 'PANTALLA', orden: 2210 },
  { codigo: 'VENTAS_REABRIR_CIERRE', nombre: 'Reabrir Cierre Comercial', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: null, tipo: 'ACCION', orden: 2220 },
  { codigo: 'VENTAS_EMBARQUES', nombre: 'Embarques', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: '/dashboard/ventas/embarques', tipo: 'PANTALLA', orden: 2230 },
  { codigo: 'VENTAS_RECLAMOS', nombre: 'Reclamos', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: '/dashboard/ventas/reclamos', tipo: 'PANTALLA', orden: 2240 },
  { codigo: 'RECLAMO_VALORIZACION', nombre: 'Valorización Reclamo', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: null, tipo: 'ACCION', orden: 2250 },
  { codigo: 'RECLAMO_PROVISION', nombre: 'Provisión de Reclamo', grupo: 'Gestión Comercial', seccion: 'Ventas', ruta: null, tipo: 'ACCION', orden: 2260 },

  // ── Gestión Comercial › Facturación y Cobranza ──────────────────────────
  { codigo: 'FACT_EXPORTACION', nombre: 'Facturación Exportación', grupo: 'Gestión Comercial', seccion: 'Facturación y Cobranza', ruta: '/dashboard/facturacion/exportacion', tipo: 'PANTALLA', orden: 2310 },
  { codigo: 'FACT_NACIONAL', nombre: 'Facturación Nacional', grupo: 'Gestión Comercial', seccion: 'Facturación y Cobranza', ruta: '/dashboard/facturacion/nacional', tipo: 'PANTALLA', orden: 2320 },
  { codigo: 'VENTAS_COBRANZA', nombre: 'Cobranza / CRM', grupo: 'Gestión Comercial', seccion: 'Facturación y Cobranza', ruta: '/dashboard/facturacion/cobranza', tipo: 'PANTALLA', orden: 2330 },

  // ── Operaciones › Materiales ────────────────────────────────────────────
  // OPER_MATERIALES queda para Movimientos de Materiales (operación); Artículos/
  // Recetas/Tipos de Movimiento salen a ítems propios (ver Configuración).
  { codigo: 'OPER_MATERIALES', nombre: 'Movimientos de Materiales', grupo: 'Operaciones', seccion: 'Materiales', ruta: '/dashboard/operaciones/movimientos', tipo: 'PANTALLA', orden: 3110 },
  { codigo: 'MATERIALES_OC', nombre: 'Orden de Compra de Materiales', grupo: 'Operaciones', seccion: 'Materiales', ruta: '/dashboard/operaciones/materiales/ordenes-compra', tipo: 'PANTALLA', orden: 3120 },
  { codigo: 'MATERIALES_PROFORMA', nombre: 'Proforma de Venta de Materiales', grupo: 'Operaciones', seccion: 'Materiales', ruta: '/dashboard/operaciones/materiales/proformas', tipo: 'PANTALLA', orden: 3130 },

  // ── Gestión Productores › Productores ───────────────────────────────────
  { codigo: 'PROD_FICHA', nombre: 'Productores', grupo: 'Gestión Productores', seccion: 'Productores', ruta: '/dashboard/configuracion/productores', tipo: 'PANTALLA', orden: 4110 },
  { codigo: 'PROD_CONTRATO', nombre: 'Contrato', grupo: 'Gestión Productores', seccion: 'Productores', ruta: '/dashboard/productores/contrato', tipo: 'PANTALLA', orden: 4120 },
  { codigo: 'PROD_CTA_CTE', nombre: 'Cuenta Corriente', grupo: 'Gestión Productores', seccion: 'Productores', ruta: '/dashboard/productores/cuenta-corriente', tipo: 'PANTALLA', orden: 4130 },
  { codigo: 'PROD_CONCEPTOS_LIQ', nombre: 'Conceptos de Liquidación', grupo: 'Gestión Productores', seccion: 'Productores', ruta: '/dashboard/configuracion/conceptos-liquidacion', tipo: 'PANTALLA', orden: 4140 },

  // ── Gestión Productores › Liquidaciones ─────────────────────────────────
  { codigo: 'LIQ_CLIENTES', nombre: 'Liquidación Clientes', grupo: 'Gestión Productores', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/clientes', tipo: 'PANTALLA', orden: 4210 },
  { codigo: 'LIQ_COSTOS', nombre: 'Matriz de Costos', grupo: 'Gestión Productores', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/costos', tipo: 'PANTALLA', orden: 4220 },
  { codigo: 'LIQ_PRECIOS', nombre: 'Determinación de Precios', grupo: 'Gestión Productores', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/precios', tipo: 'PANTALLA', orden: 4230 },
  { codigo: 'LIQ_PRODUCTOR', nombre: 'Liquidación Productor', grupo: 'Gestión Productores', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/productor', tipo: 'PANTALLA', orden: 4240 },

  // ── Calidad ─────────────────────────────────────────────────────────────
  { codigo: 'CAL_SOLICITUDES', nombre: 'Solicitudes de Inspección', grupo: 'Calidad', seccion: 'Calidad', ruta: '/dashboard/calidad', tipo: 'PANTALLA', orden: 5110 },
  { codigo: 'CAL_CONTROL', nombre: 'Control de Calidad', grupo: 'Calidad', seccion: 'Calidad', ruta: '/dashboard/calidad/control', tipo: 'PANTALLA', orden: 5120 },
  { codigo: 'CAL_LOTES', nombre: 'Validación de Lotes', grupo: 'Calidad', seccion: 'Calidad', ruta: '/dashboard/calidad/lotes', tipo: 'PANTALLA', orden: 5130 },
  { codigo: 'CAL_RECLAMOS', nombre: 'Reclamos', grupo: 'Calidad', seccion: 'Calidad', ruta: '/dashboard/calidad/reclamos', tipo: 'PANTALLA', orden: 5140 },
  { codigo: 'RECLAMO_CIERRE', nombre: 'Veredicto Final / Cierre Reclamo', grupo: 'Calidad', seccion: 'Calidad', ruta: null, tipo: 'ACCION', orden: 5150 },
  { codigo: 'OPERACIONES_GESTION_PALLETS', nombre: 'Calificación de Pallets', grupo: 'Calidad', seccion: 'Calidad', ruta: '/dashboard/operaciones/pallets', tipo: 'PANTALLA', orden: 5160 },

  // ── Finanzas ────────────────────────────────────────────────────────────
  { codigo: 'FIN_COSTOS', nombre: 'Gestión de Costos', grupo: 'Finanzas', seccion: 'Finanzas', ruta: '/dashboard/finanzas/costos', tipo: 'PANTALLA', orden: 6110 },
  { codigo: 'FIN_PAGOS', nombre: 'Gestión de Pagos', grupo: 'Finanzas', seccion: 'Finanzas', ruta: '/dashboard/finanzas/pagos', tipo: 'PANTALLA', orden: 6120 },

  // ── Reportes (todos de solo consulta → tipo REPORTE, Sí/No) ─────────────
  { codigo: 'REPORTES_STOCK_FRUTA', nombre: 'Stock de Fruta', grupo: 'Reportes', seccion: 'Reportes', ruta: '/dashboard/reportes/stock-fruta', tipo: 'REPORTE', orden: 7110 },
  { codigo: 'OPER_STOCK_EDICION', nombre: 'Edición de Stock', grupo: 'Reportes', seccion: 'Reportes', ruta: null, tipo: 'ACCION', orden: 7120 },
  { codigo: 'REPORTES_KARDEX_MATERIALES', nombre: 'Kardex de Materiales', grupo: 'Reportes', seccion: 'Reportes', ruta: '/dashboard/reportes/kardex-materiales', tipo: 'REPORTE', orden: 7130 },
  { codigo: 'REPORTES_STOCK_RECETA', nombre: 'Stock por Receta', grupo: 'Reportes', seccion: 'Reportes', ruta: '/dashboard/reportes/stock-materiales', tipo: 'REPORTE', orden: 7140 },
  { codigo: 'REPORTES_STOCK_MATERIALES', nombre: 'Stock de Materiales', grupo: 'Reportes', seccion: 'Reportes', ruta: '/dashboard/reportes/saldos-materiales', tipo: 'REPORTE', orden: 7150 },
  { codigo: 'REPORTES_GESTION_RIESGO', nombre: 'Gestión de Riesgo', grupo: 'Reportes', seccion: 'Reportes', ruta: '/dashboard/reportes/gestion-riesgo', tipo: 'REPORTE', orden: 7160 },

  // ── Configuración › Herramientas ────────────────────────────────────────
  { codigo: 'CONFIG_CARGA_MASIVA', nombre: 'Carga Masiva de Maestros', grupo: 'Configuración', seccion: 'Herramientas', ruta: '/dashboard/configuracion/carga-masiva', tipo: 'PANTALLA', orden: 8050 },

  // ── Configuración › Gestión Comercial ───────────────────────────────────
  { codigo: 'CONFIG_ENTIDADES', nombre: 'Entidades', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/entidades', tipo: 'PANTALLA', orden: 8110 },
  { codigo: 'CONFIG_GRUPOS_MERCADO', nombre: 'Grupos de Mercado', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/grupos-mercado', tipo: 'PANTALLA', orden: 8120 },
  { codigo: 'CONFIG_MERCADOS', nombre: 'Mercados', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/mercados', tipo: 'PANTALLA', orden: 8130 },
  { codigo: 'CONFIG_TIPOS_EMBARQUE', nombre: 'Tipos de Embarque', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/tipos-embarque', tipo: 'PANTALLA', orden: 8140 },
  { codigo: 'CONFIG_PUERTOS', nombre: 'Puertos', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/puertos', tipo: 'PANTALLA', orden: 8150 },
  { codigo: 'CONFIG_FORMAS_PAGO', nombre: 'Formas de Pago', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/formas-pago', tipo: 'PANTALLA', orden: 8160 },
  { codigo: 'CONFIG_CONDICIONES_PAGO', nombre: 'Condiciones de Pago', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/condiciones-pago', tipo: 'PANTALLA', orden: 8170 },
  { codigo: 'CONFIG_CLAUSULAS_VENTA', nombre: 'Cláusulas de Venta (Incoterm)', grupo: 'Configuración', seccion: 'Gestión Comercial', ruta: '/dashboard/configuracion/clausulas-venta', tipo: 'PANTALLA', orden: 8180 },

  // ── Configuración › Materiales ──────────────────────────────────────────
  { codigo: 'MATERIALES_ARTICULOS', nombre: 'Artículos', grupo: 'Configuración', seccion: 'Materiales', ruta: '/dashboard/configuracion/articulos', tipo: 'PANTALLA', orden: 8210 },
  { codigo: 'MATERIALES_RECETAS', nombre: 'Recetas', grupo: 'Configuración', seccion: 'Materiales', ruta: '/dashboard/configuracion/recetas', tipo: 'PANTALLA', orden: 8220 },
  { codigo: 'CONFIG_CAJAS_POR_PALLET', nombre: 'Cajas por Pallet', grupo: 'Configuración', seccion: 'Materiales', ruta: '/dashboard/configuracion/cajas-por-pallet', tipo: 'PANTALLA', orden: 8230 },

  // ── Configuración › Operaciones ─────────────────────────────────────────
  { codigo: 'CONFIG_TIPOS_MOVIMIENTO', nombre: 'Tipos de Movimiento', grupo: 'Configuración', seccion: 'Operaciones', ruta: '/dashboard/configuracion/tipos-movimiento', tipo: 'PANTALLA', orden: 8250 },

  // ── Configuración › Gestión Productores ─────────────────────────────────
  { codigo: 'CONFIG_CONCEPTOS_CTA_CTE', nombre: 'Conceptos Cta. Cte.', grupo: 'Configuración', seccion: 'Gestión Productores', ruta: '/dashboard/configuracion/conceptos-cta-cte', tipo: 'PANTALLA', orden: 8310 },

  // ── Configuración › Calidad ─────────────────────────────────────────────
  { codigo: 'CONFIG_GRUPOS_DEFECTO', nombre: 'Grupos de Defecto', grupo: 'Configuración', seccion: 'Calidad', ruta: '/dashboard/configuracion/grupos-defecto', tipo: 'PANTALLA', orden: 8410 },
  { codigo: 'CONFIG_DEFECTOS', nombre: 'Defectos', grupo: 'Configuración', seccion: 'Calidad', ruta: '/dashboard/configuracion/defectos', tipo: 'PANTALLA', orden: 8420 },
  { codigo: 'CONFIG_NOTAS_CALIDAD', nombre: 'Notas de Calidad', grupo: 'Configuración', seccion: 'Calidad', ruta: '/dashboard/configuracion/notas-calidad', tipo: 'PANTALLA', orden: 8430 },
  { codigo: 'CONFIG_NOTAS_CONDICION', nombre: 'Notas de Condición', grupo: 'Configuración', seccion: 'Calidad', ruta: '/dashboard/configuracion/notas-condicion', tipo: 'PANTALLA', orden: 8440 },
  { codigo: 'CONFIG_TIPOS_RECLAMO', nombre: 'Tipos de Reclamo', grupo: 'Configuración', seccion: 'Calidad', ruta: '/dashboard/configuracion/tipos-reclamo', tipo: 'PANTALLA', orden: 8450 },

  // ── Configuración › Geográfico ──────────────────────────────────────────
  { codigo: 'CONFIG_ZONAS', nombre: 'Zonas', grupo: 'Configuración', seccion: 'Geográfico', ruta: '/dashboard/configuracion/zonas', tipo: 'PANTALLA', orden: 8510 },
  { codigo: 'CONFIG_PAISES', nombre: 'Países', grupo: 'Configuración', seccion: 'Geográfico', ruta: '/dashboard/configuracion/paises', tipo: 'PANTALLA', orden: 8520 },
  { codigo: 'CONFIG_REGIONES', nombre: 'Regiones', grupo: 'Configuración', seccion: 'Geográfico', ruta: '/dashboard/configuracion/regiones', tipo: 'PANTALLA', orden: 8530 },
  { codigo: 'CONFIG_PROVINCIAS', nombre: 'Provincias', grupo: 'Configuración', seccion: 'Geográfico', ruta: '/dashboard/configuracion/provincias', tipo: 'PANTALLA', orden: 8540 },
  { codigo: 'CONFIG_COMUNAS', nombre: 'Comunas', grupo: 'Configuración', seccion: 'Geográfico', ruta: '/dashboard/configuracion/comunas', tipo: 'PANTALLA', orden: 8550 },

  // ── Configuración › Operación ───────────────────────────────────────────
  { codigo: 'CONFIG_TIPOS_PALLET', nombre: 'Tipos de Pallet', grupo: 'Configuración', seccion: 'Operación', ruta: '/dashboard/configuracion/tipos-pallet', tipo: 'PANTALLA', orden: 8610 },
  { codigo: 'CONFIG_ETIQUETAS', nombre: 'Etiquetas', grupo: 'Configuración', seccion: 'Operación', ruta: '/dashboard/configuracion/etiquetas', tipo: 'PANTALLA', orden: 8620 },
  { codigo: 'CONFIG_ALTURAS', nombre: 'Alturas', grupo: 'Configuración', seccion: 'Operación', ruta: '/dashboard/configuracion/alturas', tipo: 'PANTALLA', orden: 8630 },
  { codigo: 'CONFIG_TIPOS_PRODUCCION', nombre: 'Tipos de Producción', grupo: 'Configuración', seccion: 'Operación', ruta: '/dashboard/configuracion/tipos-produccion', tipo: 'PANTALLA', orden: 8640 },

  // ── Configuración › Fruta ───────────────────────────────────────────────
  { codigo: 'CONFIG_ESPECIES', nombre: 'Especies', grupo: 'Configuración', seccion: 'Fruta', ruta: '/dashboard/configuracion/especies', tipo: 'PANTALLA', orden: 8710 },
  { codigo: 'CONFIG_GRUPOS_VARIEDAD', nombre: 'Grupos de Variedad', grupo: 'Configuración', seccion: 'Fruta', ruta: '/dashboard/configuracion/grupos-variedad', tipo: 'PANTALLA', orden: 8720 },
  { codigo: 'CONFIG_VARIEDADES', nombre: 'Variedades', grupo: 'Configuración', seccion: 'Fruta', ruta: '/dashboard/configuracion/variedades', tipo: 'PANTALLA', orden: 8730 },
  { codigo: 'CONFIG_CATEGORIAS', nombre: 'Categorías', grupo: 'Configuración', seccion: 'Fruta', ruta: '/dashboard/configuracion/categorias', tipo: 'PANTALLA', orden: 8740 },
  { codigo: 'CONFIG_CALIBRES', nombre: 'Calibres', grupo: 'Configuración', seccion: 'Fruta', ruta: '/dashboard/configuracion/calibres', tipo: 'PANTALLA', orden: 8750 },

  // ── Configuración › Sistema ─────────────────────────────────────────────
  { codigo: 'CONFIG_EMPRESAS', nombre: 'Empresas', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/empresas', tipo: 'PANTALLA', orden: 8810 },
  { codigo: 'CONFIG_USUARIOS', nombre: 'Usuarios', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/usuarios', tipo: 'PANTALLA', orden: 8820 },
  { codigo: 'CONFIG_PERFILES', nombre: 'Perfiles', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/perfiles', tipo: 'PANTALLA', orden: 8830 },
  { codigo: 'CONFIG_BODEGAS', nombre: 'Bodegas', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/bodegas', tipo: 'PANTALLA', orden: 8840 },
  { codigo: 'CONFIG_UNIDADES_MEDIDA', nombre: 'Unidades de Medida', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/unidades-medida', tipo: 'PANTALLA', orden: 8850 },
  { codigo: 'CONFIG_TEMPORADAS', nombre: 'Temporadas', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/temporadas', tipo: 'PANTALLA', orden: 8860 },
  { codigo: 'CONFIG_MONEDAS', nombre: 'Monedas', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/monedas', tipo: 'PANTALLA', orden: 8870 },
  { codigo: 'CONFIG_TIPOS_PARAMETRO', nombre: 'Tipos de Parámetro', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/tipos-parametro', tipo: 'PANTALLA', orden: 8880 },
  { codigo: 'CONFIG_PARAMETROS', nombre: 'Parámetros', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/parametros', tipo: 'PANTALLA', orden: 8890 },
  { codigo: 'CONFIG_PREFIJOS_CODIGO', nombre: 'Prefijos de Código', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/prefijos-codigo', tipo: 'PANTALLA', orden: 8900 },
  { codigo: 'CONFIG_TEMPLATES_CARGA', nombre: 'Templates de Carga', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/templates-carga', tipo: 'PANTALLA', orden: 8910 },
  { codigo: 'CONFIG_INTEGRACIONES', nombre: 'Integraciones', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/integraciones', tipo: 'PANTALLA', orden: 8920 },
  { codigo: 'CONFIG_GENERAL', nombre: 'Configuración General', grupo: 'Configuración', seccion: 'Sistema', ruta: '/dashboard/configuracion/general', tipo: 'PANTALLA', orden: 8930 },
]

const SISTEMA_USER = 'system'

// Empresas (multi-empresa). Agrosan es la empresa base a la que se hace
// backfill de todos los datos existentes en la fase de tenancy; AGDry se crea
// solo con el nombre (razón social) y el resto de sus datos se completa desde
// la UI (decisión de negocio, Christian, 2026-07-31).
const EMPRESAS = [
  { codigo: 'AGROSAN', razonSocial: 'Frutera Agrosan SpA' },
  { codigo: 'AGDRY', razonSocial: 'AGDry' },
]

// Código fijo de la Entidad placeholder "Cliente Sin Definir" (Cierre
// Comercial). Debe coincidir con CLIENTE_SIN_DEFINIR_CODIGO en
// fas-web/src/features/ventas/notas-venta/constants.ts.
const CLIENTE_SIN_DEFINIR_CODIGO = 'CLIENTE-SD'

// TipoParametro/Parametro para Cierre Comercial (Ventas). El catálogo
// genérico Parametro no tiene `codigo` único a nivel de BD, por lo que el
// upsert se hace manualmente (findFirst + create/update) en vez de
// `prisma.<modelo>.upsert`.
const tiposParametroVentas = [
  {
    codigo: 'TIPO_FLETE',
    descripcion: 'Tipo de Flete',
    valores: [
      { codigo: 'COLLECT', descripcion: 'Collect' },
      { codigo: 'PREPAID', descripcion: 'Prepaid' },
    ],
  },
  {
    codigo: 'MODALIDAD_VENTA',
    descripcion: 'Modalidad de Venta',
    valores: [
      { codigo: 'FIRME', descripcion: 'Firme' },
      { codigo: 'CONSIGNACION', descripcion: 'Consignación' },
    ],
  },
  // INCOTERM salió de este catálogo genérico (2026-09-30): ahora es el
  // mantenedor dedicado ClausulaVenta (ver migración clausula_venta_dedicada),
  // que expone requiereFlete/requiereSeguro en su propio listado.
  // Tipo de BL (2026-09-28) — información base de la reserva del Embarque.
  {
    codigo: 'TIPO_BL',
    descripcion: 'Tipo de BL',
    valores: [
      { codigo: 'ORIGINAL', descripcion: 'Original' },
      { codigo: 'TELEX', descripcion: 'Telex Release' },
      { codigo: 'SEAWAY', descripcion: 'Seaway / Express' },
    ],
  },
]

async function main() {
  console.log('Seeding Empresas...')
  for (const emp of EMPRESAS) {
    const existente = await prisma.empresa.findFirst({ where: { codigo: emp.codigo } })
    if (!existente) {
      await prisma.empresa.create({ data: { ...emp, creadoPor: SISTEMA_USER } })
    }
  }
  console.log(`Empresas: ${EMPRESAS.length} verificadas.`)

  // Backfill (Fase 1 multi-empresa): usuarios existentes sin ninguna empresa
  // asignada quedan como miembros de AGROSAN, con AGROSAN como predeterminada.
  // Idempotente — solo toca usuarios sin membresías, así que reintentar el
  // seed no duplica ni pisa asignaciones manuales posteriores.
  const agrosan = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (agrosan) {
    const usuariosSinEmpresa = await prisma.usuario.findMany({
      where: { eliminadoEn: null, empresas: { none: {} } },
      select: { id: true },
    })
    for (const u of usuariosSinEmpresa) {
      await prisma.usuarioEmpresa.create({
        data: { usuarioId: u.id, empresaId: agrosan.id, creadoPor: SISTEMA_USER },
      })
    }
    // Solo usuarios que SON miembros de AGROSAN (recién creados arriba, o ya
    // asignados manualmente antes) — nunca pisar la predeterminada de un
    // usuario cuya única membresía sea otra empresa (ej. solo AGDRY).
    await prisma.usuario.updateMany({
      where: { eliminadoEn: null, empresaPredeterminadaId: null, empresas: { some: { empresaId: agrosan.id } } },
      data: { empresaPredeterminadaId: agrosan.id },
    })
    console.log(`Usuarios backfill a AGROSAN: ${usuariosSinEmpresa.length} membresías nuevas.`)
  }

  console.log('Seeding ItemMenu...')

  // El catálogo y el backfill de accesos (desglose de CONFIG_MANTENEDORES y
  // OPER_MATERIALES) se aplican en la migración 20261007120000 (idempotente, se
  // ejecuta en `migrate deploy`). Acá solo se re-afirma el catálogo por upsert
  // para BD de desarrollo fresca; la migración siempre corre antes del seed.
  for (const item of itemsMenu) {
    const esAccion = item.tipo === 'ACCION'
    const data = {
      codigo: item.codigo,
      nombre: item.nombre,
      grupo: item.grupo,
      seccion: item.seccion,
      ruta: item.ruta,
      esAccion,
      tipo: item.tipo,
      orden: item.orden,
    }
    await prisma.itemMenu.upsert({
      where: { codigo: item.codigo },
      create: data,
      update: {
        nombre: item.nombre,
        grupo: item.grupo,
        seccion: item.seccion,
        ruta: item.ruta,
        esAccion,
        tipo: item.tipo,
        orden: item.orden,
      },
    })
  }

  console.log(`ItemMenu: ${itemsMenu.length} ítems creados/actualizados.`)

  // Migración de ítem renombrado (2026-08-24): OPER_STOCK -> REPORTES_STOCK_FRUTA
  // (mismo reporte, reubicado de Operaciones a Reportes). El upsert por
  // `codigo` de arriba no toca códigos que ya no están en `itemsMenu`, así que
  // acá se migra cualquier PerfilAcceso existente hacia el ítem nuevo (mismo
  // nivel) antes de borrar el ítem viejo — sin esto, un perfil no-ADMIN que ya
  // tuviera acceso a OPER_STOCK lo perdería silenciosamente (QAS-STK-001).
  const operStockObsoleto = await prisma.itemMenu.findUnique({ where: { codigo: 'OPER_STOCK' } })
  if (operStockObsoleto) {
    const itemNuevo = await prisma.itemMenu.findUniqueOrThrow({ where: { codigo: 'REPORTES_STOCK_FRUTA' } })
    const accesosExistentes = await prisma.perfilAcceso.findMany({ where: { itemMenuId: operStockObsoleto.id } })
    for (const acceso of accesosExistentes) {
      await prisma.perfilAcceso.upsert({
        where: { perfilId_itemMenuId: { perfilId: acceso.perfilId, itemMenuId: itemNuevo.id } },
        create: { perfilId: acceso.perfilId, itemMenuId: itemNuevo.id, nivel: acceso.nivel },
        update: { nivel: acceso.nivel },
      })
    }
    await prisma.perfilAcceso.deleteMany({ where: { itemMenuId: operStockObsoleto.id } })
    await prisma.itemMenu.delete({ where: { id: operStockObsoleto.id } })
    console.log(`OPER_STOCK migrado a REPORTES_STOCK_FRUTA: ${accesosExistentes.length} acceso(s) trasladados.`)
  }

  // Limpieza de ítem superseded (2026-09-04): FIN_FACTURACION se reemplaza por
  // FACT_EXPORTACION + FACT_NACIONAL (split 1:2, sin mapeo 1:1 de nivel que
  // migrar). Sin pantalla/backend aún, así que no hay acceso real que
  // preservar más allá de la sync ADMIN de abajo (que recrea el acceso TOTAL
  // para los 2 ítems nuevos).
  const finFacturacionObsoleto = await prisma.itemMenu.findUnique({ where: { codigo: 'FIN_FACTURACION' } })
  if (finFacturacionObsoleto) {
    await prisma.perfilAcceso.deleteMany({ where: { itemMenuId: finFacturacionObsoleto.id } })
    await prisma.itemMenu.delete({ where: { id: finFacturacionObsoleto.id } })
    console.log('FIN_FACTURACION eliminado (superseded por FACT_EXPORTACION/FACT_NACIONAL).')
  }

  // Sincronizar accesos TOTAL para el perfil ADMIN a todos los ítems de menú.
  // Garantiza que cualquier ítem nuevo agregado al seed quede accesible para ADMIN.
  const adminPerfil = await prisma.perfil.findFirst({ where: { codigo: 'ADMIN', eliminadoEn: null } })
  if (adminPerfil) {
    const allItems = await prisma.itemMenu.findMany()
    for (const item of allItems) {
      await prisma.perfilAcceso.upsert({
        where: { perfilId_itemMenuId: { perfilId: adminPerfil.id, itemMenuId: item.id } },
        create: { perfilId: adminPerfil.id, itemMenuId: item.id, nivel: 'TOTAL' },
        update: { nivel: 'TOTAL' },
      })
    }
    console.log(`PerfilAcceso ADMIN: ${allItems.length} accesos TOTAL sincronizados.`)
  }

  console.log('Seeding TipoParametro/Parametro (Ventas — Cierre Comercial)...')

  // TipoParametro/Parametro son tablas por-empresa desde multi-empresa (Fase 3):
  // este seed los crea en la empresa base AGROSAN.
  const agrosanParaParametros = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (!agrosanParaParametros) throw new Error('No se encontró la empresa base AGROSAN para sembrar parámetros.')

  let parametrosCreados = 0
  for (const tipo of tiposParametroVentas) {
    let tipoParametro = await prisma.tipoParametro.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: tipo.codigo, eliminadoEn: null },
    })
    if (!tipoParametro) {
      tipoParametro = await prisma.tipoParametro.create({
        data: {
          empresaId: agrosanParaParametros.id,
          codigo: tipo.codigo,
          descripcion: tipo.descripcion,
          creadoPor: SISTEMA_USER,
        },
      })
    }

    for (const valor of tipo.valores) {
      const existente = await prisma.parametro.findFirst({
        where: { empresaId: agrosanParaParametros.id, codigo: valor.codigo, tipoParametroId: tipoParametro.id, eliminadoEn: null },
      })
      if (!existente) {
        await prisma.parametro.create({
          data: {
            empresaId: agrosanParaParametros.id,
            codigo: valor.codigo,
            descripcion: valor.descripcion,
            tipoParametroId: tipoParametro.id,
            creadoPor: SISTEMA_USER,
          },
        })
        parametrosCreados++
      }
    }
  }
  console.log(`TipoParametro: ${tiposParametroVentas.length} tipos verificados. Parametro: ${parametrosCreados} valores nuevos creados.`)

  console.log('Seeding ClausulaVenta (Incoterm)...')
  // codigoAduana = código de la tabla "Cláusula de Venta" de Aduana del SII
  // (DTE 110), según LibreDTE: 1=CIF, 2=CFR, 3=EXW, 5=FOB. Normaliza nuestros
  // códigos de negocio.
  const clausulasVentaBase = [
    { codigo: 'FOB', descripcion: 'FOB', requiereFlete: false, requiereSeguro: false, codigoAduana: '5' },
    { codigo: 'CFR', descripcion: 'CFR', requiereFlete: true, requiereSeguro: false, codigoAduana: '2' },
    { codigo: 'CIF', descripcion: 'CIF', requiereFlete: true, requiereSeguro: true, codigoAduana: '1' },
    { codigo: 'EXW', descripcion: 'EXW', requiereFlete: false, requiereSeguro: false, codigoAduana: '3' },
  ]
  let clausulasVentaCreadas = 0
  for (const clausula of clausulasVentaBase) {
    const existente = await prisma.clausulaVenta.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: clausula.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.clausulaVenta.create({
        data: { ...clausula, empresaId: agrosanParaParametros.id, creadoPor: SISTEMA_USER },
      })
      clausulasVentaCreadas++
    } else if (!existente.codigoAduana) {
      // Normaliza registros previos: completa el código de Aduana si faltaba.
      await prisma.clausulaVenta.update({ where: { id: existente.id }, data: { codigoAduana: clausula.codigoAduana } })
    }
  }
  console.log(`ClausulaVenta: ${clausulasVentaCreadas} valores nuevos creados.`)

  console.log('Seeding TipoReclamo (Comercial / Calidad)...')
  const tiposReclamoBase = [
    { codigo: 'COMERCIAL', descripcion: 'Comercial', generaAnalisisCalidad: false },
    { codigo: 'CALIDAD', descripcion: 'Calidad', generaAnalisisCalidad: true },
  ]
  let tiposReclamoCreados = 0
  for (const tipo of tiposReclamoBase) {
    const existente = await prisma.tipoReclamo.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: tipo.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.tipoReclamo.create({
        data: { ...tipo, empresaId: agrosanParaParametros.id, creadoPor: SISTEMA_USER },
      })
      tiposReclamoCreados++
    }
  }
  console.log(`TipoReclamo: ${tiposReclamoCreados} valores nuevos creados.`)

  console.log('Seeding UnidadMedida (Caja/Kilo para cuota unitaria de Condición de Pago)...')
  const unidadesBase = [
    { codigo: 'CAJA', descripcion: 'Caja' },
    { codigo: 'KG', descripcion: 'Kilogramo' },
  ]
  let unidadesCreadas = 0
  for (const u of unidadesBase) {
    const existente = await prisma.unidadMedida.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: u.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.unidadMedida.create({ data: { ...u, empresaId: agrosanParaParametros.id, creadoPor: SISTEMA_USER } })
      unidadesCreadas++
    }
  }
  console.log(`UnidadMedida: ${unidadesCreadas} unidades nuevas creadas.`)

  // PrefijoCodigo — necesarios para que la Carga Masiva de Maestros autogenere
  // los códigos vacíos. Uno por cada maestro que autogenera código.
  console.log('Seeding PrefijoCodigo (Carga Masiva de Maestros)...')
  const prefijosBase = [
    { modelo: 'especie', prefijo: 'ESP', digitos: 3 },
    { modelo: 'etiqueta', prefijo: 'ETQ', digitos: 3 },
    { modelo: 'grupoVariedad', prefijo: 'GVA', digitos: 3 },
    { modelo: 'variedad', prefijo: 'VAR', digitos: 4 },
    { modelo: 'categoria', prefijo: 'CAT', digitos: 3 },
    { modelo: 'calibre', prefijo: 'CAL', digitos: 4 },
    { modelo: 'mercado', prefijo: 'MER', digitos: 3 },
    { modelo: 'puerto', prefijo: 'PTO', digitos: 3 },
    { modelo: 'entidad', prefijo: 'EN', digitos: 4 },
    { modelo: 'entidadDireccion', prefijo: 'DIR', digitos: 3 },
    { modelo: 'entidadContacto', prefijo: 'CON', digitos: 3 },
    { modelo: 'articulo', prefijo: 'ART', digitos: 4 },
    { modelo: 'bodega', prefijo: 'BOD', digitos: 3 },
    { modelo: 'receta', prefijo: 'REC', digitos: 3 },
    // Proforma de Exportación (2026-09-24, cobranza.md).
    { modelo: 'proforma', prefijo: 'PRF', digitos: 4 },
    // Factura de Exportación / DTE 110 (2026-09-24, cobranza.md).
    { modelo: 'facturaExportacion', prefijo: 'FEX', digitos: 4 },
    // Reclamo (2026-10-06) — correlativo propio. Mismo prefijo visible que
    // Receta ('REC'), pero son modelos distintos (la unicidad de PrefijoCodigo
    // es por (empresaId, modelo)); aquí 4 dígitos.
    { modelo: 'reclamo', prefijo: 'REC', digitos: 4 },
  ]
  // A diferencia del resto de los parámetros (acotados a AGROSAN como empresa
  // base), los prefijos SÍ se siembran para TODAS las empresas: sin prefijo,
  // una empresa no puede generar ningún documento con código autogenerado
  // (ej. Proforma). AGDry se creó sin prefijos y no podía emitir Proformas
  // (2026-09-24). Idempotente por (empresaId, modelo).
  const empresasParaPrefijos = await prisma.empresa.findMany({ where: { eliminadoEn: null }, select: { id: true } })
  let prefijosCreados = 0
  for (const empresa of empresasParaPrefijos) {
    for (const p of prefijosBase) {
      const existente = await prisma.prefijoCodigo.findFirst({
        where: { empresaId: empresa.id, modelo: p.modelo, tipoEmbarqueId: null, eliminadoEn: null },
      })
      if (!existente) {
        await prisma.prefijoCodigo.create({
          data: { ...p, empresaId: empresa.id, creadoPor: SISTEMA_USER },
        })
        prefijosCreados++
      }
    }
  }
  console.log(`PrefijoCodigo: ${prefijosCreados} prefijos nuevos creados (${empresasParaPrefijos.length} empresa(s)).`)

  // Template de Carga BASE (Recepción de Fruta): formato estándar con columnas
  // canónicas, para que exista un formato base descargable sin tener que armar
  // un template a mano. Con cabecera en fila 1, datos desde la fila 2.
  console.log('Seeding Template de Carga base (Recepción)...')
  const templateBaseCampos: Array<{ campo: string; columna: string }> = [
    { campo: 'NUMERO_PALLET', columna: 'N° Pallet' },
    { campo: 'ESPECIE', columna: 'Especie' },
    { campo: 'VARIEDAD', columna: 'Variedad' },
    { campo: 'CATEGORIA', columna: 'Categoría' },
    { campo: 'ARTICULO', columna: 'Artículo / Embalaje' },
    { campo: 'CALIBRE', columna: 'Calibre' },
    { campo: 'CAJAS', columna: 'Cajas' },
    { campo: 'PRODUCTOR', columna: 'Productor' },
    { campo: 'NOTA_CALIDAD', columna: 'Nota de Calidad' },
    { campo: 'NOTA_CONDICION', columna: 'Nota de Condición' },
    { campo: 'COMPLETO', columna: 'Completo/Incompleto' },
    { campo: 'FECHA_EMBALAJE', columna: 'Fecha de Embalaje' },
    { campo: 'ETIQUETA', columna: 'Etiqueta' },
    { campo: 'PACKING', columna: 'Packing' },
  ]
  const templateBaseExistente = await prisma.templateCarga.findFirst({
    where: { empresaId: agrosanParaParametros.id, codigo: 'BASE', eliminadoEn: null },
  })
  if (!templateBaseExistente) {
    await prisma.templateCarga.create({
      data: {
        empresaId: agrosanParaParametros.id,
        codigo: 'BASE',
        tipo: 'RECEPCION',
        descripcion: 'Formato base FAS (columnas estándar)',
        tieneCabecera: true,
        filaCabecera: 1,
        filaPrimerRegistro: 2,
        creadoPor: SISTEMA_USER,
        campos: { create: templateBaseCampos },
      },
    })
    console.log('Template de Carga base creado (código BASE).')
  } else {
    console.log('Template de Carga base ya existe (código BASE).')
  }

  // Maestros externos que la Carga Masiva referencia pero no crea (el Excel los
  // usa como "ya existentes"): Grupo de Mercado, Tipos de Embarque, Tipo de
  // Producción.
  console.log('Seeding maestros externos (GrupoMercado / TipoEmbarque / TipoProduccion)...')
  const externos: Array<{ delegate: 'grupoMercado' | 'tipoEmbarque' | 'tipoProduccion'; registros: Array<{ codigo: string; descripcion: string }> }> = [
    { delegate: 'grupoMercado', registros: [{ codigo: 'GM', descripcion: 'General' }] },
    {
      delegate: 'tipoEmbarque',
      registros: [
        { codigo: 'MARITIMO', descripcion: 'Marítimo' },
        { codigo: 'AEREO', descripcion: 'Aéreo' },
        { codigo: 'TERRESTRE', descripcion: 'Terrestre' },
      ],
    },
    { delegate: 'tipoProduccion', registros: [{ codigo: 'CONVENCIONAL', descripcion: 'Convencional' }] },
  ]
  let externosCreados = 0
  for (const grupo of externos) {
    for (const r of grupo.registros) {
      const delegate = prisma[grupo.delegate] as {
        findFirst: (a: unknown) => Promise<unknown>
        create: (a: unknown) => Promise<unknown>
      }
      const existente = await delegate.findFirst({
        where: { empresaId: agrosanParaParametros.id, codigo: r.codigo, eliminadoEn: null },
      })
      if (!existente) {
        await delegate.create({
          data: { empresaId: agrosanParaParametros.id, ...r, creadoPor: SISTEMA_USER },
        })
        externosCreados++
      }
    }
  }
  console.log(`Maestros externos: ${externosCreados} creados.`)

  // Normalización de códigos de Aduana del SII (2026-10-01) para los mantenedores
  // estándar del bloque Aduana del DTE 110. Puertos y Países se cargan con los
  // datos del cliente (la validación al enviar al SII obliga a completarlos).
  console.log('Normalizando códigos de Aduana (SII): vía de transporte y modalidad de venta...')
  // Vía de transporte (tabla SII): 1=Marítima, 4=Aéreo, 7=Carretero/Terrestre.
  const viaAduana: Record<string, string> = { MARITIMO: '1', AEREO: '4', TERRESTRE: '7' }
  for (const [codigo, codigoAduana] of Object.entries(viaAduana)) {
    await prisma.tipoEmbarque.updateMany({
      where: { empresaId: agrosanParaParametros.id, codigo, codigoAduana: null, eliminadoEn: null },
      data: { codigoAduana },
    })
  }
  // Modalidad de Venta "A firme" (Parametro bajo MODALIDAD_VENTA) → código SII 1.
  await prisma.parametro.updateMany({
    where: {
      empresaId: agrosanParaParametros.id,
      codigo: 'FIRME',
      codigoAduana: null,
      eliminadoEn: null,
      tipoParametro: { codigo: 'MODALIDAD_VENTA' },
    },
    data: { codigoAduana: '1' },
  })
  // País: código de la tabla de Aduana del SII por ISO alfa-3 (nuestro `codigo`).
  // Set de mercados de exportación habituales; el resto se carga manual. (Países
  // es global: no se scopea por empresa.) Solo escribe donde falta.
  const paisAduana: Record<string, string> = {
    CHL: '997', COL: '202', USA: '225', CHN: '336', PER: '219', BRA: '220',
    NLD: '515', GBR: '510', ESP: '517', DEU: '563', CAN: '226', MEX: '216',
    ECU: '218', ARG: '224', RUS: '562', IND: '317', KOR: '333', JPN: '331',
    TWN: '330', HKG: '342', ARE: '341', SAU: '302',
  }
  for (const [codigo, codigoAduana] of Object.entries(paisAduana)) {
    await prisma.pais.updateMany({ where: { codigo, codigoAduana: null, eliminadoEn: null }, data: { codigoAduana } })
  }

  // Notas de Calidad/Condición del Pallet (2026-09-02, compras.md §4.8):
  // catálogo inicial de ejemplo (A-D / 1-4), habilitado desde ya para todas
  // las especies existentes en AGROSAN — decisión del usuario, para poder
  // probar/ajustar de inmediato en vez de partir con el catálogo vacío.
  console.log('Seeding NotaCalidad (A-D) / NotaCondicion (1-4)...')
  const especiesAgrosan = await prisma.especie.findMany({
    where: { empresaId: agrosanParaParametros.id, eliminadoEn: null },
    select: { id: true },
  })
  const notasCalidadBase = [
    { codigo: 'A', descripcion: 'A' },
    { codigo: 'B', descripcion: 'B' },
    { codigo: 'C', descripcion: 'C' },
    { codigo: 'D', descripcion: 'D' },
  ]
  const notasCondicionBase = [
    { codigo: '1', descripcion: '1' },
    { codigo: '2', descripcion: '2' },
    { codigo: '3', descripcion: '3' },
    { codigo: '4', descripcion: '4' },
  ]
  let notasCalidadCreadas = 0
  for (const n of notasCalidadBase) {
    const existente = await prisma.notaCalidad.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: n.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.notaCalidad.create({
        data: {
          empresaId: agrosanParaParametros.id,
          ...n,
          creadoPor: SISTEMA_USER,
          especies: { create: especiesAgrosan.map((e) => ({ especieId: e.id })) },
        },
      })
      notasCalidadCreadas++
    }
  }
  let notasCondicionCreadas = 0
  for (const n of notasCondicionBase) {
    const existente = await prisma.notaCondicion.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: n.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.notaCondicion.create({
        data: {
          empresaId: agrosanParaParametros.id,
          ...n,
          creadoPor: SISTEMA_USER,
          especies: { create: especiesAgrosan.map((e) => ({ especieId: e.id })) },
        },
      })
      notasCondicionCreadas++
    }
  }
  console.log(`NotaCalidad: ${notasCalidadCreadas} nuevas. NotaCondicion: ${notasCondicionCreadas} nuevas.`)

  // Entidad placeholder para Cierre Comercial sin cliente definido todavía
  // (decisión de negocio, Christian, 2026-07-30) — preseleccionada al crear
  // un Cierre Comercial nuevo, editable en cualquier momento después.
  // Entidad es por-empresa desde Fase 3 (lote Entidades) — este seed corre
  // fuera de cualquier request (sin contexto ALS), así que se acota
  // explícitamente a AGROSAN, mismo patrón que el backfill de arriba.
  console.log('Seeding Entidad placeholder "Cliente Sin Definir"...')
  const agrosanParaPlaceholder = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (!agrosanParaPlaceholder) {
    console.warn('  Omitido: no se encontró la empresa "AGROSAN".')
  } else {
    const clientePlaceholderExistente = await prisma.entidad.findFirst({
      where: { empresaId: agrosanParaPlaceholder.id, codigo: CLIENTE_SIN_DEFINIR_CODIGO },
    })
    if (!clientePlaceholderExistente) {
      const chile = await prisma.pais.findFirst({ where: { codigo: 'CHL', eliminadoEn: null } })
      if (!chile) {
        console.warn('  Omitido: no se encontró el país "CHL" (correr seed de geografía primero).')
      } else {
        await prisma.entidad.create({
          data: {
            empresaId: agrosanParaPlaceholder.id,
            codigo: CLIENTE_SIN_DEFINIR_CODIGO,
            descripcion: 'Cliente Sin Definir',
            razonSocial: 'Cliente Sin Definir',
            paisId: chile.id,
            tipos: ['CLIENTE_NACIONAL'],
            creadoPor: SISTEMA_USER,
          },
        })
        console.log('  Entidad placeholder creada.')
      }
    }
  }

  console.log('Seed completado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
