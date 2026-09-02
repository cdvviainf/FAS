import { prisma } from '../../../lib/prisma.js'

const entidadSelect = { id: true, codigo: true, descripcion: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

// Pallets vigentes de la empresa que siguen siendo stock DISPONIBLE (modelo
// tenant — el Prisma Client Extension inyecta empresaId) con sus líneas y los
// datos necesarios para resolver especie/variedad/categoría/calibre/
// productor/estado/kg. `embarqueId: null` (2026-09-02, EP-QA-005): un pallet
// ya reservado a un Embarque dejó de ser stock disponible — compras.md §11
// describe este reporte como "stock disponible", no "todo lo recepcionado
// alguna vez". Sin más filtros: el reporte en pantalla (fas-web) trae este
// dataset completo una sola vez y filtra/agrupa/pagina en el cliente
// (2026-08-24, ver compras.md §11 y stock.types.ts).
export async function listPalletsConLineas() {
  return prisma.pallet.findMany({
    where: { embarqueId: null },
    include: {
      productor: { select: entidadSelect },
      recepcion: { select: { estado: true } },
      lineas: {
        include: {
          especie: { select: mantenedorSelect },
          variedad: { select: mantenedorSelect },
          categoria: { select: mantenedorSelect },
          // orden: para graficar la distribución de calibres respetando el
          // orden del maestro (por especie), no el orden alfabético.
          calibre: { select: { ...mantenedorSelect, orden: true } },
          articulo: { select: { kgNetoEnvase: true } },
        },
      },
    },
    orderBy: { creadoEn: 'desc' },
  })
}
