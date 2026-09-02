import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as repo from './stock.repository.js'
import type { StockDetalleRow, PalletUpdateInput } from './stock.types.js'

export async function obtenerStock(): Promise<StockDetalleRow[]> {
  const pallets = await repo.listPalletsConLineas()
  const rows: StockDetalleRow[] = []
  for (const pallet of pallets) {
    for (const linea of pallet.lineas) {
      const kgNeto = linea.articulo.kgNetoEnvase != null ? Number(linea.articulo.kgNetoEnvase) : 0
      rows.push({
        palletLineaId: linea.id,
        palletId: pallet.id,
        numeroPallet: pallet.numeroPallet,
        especieId: linea.especieId,
        especie: linea.especie,
        variedadId: linea.variedadId,
        variedad: linea.variedad,
        categoriaId: linea.categoriaId,
        categoria: linea.categoria,
        calibreId: linea.calibreId,
        calibre: linea.calibre,
        productorId: pallet.productorId,
        productor: pallet.productor,
        origen: pallet.origen,
        // La Recepción que generó el Pallet nunca es RECHAZADA (una
        // Recepción rechazada no genera Pallets) — el cast es seguro.
        estado: pallet.recepcion.estado as 'CARGADA' | 'VALIDADA',
        fechaRecepcion: pallet.creadoEn,
        cajas: linea.cajas,
        // Sin redondear acá (QAS-STK-004, QA ronda 2): redondear por línea
        // pierde precisión y acumula diferencia en los totales agregados —
        // el redondeo es responsabilidad de la presentación (fas-web).
        kg: linea.cajas * kgNeto,
        notaCalidadId: pallet.notaCalidadId,
        notaCalidad: pallet.notaCalidad,
        notaCondicionId: pallet.notaCondicionId,
        notaCondicion: pallet.notaCondicion,
        completo: pallet.completo,
      })
    }
  }
  return rows
}

async function validarReferencias(data: PalletUpdateInput) {
  if (data.notaCalidadId != null) {
    const nota = await repo.getNotaCalidadById(data.notaCalidadId)
    if (!nota) throw new ValidationError('La Nota de Calidad seleccionada no existe o fue eliminada')
  }
  if (data.notaCondicionId != null) {
    const nota = await repo.getNotaCondicionById(data.notaCondicionId)
    if (!nota) throw new ValidationError('La Nota de Condición seleccionada no existe o fue eliminada')
  }
}

export async function actualizarPallet(id: number, data: PalletUpdateInput) {
  const pallet = await repo.getPalletParaEdicion(id)
  if (!pallet) throw new NotFoundError('Pallet', String(id))
  await validarReferencias(data)
  return repo.updatePalletNotas(id, data)
}
