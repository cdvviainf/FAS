import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import { validarYCompletarLineas } from './proforma.service.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import { mapFacturaExportacionA110 } from '../../finanzas/facturacion/mappers/factura-exportacion.mapper.js'
import * as repo from './factura-exportacion.repository.js'
import type {
  DimensionProforma,
  FacturaExportacionActualizarInput,
  FacturasExportacionListFilters,
  ProformaLineaInput,
} from './factura-exportacion.types.js'

const ORIGEN_TIPO = 'factura-exportacion'
const TIPO_DTE_FACTURA_EXPORTACION = 110
// RUT genérico de receptor extranjero en DTE de exportación (mismo que usa el mapper).
const RUT_RECEPTOR_EXTRANJERO = '55555555-5'

// Suma exacta en centavos (evita arrastre de float) — mismo criterio que Proforma.
function sumarMontos(montos: number[]): number {
  return montos.reduce((acc, m) => acc + Math.round(m * 100), 0) / 100
}

function requireEmbarqueDespachado(embarque: { despachadoEn: Date | null; despachoAnuladoEn: Date | null }) {
  const despachado = !!embarque.despachadoEn && !embarque.despachoAnuladoEn
  if (!despachado) throw new ValidationError('Este Embarque debe estar despachado antes de facturar')
}

// ─── Crear borrador desde una Proforma emitida ───────────────────────────────
export async function crearBorradorDesdeProforma(proformaId: number, userId: string) {
  const proforma = await repo.getProformaEmitidaParaFactura(proformaId)
  if (!proforma) throw new NotFoundError('Proforma', String(proformaId))
  if (proforma.estado !== 'EMITIDA') {
    throw new ValidationError('Solo se puede facturar una Proforma emitida')
  }

  const embarque = await repo.getEmbarqueParaFacturaDte(proforma.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(proforma.embarqueId))
  requireEmbarqueDespachado(embarque)

  const existente = await repo.getFacturaActivaPorEmbarque(proforma.embarqueId)
  if (existente) {
    throw new ValidationError('Este Embarque ya tiene una Factura de Exportación — anúlala antes de crear otra (CB2)')
  }

  const codigo = await siguienteCodigo('facturaExportacion')
  if (!codigo) {
    throw new ValidationError(
      'No hay un prefijo de código configurado para Factura de Exportación (Configuración › Prefijos de Código)',
    )
  }

  const lineas = proforma.lineas.map((l) => ({
    descripcion: l.descripcion,
    especieId: l.especieId,
    variedadId: l.variedadId,
    articuloId: l.articuloId,
    calibreId: l.calibreId,
    categoriaId: l.categoriaId,
    etiquetaId: l.etiquetaId,
    cantidadCajas: l.cantidadCajas,
    precioUnitario: Number(l.precioUnitario),
    montoLinea: Number(l.montoLinea),
  }))
  const montoTotal = sumarMontos(lineas.map((l) => l.montoLinea))

  try {
    return await repo.crearBorrador(
      {
        embarqueId: proforma.embarqueId,
        proformaId: proforma.id,
        codigo,
        clienteId: proforma.clienteId,
        monedaId: proforma.monedaId,
        condicionPagoId: proforma.condicionPagoId,
        dimensiones: proforma.dimensionesAgrupacion,
        montoTotal,
        lineas,
      },
      userId,
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ValidationError('Este Embarque ya tiene una Factura de Exportación — recarga e intenta de nuevo')
    }
    throw err
  }
}

// ─── Editar valores/agrupación (solo BORRADOR) ───────────────────────────────
export async function actualizarBorrador(id: number, body: FacturaExportacionActualizarInput, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado !== 'BORRADOR') {
    throw new ValidationError('Solo se puede editar una Factura en estado Borrador')
  }

  // Reusa el motor de agrupación canónica de la Proforma: revalida las líneas
  // contra los pallets reales del Embarque y deriva montoLinea = precio × cajas.
  const lineas = await validarYCompletarLineas(
    factura.embarqueId,
    body.dimensiones as DimensionProforma[],
    body.lineas as ProformaLineaInput[],
  )
  const montoTotal = sumarMontos(lineas.map((l) => l.montoLinea))

  return repo.actualizarBorrador(id, body.dimensiones as DimensionProforma[], montoTotal, lineas, userId)
}

// ─── Generación de Cuotas (CB5/CB6) ──────────────────────────────────────────
// Copia el snapshot NotaVentaCuotaPago del Cierre Comercial. PORCENTAJE se
// recalcula contra el montoTotal real de la Factura; MONTO_UNITARIO usa el monto
// ya congelado. Vencimiento = fecha de referencia + plazoDias; FACTURA usa la
// fecha de emisión, ZARPE/ARRIBO las del Embarque, ENVIO_DOCUMENTOS queda null.
// El descuadre de redondeo (si existe) se ajusta en la última cuota.
async function construirCuotas(
  notaVentaId: number,
  montoTotal: number,
  fechaEmision: Date,
  embarque: {
    reservaManual: boolean
    fechaZarpeManual: Date | null
    fechaArribo: Date | null
    solicitudReserva: { fechaZarpe: Date | null } | null
  },
): Promise<repo.CuotaPersistir[]> {
  const cuotasPago = await repo.getCuotasPagoNotaVenta(notaVentaId)
  if (cuotasPago.length === 0) return []

  const fechaZarpe = embarque.reservaManual ? embarque.fechaZarpeManual : embarque.solicitudReserva?.fechaZarpe ?? null
  const fechasPorReferencia: Record<string, Date | null> = {
    FACTURA: fechaEmision,
    ZARPE: fechaZarpe,
    ARRIBO: embarque.fechaArribo,
    ENVIO_DOCUMENTOS: null,
  }

  const cuotas = cuotasPago.map((c, i) => {
    const montoBruto =
      c.tipoValor === 'PORCENTAJE'
        ? (Number(c.porcentaje ?? 0) / 100) * montoTotal
        : Number(c.montoCalculado ?? 0)
    const fechaBase = fechasPorReferencia[c.fechaReferencia]
    const fechaVencimiento = fechaBase ? new Date(fechaBase.getTime() + c.plazoDias * 86_400_000) : null
    return {
      numeroCuota: i + 1,
      fechaReferencia: c.fechaReferencia,
      plazoDias: c.plazoDias,
      montoCuota: Math.round(montoBruto * 100) / 100,
      fechaVencimiento,
    }
  })

  // Ajuste de redondeo en la última cuota para que Σ montoCuota == montoTotal (CB5).
  const sumaCuotas = sumarMontos(cuotas.map((c) => c.montoCuota))
  const diff = Math.round((montoTotal - sumaCuotas) * 100) / 100
  if (diff !== 0 && cuotas.length > 0) {
    const ultima = cuotas[cuotas.length - 1]
    ultima.montoCuota = Math.round((ultima.montoCuota + diff) * 100) / 100
  }
  return cuotas
}

// ─── Emitir (timbrar el DTE 110 + generar cuotas) ────────────────────────────
export async function emitir(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado !== 'BORRADOR') {
    throw new ValidationError('Esta Factura ya fue emitida o está anulada')
  }
  if (factura.lineas.length === 0) throw new ValidationError('La Factura no tiene líneas para emitir')

  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  requireEmbarqueDespachado(embarque)

  const empresaId = factura.empresaId
  const emisor = await dteRepo.getEmpresaParaDte(empresaId)
  if (!emisor?.rut) {
    throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas antes de facturar')
  }

  const nv = embarque.notaVenta
  const monedaAduana = nv.moneda.descripcionExtranjera || nv.moneda.descripcion || nv.moneda.codigo

  const payload = mapFacturaExportacionA110({
    fechaEmision: new Date(),
    monedaAduana,
    emisor: {
      rut: emisor.rut,
      razonSocial: emisor.razonSocial,
      giro: emisor.giro,
      direccion: emisor.direccion,
      comuna: emisor.comuna,
    },
    receptor: {
      razonSocial: nv.cliente.razonSocial,
      identificador: nv.cliente.identificador,
      giro: nv.cliente.giro,
      direccion: null,
      nacionalidadCodigo: nv.paisDestino?.codigo ?? null,
    },
    lineas: factura.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidadCajas: l.cantidadCajas,
      precioUnitario: Number(l.precioUnitario),
    })),
    aduana: {
      codModVenta: nv.modalidadVenta?.codigo ?? null,
      codClauVenta: nv.clausulaVenta?.codigo ?? null,
      totalClausulaVenta: Number(factura.montoTotal),
      codViaTransp: nv.tipoEmbarque?.codigo ?? null,
      codPtoEmbarque: embarque.puertoZarpe?.codigo ?? null,
      codPtoDesembarque: nv.puertoDestino?.codigo ?? null,
      paisDestinoCodigo: nv.paisDestino?.codigo ?? null,
    },
  })

  // Paso 1 — DTE temporal (borrador en LibreDTE).
  const temporal = await dteService.emitirDteTemporal({
    origenTipo: ORIGEN_TIPO,
    origenId: factura.id,
    tipoDte: TIPO_DTE_FACTURA_EXPORTACION,
    payload,
    rutEmisor: emisor.rut,
    rutReceptor: RUT_RECEPTOR_EXTRANJERO,
    creadoPor: userId,
  })
  if (temporal.estado !== 'TEMPORAL_CREADO') {
    throw new ValidationError(temporal.errorMensaje ?? 'No se pudo crear el DTE temporal en LibreDTE')
  }

  // Paso 2 — timbrado real (folio + envío SII).
  const generado = await dteService.generarDteReal({
    origenTipo: ORIGEN_TIPO,
    origenId: factura.id,
    tipoDte: TIPO_DTE_FACTURA_EXPORTACION,
    rutEmisor: emisor.rut,
    rutReceptor: RUT_RECEPTOR_EXTRANJERO,
    creadoPor: userId,
  })
  if (generado.estado !== 'GENERADO') {
    // La Factura queda en BORRADOR; se puede reintentar. El temporal sigue vivo.
    throw new ValidationError(generado.errorMensaje ?? 'No se pudo timbrar el DTE en LibreDTE')
  }

  const fechaEmision = new Date()
  const cuotas = await construirCuotas(embarque.notaVentaId, Number(factura.montoTotal), fechaEmision, embarque)

  return repo.marcarEmitida(
    factura.id,
    {
      folio: generado.folio ?? null,
      trackIdSii: generado.libredteCodigoTemporal ?? null,
      fechaEmision,
      cuotas,
    },
    userId,
  )
}

// ─── Lecturas / anulación ────────────────────────────────────────────────────
export async function obtenerPorEmbarque(embarqueId: number) {
  return repo.getFacturaActivaPorEmbarque(embarqueId)
}

export async function obtenerFactura(id: number) {
  const factura = await repo.getFacturaByIdConHistorial(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  return factura
}

export async function listarFacturas(filters: FacturasExportacionListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listFacturas(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function anularFactura(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado === 'EMITIDA') {
    throw new ValidationError('No se puede anular una Factura ya emitida (timbrada ante el SII) — corrige con una Nota de Crédito')
  }
  return repo.anularFactura(id, userId)
}
