import type { FastifyInstance } from 'fastify'
import { makeControllers, getTemporadaPredeterminada, getMiMenu, getMisEmpresas } from './config.controller.js'
import type { MantenedorConfig } from './config.types.js'
import { requireAuth, requireLevel } from '../../plugins/auth-guard.js'
import { perfilesRoutes } from './perfiles/perfiles.routes.js'
import { usuariosRoutes } from './usuarios/usuarios.routes.js'
import { entidadesRoutes } from './entidades/entidades.routes.js'
import { empresasRoutes } from './empresas/empresas.routes.js'
import { correoRoutes } from './correo/correo.routes.js'
import { conceptosLiquidacionRoutes } from './conceptos-liquidacion/conceptos-liquidacion.routes.js'
import { condicionesPagoRoutes } from './condiciones-pago/condiciones-pago.routes.js'
import { prefijosCodigoRoutes } from './prefijos-codigo/prefijos-codigo.routes.js'
import { templatesCargaRoutes } from './templates-carga/templates-carga.routes.js'
import { notasCalidadRoutes } from './notas-calidad/notas-calidad.routes.js'
import { notasCondicionRoutes } from './notas-condicion/notas-condicion.routes.js'
import { integracionesRoutes } from './integraciones/integraciones.routes.js'
import { cargaMaestrosRoutes } from './carga-maestros/carga-maestros.routes.js'
import { cargaEntidadesDetalleRoutes } from './carga-entidades-detalle/carga-entidades-detalle.routes.js'
import { cajasPorPalletRoutes } from './cajas-por-pallet/cajas-por-pallet.routes.js'

// Un permiso (ItemMenu) por mantenedor (2026-10-07): `itemCodigo` reemplaza al
// genérico CONFIG_MANTENEDORES. Los códigos coinciden con el seed de ItemMenu.
const MANTENEDORES: MantenedorConfig[] = [
  { modelo: 'pais', prefixRuta: 'paises', label: 'País', itemCodigo: 'CONFIG_PAISES', tienePaisOrigen: true, schemaKey: 'pais' },
  { modelo: 'zona', prefixRuta: 'zonas', label: 'Zona', itemCodigo: 'CONFIG_ZONAS' },
  { modelo: 'grupoMercado', prefixRuta: 'grupos-mercado', label: 'Grupo de Mercado', itemCodigo: 'CONFIG_GRUPOS_MERCADO' },
  { modelo: 'tipoEmbarque', prefixRuta: 'tipos-embarque', label: 'Tipo de Embarque', itemCodigo: 'CONFIG_TIPOS_EMBARQUE' },
  { modelo: 'formaPago', prefixRuta: 'formas-pago', label: 'Forma de Pago', itemCodigo: 'CONFIG_FORMAS_PAGO' },
  { modelo: 'unidadMedida', prefixRuta: 'unidades-medida', label: 'Unidad de Medida', itemCodigo: 'CONFIG_UNIDADES_MEDIDA' },
  { modelo: 'tipoPallet', prefixRuta: 'tipos-pallet', label: 'Tipo de Pallet', itemCodigo: 'CONFIG_TIPOS_PALLET' },
  { modelo: 'etiqueta', prefixRuta: 'etiquetas', label: 'Etiqueta', itemCodigo: 'CONFIG_ETIQUETAS' },
  { modelo: 'altura', prefixRuta: 'alturas', label: 'Altura', itemCodigo: 'CONFIG_ALTURAS' },
  { modelo: 'tipoProduccion', prefixRuta: 'tipos-produccion', label: 'Tipo de Producción', itemCodigo: 'CONFIG_TIPOS_PRODUCCION' },
  { modelo: 'tipoParametro', prefixRuta: 'tipos-parametro', label: 'Tipo de Parámetro', itemCodigo: 'CONFIG_TIPOS_PARAMETRO' },
  // Catálogo de defectos (2026-10-06): 2 niveles GrupoDefecto -> Defecto.
  // GrupoDefecto es mantenedor plano (sin FK); Defecto tiene FK + especies N:M.
  { modelo: 'grupoDefecto', prefixRuta: 'grupos-defecto', label: 'Grupo de Defecto', itemCodigo: 'CONFIG_GRUPOS_DEFECTO' },
  // Sin FK
  { modelo: 'region', prefixRuta: 'regiones', label: 'Región', itemCodigo: 'CONFIG_REGIONES' },
  { modelo: 'especie', prefixRuta: 'especies', label: 'Especie', itemCodigo: 'CONFIG_ESPECIES', schemaKey: 'especie' },
  // Con FK
  { modelo: 'provincia', prefixRuta: 'provincias', label: 'Provincia', itemCodigo: 'CONFIG_PROVINCIAS', schemaKey: 'provincia' },
  { modelo: 'comuna', prefixRuta: 'comunas', label: 'Comuna', itemCodigo: 'CONFIG_COMUNAS', schemaKey: 'comuna' },
  { modelo: 'grupoVariedad', prefixRuta: 'grupos-variedad', label: 'Grupo de Variedad', itemCodigo: 'CONFIG_GRUPOS_VARIEDAD', schemaKey: 'grupoVariedad' },
  { modelo: 'variedad', prefixRuta: 'variedades', label: 'Variedad', itemCodigo: 'CONFIG_VARIEDADES', schemaKey: 'variedad' },
  { modelo: 'defecto', prefixRuta: 'defectos', label: 'Defecto', itemCodigo: 'CONFIG_DEFECTOS', schemaKey: 'defecto' },
  { modelo: 'categoria', prefixRuta: 'categorias', label: 'Categoría', itemCodigo: 'CONFIG_CATEGORIAS', schemaKey: 'categoria' },
  { modelo: 'calibre', prefixRuta: 'calibres', label: 'Calibre', itemCodigo: 'CONFIG_CALIBRES', schemaKey: 'calibre' },
  { modelo: 'parametro', prefixRuta: 'parametros', label: 'Parámetro', itemCodigo: 'CONFIG_PARAMETROS', schemaKey: 'parametro' },
  // Extraído de Parametro (2026-09-30): Cláusula de Venta / Incoterm.
  { modelo: 'clausulaVenta', prefixRuta: 'clausulas-venta', label: 'Cláusula de Venta', itemCodigo: 'CONFIG_CLAUSULAS_VENTA', schemaKey: 'clausulaVenta' },
  { modelo: 'tipoReclamo', prefixRuta: 'tipos-reclamo', label: 'Tipo de Reclamo', itemCodigo: 'CONFIG_TIPOS_RECLAMO', schemaKey: 'tipoReclamo' },
  { modelo: 'mercado', prefixRuta: 'mercados', label: 'Mercado', itemCodigo: 'CONFIG_MERCADOS', schemaKey: 'mercado' },
  // Lote 3
  { modelo: 'puerto', prefixRuta: 'puertos', label: 'Puerto', itemCodigo: 'CONFIG_PUERTOS', schemaKey: 'puerto' },
  { modelo: 'moneda', prefixRuta: 'monedas', label: 'Moneda', itemCodigo: 'CONFIG_MONEDAS', schemaKey: 'moneda' },
  { modelo: 'conceptoCtaCte', prefixRuta: 'conceptos-cta-cte', label: 'Concepto Cta. Cte.', itemCodigo: 'CONFIG_CONCEPTOS_CTA_CTE', schemaKey: 'conceptoCtaCte' },
  // Lote 4
  { modelo: 'temporada', prefixRuta: 'temporadas', label: 'Temporada', itemCodigo: 'CONFIG_TEMPORADAS', schemaKey: 'temporada' },
  { modelo: 'bodega', prefixRuta: 'bodegas', label: 'Bodega', itemCodigo: 'CONFIG_BODEGAS', schemaKey: 'bodega' },
]

export async function configRoutes(app: FastifyInstance) {
  // Módulos de seguridad: perfiles, usuarios e ítems de menú
  await app.register(perfilesRoutes)
  await app.register(usuariosRoutes)
  await app.register(entidadesRoutes)
  await app.register(empresasRoutes)
  await app.register(correoRoutes)
  await app.register(conceptosLiquidacionRoutes)
  await app.register(condicionesPagoRoutes)
  await app.register(prefijosCodigoRoutes)
  await app.register(templatesCargaRoutes)
  await app.register(notasCalidadRoutes)
  await app.register(notasCondicionRoutes)
  await app.register(integracionesRoutes)
  await app.register(cargaMaestrosRoutes)
  await app.register(cargaEntidadesDetalleRoutes)
  await app.register(cajasPorPalletRoutes)

  // Menú accesible del usuario autenticado
  app.get('/me/menu', { preHandler: [requireAuth] }, getMiMenu)

  // Empresas accesibles del usuario autenticado (multi-empresa, Fase 1)
  app.get('/me/empresas', { preHandler: [requireAuth] }, getMisEmpresas)

  // Ruta especial: temporada predeterminada (antes del loop para evitar que :id capture "predeterminada")
  app.get('/temporadas/predeterminada', { preHandler: [requireAuth, requireLevel('CONFIG_TEMPORADAS', 'LECTURA')] }, getTemporadaPredeterminada)

  for (const cfg of MANTENEDORES) {
    const ctrl = makeControllers(cfg.modelo, cfg.schemaKey)
    const item = cfg.itemCodigo

    app.get(`/${cfg.prefixRuta}`, { preHandler: [requireAuth, requireLevel(item, 'LECTURA')] }, ctrl.list)
    app.get(`/${cfg.prefixRuta}/:id`, { preHandler: [requireAuth, requireLevel(item, 'LECTURA')] }, ctrl.getById)
    app.post(`/${cfg.prefixRuta}`, { preHandler: [requireAuth, requireLevel(item, 'TOTAL')] }, ctrl.create)
    app.patch(`/${cfg.prefixRuta}/:id`, { preHandler: [requireAuth, requireLevel(item, 'TOTAL')] }, ctrl.update)
    app.delete(`/${cfg.prefixRuta}/:id`, { preHandler: [requireAuth, requireLevel(item, 'TOTAL')] }, ctrl.remove)
  }
}
