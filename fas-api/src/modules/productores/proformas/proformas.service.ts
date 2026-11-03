// ─────────────────────────────────────────────────────────────────────────────
// Supersesión (2026-10-31, decisión de Christian — ver Docs/productores.md R14):
//   • Las líneas de la Proforma de Servicios a Productores se modelan con
//     `Articulo` tipo SERVICIO (NO con `ConceptoLiquidacion` como decía R14).
//   • Ruta API: /api/productores/proformas (NO /proformas-servicio).
//   • Control de doble cobro (R15, factura vs liquidación) DIFERIDO a la Etapa 3
//     (Liquidación). Por ahora la vía factura SÍ impacta la cuenta corriente del
//     productor (DEBE) al timbrarse la Factura Nacional de origen.
// ─────────────────────────────────────────────────────────────────────────────
import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import { obtenerTipoCambio } from '../../finanzas/facturacion/tipo-cambio.adapter.js'
import * as repo from './proformas.repository.js'
import type {
  ProformaProductorCreateInput,
  ProformaProductorUpdateInput,
  ProformaProductorListFilters,
  ProformaProductorLineaInput,
} from './proformas.types.js'

async function validarReferenciasHeader(data: {
  entidadId?: number
  monedaId?: number
  formaPagoId?: number | null
  condicionPagoId?: number | null
  conceptoCtaCteId?: number | null
}) {
  if (data.entidadId != null) {
    const entidad = await repo.getEntidad(data.entidadId)
    if (!entidad) throw new ValidationError('El productor seleccionado no existe')
    if (!entidad.tipos.includes('PRODUCTOR')) {
      throw new ValidationError('La entidad seleccionada no es un Productor')
    }
  }
  if (data.conceptoCtaCteId != null) {
    const concepto = await repo.getConceptoCtaCte(data.conceptoCtaCteId)
    if (!concepto) throw new ValidationError('El concepto de cuenta corriente seleccionado no existe o está bloqueado')
    // Una factura de venta de servicios al productor es un CARGO para él → al
    // emitirse genera un movimiento DEBE en su CC (R5b: saldo = ΣHABER − ΣDEBE).
    // Por eso el concepto debe admitir DEBE (o AMBOS); un concepto solo HABER no
    // aplica → 422.
    if (concepto.naturaleza === 'HABER') {
      throw new ValidationError('El concepto de cuenta corriente debe ser de naturaleza DEBE o AMBOS (la factura es un cargo al productor)')
    }
  }
  if (data.monedaId != null) {
    const moneda = await repo.getMoneda(data.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  }
  if (data.formaPagoId != null) {
    const formaPago = await repo.getFormaPago(data.formaPagoId)
    if (!formaPago) throw new ValidationError('La forma de pago seleccionada no existe o está bloqueada')
  }
  if (data.condicionPagoId != null) {
    const condicionPago = await repo.getCondicionPago(data.condicionPagoId)
    if (!condicionPago) throw new ValidationError('La condición de pago seleccionada no existe o está bloqueada')
    if (condicionPago.tipo !== 'VENTA') {
      throw new ValidationError('La condición de pago debe ser de tipo Venta')
    }
  }
}

export async function listarProformasProductor(filters: ProformaProductorListFilters) {
  const { page = 1, limit = 20, entidadId, estado, q } = filters
  const { data, total } = await repo.listProformasProductor(page, limit, entidadId, estado, q)
  // Estado de emisión: EMITIDA ⟺ la Factura Nacional activa está APROBADA por el
  // SII; PENDIENTE en cualquier otro caso (sin factura, o factura en
  // borrador/enviada/rechazada/anulada). No exponemos el array crudo de facturas.
  const dataConEmision = data.map(({ facturasNacional, ...p }) => ({
    ...p,
    estadoEmision: facturasNacional.some((f) => f.estado === 'APROBADA') ? ('EMITIDA' as const) : ('PENDIENTE' as const),
  }))
  return { data: dataConEmision, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } }
}

export async function obtenerProformaProductor(id: number) {
  const proforma = await repo.getProformaProductorById(id)
  if (!proforma) throw new NotFoundError('Proforma a Productor', String(id))
  return proforma
}

// Tipo de cambio sugerido (CLP por 1 unidad de la moneda) desde la fuente
// oficial (mindicador.cl), para el botón "Obtener" del form. No persiste nada.
// CLP → 1. Monedas sin serie automática → error accionable (se ingresa manual).
export async function obtenerTipoCambioSugerido(monedaCodigo: string, fecha?: string) {
  if (monedaCodigo.toUpperCase() === 'CLP') return { valor: 1, fecha: null, moneda: 'CLP' }
  const tc = await obtenerTipoCambio(monedaCodigo, fecha ? new Date(fecha) : undefined)
  if ('error' in tc) throw new ValidationError(tc.error)
  return { valor: tc.valor, fecha: tc.fecha, moneda: monedaCodigo }
}

// La Factura Nacional es en CLP: si la moneda de la proforma no es CLP, se exige
// el tipo de cambio (CLP por 1 unidad) para convertir al facturar.
function validarTipoCambio(codigoMoneda: string, tipoCambio: number | null | undefined) {
  if (codigoMoneda === 'CLP') return
  if (tipoCambio == null || tipoCambio <= 0) {
    throw new ValidationError('La moneda no es CLP: indica el tipo de cambio (CLP por 1 unidad de la moneda) para poder facturar')
  }
}

export async function crearProformaProductor(body: ProformaProductorCreateInput, creadoPor: string) {
  await validarReferenciasHeader(body)
  const moneda = await repo.getMoneda(body.monedaId)
  if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
  validarTipoCambio(moneda.codigo, body.tipoCambio)
  // CLP no lleva tipo de cambio: se normaliza a null.
  const tipoCambio = moneda.codigo === 'CLP' ? null : body.tipoCambio
  return repo.createProformaProductor({ ...body, tipoCambio }, creadoPor)
}

export async function actualizarProformaProductor(id: number, body: ProformaProductorUpdateInput, actualizadoPor: string) {
  const actual = await obtenerProformaProductor(id)
  await validarReferenciasHeader(body)
  const patch: ProformaProductorUpdateInput = { ...body }
  if (body.lineas !== undefined) {
    if (body.lineas.length === 0) throw new ValidationError('La Proforma debe tener al menos una línea')
    patch.lineas = body.lineas
  }
  // Valida/normaliza el tipo de cambio contra la moneda EFECTIVA (la del patch o,
  // si no cambia, la actual de la proforma).
  if (body.monedaId !== undefined || body.tipoCambio !== undefined) {
    const moneda = await repo.getMoneda(body.monedaId ?? actual.monedaId)
    if (!moneda) throw new ValidationError('La moneda seleccionada no existe o está bloqueada')
    if (moneda.codigo === 'CLP') {
      patch.tipoCambio = null
    } else {
      // Si la moneda CAMBIA a una no-CLP, el tipo de cambio del mismo PATCH es
      // obligatorio: no se reutiliza el anterior (era de otra moneda). Si la
      // moneda no cambia, se conserva el tipo de cambio actual de la proforma.
      const monedaCambia = body.monedaId !== undefined && body.monedaId !== actual.monedaId
      const tc = body.tipoCambio !== undefined
        ? body.tipoCambio
        : monedaCambia
          ? null
          : actual.tipoCambio != null ? Number(actual.tipoCambio) : null
      validarTipoCambio(moneda.codigo, tc)
    }
  }
  return repo.updateProformaProductor(id, patch, actualizadoPor)
}

export async function enviarValidacionProformaProductor(id: number) {
  const proforma = await obtenerProformaProductor(id)
  // FAS-PP-QA-002 / R16 / VN5: la vía factura impacta la CC del productor. No se
  // puede enviar a validación sin el concepto de cuenta corriente que registrará
  // el movimiento al timbrar la factura.
  // FAS-PP-QA-005: la revalidación del Concepto de Cta. Cte. (vigente, no
  // bloqueado/eliminado y naturaleza DEBE/AMBOS) se hace ATÓMICAMENTE dentro de
  // repo.enviarValidacion, bajo lock de fila del concepto y leyendo el
  // conceptoCtaCteId ACTUAL de la proforma, para serializar con el mantenedor.
  if (proforma.conceptoCtaCteId == null) {
    throw new ValidationError('Debes seleccionar el Concepto de Cuenta Corriente antes de enviar a validación (se usará al emitir la factura)')
  }
  // Si la moneda no es CLP, el tipo de cambio es obligatorio para convertir la
  // Factura Nacional a CLP al facturar.
  validarTipoCambio(proforma.moneda.codigo, proforma.tipoCambio != null ? Number(proforma.tipoCambio) : null)
  // FAS-PP-QA-004 / R13: para poder facturarle, el productor debe estar marcado
  // también como Cliente Nacional. Se valida temprano (acá) para no dejar
  // proformas "listas" que luego no se pueden facturar.
  const entidad = await repo.getEntidad(proforma.entidadId)
  if (!entidad || !entidad.tipos.includes('CLIENTE_NACIONAL')) {
    throw new ValidationError('El productor debe estar marcado también como Cliente Nacional para poder facturarle')
  }
  return repo.enviarValidacion(id)
}

export async function rechazarProformaProductor(id: number) {
  await obtenerProformaProductor(id)
  return repo.rechazarProformaProductor(id)
}

export async function anularProformaProductor(id: number) {
  await obtenerProformaProductor(id)
  return repo.anularProformaProductor(id)
}
