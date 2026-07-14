import type { FastifyInstance } from 'fastify'
import { makeControllers, getTemporadaPredeterminada } from './config.controller.js'
import type { MantenedorConfig } from './config.types.js'

const MANTENEDORES: MantenedorConfig[] = [
  { modelo: 'pais', prefixRuta: 'paises', label: 'País', tienePaisOrigen: true, schemaKey: 'pais' },
  { modelo: 'zona', prefixRuta: 'zonas', label: 'Zona' },
  { modelo: 'grupoMercado', prefixRuta: 'grupos-mercado', label: 'Grupo de Mercado' },
  { modelo: 'tipoEmbarque', prefixRuta: 'tipos-embarque', label: 'Tipo de Embarque' },
  { modelo: 'unidadMedida', prefixRuta: 'unidades-medida', label: 'Unidad de Medida' },
  { modelo: 'tipoPallet', prefixRuta: 'tipos-pallet', label: 'Tipo de Pallet' },
  { modelo: 'altura', prefixRuta: 'alturas', label: 'Altura' },
  { modelo: 'tipoProduccion', prefixRuta: 'tipos-produccion', label: 'Tipo de Producción' },
  { modelo: 'tipoDefecto', prefixRuta: 'tipos-defecto', label: 'Tipo de Defecto' },
  { modelo: 'tipoParametro', prefixRuta: 'tipos-parametro', label: 'Tipo de Parámetro' },
  // Sin FK
  { modelo: 'region', prefixRuta: 'regiones', label: 'Región' },
  { modelo: 'especie', prefixRuta: 'especies', label: 'Especie', schemaKey: 'especie' },
  // Con FK
  { modelo: 'provincia', prefixRuta: 'provincias', label: 'Provincia', schemaKey: 'provincia' },
  { modelo: 'comuna', prefixRuta: 'comunas', label: 'Comuna', schemaKey: 'comuna' },
  { modelo: 'grupoVariedad', prefixRuta: 'grupos-variedad', label: 'Grupo de Variedad', schemaKey: 'grupoVariedad' },
  { modelo: 'variedad', prefixRuta: 'variedades', label: 'Variedad', schemaKey: 'variedad' },
  { modelo: 'categoria', prefixRuta: 'categorias', label: 'Categoría', schemaKey: 'categoria' },
  { modelo: 'calibre', prefixRuta: 'calibres', label: 'Calibre', schemaKey: 'calibre' },
  { modelo: 'parametro', prefixRuta: 'parametros', label: 'Parámetro', schemaKey: 'parametro' },
  { modelo: 'mercado', prefixRuta: 'mercados', label: 'Mercado', schemaKey: 'mercado' },
  // Lote 3
  { modelo: 'puerto', prefixRuta: 'puertos', label: 'Puerto', schemaKey: 'puerto' },
  { modelo: 'moneda', prefixRuta: 'monedas', label: 'Moneda', schemaKey: 'moneda' },
  { modelo: 'conceptoCtaCte', prefixRuta: 'conceptos-cta-cte', label: 'Concepto Cta. Cte.', schemaKey: 'conceptoCtaCte' },
  // Lote 4
  { modelo: 'temporada', prefixRuta: 'temporadas', label: 'Temporada', schemaKey: 'temporada' },
  { modelo: 'bodega', prefixRuta: 'bodegas', label: 'Bodega', schemaKey: 'bodega' },
]

export async function configRoutes(app: FastifyInstance) {
  // Ruta especial: temporada predeterminada (antes del loop para evitar que :id capture "predeterminada")
  app.get('/temporadas/predeterminada', getTemporadaPredeterminada)

  for (const cfg of MANTENEDORES) {
    const ctrl = makeControllers(cfg.modelo, cfg.schemaKey)

    app.get(`/${cfg.prefixRuta}`, ctrl.list)
    app.get(`/${cfg.prefixRuta}/:id`, ctrl.getById)
    app.post(`/${cfg.prefixRuta}`, ctrl.create)
    app.patch(`/${cfg.prefixRuta}/:id`, ctrl.update)
    app.delete(`/${cfg.prefixRuta}/:id`, ctrl.remove)
  }
}
