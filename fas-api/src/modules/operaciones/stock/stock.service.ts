import * as repo from './stock.repository.js'
import type { StockFiltros } from './stock.types.js'

interface Mantenedor {
  id: number
  codigo: string
  descripcion: string
}

interface GrupoStock {
  especieId: number
  especie: Mantenedor
  variedadId: number
  variedad: Mantenedor
  categoriaId: number
  categoria: Mantenedor
  calibreId: number
  calibre: Mantenedor
  cajas: number
  pallets: number
}

// Resumen agrupado por especie/variedad/categoría/calibre — la fila del
// reporte en pantalla. Se arma en memoria a partir de listPalletsConLineas
// (no groupBy de Prisma): PalletLinea no es modelo tenant (tabla hija, mismo
// patrón que OrdenCompraLinea/NotaVentaDetalle), así que agregar cross-tenant
// directamente sobre ella exigiría inyectar el empresaId a mano; en cambio,
// listar desde Pallet (que sí es tenant) deja que el Prisma Client Extension
// haga ese trabajo, y el volumen de pallets en inventario no justifica
// mover la agregación a SQL.
export async function obtenerResumenStock(filtros: StockFiltros): Promise<GrupoStock[]> {
  const pallets = await repo.listPalletsConLineas(filtros)

  const grupos = new Map<string, GrupoStock & { palletIds: Set<number> }>()
  for (const pallet of pallets) {
    for (const linea of pallet.lineas) {
      const key = `${linea.especieId}-${linea.variedadId}-${linea.categoriaId}-${linea.calibreId}`
      let grupo = grupos.get(key)
      if (!grupo) {
        grupo = {
          especieId: linea.especieId,
          especie: linea.especie,
          variedadId: linea.variedadId,
          variedad: linea.variedad,
          categoriaId: linea.categoriaId,
          categoria: linea.categoria,
          calibreId: linea.calibreId,
          calibre: linea.calibre,
          cajas: 0,
          pallets: 0,
          palletIds: new Set(),
        }
        grupos.set(key, grupo)
      }
      grupo.cajas += linea.cajas
      grupo.palletIds.add(pallet.id)
    }
  }

  return [...grupos.values()]
    .map(({ palletIds, ...grupo }) => ({ ...grupo, pallets: palletIds.size }))
    .sort(
      (a, b) =>
        a.especie.descripcion.localeCompare(b.especie.descripcion) ||
        a.variedad.descripcion.localeCompare(b.variedad.descripcion) ||
        a.categoria.descripcion.localeCompare(b.categoria.descripcion) ||
        a.calibre.descripcion.localeCompare(b.calibre.descripcion),
    )
}

// Drill-down: un Pallet por fila para la combinación especie/variedad/
// categoría/calibre solicitada (más los demás filtros activos) — reutiliza
// la misma consulta que el resumen, ya que stockDetalleQuerySchema exige
// esos 4 campos y listPalletsConLineas ya filtra las líneas por ellos.
export async function obtenerDetalleStock(filtros: StockFiltros) {
  const pallets = await repo.listPalletsConLineas(filtros)
  return pallets.flatMap((pallet) =>
    pallet.lineas.map((linea) => ({
      palletLineaId: linea.id,
      palletId: pallet.id,
      numeroPallet: pallet.numeroPallet,
      origen: pallet.origen,
      creadoEn: pallet.creadoEn,
      productor: pallet.productor,
      cajas: linea.cajas,
    })),
  )
}
