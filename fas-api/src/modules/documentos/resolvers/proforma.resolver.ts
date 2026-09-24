import { NotFoundError } from '../../../shared/errors.js'
import {
  getEmbarqueParaProforma,
  getCuotasPagoNotaVenta,
  getProformaById,
} from '../../ventas/cobranza/proforma.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { ProformaPdfPayload } from '../schemas/proforma.schema.js'

// Resolver de la Proforma de Exportación (cobranza.md, 2026-09-24). `id` es
// el id de la Proforma (documento ya emitido, no del Embarque).
export async function resolverProforma(id: number, empresaId: number): Promise<ProformaPdfPayload> {
  const proforma = await getProformaById(id)
  if (!proforma) throw new NotFoundError('Proforma', String(id))

  const embarque = await getEmbarqueParaProforma(proforma.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(proforma.embarqueId))

  const [empresa, cliente, cuotasPago] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(proforma.clienteId),
    getCuotasPagoNotaVenta(embarque.notaVentaId),
  ])

  // Fechas de referencia resolubles hoy (D6): ZARPE y ARRIBO. FACTURA/
  // ENVIO_DOCUMENTOS no tienen fecha resoluble todavía (sin Factura DTE
  // construida) — quedan "Pendiente" en el PDF. FAS-PROF-EXP-002 (QA ronda
  // 1): el enum real (`FechaReferenciaPago`, schema.prisma) es
  // FACTURA/ZARPE/ENVIO_DOCUMENTOS/ARRIBO — no EMBARQUE/BL/PROFORMA como
  // asumía la primera versión de este resolver (copiados del texto del spec
  // original, desactualizado — ver Docs/cobranza.md §0.b).
  const fechaZarpe = embarque.reservaManual ? embarque.fechaZarpeManual : embarque.solicitudReserva?.fechaZarpe
  const fechasPorReferencia: Partial<Record<string, Date | null | undefined>> = {
    ZARPE: fechaZarpe,
    ARRIBO: embarque.fechaArribo,
  }

  // FAS-PROF-EXP-006 (QA ronda 1): se entrega la clave semántica cruda —
  // ProformaV1 (la plantilla) es quien traduce según `idioma`, mismo criterio
  // que el resto de los rótulos del documento (Etapa 4 §5: nada se formatea
  // ni traduce a mano en el resolver).
  const vencimientosEstimados = cuotasPago.map((c, i) => {
    const fechaBase = fechasPorReferencia[c.fechaReferencia]
    const fechaEstimada = fechaBase ? new Date(fechaBase.getTime() + c.plazoDias * 86_400_000) : null
    // MONTO_UNITARIO ya viene resuelto en dólares desde el Cierre Comercial
    // (montoCalculado) — no escala con el total real de esta Proforma, a
    // diferencia de PORCENTAJE (recalculado al vuelo, D4).
    const monto =
      c.tipoValor === 'PORCENTAJE'
        ? (Number(c.porcentaje ?? 0) / 100) * Number(proforma.montoTotal)
        : Number(c.montoCalculado ?? 0)
    return {
      numeroCuota: i + 1,
      descripcion: c.descripcion,
      monto,
      fechaReferencia: c.fechaReferencia,
      plazoDias: c.plazoDias,
      fechaEstimada: fechaEstimada ? fechaEstimada.toISOString() : null,
    }
  })

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    codigo: proforma.codigo,
    numeroInstructivo: embarque.numeroInstructivo,
    fechaEmision: proforma.fechaEmision.toISOString(),
    idioma: proforma.idioma as 'EN' | 'ES',
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
    },
    moneda: proforma.moneda.codigo,
    condicionPago: proforma.condicionPago?.descripcion ?? null,
    lineas: proforma.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidadCajas: l.cantidadCajas,
      precioUnitario: Number(l.precioUnitario),
      montoLinea: Number(l.montoLinea),
    })),
    montoTotal: Number(proforma.montoTotal),
    vencimientosEstimados,
  }
}
