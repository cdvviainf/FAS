import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { getMovimientoById } from '../../materiales/movimientos/movimientos.repository.js'
import { getEmpresaParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { MovimientoPdfPayload } from '../schemas/movimiento.schema.js'

// Resolver de Movimiento — reusa movimientos.repository.ts (repository
// pattern, CLAUDE.md §12.2) en vez de duplicar la query. Compartido por las
// dos entradas del registro ('movimiento' y 'movimiento-guia-despacho');
// resolverMovimientoGuiaDespacho agrega el gate de negocio propio de esa
// variante.
export async function resolverMovimiento(id: number, empresaId: number): Promise<MovimientoPdfPayload> {
  const mov = await getMovimientoById(id)
  if (!mov) throw new NotFoundError('Movimiento', String(id))

  const empresa = await getEmpresaParaDocumento(empresaId)

  const lineas = mov.detalle.map((d) => {
    const cantidad = Number(d.cantidad)
    const precioUnitario = d.precioUnitario != null ? Number(d.precioUnitario) : null
    return {
      articulo: `${d.articulo.codigo} — ${d.articulo.descripcion}`,
      cantidad: cantidad.toString(),
      precioUnitario: precioUnitario != null ? precioUnitario.toString() : null,
      subtotal: precioUnitario != null ? (cantidad * precioUnitario).toString() : null,
    }
  })
  const cantidadTotal = mov.detalle.reduce((acc, d) => acc + Number(d.cantidad), 0)
  const subtotalTotal = mov.detalle.length > 0 && mov.detalle.every((d) => d.precioUnitario != null)
    ? mov.detalle.reduce((acc, d) => acc + Number(d.cantidad) * Number(d.precioUnitario), 0)
    : null

  return {
    empresa: {
      codigo: empresa?.codigo ?? '',
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    numero: `MOV-${String(mov.id).padStart(6, '0')}`,
    fecha: mov.fechaMovimiento.toISOString(),
    estado: mov.estado,
    emiteDTE: mov.tipoMovimiento.emiteDTE,
    tipoMovimiento: mov.tipoMovimiento.descripcion,
    clase: mov.tipoMovimiento.clase,
    bodegaOrigen: mov.bodegaOrigen?.descripcion ?? null,
    bodegaDestino: mov.bodegaDestino?.descripcion ?? null,
    entidad: mov.entidad?.razonSocial ?? mov.entidad?.descripcion ?? null,
    guiaReferencia: mov.guiaReferencia,
    transporte: {
      transportista: mov.transporteEntidad?.razonSocial ?? mov.transporteEntidad?.descripcion ?? null,
      choferRut: mov.choferRut,
      choferNombre: mov.choferNombre,
      placaCamion: mov.placaCamion,
      placaRemolque: mov.placaRemolque,
      horaSalida: mov.horaSalida ? mov.horaSalida.toISOString() : null,
      horaEstimadaLlegada: mov.horaEstimadaLlegada ? mov.horaEstimadaLlegada.toISOString() : null,
    },
    lineas,
    totales: {
      cantidad: cantidadTotal.toString(),
      subtotal: subtotalTotal != null ? subtotalTotal.toString() : null,
    },
  }
}

// La Guía de Despacho (interna, no válida como DTE — ver Docs/
// agrosan_etapa4_motor_documentos.md §7) solo tiene sentido para movimientos
// cuyo tipo captura datos de transporte, y solo una vez confirmado (un
// borrador todavía puede cambiar de bodega/entidad/líneas).
export async function resolverMovimientoGuiaDespacho(id: number, empresaId: number): Promise<MovimientoPdfPayload> {
  const payload = await resolverMovimiento(id, empresaId)
  if (!payload.emiteDTE) {
    throw new ValidationError('Este tipo de movimiento no exige datos de transporte — no corresponde generar una Guía de Despacho')
  }
  if (payload.estado !== 'CONFIRMADO') {
    throw new ValidationError('El movimiento debe estar confirmado para generar la Guía de Despacho')
  }
  return payload
}
