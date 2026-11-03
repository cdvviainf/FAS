import { Prisma } from '@prisma/client'
import type { NaturalezaCuentaCorriente } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import { LOCK_NAMESPACE_PROFORMA_PRODUCTOR_NUMERO, LOCK_NAMESPACE_PROFORMA_PRODUCTOR_PROCESO } from '../../../shared/advisory-locks.js'
import type {
  ProformaProductorCreateInput,
  ProformaProductorUpdateInput,
  ProformaProductorLineaInput,
} from './proformas.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  entidad: { select: entidadSelect },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  condicionPago: { select: { id: true, codigo: true, descripcion: true } },
  conceptoCtaCte: { select: { id: true, codigo: true, descripcion: true, naturaleza: true } },
  lineas: {
    orderBy: { id: 'asc' as const },
  },
  cuotasPago: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.ProformaProductorInclude

const round2 = (n: number) => Math.round(n * 100) / 100

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

export async function listProformasProductor(page: number, limit: number, entidadId?: number, estado?: string, q?: string) {
  const where: Prisma.ProformaProductorWhereInput = {
    ...(entidadId ? { entidadId } : {}),
    ...(estado ? { estado: estado as 'BORRADOR' | 'ENVIADA_VALIDACION' | 'RECHAZADA' | 'FACTURADA' | 'ANULADA' } : {}),
    ...(q
      ? {
          OR: [
            { numero: { contains: q, mode: 'insensitive' } },
            { entidad: { razonSocial: { contains: q, mode: 'insensitive' } } },
            { entidad: { descripcion: { contains: q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  }

  const [data, total] = await Promise.all([
    prisma.proformaProductor.findMany({
      where,
      include: {
        entidad: { select: entidadSelect },
        moneda: { select: mantenedorSelect },
        // Factura Nacional activa (≤1 por índice único parcial) para derivar el
        // estado de emisión (EMITIDA ⟺ factura APROBADA por el SII).
        facturasNacional: { where: { eliminadoEn: null }, select: { estado: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.proformaProductor.count({ where }),
  ])

  return { data, total }
}

export async function getProformaProductorById(id: number) {
  return prisma.proformaProductor.findUnique({ where: { id }, include: includeDetalle })
}

// R: solo condiciones tipo VENTA, cuotas 100% PORCENTAJE — mismo criterio que la
// Proforma de Materiales.
async function cuotasDesdeCondicionPago(tx: Tx, condicionPagoId: number | null | undefined) {
  if (!condicionPagoId) return []
  const condicionPago = await tx.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []
  if (condicionPago.tipo !== 'VENTA') {
    throw new ValidationError('La condición de pago debe ser de tipo Venta')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (condicionPago.cuotas.some((c: any) => c.tipoValor !== 'PORCENTAJE')) {
    throw new ValidationError('La condición de pago seleccionada tiene una cuota por unidad (caja/kilo) — no aplica a servicios')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return condicionPago.cuotas.map((c: any) => ({
    fechaReferencia: c.fechaReferencia,
    plazoDias: c.plazoDias,
    porcentaje: c.porcentaje,
    descripcion: c.descripcion,
  }))
}

function lineasPersistir(lineas: ProformaProductorLineaInput[]) {
  return lineas.map((l) => ({
    glosa: l.glosa,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    monto: round2(l.cantidad * l.precioUnitario),
    exento: l.exento,
  }))
}

// Estados editables: BORRADOR y RECHAZADA (una proforma rechazada se corrige y
// se reenvía a validación). ENVIADA_VALIDACION / FACTURADA / ANULADA bloquean
// cabecera/líneas.
async function lockYVerificarEditable(tx: Tx, proformaProductorId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_PRODUCTOR_PROCESO}::int, ${proformaProductorId}::int)`
  const actual = await tx.proformaProductor.findUnique({ where: { id: proformaProductorId }, select: { estado: true } })
  if (!actual) throw new ValidationError('La Proforma a Productor ya no existe')
  if (actual.estado !== 'BORRADOR' && actual.estado !== 'RECHAZADA') {
    throw new ValidationError('La Proforma a Productor no está en un estado editable (Borrador o Rechazada)')
  }
}

export async function createProformaProductor(data: ProformaProductorCreateInput, creadoPor: string) {
  return prisma.$transaction(async (tx) => {
    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)

    const anio = new Date().getFullYear()
    const prefijo = `PVP-${anio}-`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_PRODUCTOR_NUMERO}::int, ${anio}::int)`
    const total = await tx.proformaProductor.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`

    return tx.proformaProductor.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto.
        empresaId: getEmpresaIdActual()!,
        numero,
        entidadId: data.entidadId,
        formaPagoId: data.formaPagoId,
        condicionPagoId: data.condicionPagoId,
        conceptoCtaCteId: data.conceptoCtaCteId,
        monedaId: data.monedaId,
        tipoCambio: data.tipoCambio ?? null,
        observaciones: data.observaciones,
        creadoPor,
        lineas: { create: lineasPersistir(data.lineas) },
        cuotasPago: { create: cuotasPago },
      },
      include: includeDetalle,
    })
  })
}

export async function updateProformaProductor(id: number, data: ProformaProductorUpdateInput, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)

    if (data.condicionPagoId !== undefined) {
      const actual = await tx.proformaProductor.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)
        await tx.proformaProductorCuotaPago.deleteMany({ where: { proformaProductorId: id } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.proformaProductorCuotaPago.createMany({ data: cuotasPago.map((c: any) => ({ proformaProductorId: id, ...c })) })
      }
    }

    if (data.lineas !== undefined) {
      await tx.proformaProductorLinea.deleteMany({ where: { proformaProductorId: id } })
      await tx.proformaProductorLinea.createMany({
        data: lineasPersistir(data.lineas).map((l) => ({ proformaProductorId: id, ...l })),
      })
    }

    return tx.proformaProductor.update({
      where: { id },
      data: {
        ...(data.entidadId !== undefined ? { entidadId: data.entidadId } : {}),
        ...(data.monedaId !== undefined ? { monedaId: data.monedaId } : {}),
        ...(data.tipoCambio !== undefined ? { tipoCambio: data.tipoCambio } : {}),
        ...(data.formaPagoId !== undefined ? { formaPagoId: data.formaPagoId } : {}),
        ...(data.condicionPagoId !== undefined ? { condicionPagoId: data.condicionPagoId } : {}),
        ...(data.conceptoCtaCteId !== undefined ? { conceptoCtaCteId: data.conceptoCtaCteId } : {}),
        ...(data.observaciones !== undefined ? { observaciones: data.observaciones } : {}),
        actualizadoPor,
      },
      include: includeDetalle,
    })
  })
}

export async function enviarValidacion(id: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarEditable(tx, id)
    // FAS-PP-QA-005: revalidar el Concepto de Cta. Cte. YA bajo transacción y con
    // lock de fila (SELECT … FOR UPDATE), leyendo el conceptoCtaCteId ACTUAL de la
    // proforma (no el del snapshot del service, que una edición concurrente pudo
    // cambiar). El lock usa el mismo recurso/orden que `updateConceptoCtaCteSeguro`
    // del mantenedor y que `marcarFirmada`, de modo que una edición concurrente del
    // concepto no puede intercalarse: la proforma nunca queda ENVIADA_VALIDACION
    // apuntando a un concepto bloqueado, eliminado o de naturaleza HABER.
    const actual = await tx.proformaProductor.findUnique({ where: { id }, select: { conceptoCtaCteId: true, entidadId: true } })
    if (!actual?.conceptoCtaCteId) {
      throw new ValidationError('Debes seleccionar el Concepto de Cuenta Corriente antes de enviar a validación (se usará al emitir la factura)')
    }
    // FAS-PP-QA-006 / QA-007 / R13: revalidar el PRODUCTOR con el entidadId ACTUAL
    // de la proforma (una edición concurrente —serializada por el advisory lock de
    // arriba— pudo cambiarlo) y bajo LOCK DE FILA de la entidad (SELECT … FOR
    // UPDATE), para serializar con el mantenedor de entidades: una edición que le
    // quite CLIENTE_NACIONAL, lo desactive o lo elimine no puede intercalarse entre
    // esta lectura y el cambio de estado. Para poder facturarle debe existir, estar
    // vigente, activo y ser también CLIENTE_NACIONAL. La firma lo revalida como
    // gate duro; acá se evita dejar una proforma ENVIADA_VALIDACION no facturable.
    const [entidad] = await tx.$queryRaw<
      Array<{ tipos: string[]; eliminadoEn: Date | null; activo: boolean }>
    >(Prisma.sql`SELECT tipos, "eliminadoEn", activo FROM entidades WHERE id = ${actual.entidadId} FOR UPDATE`)
    if (!entidad || entidad.eliminadoEn != null || !entidad.activo || !entidad.tipos.includes('CLIENTE_NACIONAL')) {
      throw new ValidationError('El productor debe estar marcado también como Cliente Nacional (y estar vigente) para poder facturarle')
    }
    const [concepto] = await tx.$queryRaw<
      Array<{ naturaleza: NaturalezaCuentaCorriente; bloqueado: boolean; eliminadoEn: Date | null }>
    >(Prisma.sql`SELECT naturaleza, bloqueado, "eliminadoEn" FROM conceptos_cta_cte WHERE id = ${actual.conceptoCtaCteId} FOR UPDATE`)
    if (!concepto || concepto.eliminadoEn != null || concepto.bloqueado) {
      throw new ValidationError('El Concepto de Cuenta Corriente de la Proforma ya no existe o está bloqueado — selecciona uno vigente antes de enviar a validación')
    }
    if (concepto.naturaleza === 'HABER') {
      throw new ValidationError('El Concepto de Cuenta Corriente debe ser de naturaleza DEBE o AMBOS (la factura es un cargo al productor)')
    }
    const lineas = await tx.proformaProductorLinea.findMany({ where: { proformaProductorId: id }, select: { precioUnitario: true } })
    if (lineas.length === 0) {
      throw new ValidationError('La Proforma debe tener al menos una línea antes de enviar a validación')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (lineas.some((l: any) => Number(l.precioUnitario) <= 0)) {
      throw new ValidationError('Todas las líneas deben tener un precio mayor a 0 antes de enviar a validación')
    }
    return tx.proformaProductor.update({
      where: { id },
      data: { estado: 'ENVIADA_VALIDACION' },
      include: includeDetalle,
    })
  })
}

// Rechazar: devuelve una proforma ENVIADA_VALIDACION a corrección (RECHAZADA).
// Solo desde ENVIADA_VALIDACION y solo si no hay Factura Nacional activa (si ya
// se generó la factura, hay que anularla primero — mismo guard que anular).
export async function rechazarProformaProductor(id: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_PRODUCTOR_PROCESO}::int, ${id}::int)`
    const actual = await tx.proformaProductor.findUnique({ where: { id }, select: { estado: true } })
    if (!actual) throw new ValidationError('La Proforma a Productor ya no existe')
    if (actual.estado !== 'ENVIADA_VALIDACION') {
      throw new ValidationError('Solo se puede rechazar una Proforma que está Enviada a Validación')
    }
    const facturaActiva = await tx.facturaNacional.findFirst({
      where: { proformaProductorId: id, eliminadoEn: null },
      select: { codigo: true },
    })
    if (facturaActiva) {
      throw new ValidationError(
        `No se puede rechazar: la Proforma tiene la Factura Nacional ${facturaActiva.codigo} asociada. Anula primero la factura.`,
      )
    }
    return tx.proformaProductor.update({
      where: { id },
      data: { estado: 'RECHAZADA' },
      include: includeDetalle,
    })
  })
}

export async function anularProformaProductor(id: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_PRODUCTOR_PROCESO}::int, ${id}::int)`
    const actual = await tx.proformaProductor.findUnique({ where: { id }, select: { estado: true } })
    if (!actual) throw new ValidationError('La Proforma a Productor ya no existe')
    if (actual.estado === 'FACTURADA' || actual.estado === 'ANULADA') {
      throw new ValidationError('Esta Proforma a Productor ya no puede anularse')
    }
    // Mientras exista una Factura Nacional activa sobre esta Proforma, no se puede
    // anular (la factura la "reserva"). El índice único garantiza a lo más una
    // factura activa.
    const facturaActiva = await tx.facturaNacional.findFirst({
      where: { proformaProductorId: id, eliminadoEn: null },
      select: { codigo: true },
    })
    if (facturaActiva) {
      throw new ValidationError(
        `No se puede anular: la Proforma tiene la Factura Nacional ${facturaActiva.codigo} asociada. Anula primero la factura.`,
      )
    }
    return tx.proformaProductor.update({
      where: { id },
      data: { estado: 'ANULADA' },
      include: includeDetalle,
    })
  })
}

// ─── Validación de referencias ───────────────────────────────────────────────

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, codigo: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, tipo: true } })
}

export async function getEntidad(id: number) {
  return prisma.entidad.findFirst({ where: { id, eliminadoEn: null }, select: { id: true, tipos: true } })
}

// Concepto de cta. cte. activo (empresa activa — la extensión de tenancy acota
// ConceptoCtaCte por empresa). Devuelve su naturaleza para validar el signo.
export async function getConceptoCtaCte(id: number) {
  return prisma.conceptoCtaCte.findFirst({
    where: { id, eliminadoEn: null, bloqueado: false },
    select: { id: true, naturaleza: true },
  })
}
