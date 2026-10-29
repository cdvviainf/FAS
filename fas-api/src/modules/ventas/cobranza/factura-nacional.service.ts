import { Prisma } from '@prisma/client'
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { logger } from '../../../lib/logger.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import { construirCuotasDesdeCondicion, derivarEstadoCobranza, inicioDeHoy } from './cobranza-estado.js'
import * as ncService from './nota-credito.service.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import { mapFacturaNacionalADte } from '../../finanzas/facturacion/mappers/factura-nacional.mapper.js'
import { obtenerTipoCambio } from '../../finanzas/facturacion/tipo-cambio.adapter.js'
import * as proformaService from './proforma.service.js'
import * as repo from './factura-nacional.repository.js'
import type { DimensionProforma } from './proforma.types.js'
import type { FacturaNacionalActualizarInput, FacturasNacionalListFilters } from './factura-nacional.types.js'

// Dimensiones por defecto para agrupar el despacho al crear la Factura Nacional
// de venta (editable luego línea a línea en el borrador).
const DIMENSIONES_VENTA = ['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA'] as const

const ORIGEN_TIPO = 'factura-nacional'
const IVA_TASA = 0.19

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10000) / 10000

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

function lineasPersistir(
  lineas: Array<{ descripcion: string; articuloId?: number | null; cantidad: number; precioUnitario: number; precioUnitarioOrigen?: number | null; exento: boolean }>,
) {
  return lineas.map((l) => ({
    descripcion: l.descripcion.trim(),
    articuloId: l.articuloId ?? null,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    precioUnitarioOrigen: l.precioUnitarioOrigen ?? null,
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
        origenClase: 'PROFORMA_MATERIAL',
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

// ─── Crear borrador desde un Embarque (venta NACIONAL) ────────────────────────
export async function crearBorradorDesdeEmbarque(embarqueId: number, userId: string) {
  const embarque = await repo.getEmbarqueParaFacturaNacional(embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(embarqueId))
  if (!embarque.despachadoEn || embarque.despachoAnuladoEn) {
    throw new ValidationError('El Embarque debe estar despachado (y no anulado) para facturar')
  }
  if (embarque.notaVenta.tipoVenta !== 'NACIONAL') {
    throw new ValidationError('El Cierre Comercial del Embarque no es una venta Nacional')
  }
  if (!embarque.notaVenta.cliente.tipos.includes('CLIENTE_NACIONAL')) {
    throw new ValidationError('El cliente (exportadora) del Cierre no es un Cliente Nacional — ajústalo en Entidades')
  }
  if (await repo.getFacturaActivaPorEmbarque(embarqueId)) {
    throw new ValidationError('Este Embarque ya tiene una Factura Nacional asociada')
  }

  // Líneas agregadas del despacho (precio en la moneda de la NV, ej. USD).
  const sugeridas = await proformaService.sugerirLineas(embarqueId, [...DIMENSIONES_VENTA] as DimensionProforma[])
  if (sugeridas.length === 0) throw new ValidationError('El Embarque no tiene pallets despachados para facturar')

  // Tipo de cambio SUGERIDO (moneda de la NV → CLP). Es una sugerencia, no una
  // precondición (VN-QA-001): si la fuente falla o la moneda no tiene serie, el
  // borrador se crea igual con el TC pendiente (se completa/edita en el borrador
  // y el envío al SII lo exige). CLP no necesita conversión → TC = 1.
  const monedaOrigen = embarque.notaVenta.moneda.codigo
  let tipoCambio: number | null = null
  let fechaTipoCambio: Date | null = null
  if (monedaOrigen === 'CLP') {
    tipoCambio = 1
  } else {
    const tc = await obtenerTipoCambio(monedaOrigen, undefined)
    if (!('error' in tc)) {
      tipoCambio = tc.valor
      fechaTipoCambio = new Date(tc.fecha)
    }
  }

  const clp = await repo.getMonedaClp()
  if (!clp) throw new ValidationError('No existe la moneda CLP en el maestro de Monedas')

  const lineas = lineasPersistir(
    sugeridas.map((l) => ({
      descripcion: l.descripcion || 'Fruta',
      articuloId: null,
      cantidad: l.cantidadCajas,
      // CLP convertido; si aún no hay TC, queda 0 hasta que se cargue en el borrador.
      precioUnitario: tipoCambio != null ? round4(l.precioUnitario * tipoCambio) : 0,
      precioUnitarioOrigen: l.precioUnitario, // moneda de origen (USD/EUR)
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
        origenClase: 'VENTA_NACIONAL',
        embarqueId,
        codigo,
        clienteId: embarque.notaVenta.clienteId,
        monedaId: clp.id,
        condicionPagoId: embarque.notaVenta.condicionPagoId,
        idioma: 'ES',
        tipoDte: montos.tipoDte,
        tipoCambio,
        fechaTipoCambio,
        montoNeto: montos.montoNeto,
        montoExento: montos.montoExento,
        montoIva: montos.montoIva,
        montoTotal: montos.montoTotal,
        lineas,
      },
      userId,
    )
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
      throw new ValidationError('Este Embarque ya tiene una Factura Nacional asociada')
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

  if (factura.origenClase === 'VENTA_NACIONAL') {
    // Venta nacional: precios en moneda de origen (USD) → CLP con el tipo de
    // cambio (editable). El campo `precioUnitario` del request es el de ORIGEN.
    // Si el Cierre ya está en CLP no hay conversión: TC se fuerza a 1 y se
    // ignora cualquier otro valor del request (VN-QA-004).
    const monedaOrigen = factura.embarque?.notaVenta?.moneda?.codigo ?? ''
    const esClp = monedaOrigen === 'CLP'
    let tipoCambio = factura.tipoCambio != null ? Number(factura.tipoCambio) : null
    if (esClp) {
      tipoCambio = 1
      data.tipoCambio = 1
      data.fechaTipoCambio = null
    } else if (body.tipoCambio !== undefined) {
      if (body.tipoCambio == null || body.tipoCambio <= 0) throw new ValidationError('Indica un tipo de cambio válido (mayor a 0)')
      tipoCambio = body.tipoCambio
      data.tipoCambio = body.tipoCambio
      data.fechaTipoCambio = body.fechaTipoCambio ? new Date(body.fechaTipoCambio) : null // manual = sin fecha de paridad
    }
    // Líneas USD: las nuevas del request, o las existentes (para recotizar solo por TC).
    const lineasUsd =
      body.lineas !== undefined
        ? body.lineas.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, precioUnitarioOrigen: l.precioUnitario }))
        : factura.lineas.map((l) => ({ descripcion: l.descripcion, cantidad: Number(l.cantidad), precioUnitarioOrigen: Number(l.precioUnitarioOrigen ?? 0) }))
    if (body.lineas !== undefined || body.tipoCambio !== undefined) {
      if (tipoCambio == null || tipoCambio <= 0) throw new ValidationError('Falta el tipo de cambio para convertir los montos')
      if (lineasUsd.length === 0) throw new ValidationError('La Factura debe tener al menos una línea')
      const lineas = lineasPersistir(
        lineasUsd.map((l) => ({
          descripcion: l.descripcion,
          articuloId: null,
          cantidad: l.cantidad,
          precioUnitario: round4(l.precioUnitarioOrigen * tipoCambio!),
          precioUnitarioOrigen: l.precioUnitarioOrigen,
          exento: false,
        })),
      )
      const montos = calcularMontosYTipoDte(lineas)
      data.lineas = lineas
      data.tipoDte = montos.tipoDte
      data.montoNeto = montos.montoNeto
      data.montoExento = montos.montoExento
      data.montoIva = montos.montoIva
      data.montoTotal = montos.montoTotal
    }
  } else if (body.lineas !== undefined) {
    // Proforma de Materiales: líneas con artículo (CLP), afecto/exento editable.
    if (body.lineas.length === 0) throw new ValidationError('La Factura debe tener al menos una línea')
    // Aislamiento tenant: los articuloId de las líneas deben pertenecer a la
    // empresa activa (FAS-FN-QA-002).
    const articuloIds = [...new Set(body.lineas.map((l) => l.articuloId).filter((x): x is number => x != null))]
    if (articuloIds.length > 0) {
      const validos = await repo.getArticulosIdsValidos(articuloIds)
      const invalido = articuloIds.find((aid) => !validos.has(aid))
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

// Venta nacional: el Embarque de origen debe seguir despachado (no anulado) y
// con Cierre NACIONAL al emitir/firmar — no se puede timbrar fruta cuyo despacho
// se anuló (VN-QA-005).
async function revalidarEmbarqueVenta(embarqueId: number | null) {
  if (embarqueId == null) return
  const e = await repo.getEmbarqueParaFacturaNacional(embarqueId)
  if (!e || !e.despachadoEn || e.despachoAnuladoEn) {
    throw new ValidationError('El despacho del Embarque de origen fue anulado — no se puede facturar. Anula el borrador o vuelve a despachar.')
  }
  if (e.notaVenta.tipoVenta !== 'NACIONAL') {
    throw new ValidationError('El Cierre del Embarque de origen ya no es una venta Nacional')
  }
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
  // Venta nacional: los montos CLP derivan del tipo de cambio — exigirlo.
  if (factura.origenClase === 'VENTA_NACIONAL' && (factura.tipoCambio == null || Number(factura.tipoCambio) <= 0)) {
    throw new ValidationError('Indica el tipo de cambio antes de enviar al SII')
  }
  // La Proforma de origen debe seguir disponible (no anulada/facturada) — FAS-FN-QA-007.
  if (factura.proformaMaterial && factura.proformaMaterial.estado !== 'ENVIADA_VALIDACION') {
    throw new ValidationError('La Proforma de Materiales de origen ya no está disponible para facturar (fue anulada o facturada)')
  }
  if (factura.origenClase === 'VENTA_NACIONAL') await revalidarEmbarqueVenta(factura.embarqueId)

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
  if (factura.origenClase === 'VENTA_NACIONAL') await revalidarEmbarqueVenta(factura.embarqueId)

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
  // Cuotas de cartera (Ciclo 2): se generan al firmar desde la CondicionPago,
  // espejo de la Factura de Exportación (que las toma del Cierre Comercial).
  const cuotas = await construirCuotasNacional(factura, fechaDocumento)
  const estadoCobranza = derivarEstadoCobranza(
    cuotas.map((c) => ({ montoCuota: c.montoCuota, saldoPendiente: c.montoCuota, fechaVencimiento: c.fechaVencimiento })),
    inicioDeHoy(),
  )
  return repo.marcarFirmada(
    factura.id,
    { folio, trackIdSii, fechaEmision, fechaDocumento, proformaMaterialId: factura.proformaMaterialId, cuotas, estadoCobranza },
    userId,
  )
}

// Arma las cuotas de la Factura Nacional desde su CondicionPago. Sin condición
// configurada → sin cuotas (estadoCobranza SIN_CUOTAS). FACTURA usa la fecha del
// documento; ZARPE/ARRIBO usan las del Embarque (solo VENTA_NACIONAL);
// ENVIO_DOCUMENTOS queda sin fecha (sin fuente aún, igual que en exportación).
async function construirCuotasNacional(
  factura: { id: number; condicionPagoId: number | null; embarqueId: number | null; lineas: Array<{ cantidad: Prisma.Decimal | number }>; montoTotal: Prisma.Decimal | number },
  fechaDocumento: Date,
) {
  if (factura.condicionPagoId == null) return []
  const cuotasCondicion = await repo.getCuotasCondicionPago(factura.condicionPagoId)
  if (cuotasCondicion.length === 0) return []

  let fechaZarpe: Date | null = null
  let fechaArribo: Date | null = null
  if (factura.embarqueId != null) {
    const emb = await repo.getFechasEmbarque(factura.embarqueId)
    if (emb) {
      fechaZarpe = emb.reservaManual ? emb.fechaZarpeManual : emb.solicitudReserva?.fechaZarpe ?? null
      fechaArribo = emb.fechaArribo
    }
  }
  const cantidadTotal = factura.lineas.reduce((acc, l) => acc + Number(l.cantidad), 0)
  return construirCuotasDesdeCondicion(
    cuotasCondicion.map((c) => ({
      fechaReferencia: c.fechaReferencia,
      plazoDias: c.plazoDias,
      tipoValor: c.tipoValor,
      porcentaje: c.porcentaje != null ? Number(c.porcentaje) : null,
      valorUnitario: c.valorUnitario != null ? Number(c.valorUnitario) : null,
    })),
    Number(factura.montoTotal),
    cantidadTotal,
    { FACTURA: fechaDocumento, ZARPE: fechaZarpe, ARRIBO: fechaArribo, ENVIO_DOCUMENTOS: null },
  )
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

export async function listarEmbarquesFacturables(filters: { page?: number; limit?: number; q?: string }) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listEmbarquesFacturables(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

// Tipo de cambio sugerido (moneda de origen del embarque → CLP) para el editor
// de una Factura Nacional de venta; `fecha` (YYYY-MM-DD) usa la paridad de esa
// fecha (día hábil anterior más cercano).
export async function obtenerTipoCambioSugerido(id: number, fecha?: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.origenClase !== 'VENTA_NACIONAL' || !factura.embarqueId) {
    throw new ValidationError('El tipo de cambio solo aplica a facturas de venta nacional')
  }
  const embarque = await repo.getEmbarqueParaFacturaNacional(factura.embarqueId)
  const monedaOrigen = embarque?.notaVenta.moneda.codigo ?? ''
  const tc = await obtenerTipoCambio(monedaOrigen, fecha ? new Date(fecha) : undefined)
  if ('error' in tc) throw new ValidationError(tc.error)
  return { valor: tc.valor, fecha: tc.fecha, moneda: monedaOrigen }
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
    throw new ValidationError('No se puede anular directamente una Factura ya aprobada (timbrada) — usa "Anular con Nota de Crédito"')
  }
  return repo.anularFactura(id, userId)
}

// ─── Anular una Factura Nacional APROBADA con Nota de Crédito (DTE 61) ─────────
const ORIGEN_TIPO_NC = 'nota-credito-nacional'
const TIPO_DTE_NC_NACIONAL = 61

export async function anularConNotaCredito(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura Nacional', String(id))
  if (factura.estado !== 'APROBADA' || factura.folio == null) {
    throw new ValidationError('Solo se puede anular con Nota de Crédito una Factura aprobada (timbrada ante el SII)')
  }

  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) {
    throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas')
  }
  const rutReceptor = factura.cliente.identificador?.trim()
  if (!rutReceptor) {
    throw new ValidationError('El cliente no tiene RUT (identificador) configurado — complétalo en Entidades')
  }
  const dirCliente = factura.cliente.direcciones[0]

  const codigo = await siguienteCodigo('notaCredito')
  if (!codigo) {
    throw new ValidationError('No hay un prefijo de código configurado para Notas de Crédito (Configuración › Prefijos de Código)')
  }

  const fechaFactura = factura.fechaEmision ?? factura.fechaDocumento ?? new Date()
  const payload = mapFacturaNacionalADte({
    // NC nacional = DTE 61 (sirve para anular tanto 33 como 34).
    tipoDte: TIPO_DTE_NC_NACIONAL,
    fechaEmision: new Date(),
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
    observaciones: `Anula factura ${factura.codigo}`,
    referencias: [
      {
        tpoDocRef: String(factura.tipoDte), // 33 o 34
        folioRef: String(factura.folio),
        fecha: fechaFactura.toISOString().slice(0, 10),
        codRef: 1, // anula documento de referencia
        razonRef: `Anula factura ${factura.codigo}`,
      },
    ],
  })

  return ncService.emitirNcAnulacion({
    tipoFactura: 'NACIONAL',
    facturaId: factura.id,
    tipoDteNc: TIPO_DTE_NC_NACIONAL,
    facturaTipoDte: factura.tipoDte,
    facturaFolio: factura.folio,
    origenTipo: ORIGEN_TIPO_NC,
    clienteId: factura.clienteId,
    monedaId: factura.monedaId,
    montoTotal: factura.montoTotal,
    idioma: factura.idioma,
    codigo,
    payload,
    rutEmisor: emisor.rut,
    rutReceptor,
    userId,
  })
}
