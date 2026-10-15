import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { logger } from '../../../lib/logger.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import { mapFacturaNacionalADte } from '../../finanzas/facturacion/mappers/factura-nacional.mapper.js'
import * as repo from './factura-nacional.repository.js'
import type { FacturaNacionalActualizarInput, FacturasNacionalListFilters } from './factura-nacional.types.js'

const ORIGEN_TIPO = 'factura-nacional'
const IVA_TASA = 0.19

const round2 = (n: number) => Math.round(n * 100) / 100

// Tope de las columnas Decimal(14,2): 12 enteros + 2 decimales. El producto
// cantidad × precio (o un total acumulado) no puede excederlo — se valida en el
// servicio para devolver un error de negocio en vez de un fallo de BD (QA-010).
const MONTO_MAX = 999_999_999_999.99

// Normaliza un RUT para comparar (sin puntos/guion, mayúsculas) — se usa para
// verificar que el receptor no cambió entre el temporal y la firma.
const normalizarRut = (rut: string) => rut.replace(/[.\-\s]/g, '').toUpperCase()

type LineaCalculo = { exento: boolean; cantidad: number; precioUnitario: number }

// Calcula montos y el tipo de DTE a partir de las líneas: 34 (Exenta) si TODAS
// las líneas son exentas; 33 (Afecta) en cualquier otro caso. El IVA (19%) se
// aplica solo al neto (líneas afectas); los totales reales los recalcula LibreDTE
// con normalizar=1 al timbrar — estos son para registro/listado.
function calcularMontosYTipoDte(lineas: LineaCalculo[]) {
  let montoNeto = 0
  let montoExento = 0
  for (const l of lineas) {
    const montoLinea = round2(l.cantidad * l.precioUnitario)
    if (montoLinea > MONTO_MAX) {
      throw new ValidationError('El monto de una línea excede el máximo facturable — reduce la cantidad o el precio')
    }
    if (l.exento) montoExento += montoLinea
    else montoNeto += montoLinea
  }
  montoNeto = round2(montoNeto)
  montoExento = round2(montoExento)
  const montoIva = Math.round(montoNeto * IVA_TASA) // IVA en pesos enteros (CLP)
  const montoTotal = round2(montoNeto + montoIva + montoExento)
  if (montoNeto > MONTO_MAX || montoExento > MONTO_MAX || montoIva > MONTO_MAX || montoTotal > MONTO_MAX) {
    throw new ValidationError('El total de la factura excede el máximo facturable — divide el documento o ajusta las líneas')
  }
  const tipoDte = lineas.length > 0 && lineas.every((l) => l.exento) ? 34 : 33
  return { montoNeto, montoExento, montoIva, montoTotal, tipoDte }
}

function lineasPersistir(lineas: Array<{ descripcion: string; articuloId?: number | null; cantidad: number; precioUnitario: number; exento: boolean }>) {
  return lineas.map((l) => ({
    descripcion: l.descripcion.trim(),
    articuloId: l.articuloId ?? null,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    exento: l.exento,
    montoLinea: round2(l.cantidad * l.precioUnitario),
  }))
}

// ─── Crear borrador desde una Proforma de Materiales ──────────────────────────
export async function crearBorradorDesdeProforma(proformaMaterialId: number, userId: string) {
  const proforma = await repo.getProformaMaterialParaFactura(proformaMaterialId)
  if (!proforma) {
    throw new ValidationError('La Proforma de Materiales no existe o no está en estado "Enviada a validación"')
  }
  const existente = await repo.getFacturaActivaPorProforma(proformaMaterialId)
  if (existente) {
    throw new ValidationError('Esta Proforma de Materiales ya tiene una Factura Nacional asociada')
  }
  if (proforma.lineas.length === 0) {
    throw new ValidationError('La Proforma no tiene líneas para facturar')
  }
  // VN3: el cliente debe ser una Entidad tipo CLIENTE_NACIONAL (cobranza.md).
  if (!proforma.entidad.tipos.includes('CLIENTE_NACIONAL')) {
    throw new ValidationError('El cliente de la Proforma no es un Cliente Nacional — no se puede facturar nacionalmente')
  }
  // La Factura Nacional es en CLP: se exige explícitamente el código CLP (no
  // "moneda base", que es configurable y podría ser otra — FAS-FN-QA-006).
  if (proforma.moneda.codigo !== 'CLP') {
    throw new ValidationError('La Factura Nacional solo admite proformas en pesos chilenos (CLP)')
  }

  // Líneas iniciales: artículo + cantidad + precio de la proforma; afectas por
  // defecto (el usuario marca las exentas en el borrador).
  const lineas = lineasPersistir(
    proforma.lineas.map((l) => ({
      descripcion: l.articulo?.descripcion ?? 'Ítem',
      articuloId: l.articuloId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      exento: false,
    })),
  )
  const montos = calcularMontosYTipoDte(lineas)
  const codigo = await siguienteCodigo('facturaNacional')
  if (!codigo) {
    throw new ValidationError('No hay un prefijo de código configurado para Factura Nacional (Configuración › Prefijos de Código)')
  }

  try {
    return await repo.crearBorrador(
      {
        proformaMaterialId,
        codigo,
        clienteId: proforma.entidadId,
        monedaId: proforma.monedaId,
        condicionPagoId: proforma.condicionPagoId,
        idioma: 'ES',
        tipoDte: montos.tipoDte,
        montoNeto: montos.montoNeto,
        montoExento: montos.montoExento,
        montoIva: montos.montoIva,
        montoTotal: montos.montoTotal,
        lineas,
      },
      userId,
    )
  } catch (err) {
    // check-then-create no atómico: el índice único parcial rechaza una 2da factura.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      throw new ValidationError('Esta Proforma de Materiales ya tiene una Factura Nacional asociada')
    }
    throw err
  }
}

export async function actualizarBorrador(id: number, body: FacturaNacionalActualizarInput) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado !== 'BORRADOR') throw new ValidationError('Solo se puede editar una Factura en estado Borrador')

  const data: repo.ActualizarBorradorData = {}
  if (body.fechaDocumento !== undefined) data.fechaDocumento = body.fechaDocumento ? new Date(body.fechaDocumento) : null
  if (body.observaciones !== undefined) data.observaciones = body.observaciones?.trim() || null
  if (body.lineas !== undefined) {
    if (body.lineas.length === 0) throw new ValidationError('La Factura debe tener al menos una línea')
    // Aislamiento tenant: los articuloId de las líneas deben pertenecer a la
    // empresa activa (FAS-FN-QA-002).
    const articuloIds = [...new Set(body.lineas.map((l) => l.articuloId).filter((x): x is number => x != null))]
    if (articuloIds.length > 0) {
      const validos = await repo.getArticulosIdsValidos(articuloIds)
      const invalido = articuloIds.find((id) => !validos.has(id))
      if (invalido != null) throw new ValidationError('Una de las líneas referencia un artículo que no existe en la empresa')
    }
    const lineas = lineasPersistir(body.lineas)
    const montos = calcularMontosYTipoDte(lineas)
    data.lineas = lineas
    data.tipoDte = montos.tipoDte
    data.montoNeto = montos.montoNeto
    data.montoExento = montos.montoExento
    data.montoIva = montos.montoIva
    data.montoTotal = montos.montoTotal
  }
  // El repo descarta el DTE temporal descartable al editar (atómico, bajo lock),
  // así que al reenviar se reconstruye con los datos nuevos.
  return repo.actualizarBorrador(id, data)
}

// Captura errores inesperados al armar/enviar el DTE con un mensaje accionable.
async function conManejoPayloadDte<T>(facturaId: number, accion: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ValidationError || e instanceof NotFoundError) throw e
    logger.error({ err: e, facturaId, accion }, 'Error inesperado al armar/enviar el DTE de Factura Nacional')
    throw new ValidationError('No se pudo armar el documento para el SII. Revisa los datos de la Factura; el detalle quedó en los logs.')
  }
}

// ─── Paso 1: Enviar borrador al SII (crea el DTE temporal) ────────────────────
export async function enviarBorradorSii(id: number, userId: string) {
  return conManejoPayloadDte(id, 'enviar-sii', () => enviarBorradorSiiInterno(id, userId))
}

async function enviarBorradorSiiInterno(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado !== 'BORRADOR') throw new ValidationError('Solo se puede enviar al SII una Factura en estado Borrador')
  if (factura.lineas.length === 0) throw new ValidationError('La Factura no tiene líneas para enviar')
  if (!factura.fechaDocumento) throw new ValidationError('Indica la fecha del documento antes de enviar al SII')
  if (!factura.cliente.identificador?.trim()) {
    throw new ValidationError('El cliente no tiene RUT (identificador) configurado — complétalo en Entidades antes de facturar')
  }
  // VN3 (re-validado antes de emitir): el cliente debe seguir siendo CLIENTE_NACIONAL.
  if (!factura.cliente.tipos.includes('CLIENTE_NACIONAL')) {
    throw new ValidationError('El cliente ya no es un Cliente Nacional — no se puede emitir la factura')
  }
  if (factura.moneda.codigo !== 'CLP') {
    throw new ValidationError('La Factura Nacional solo se emite en pesos chilenos (CLP)')
  }
  // La Proforma de origen debe seguir disponible (no anulada/facturada) — FAS-FN-QA-007.
  if (factura.proformaMaterial && factura.proformaMaterial.estado !== 'ENVIADA_VALIDACION') {
    throw new ValidationError('La Proforma de Materiales de origen ya no está disponible para facturar (fue anulada o facturada)')
  }

  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) {
    throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas antes de facturar')
  }

  const rutReceptor = factura.cliente.identificador.trim()
  const dirCliente = factura.cliente.direcciones[0]

  // FAS-FN-QA-009: el DTE 33/34 timbrado exige razón social, giro, dirección y
  // comuna del emisor y del receptor. Se valida aquí (antes de LibreDTE) para
  // devolver un error de negocio accionable en vez de un rechazo del SII.
  const faltantesEmisor: string[] = []
  if (!emisor.razonSocial?.trim()) faltantesEmisor.push('razón social')
  if (!emisor.giro?.trim()) faltantesEmisor.push('giro')
  if (!emisor.direccion?.trim()) faltantesEmisor.push('dirección')
  if (!emisor.comuna?.trim()) faltantesEmisor.push('comuna')
  if (faltantesEmisor.length > 0) {
    throw new ValidationError(
      `La Empresa emisora no tiene ${faltantesEmisor.join(', ')} — complétalo en Configuración → Empresas antes de enviar al SII`,
    )
  }
  const faltantesReceptor: string[] = []
  if (!factura.cliente.razonSocial?.trim()) faltantesReceptor.push('razón social')
  if (!factura.cliente.giro?.trim()) faltantesReceptor.push('giro')
  if (!dirCliente?.direccion?.trim()) faltantesReceptor.push('dirección')
  if (!dirCliente?.comuna?.descripcion?.trim()) faltantesReceptor.push('comuna')
  if (faltantesReceptor.length > 0) {
    throw new ValidationError(
      `El cliente no tiene ${faltantesReceptor.join(', ')} — complétalo en Entidades antes de enviar al SII`,
    )
  }
  const payload = mapFacturaNacionalADte({
    tipoDte: factura.tipoDte,
    fechaEmision: factura.fechaDocumento,
    emisor: { rut: emisor.rut, razonSocial: emisor.razonSocial, giro: emisor.giro, direccion: emisor.direccion, comuna: emisor.comuna },
    receptor: {
      rut: rutReceptor,
      razonSocial: factura.cliente.razonSocial,
      giro: factura.cliente.giro,
      direccion: dirCliente?.direccion ?? null,
      comuna: dirCliente?.comuna?.descripcion ?? null,
    },
    lineas: factura.lineas.map((l) => ({
      descripcion: l.descripcion,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      exento: l.exento,
    })),
    observaciones: factura.observaciones,
  })

  const versionAlLeer = factura.actualizadoEn?.getTime() ?? null
  const temporal = await dteService.emitirDteTemporal({
    origenTipo: ORIGEN_TIPO,
    origenId: factura.id,
    tipoDte: factura.tipoDte,
    payload,
    rutEmisor: emisor.rut,
    rutReceptor,
    creadoPor: userId,
    verificarVigencia: async (tx) => {
      const actual = await tx.facturaNacional.findFirst({
        where: { id: factura.id },
        select: { estado: true, actualizadoEn: true, eliminadoEn: true },
      })
      if (!actual || actual.eliminadoEn || actual.estado !== 'BORRADOR') {
        throw new ValidationError('La Factura ya no está en Borrador. Recarga la página.')
      }
      if ((actual.actualizadoEn?.getTime() ?? null) !== versionAlLeer) {
        throw new ValidationError('La Factura fue modificada mientras se enviaba al SII. Recarga e inténtalo de nuevo.')
      }
    },
  })
  if (temporal.estado !== 'TEMPORAL_CREADO') {
    throw new ValidationError(temporal.errorMensaje ?? 'No se pudo crear el DTE temporal en LibreDTE')
  }
  return repo.getFacturaActivaById(id)
}

// ─── Paso 2: Firmar (timbrado real) ──────────────────────────────────────────
export async function firmar(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado !== 'BORRADOR' && factura.estado !== 'RECHAZADA') {
    throw new ValidationError('Esta Factura no está en estado para firmar')
  }
  if (!factura.cliente.tipos.includes('CLIENTE_NACIONAL')) {
    throw new ValidationError('El cliente ya no es un Cliente Nacional — no se puede firmar la factura')
  }
  if (factura.moneda.codigo !== 'CLP') {
    throw new ValidationError('La Factura Nacional solo se emite en pesos chilenos (CLP)')
  }
  if (factura.proformaMaterial && factura.proformaMaterial.estado !== 'ENVIADA_VALIDACION') {
    throw new ValidationError('La Proforma de Materiales de origen ya no está disponible para facturar (fue anulada o facturada)')
  }

  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  if (!dte || (dte.estado !== 'TEMPORAL_CREADO' && dte.estado !== 'GENERADO')) {
    throw new ValidationError('Primero envía el borrador al SII antes de firmar')
  }

  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas')
  const rutReceptor = factura.cliente.identificador?.trim() || ''
  // FAS-FN-QA-001: el RUT del receptor debe existir y coincidir con el usado al
  // crear el temporal — si cambió, no se timbra con un receptor distinto.
  if (!rutReceptor) {
    throw new ValidationError('El cliente no tiene RUT (identificador) configurado — complétalo en Entidades antes de firmar')
  }
  if (dte.rutReceptor && normalizarRut(dte.rutReceptor) !== normalizarRut(rutReceptor)) {
    throw new ValidationError('El RUT del cliente cambió desde que se envió el borrador — reenvía el borrador al SII antes de firmar')
  }

  let folio: number
  let trackIdSii: string | null
  if (dte.estado === 'GENERADO') {
    // Reconciliación idempotente: ya timbrado en un intento previo.
    if (dte.folio == null) throw new ValidationError('El DTE quedó timbrado sin folio (dato inconsistente) — contacta a soporte')
    folio = dte.folio
    trackIdSii = dte.libredteCodigoTemporal
  } else {
    const generado = await dteService.generarDteReal({
      origenTipo: ORIGEN_TIPO,
      origenId: factura.id,
      tipoDte: factura.tipoDte,
      rutEmisor: emisor.rut,
      rutReceptor,
      creadoPor: userId,
    })
    if (generado.estado === 'GENERANDO') {
      throw new ValidationError('El timbrado de esta Factura ya está en curso — espera unos segundos y recarga')
    }
    if (generado.estado !== 'GENERADO') {
      await repo.marcarRechazada(factura.id, generado.errorMensaje ?? 'No se pudo timbrar el DTE en LibreDTE')
      throw new ValidationError(generado.errorMensaje ?? 'No se pudo timbrar el DTE en LibreDTE')
    }
    if (generado.folio == null) throw new ValidationError('El DTE se timbró sin folio (dato inconsistente) — contacta a soporte')
    folio = generado.folio
    trackIdSii = generado.libredteCodigoTemporal ?? null
  }

  const fechaEmision = new Date()
  const fechaDocumento = factura.fechaDocumento ?? fechaEmision
  return repo.marcarFirmada(factura.id, { folio, trackIdSii, fechaEmision, fechaDocumento, proformaMaterialId: factura.proformaMaterialId }, userId)
}

// ─── Lecturas / anulación ─────────────────────────────────────────────────────
export async function obtenerFactura(id: number) {
  const factura = await repo.getFacturaByIdConHistorial(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  return { ...factura, dte: dte ? { estado: dte.estado, folio: dte.folio, tieneXml: !!dte.xml } : null }
}

export async function obtenerXmlFactura(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  if (!dte?.xml) throw new ValidationError('Esta Factura aún no tiene XML timbrado disponible')
  return { xml: dte.xml, folio: dte.folio, codigo: factura.codigo }
}

export async function obtenerPdfBorrador(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  if (!dte?.libredteCodigoTemporal) {
    throw new ValidationError('La Factura no tiene un borrador en el SII — envíala al SII primero')
  }
  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) throw new ValidationError('La Empresa no tiene RUT configurado')
  const r = await dteService.obtenerPdfTemporal({
    tipoDte: factura.tipoDte,
    codigo: dte.libredteCodigoTemporal,
    rutEmisor: emisor.rut,
    rutReceptor: factura.cliente.identificador?.trim() || '',
  })
  if (!r.ok) throw new ValidationError(r.error)
  return { pdf: r.pdf, codigo: factura.codigo }
}

export async function listarFacturas(filters: FacturasNacionalListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listFacturas(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function listarProformasFacturables(filters: { page?: number; limit?: number; q?: string }) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listProformasFacturables(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function reabrirFactura(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado !== 'RECHAZADA') throw new ValidationError('Solo se puede reabrir una Factura rechazada')
  return repo.reabrirBorrador(id)
}

export async function anularFactura(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado === 'APROBADA') {
    throw new ValidationError('No se puede anular una Factura ya aprobada (timbrada) — requiere una Nota de Crédito (próxima fase)')
  }
  return repo.anularFactura(id, userId)
}
