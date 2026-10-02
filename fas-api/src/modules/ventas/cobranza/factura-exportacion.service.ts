import { Prisma } from '@prisma/client'
import { BusinessError, NotFoundError, ValidationError } from '../../../shared/errors.js'
import { logger } from '../../../lib/logger.js'
import { siguienteCodigo } from '../../config/prefijos-codigo/prefijos-codigo.service.js'
import { validarYCompletarLineas } from './proforma.service.js'
import * as dteService from '../../finanzas/facturacion/dte-emitidos.service.js'
import * as dteRepo from '../../finanzas/facturacion/dte-emitidos.repository.js'
import { mapFacturaExportacionA110 } from '../../finanzas/facturacion/mappers/factura-exportacion.mapper.js'
import { obtenerTipoCambio } from '../../finanzas/facturacion/tipo-cambio.adapter.js'
import { factorFob, resolverFleteSeguro, unitarioFob } from './clausula-flete-seguro.js'
import { descripcionLinea, faltantesDescripcionExtranjera, type Idioma, type LineaConMantenedores } from './descripcion-idioma.js'
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

// Idioma normalizado (ES/EN); cualquier otro valor cae a ES.
function normalizarIdioma(idioma: string | null | undefined): Idioma {
  return idioma === 'EN' ? 'EN' : 'ES'
}

// Adapta las líneas (con relaciones de mantenedores) al shape del builder de
// descripción por idioma.
type LineaConRelaciones = {
  especie: { descripcion: string; descripcionExtranjera: string | null }
  variedad: { descripcion: string; descripcionExtranjera: string | null } | null
  articulo: { descripcion: string; descripcionExtranjera: string | null } | null
  calibre: { descripcion: string; descripcionExtranjera: string | null } | null
  categoria: { descripcion: string; descripcionExtranjera: string | null } | null
  etiqueta: { descripcion: string; descripcionExtranjera: string | null } | null
}
function aLineasMantenedores(lineas: LineaConRelaciones[]): LineaConMantenedores[] {
  return lineas.map((l) => ({
    especie: l.especie,
    variedad: l.variedad,
    articulo: l.articulo,
    calibre: l.calibre,
    categoria: l.categoria,
    etiqueta: l.etiqueta,
  }))
}

// Barrera de idioma: si es EN, exige que todos los mantenedores referenciados
// tengan descripcionExtranjera; si falta alguno, bloquea y los lista.
function requireIdiomaEmitible(idioma: Idioma, lineas: LineaConRelaciones[]) {
  if (idioma !== 'EN') return
  const faltan = faltantesDescripcionExtranjera(aLineasMantenedores(lineas))
  if (faltan.length > 0) {
    throw new ValidationError(
      `No se puede emitir en inglés: falta la descripción extranjera de — ${faltan.join(' · ')}. Complétala en el mantenedor o cambia el idioma a español.`,
    )
  }
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

  // Flete/Seguro se heredan de la Proforma (ya validados al emitirla) como
  // punto de partida; siguen siendo editables mientras la Factura esté en
  // BORRADOR. Se revalidan igual contra la cláusula, por si sus flags o el
  // total cambiaron entre la emisión de la Proforma y la creación de la Factura.
  const { montoFlete, montoSeguro } = resolverFleteSeguro(embarque.notaVenta.clausulaVenta, montoTotal, {
    montoFlete: proforma.montoFlete == null ? null : Number(proforma.montoFlete),
    montoSeguro: proforma.montoSeguro == null ? null : Number(proforma.montoSeguro),
  })

  // Tipo de cambio: se sugiere automáticamente desde el Banco Central (dólar/euro
  // observado) al crear el borrador, salvo que la moneda sea la base (CLP). Si la
  // fuente falla o la moneda no tiene serie, queda null — el usuario lo obtiene o
  // ingresa manualmente en el editor antes de enviar al SII.
  let tipoCambio: number | null = null
  let fechaTipoCambio: Date | null = null
  if (!embarque.notaVenta.moneda.esMonedaBase) {
    const tc = await obtenerTipoCambio(embarque.notaVenta.moneda.codigo)
    if ('valor' in tc) {
      tipoCambio = tc.valor
      fechaTipoCambio = tc.fecha ? new Date(tc.fecha) : null
    }
  }

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
        // Idioma y fecha del documento se heredan de la Proforma; ambos son
        // editables mientras la Factura esté en BORRADOR.
        idioma: proforma.idioma,
        fechaDocumento: proforma.fechaDocumento ?? null,
        montoTotal,
        montoFlete,
        montoSeguro,
        tipoCambio,
        fechaTipoCambio,
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

  // Flete/Seguro según la cláusula de venta (flags en la Nota de Venta del
  // Embarque). Se exigen solo si la cláusula lo indica.
  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  const { montoFlete, montoSeguro } = resolverFleteSeguro(embarque.notaVenta.clausulaVenta, montoTotal, {
    montoFlete: body.montoFlete,
    montoSeguro: body.montoSeguro,
  })

  // Tipo de cambio: se conserva la fecha de la paridad observada mientras el
  // valor no cambie. Si el usuario lo edita, se sella con la fecha de la paridad
  // informada por el frontend (la real del Banco Central cuando viene de
  // "Obtener"); en ingreso manual —sin fecha— se cae a la fecha de edición. Si
  // borra el valor, queda null. BRT-R1-003 (antes siempre sellaba new Date()).
  const tipoCambio = body.tipoCambio ?? null
  const tipoCambioPrevio = factura.tipoCambio == null ? null : Number(factura.tipoCambio)
  const tipoCambioCambio = tipoCambio !== tipoCambioPrevio
  const fechaTipoCambio = tipoCambioCambio
    ? tipoCambio != null
      ? body.fechaTipoCambio
        ? new Date(body.fechaTipoCambio)
        : new Date()
      : null
    : factura.fechaTipoCambio

  // El repo actualiza el borrador y descarta el DTE temporal descartable en una
  // sola transacción bajo el advisory lock del origen (FAS-COB-F1-001), para que
  // "Firmar" nunca timbre un payload viejo.
  return repo.actualizarBorrador(
    id,
    {
      dimensiones: body.dimensiones as DimensionProforma[],
      idioma: normalizarIdioma(body.idioma),
      fechaDocumento: body.fechaDocumento ? new Date(body.fechaDocumento) : null,
      montoTotal,
      montoFlete,
      montoSeguro,
      tipoCambio,
      fechaTipoCambio,
      lineas,
    },
    userId,
  )
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

// Arma el payload del DTE 110 desde la Factura + Embarque + emisor, en el idioma
// de la Factura (descripción reconstruida por idioma; detalle a valor FOB).
// Valida que cada mantenedor que alimenta el bloque Aduana del DTE 110 esté
// presente en la Nota de Venta/Embarque y tenga su código de Aduana del SII
// (codigoAduana) cargado. Junta todos los faltantes en un solo error accionable
// en vez de fallar de a uno. (Decisión 2026-10-01: normalizar a códigos SII.)
function validarCodigosAduana(
  embarque: NonNullable<Awaited<ReturnType<typeof repo.getEmbarqueParaFacturaDte>>>,
) {
  const nv = embarque.notaVenta
  // `donde` dice dónde completar cada dato cuando FALTA el registro en sí (no el
  // código): casi todos vienen del Cierre Comercial (Nota de Venta); el Puerto de
  // Embarque se carga en el Embarque → pestaña "Solicitud de Reserva".
  const requeridos: Array<{
    etiqueta: string
    registro: { descripcion: string; codigoAduana: string | null } | null
    donde: string
  }> = [
    { etiqueta: 'Cláusula de Venta (Incoterm)', registro: nv.clausulaVenta, donde: 'el Cierre Comercial / Nota de Venta' },
    { etiqueta: 'Modalidad de Venta', registro: nv.modalidadVenta, donde: 'el Cierre Comercial / Nota de Venta' },
    { etiqueta: 'Vía de transporte (Tipo de Embarque)', registro: nv.tipoEmbarque, donde: 'el Cierre Comercial / Nota de Venta' },
    { etiqueta: 'Puerto de Embarque (zarpe)', registro: embarque.puertoZarpe, donde: 'el Embarque, pestaña "Solicitud de Reserva" → "Puerto Embarque"' },
    { etiqueta: 'Puerto de Desembarque (destino)', registro: nv.puertoDestino, donde: 'el Cierre Comercial / Nota de Venta' },
    { etiqueta: 'País de destino', registro: nv.paisDestino, donde: 'el Cierre Comercial / Nota de Venta' },
  ]
  const faltantes = requeridos
    .filter((r) => !r.registro || !r.registro.codigoAduana?.trim())
    .map((r) =>
      r.registro
        ? `${r.etiqueta} ("${r.registro.descripcion}") no tiene Código de Aduana (SII) — cárgalo en Configuración`
        : `Falta seleccionar ${r.etiqueta} en ${r.donde}`,
    )
  if (faltantes.length > 0) {
    throw new ValidationError(
      `No se puede enviar al SII hasta completar: ${faltantes.join('; ')}.`,
    )
  }
}

// Ejecuta el armado/envío del DTE 110 con manejo de errores: los de negocio
// (BusinessError) pasan tal cual (ya tienen mensaje claro); cualquier otro
// (campo mal armado, Prisma, etc.) se loguea con detalle y se devuelve un
// mensaje accionable en vez de un 500 opaco "Error interno del servidor".
async function conManejoPayloadDte<T>(facturaId: number, accion: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof BusinessError) throw e
    logger.error({ err: e, facturaId, accion }, 'Error inesperado al armar/enviar el DTE 110 de exportación')
    throw new ValidationError(
      'No se pudo armar el documento para el SII. Revisa los datos del Embarque y la Factura; ' +
        'el detalle del error quedó en los logs del servidor.',
    )
  }
}

// Mapea el texto libre de `tipoBultos` del Embarque a un código de la tabla de
// Tipo de Bulto del SII. Para fruta el bulto es la caja (default 22 = CAJA DE
// CARTON). Reefer/pallet/contenedor si el texto lo indica.
function mapCodTipoBultos(texto: string | null): string {
  const t = (texto ?? '').toLowerCase()
  if (/pallet/.test(t)) return '80'
  if (/reefer|refrigerad/.test(t)) return '75'
  if (/cont.*40|40.*(hc|rf|dc)?/.test(t) && /cont/.test(t)) return '74'
  if (/cont.*20/.test(t)) return '73'
  return '22' // CAJA DE CARTON (default fruta)
}

function construirPayloadDte(
  factura: NonNullable<Awaited<ReturnType<typeof repo.getFacturaActivaById>>>,
  embarque: NonNullable<Awaited<ReturnType<typeof repo.getEmbarqueParaFacturaDte>>>,
  emisor: { rut: string; razonSocial: string; giro: string | null; direccion: string | null; comuna: string | null },
  idioma: Idioma,
) {
  const nv = embarque.notaVenta
  const monedaAduana = nv.moneda.descripcionExtranjera || nv.moneda.descripcion || nv.moneda.codigo
  const montoTotalNum = Number(factura.montoTotal)
  // Revalida Flete/Seguro (última barrera). El total (CIF) NO cambia — va como
  // TotClauVenta; el detalle se timbra a valor FOB.
  const { montoFlete, montoSeguro } = resolverFleteSeguro(nv.clausulaVenta, montoTotalNum, {
    montoFlete: factura.montoFlete == null ? null : Number(factura.montoFlete),
    montoSeguro: factura.montoSeguro == null ? null : Number(factura.montoSeguro),
  })
  const factor = factorFob(montoTotalNum, montoFlete, montoSeguro)
  const fechaDocumento = factura.fechaDocumento ?? new Date()
  const fechaRef = fechaDocumento.toISOString().slice(0, 10)

  // Transporte/booking: según reservaManual, de los campos manuales del Embarque
  // o de la SolicitudReserva (AGL360) — mismo criterio que el PDF del Instructivo.
  const nave = embarque.reservaManual ? embarque.naveManual : (embarque.solicitudReserva?.nave ?? null)
  const booking = embarque.reservaManual ? embarque.numeroBookingManual : (embarque.solicitudReserva?.numeroBooking ?? null)
  const contenedor = embarque.reservaManual ? embarque.numeroContenedorManual : (embarque.solicitudReserva?.numeroContenedor ?? null)

  // Pesos (kilos) y total de bultos, derivados de las líneas y el envase (Artículo).
  const redondea = (n: number) => Math.round(n * 100) / 100
  let pesoNetoAcum = 0
  let pesoBrutoAcum = 0
  let totBultos = 0
  for (const l of factura.lineas) {
    const cajas = Number(l.cantidadCajas)
    totBultos += cajas
    if (l.articulo?.kgNetoEnvase != null) pesoNetoAcum += cajas * Number(l.articulo.kgNetoEnvase)
    if (l.articulo?.kgBrutoEnvase != null) pesoBrutoAcum += cajas * Number(l.articulo.kgBrutoEnvase)
  }
  const pesoNeto = pesoNetoAcum > 0 ? redondea(pesoNetoAcum) : null
  const pesoBruto = pesoBrutoAcum > 0 ? redondea(pesoBrutoAcum) : null

  // Referencias: B/L (código SII 808) si el Embarque lo tiene.
  const referencias: Array<{ tpoDocRef: string; folioRef: string; fecha: string; razonRef?: string }> = []
  if (embarque.awbBl?.trim()) {
    referencias.push({ tpoDocRef: '808', folioRef: embarque.awbBl.trim(), fecha: fechaRef, razonRef: 'B/L' })
  }

  return mapFacturaExportacionA110({
    fechaEmision: fechaDocumento,
    monedaAduana,
    tipoCambio: factura.tipoCambio == null ? null : Number(factura.tipoCambio),
    emisor,
    receptor: {
      razonSocial: nv.cliente.razonSocial,
      identificador: nv.cliente.identificador,
      giro: nv.cliente.giro,
      direccion: null,
      // SII espera el código de país de SU tabla de Aduana (no "COL").
      nacionalidadCodigo: nv.paisDestino?.codigoAduana ?? null,
    },
    lineas: factura.lineas.map((l) => ({
      descripcion: descripcionLinea(l, idioma),
      cantidadCajas: l.cantidadCajas,
      precioUnitario: unitarioFob(Number(l.precioUnitario), factor),
    })),
    // Se mandan los códigos de la tabla de Aduana del SII (codigoAduana), no el
    // `codigo` de negocio — LibreDTE descarta los que no son de su tabla. El
    // service valida que estén presentes antes de enviar (validarCodigosAduana).
    aduana: {
      codModVenta: nv.modalidadVenta?.codigoAduana ?? null,
      codClauVenta: nv.clausulaVenta?.codigoAduana ?? null,
      totalClausulaVenta: montoTotalNum,
      montoFlete,
      montoSeguro,
      codViaTransp: nv.tipoEmbarque?.codigoAduana ?? null,
      codPtoEmbarque: embarque.puertoZarpe?.codigoAduana ?? null,
      codPtoDesembarque: nv.puertoDestino?.codigoAduana ?? null,
      paisDestinoCodigo: nv.paisDestino?.codigoAduana ?? null,
      // Transporte. RUTCiaTransp se omite: la naviera suele ser extranjera (sin
      // RUT chileno) y un RUT inválido haría rechazar el DTE.
      nombreCiaTransp: embarque.naviera?.razonSocial ?? null,
      rutCiaTransp: null,
      nombreTransp: nave,
      booking,
      pesoNeto,
      pesoBruto,
      totItems: factura.lineas.length,
      totBultos: totBultos > 0 ? totBultos : null,
      // El bulto es la caja (CantBultos = total de cajas); el contenedor va aparte.
      tipoBulto: totBultos > 0
        ? { codTpoBultos: mapCodTipoBultos(embarque.tipoBultos), cantBultos: totBultos, idContainer: contenedor }
        : null,
    },
    referencias,
  })
}

// Diagnóstico: arma y devuelve EXACTAMENTE el payload que se manda a LibreDTE/
// simpleDTE (mismo construirPayloadDte), SIN enviarlo ni validar. Sirve para ver
// si el bloque Aduana sale completo cuando el PDF del borrador se ve reducido.
export async function obtenerPayloadDtePreview(id: number) {
  return conManejoPayloadDte(id, 'preview', () => armarPreviewPayloadDte(id))
}

async function armarPreviewPayloadDte(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) throw new ValidationError('La Empresa no tiene RUT configurado')

  const idioma = normalizarIdioma(factura.idioma)
  const payload = construirPayloadDte(
    factura,
    embarque,
    { rut: emisor.rut, razonSocial: emisor.razonSocial, giro: emisor.giro, direccion: emisor.direccion, comuna: emisor.comuna },
    idioma,
  )
  const nv = embarque.notaVenta
  // Resumen rápido: qué dato va con qué código de Aduana (null = falta).
  const aduanaResumen = {
    clausulaVenta: { descripcion: nv.clausulaVenta?.descripcion ?? null, codigoAduana: nv.clausulaVenta?.codigoAduana ?? null },
    modalidadVenta: { descripcion: nv.modalidadVenta?.descripcion ?? null, codigoAduana: nv.modalidadVenta?.codigoAduana ?? null },
    viaTransporte: { descripcion: nv.tipoEmbarque?.descripcion ?? null, codigoAduana: nv.tipoEmbarque?.codigoAduana ?? null },
    puertoEmbarque: { descripcion: embarque.puertoZarpe?.descripcion ?? null, codigoAduana: embarque.puertoZarpe?.codigoAduana ?? null },
    puertoDesembarque: { descripcion: nv.puertoDestino?.descripcion ?? null, codigoAduana: nv.puertoDestino?.codigoAduana ?? null },
    paisDestino: { descripcion: nv.paisDestino?.descripcion ?? null, codigoAduana: nv.paisDestino?.codigoAduana ?? null },
    moneda: nv.moneda?.descripcionExtranjera || nv.moneda?.descripcion || nv.moneda?.codigo || null,
    tipoCambio: factura.tipoCambio == null ? null : Number(factura.tipoCambio),
  }
  return {
    endpoint: 'POST /api/dte/documentos/emitir?normalizar=1 (simpleDTE/LibreDTE)',
    aduanaResumen,
    payload,
  }
}

// ─── Paso 1: Enviar borrador al SII (crea el DTE temporal en LibreDTE) ────────
export async function enviarBorradorSii(id: number, userId: string) {
  return conManejoPayloadDte(id, 'enviar-sii', () => enviarBorradorSiiInterno(id, userId))
}

async function enviarBorradorSiiInterno(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado !== 'BORRADOR') {
    throw new ValidationError('Solo se puede enviar al SII una Factura en estado Borrador')
  }
  if (factura.lineas.length === 0) throw new ValidationError('La Factura no tiene líneas para enviar')
  if (!factura.fechaDocumento) throw new ValidationError('Indica la fecha del documento antes de enviar al SII')

  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  requireEmbarqueDespachado(embarque)

  // El SII exige el tipo de cambio para emitir en moneda extranjera (DTE 110).
  // Solo se omite si la moneda es la base (CLP).
  if (!embarque.notaVenta.moneda.esMonedaBase && (factura.tipoCambio == null || Number(factura.tipoCambio) <= 0)) {
    throw new ValidationError('Indica el tipo de cambio antes de enviar al SII (el SII lo exige para facturar en moneda extranjera)')
  }

  // El bloque Aduana del DTE 110 exige los códigos de las tablas del SII; se
  // validan ANTES de mandar a simpleDTE (si no, LibreDTE los descarta en
  // silencio y el documento sale sin la info de exportación).
  validarCodigosAduana(embarque)

  const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
  if (!emisor?.rut) {
    throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas antes de facturar')
  }

  const idioma = normalizarIdioma(factura.idioma)
  requireIdiomaEmitible(idioma, factura.lineas)

  // Versión de la factura con la que se arma el payload — se re-verifica bajo el
  // advisory lock antes de crear el temporal (FAS-COB-F1-001).
  const versionAlLeer = factura.actualizadoEn?.getTime() ?? null

  const payload = construirPayloadDte(
    factura,
    embarque,
    { rut: emisor.rut, razonSocial: emisor.razonSocial, giro: emisor.giro, direccion: emisor.direccion, comuna: emisor.comuna },
    idioma,
  )

  const temporal = await dteService.emitirDteTemporal({
    origenTipo: ORIGEN_TIPO,
    origenId: factura.id,
    tipoDte: TIPO_DTE_FACTURA_EXPORTACION,
    payload,
    rutEmisor: emisor.rut,
    rutReceptor: RUT_RECEPTOR_EXTRANJERO,
    creadoPor: userId,
    // Bajo el lock: aborta si la factura cambió (otra edición guardó una versión
    // nueva) o dejó de estar en BORRADOR entre la lectura inicial y este punto,
    // para no persistir un temporal con un payload viejo.
    verificarVigencia: async (tx) => {
      const actual = await tx.facturaExportacion.findFirst({
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
  // La Factura sigue en BORRADOR; el "borrador enviado" se refleja por el estado
  // del DocumentoDte (TEMPORAL_CREADO), que habilita "Firmar".
  return repo.getFacturaActivaById(id)
}

// ─── Paso 2: Firmar (timbrado real: folio + envío SII, genera cuotas) ─────────
export async function firmar(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado !== 'BORRADOR' && factura.estado !== 'RECHAZADA') {
    throw new ValidationError('Esta Factura no está en estado para firmar')
  }

  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  if (!dte || (dte.estado !== 'TEMPORAL_CREADO' && dte.estado !== 'GENERADO')) {
    throw new ValidationError('Primero envía el borrador al SII antes de firmar')
  }

  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  requireEmbarqueDespachado(embarque)

  // Reconciliación idempotente (FAS-COB-F1-005): si el DTE YA está GENERADO
  // (timbrado en un intento previo que no alcanzó a aprobar la factura), NO se
  // vuelve a timbrar — solo se reconcilia la factura con el folio existente.
  let folio: number
  let trackIdSii: string | null
  if (dte.estado === 'GENERADO') {
    // Invariante: un DocumentoDte GENERADO siempre debe tener folio (el motor DTE
    // ya no persiste GENERADO sin folio — FAS-EXP-IE-QA-003). Si igual apareciera
    // uno sin folio, no se aprueba la factura: es un error de datos a corregir.
    if (dte.folio == null) {
      throw new ValidationError('El DTE quedó timbrado sin folio (dato inconsistente) — contacta a soporte antes de continuar')
    }
    folio = dte.folio
    trackIdSii = dte.libredteCodigoTemporal
  } else {
    const emisor = await dteRepo.getEmpresaParaDte(factura.empresaId)
    if (!emisor?.rut) {
      throw new ValidationError('La Empresa no tiene RUT configurado — complétalo en Configuración → Empresas antes de facturar')
    }
    const generado = await dteService.generarDteReal({
      origenTipo: ORIGEN_TIPO,
      origenId: factura.id,
      tipoDte: TIPO_DTE_FACTURA_EXPORTACION,
      rutEmisor: emisor.rut,
      rutReceptor: RUT_RECEPTOR_EXTRANJERO,
      creadoPor: userId,
    })
    if (generado.estado === 'GENERANDO') {
      // Otra firma del mismo origen está timbrando (advisory lock liberado antes
      // de la llamada externa). NO es un rechazo: no se toca la factura — el
      // usuario reintenta/recarga cuando termine (FAS-COB-F1-006).
      throw new ValidationError('El timbrado de esta Factura ya está en curso — espera unos segundos y recarga')
    }
    if (generado.estado !== 'GENERADO') {
      // Rechazo real del SII/LibreDTE: se marca RECHAZADA con el motivo. El
      // DocumentoDte vuelve a TEMPORAL_CREADO, así que se puede reintentar
      // "Firmar" sobre el mismo temporal (política F1-A03: reusar temporal).
      await repo.marcarRechazada(factura.id, generado.errorMensaje ?? 'No se pudo timbrar el DTE en LibreDTE')
      throw new ValidationError(generado.errorMensaje ?? 'No se pudo timbrar el DTE en LibreDTE')
    }
    // Invariante reforzada en generarDteReal (FAS-EXP-IE-QA-003): un resultado
    // GENERADO siempre trae folio — si no, es un error de datos a corregir.
    if (generado.folio == null) {
      throw new ValidationError('El DTE se timbró sin folio (dato inconsistente) — contacta a soporte antes de continuar')
    }
    folio = generado.folio
    trackIdSii = generado.libredteCodigoTemporal ?? null
  }

  const fechaEmision = new Date()
  const fechaDocumento = factura.fechaDocumento ?? fechaEmision
  // La referencia FACTURA de las cuotas usa la fecha del documento.
  const cuotas = await construirCuotas(embarque.notaVentaId, Number(factura.montoTotal), fechaDocumento, embarque)

  return repo.marcarFirmada(factura.id, { folio, trackIdSii, fechaEmision, fechaDocumento, cuotas }, userId)
}

// ─── Lecturas / anulación ────────────────────────────────────────────────────
export async function obtenerPorEmbarque(embarqueId: number) {
  return repo.getFacturaActivaPorEmbarque(embarqueId)
}

export async function obtenerFactura(id: number) {
  const factura = await repo.getFacturaByIdConHistorial(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  // Adjunta el estado del DocumentoDte (para habilitar Enviar/Firmar/Descargar
  // XML en el frontend sin exponer el XML completo).
  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  return {
    ...factura,
    dte: dte ? { estado: dte.estado, folio: dte.folio, tieneXml: !!dte.xml } : null,
  }
}

// XML timbrado del DTE (para descarga). Solo si ya fue generado.
export async function obtenerXmlFactura(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  const dte = await dteService.obtenerDocumentoDte(ORIGEN_TIPO, factura.id)
  if (!dte?.xml) throw new ValidationError('Esta Factura aún no tiene XML timbrado disponible')
  return { xml: dte.xml, folio: dte.folio, codigo: factura.codigo }
}

// Sugiere el tipo de cambio vigente (dólar/euro observado del Banco Central) para
// la moneda de la Factura — para el botón "Obtener" del editor. No persiste: el
// valor se guarda al editar la Factura (actualizarBorrador), que invalida el DTE
// temporal. Lanza error si la moneda es la base (no aplica) o la fuente falla.
export async function obtenerTipoCambioSugerido(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  const embarque = await repo.getEmbarqueParaFacturaDte(factura.embarqueId)
  if (!embarque) throw new NotFoundError('Embarque', String(factura.embarqueId))
  if (embarque.notaVenta.moneda.esMonedaBase) {
    throw new ValidationError('La factura está en pesos (moneda base) — no requiere tipo de cambio')
  }
  const tc = await obtenerTipoCambio(embarque.notaVenta.moneda.codigo)
  if ('error' in tc) throw new ValidationError(tc.error)
  return { valor: tc.valor, fecha: tc.fecha, moneda: embarque.notaVenta.moneda.codigo }
}

export async function listarFacturas(filters: FacturasExportacionListFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listFacturas(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

// Listado embarque-céntrico: embarques despachados + estado Proforma/Factura.
export async function listarEmbarquesDespachados(filters: repo.EmbarquesExportacionFilters) {
  const { page = 1, limit = 20 } = filters
  const { data, total } = await repo.listEmbarquesDespachados(filters)
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

// Vuelve una Factura RECHAZADA a BORRADOR para poder editarla y reintentar.
export async function reabrirFactura(id: number) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado !== 'RECHAZADA') {
    throw new ValidationError('Solo se puede reabrir una Factura rechazada')
  }
  return repo.reabrirBorrador(id)
}

export async function anularFactura(id: number, userId: string) {
  const factura = await repo.getFacturaActivaById(id)
  if (!factura) throw new NotFoundError('Factura de Exportación', String(id))
  if (factura.estado === 'APROBADA') {
    throw new ValidationError(
      'No se puede anular una Factura ya aprobada (timbrada ante el SII) — requiere una Nota de Crédito de anulación (próxima fase)',
    )
  }
  return repo.anularFactura(id, userId)
}
