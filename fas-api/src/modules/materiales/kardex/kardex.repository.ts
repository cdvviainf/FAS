import { prisma } from '../../../lib/prisma.js'

const mantenedorSelect = { id: true, codigo: true, descripcion: true }

export async function getArticuloActivo(id: number) {
  return prisma.articulo.findUnique({ where: { id }, select: { id: true, codigo: true, descripcion: true } })
}

export async function getBodegaById(id: number) {
  return prisma.bodega.findUnique({ where: { id }, select: mantenedorSelect })
}

// Todas las líneas de Movimiento del artículo, sin límite de fecha: el saldo
// inicial de un rango se calcula reproduciendo desde el origen (los
// movimientos CONFIRMADO son inmutables — R1 de materiales.md — así que no
// hay que preocuparse por ediciones retroactivas). Solo movimientos
// CONFIRMADO y no eliminados: un BORRADOR todavía no aplicó su efecto en
// SaldoArticulo (motor de PMP en confirmarMovimientoTransaccional), así que
// tampoco debe aparecer en el saldo corrido del Kardex. Orden
// fechaMovimiento/id: refleja la fecha efectiva de negocio: si se ingresan
// movimientos con fecha retroactiva fuera de su orden real de creación, el
// saldo corrido mostrado puede diferir transitoriamente del que quedó
// aplicado en SaldoArticulo (que se actualiza en orden de confirmación) —
// comportamiento aceptado, no se recalcula históricamente.
export async function listDetalleDelArticulo(articuloId: number) {
  return prisma.movimientoDetalle.findMany({
    where: { articuloId, movimiento: { estado: 'CONFIRMADO', eliminadoEn: null } },
    include: {
      movimiento: {
        select: {
          id: true,
          fechaMovimiento: true,
          bodegaOrigenId: true,
          bodegaDestinoId: true,
          guiaReferencia: true,
          tipoMovimiento: { select: { id: true, codigo: true, descripcion: true, clase: true } },
          bodegaOrigen: { select: mantenedorSelect },
          bodegaDestino: { select: mantenedorSelect },
          entidad: { select: mantenedorSelect },
        },
      },
    },
    orderBy: [{ movimiento: { fechaMovimiento: 'asc' } }, { movimientoId: 'asc' }],
  })
}
