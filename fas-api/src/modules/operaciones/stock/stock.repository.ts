import { prisma } from '../../../lib/prisma.js'
import type { StockFiltros } from './stock.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

function whereLineas(f: StockFiltros) {
  return {
    ...(f.especieId ? { especieId: f.especieId } : {}),
    ...(f.variedadId ? { variedadId: f.variedadId } : {}),
    ...(f.categoriaId ? { categoriaId: f.categoriaId } : {}),
    ...(f.calibreId ? { calibreId: f.calibreId } : {}),
  }
}

// Trae los Pallet vigentes que calzan con los filtros, junto con SOLO las
// líneas de cada Pallet que calzan (un Pallet puede mezclar más de una
// combinación especie/variedad/categoría/calibre) — tanto el resumen
// agrupado como el detalle por pallet (stock.service.ts) se arman a partir
// de este mismo resultado, sin duplicar la consulta. `Pallet` es modelo
// tenant (ver prisma-tenancy.ts) — el Prisma Client Extension inyecta
// empresaId automáticamente, no hace falta filtrarlo acá.
export async function listPalletsConLineas(filtros: StockFiltros) {
  const lineasWhere = whereLineas(filtros)
  return prisma.pallet.findMany({
    where: {
      ...(filtros.productorId ? { productorId: filtros.productorId } : {}),
      ...(filtros.origen ? { origen: filtros.origen } : {}),
      ...(filtros.fechaDesde || filtros.fechaHasta
        ? {
            creadoEn: {
              ...(filtros.fechaDesde ? { gte: filtros.fechaDesde } : {}),
              ...(filtros.fechaHasta ? { lte: filtros.fechaHasta } : {}),
            },
          }
        : {}),
      // Sin esto, un Pallet sin ninguna línea que calce con los filtros de
      // fruta igual entraría al resultado (con `lineas: []` tras el include
      // filtrado de abajo) — se exige al menos una línea que calce.
      ...(Object.keys(lineasWhere).length > 0 ? { lineas: { some: lineasWhere } } : {}),
    },
    include: {
      productor: { select: entidadSelect },
      lineas: {
        where: lineasWhere,
        include: {
          especie: { select: mantenedorSelect },
          variedad: { select: mantenedorSelect },
          categoria: { select: mantenedorSelect },
          calibre: { select: mantenedorSelect },
        },
      },
    },
    orderBy: { creadoEn: 'desc' },
  })
}
