import { NotFoundError } from '../../../shared/errors.js'
import {
  getEmbarqueParaProforma,
  getCuotasPagoNotaVenta,
  getProformaById,
} from '../../ventas/cobranza/proforma.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri, getEspecieImagenDataUri } from '../documentos.repository.js'
import { factorFob, subtotalFob as calcSubtotalFob, totalClausula, unitarioFob } from '../../ventas/cobranza/clausula-flete-seguro.js'
import { descripcionLinea } from '../../ventas/cobranza/descripcion-idioma.js'
import { resolverDatosEmbarqueExport } from './datos-embarque-export.js'
import { montoEnPalabras } from '../ui/monto-en-palabras.js'
import { actorCompleto } from './instructivo-embarque.resolver.js'
import { lineasDireccion } from './orden-compra.resolver.js'
import { condicionPagoSii } from '../../ventas/cobranza/condicion-pago-sii.js'
import type { ProformaPdfPayload } from '../schemas/proforma.schema.js'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Resolver de la Proforma de Exportación (cobranza.md, 2026-09-24). `id` es
// el id de la Proforma (documento ya emitido, no del Embarque).
export async function resolverProforma(id: number, empresaId: number): Promise<ProformaPdfPayload> {
  const proforma = await getProformaById(id)
  if (!proforma) throw new NotFoundError('Proforma', String(id))

  const embarque = await getEmbarqueParaProforma(proforma.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(proforma.embarqueId))

  const exportadorId = embarque.notaVenta.exportadorId
  const [empresa, cliente, cuotasPago, datosEmbarque, exportadora] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(proforma.clienteId),
    getCuotasPagoNotaVenta(embarque.notaVentaId),
    resolverDatosEmbarqueExport(proforma.embarqueId),
    exportadorId ? getEntidadParaDocumento(exportadorId) : Promise.resolve(null),
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

  // Desglose de la cláusula de venta. montoTotal es el valor cláusula/CIF; el
  // flete y el seguro son un monto cerrado dentro de él y el resto es FOB.
  const montoTotal = Number(proforma.montoTotal)
  const montoFlete = proforma.montoFlete == null ? null : Number(proforma.montoFlete)
  const montoSeguro = proforma.montoSeguro == null ? null : Number(proforma.montoSeguro)
  const fleteSumado = proforma.fleteSumaAlPrecio
  const factor = factorFob(montoTotal, montoFlete, montoSeguro, fleteSumado)
  const subtotalFob = calcSubtotalFob(montoTotal, montoFlete, montoSeguro, fleteSumado)
  const totalCif = totalClausula(montoTotal, montoFlete, montoSeguro, fleteSumado)

  const idioma = proforma.idioma === 'EN' ? 'EN' : 'ES'

  // Exportador (2026-11-13): mismo bloque que el Instructivo v4 — la entidad
  // EXPORTADORA de la NV; sin una, la empresa emisora (sin contactos).
  const actorExp = actorCompleto(exportadora, idioma)
  const exportador = actorExp
    ? {
        razonSocial: actorExp.razonSocial,
        rut: actorExp.rut,
        taxId: actorExp.taxId,
        esNacional: actorExp.esNacional,
        direccion: actorExp.direccion,
        direccionLineas: actorExp.direccionLineas,
        telefono: actorExp.telefono,
        contactosDocumentales: actorExp.contactosDocumentales,
      }
    : {
        razonSocial: empresa?.razonSocial ?? '—',
        rut: empresa?.rut ?? null,
        taxId: null,
        esNacional: true,
        direccion: empresa?.direcciones[0]?.direccion ?? null,
        direccionLineas: lineasDireccion(empresa?.direcciones[0], idioma),
        telefono: empresa?.telefono ?? null,
        contactosDocumentales: [],
      }

  // Contado/Crédito (2026-11-13): misma regla que la Factura Nacional, con la
  // fecha del documento como referencia FACTURA.
  const fechaDoc = proforma.fechaDocumento ?? proforma.fechaEmision
  const basePorReferencia: Record<string, Date | null | undefined> = { ...fechasPorReferencia, FACTURA: fechaDoc, ENVIO_DOCUMENTOS: null }
  const formaPago = condicionPagoSii(
    cuotasPago.map((c) => {
      const base = basePorReferencia[c.fechaReferencia]
      return { fechaVencimiento: base ? new Date(base.getTime() + c.plazoDias * 86_400_000) : null }
    }),
    fechaDoc,
  ).fmaPago === 1 ? 'CONTADO' as const : 'CREDITO' as const

  // Totales al pie: cajas de la fruta (las sublíneas de "Separar cantidades"
  // repiten la cantidad y no se suman) y pallets del Embarque.
  const totalCajas = proforma.lineas.reduce((a, l) => a + l.cantidadCajas, 0)
  const paisCliente = cliente?.pais ? (idioma === 'EN' ? cliente.pais.descripcionExtranjera?.trim() || cliente.pais.descripcion : cliente.pais.descripcion) : null

  // Imagen de la especie (primera línea) para la cabecera corporativa (2026-11-08).
  const especieImagenDataUri = await getEspecieImagenDataUri(proforma.lineas[0]?.especieId ?? null)

  return {
    especieImagenDataUri,
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      telefono: empresa?.telefono ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    exportador,
    codigo: proforma.codigo,
    numeroInstructivo: embarque.numeroInstructivo,
    // Fecha del documento (editable) — cae a la fecha de emisión si no se fijó.
    fechaEmision: (proforma.fechaDocumento ?? proforma.fechaEmision).toISOString(),
    idioma: proforma.idioma as 'EN' | 'ES',
    cliente: {
      razonSocial: cliente?.razonSocial ?? '—',
      rut: cliente?.identificador ?? null,
      direccion: cliente?.direcciones[0]?.direccion ?? null,
      pais: paisCliente,
    },
    moneda: proforma.moneda.codigo,
    condicionPago: proforma.condicionPago?.descripcion ?? null,
    formaPago,
    totalCajas,
    totalPallets: datosEmbarque?.totalPallets ?? null,
    observaciones: proforma.observaciones ?? null,
    variante: 'PROFORMA',
    folio: null,
    tipoDte: null,
    // Detalle a valor FOB: si la cláusula exige Flete/Seguro, el precio unitario
    // cláusula/CIF se lleva a FOB con el factor. Sin flete/seguro el factor es 1
    // y las líneas quedan idénticas al valor cláusula.
    // "Separar cantidades" (2026-11-10): la sublínea va como fila propia debajo
    // de su línea de fruta (texto libre, misma cantidad, su valor a FOB). Los
    // montos de cada fila se redondean por separado, igual que en el DTE 110.
    lineas: proforma.lineas.flatMap((l) => {
      const cajas = l.cantidadCajas
      const precioFruta = unitarioFob(Number(l.precioUnitario), factor)
      const sep = l.separacionPrecioUnitario == null ? null : Number(l.separacionPrecioUnitario)
      const fruta = {
        // Descripción reconstruida en el idioma del documento (ES/EN).
        descripcion: descripcionLinea(l, proforma.idioma === 'EN' ? 'EN' : 'ES'),
        cantidadCajas: cajas,
        precioUnitario: precioFruta,
        montoLinea: sep == null ? round2(Number(l.montoLinea) * factor) : round2(Number(l.precioUnitario) * cajas * factor),
      }
      if (sep == null || !l.separacionDescripcion) return [fruta]
      return [
        fruta,
        {
          descripcion: l.separacionDescripcion,
          cantidadCajas: cajas,
          precioUnitario: unitarioFob(sep, factor),
          montoLinea: round2(sep * cajas * factor),
        },
      ]
    }),
    montoFlete,
    montoSeguro,
    subtotalFob,
    montoTotal: totalCif,
    vencimientosEstimados,
    transporte: datosEmbarque
      ? {
          nave: datosEmbarque.nave,
          via: datosEmbarque.via,
          blAwb: datosEmbarque.blAwb,
          tipoBl: datosEmbarque.tipoBl,
          booking: datosEmbarque.booking,
          contenedor: datosEmbarque.contenedor,
          sello: datosEmbarque.sello,
          dus: datosEmbarque.dus,
          puertoEmbarque: datosEmbarque.puertoEmbarque,
          puertoDestino: datosEmbarque.puertoDestino,
          etd: datosEmbarque.etd,
          eta: datosEmbarque.eta,
          flete: datosEmbarque.flete,
          modalidadVenta: datosEmbarque.modalidadVenta,
          incoterm: datosEmbarque.incoterm,
        }
      : null,
    notify: datosEmbarque?.notify ?? null,
    consignatario: datosEmbarque?.consignatario ?? null,
    pesoNeto: datosEmbarque?.pesoNeto ?? null,
    pesoBruto: datosEmbarque?.pesoBruto ?? null,
    montoEnPalabras: montoEnPalabras(totalCif, idioma, proforma.moneda.codigo),
  }
}
