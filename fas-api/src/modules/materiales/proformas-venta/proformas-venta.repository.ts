import { Prisma } from '@prisma/client'
import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'
import { ValidationError } from '../../../shared/errors.js'
import type {
  ProformaMaterialCreateInput,
  ProformaMaterialUpdateInput,
  ProformaMaterialLineaUpdateInput,
} from './proformas-venta.types.js'

const entidadSelect = { id: true, codigo: true, descripcion: true, razonSocial: true }
const mantenedorSelect = { id: true, codigo: true, descripcion: true }

const includeDetalle = {
  movimiento: {
    select: {
      id: true,
      fechaMovimiento: true,
      guiaReferencia: true,
      bodegaOrigen: { select: mantenedorSelect },
      tipoMovimiento: { select: { id: true, codigo: true, descripcion: true } },
    },
  },
  entidad: { select: entidadSelect },
  moneda: { select: mantenedorSelect },
  formaPago: { select: mantenedorSelect },
  condicionPago: { select: { id: true, codigo: true, descripcion: true } },
  lineas: {
    include: { articulo: { select: { id: true, codigo: true, descripcion: true, unidad: { select: mantenedorSelect } } } },
    orderBy: { id: 'asc' as const },
  },
  cuotasPago: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.ProformaMaterialInclude

export async function listProformasMaterial(page: number, limit: number, entidadId?: number, estado?: string) {
  const where: Prisma.ProformaMaterialWhereInput = {
    ...(entidadId ? { entidadId } : {}),
    ...(estado ? { estado: estado as 'BORRADOR' | 'ENVIADA_VALIDACION' | 'FACTURADA' | 'ANULADA' } : {}),
  }

  const [data, total] = await Promise.all([
    prisma.proformaMaterial.findMany({
      where,
      include: {
        entidad: { select: entidadSelect },
        moneda: { select: mantenedorSelect },
        movimiento: { select: { id: true, fechaMovimiento: true } },
      },
      orderBy: { id: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.proformaMaterial.count({ where }),
  ])

  return { data, total }
}

export async function getProformaMaterialById(id: number) {
  return prisma.proformaMaterial.findUnique({ where: { id }, include: includeDetalle })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any

// A diferencia de OrdenCompraMaterial (BORRADOR único estado editable, R20),
// acá no hay estado EMITIDA intermedio: BORRADOR es el único editable, y
// ENVIADA_VALIDACION ya bloquea cabecera/líneas/precio (R25).
async function lockYVerificarBorrador(tx: Tx, proformaMaterialId: number): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_MATERIAL_PROCESO}::int, ${proformaMaterialId}::int)`
  const actual = await tx.proformaMaterial.findUnique({ where: { id: proformaMaterialId }, select: { estado: true } })
  if (!actual) throw new ValidationError('La Proforma de Venta de Materiales ya no existe')
  if (actual.estado !== 'BORRADOR') {
    throw new ValidationError('La Proforma de Venta de Materiales ya fue enviada a validación y no puede editarse')
  }
}

// R25: solo condiciones tipo VENTA, cuotas 100% PORCENTAJE — mismo criterio
// que R21 (OrdenCompraMaterial), MONTO_UNITARIO no aplica a Materiales.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cuotasDesdeCondicionPago(tx: Tx, condicionPagoId: number | null | undefined) {
  if (!condicionPagoId) return []
  const condicionPago = await tx.condicionPago.findFirst({
    where: { id: condicionPagoId, eliminadoEn: null },
    include: { cuotas: true },
  })
  if (!condicionPago) return []
  if (condicionPago.tipo !== 'VENTA') {
    throw new ValidationError('La condición de pago debe ser de tipo Venta (R25)')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (condicionPago.cuotas.some((c: any) => c.tipoValor !== 'PORCENTAJE')) {
    throw new ValidationError('La condición de pago seleccionada tiene una cuota por unidad (caja/kilo) — no aplica a Materiales (R25)')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return condicionPago.cuotas.map((c: any) => ({
    fechaReferencia: c.fechaReferencia,
    plazoDias: c.plazoDias,
    porcentaje: c.porcentaje,
    descripcion: c.descripcion,
  }))
}

// Numeración PVM-{AAAA}-{NNNN} (R25) — namespace propio, no coordina con
// nada más (mismo criterio que LOCK_NAMESPACE_ORDEN_COMPRA_MATERIAL_NUMERO).
const LOCK_NAMESPACE_PROFORMA_MATERIAL_NUMERO = 490247
// Serializa cualquier operación sobre una Proforma puntual (edición de
// cabecera/línea, enviar a validación, anular) y, con clave = movimientoId,
// dos intentos concurrentes de crear una Proforma para el MISMO Movimiento.
const LOCK_NAMESPACE_PROFORMA_MATERIAL_PROCESO = 490248

export async function createProformaMaterial(data: ProformaMaterialCreateInput, creadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_MATERIAL_PROCESO}::int, ${data.movimientoId}::int)`

    const movimiento = await tx.movimiento.findFirst({
      where: { id: data.movimientoId, eliminadoEn: null },
      include: {
        tipoMovimiento: { select: { clase: true, generaProforma: true } },
        entidad: { select: { id: true, tipos: true } },
        detalle: { select: { articuloId: true, cantidad: true } },
        proformasMaterial: { where: { estado: { not: 'ANULADA' } }, select: { id: true } },
      },
    })
    if (!movimiento) throw new ValidationError('El Movimiento seleccionado no existe')
    if (movimiento.estado !== 'CONFIRMADO') {
      throw new ValidationError('El Movimiento debe estar Confirmado para generar una Proforma de Venta (R25)')
    }
    if (movimiento.tipoMovimiento.clase !== 'SALIDA' || !movimiento.tipoMovimiento.generaProforma) {
      throw new ValidationError('El Tipo de Movimiento no está habilitado para generar Proforma de Venta (R25)')
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!movimiento.entidad || !movimiento.entidad.tipos.includes('CLIENTE_NACIONAL')) {
      throw new ValidationError('El Movimiento debe tener una Entidad tipo Cliente Nacional para generar la Proforma (R17)')
    }
    if (movimiento.proformasMaterial.length > 0) {
      throw new ValidationError('Este Movimiento ya tiene una Proforma de Venta vigente')
    }
    if (movimiento.detalle.length === 0) {
      throw new ValidationError('El Movimiento no tiene líneas')
    }

    const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)

    const anio = new Date().getFullYear()
    const prefijo = `PVM-${anio}-`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_MATERIAL_NUMERO}::int, ${anio}::int)`
    const total = await tx.proformaMaterial.count({ where: { numero: { startsWith: prefijo } } })
    const numero = `${prefijo}${String(total + 1).padStart(4, '0')}`

    return tx.proformaMaterial.create({
      data: {
        // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe
        // este valor con la empresa activa del contexto.
        empresaId: getEmpresaIdActual()!,
        numero,
        movimientoId: data.movimientoId,
        entidadId: movimiento.entidad!.id,
        formaPagoId: data.formaPagoId,
        condicionPagoId: data.condicionPagoId,
        monedaId: data.monedaId,
        observaciones: data.observaciones,
        creadoPor,
        // Líneas copiadas 1:1 desde el Movimiento — cantidad no editable
        // (R25), el precio de venta se define después vía PATCH por línea.
        lineas: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: movimiento.detalle.map((d: any) => ({
            articuloId: d.articuloId,
            cantidad: d.cantidad,
            precioUnitario: 0,
            monto: 0,
          })),
        },
        cuotasPago: { create: cuotasPago },
      },
      include: includeDetalle,
    })
  })
}

export async function updateProformaMaterial(id: number, data: ProformaMaterialUpdateInput, actualizadoPor: string) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    if (data.condicionPagoId !== undefined) {
      const actual = await tx.proformaMaterial.findUniqueOrThrow({ where: { id }, select: { condicionPagoId: true } })
      if (data.condicionPagoId !== actual.condicionPagoId) {
        const cuotasPago = await cuotasDesdeCondicionPago(tx, data.condicionPagoId)
        await tx.proformaMaterialCuotaPago.deleteMany({ where: { proformaMaterialId: id } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await tx.proformaMaterialCuotaPago.createMany({ data: cuotasPago.map((c: any) => ({ proformaMaterialId: id, ...c })) })
      }
    }
    return tx.proformaMaterial.update({
      where: { id },
      data: { ...data, actualizadoPor },
      include: includeDetalle,
    })
  })
}

function calcularMonto(cantidad: number, precioUnitario: number): Prisma.Decimal {
  return new Prisma.Decimal(cantidad).mul(precioUnitario)
}

export async function updateLineaPrecio(proformaMaterialId: number, lineaId: number, data: ProformaMaterialLineaUpdateInput) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, proformaMaterialId)
    const linea = await tx.proformaMaterialLinea.findUnique({
      where: { id: lineaId },
      select: { id: true, proformaMaterialId: true, cantidad: true },
    })
    if (!linea || linea.proformaMaterialId !== proformaMaterialId) {
      throw new ValidationError('La línea no pertenece a esta Proforma de Venta de Materiales')
    }
    return tx.proformaMaterialLinea.update({
      where: { id: lineaId },
      data: {
        precioUnitario: data.precioUnitario,
        monto: calcularMonto(Number(linea.cantidad), data.precioUnitario),
      },
      include: { articulo: { select: { id: true, codigo: true, descripcion: true } } },
    })
  })
}

export async function enviarValidacion(id: number) {
  return prisma.$transaction(async (tx) => {
    await lockYVerificarBorrador(tx, id)
    const lineas = await tx.proformaMaterialLinea.findMany({ where: { proformaMaterialId: id }, select: { precioUnitario: true } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (lineas.some((l: any) => Number(l.precioUnitario) <= 0)) {
      throw new ValidationError('Todas las líneas deben tener un precio de venta mayor a 0 antes de enviar a validación')
    }
    return tx.proformaMaterial.update({
      where: { id },
      data: { estado: 'ENVIADA_VALIDACION' },
      include: includeDetalle,
    })
  })
}

export async function anularProformaMaterial(id: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_PROFORMA_MATERIAL_PROCESO}::int, ${id}::int)`
    const actual = await tx.proformaMaterial.findUnique({ where: { id }, select: { estado: true } })
    if (!actual) throw new ValidationError('La Proforma de Venta de Materiales ya no existe')
    if (actual.estado === 'FACTURADA' || actual.estado === 'ANULADA') {
      throw new ValidationError('Esta Proforma de Venta de Materiales ya no puede anularse')
    }
    return tx.proformaMaterial.update({
      where: { id },
      data: { estado: 'ANULADA' },
      include: includeDetalle,
    })
  })
}

// ─── Validación de referencias ───────────────────────────────────────────────

export async function getMoneda(id: number) {
  return prisma.moneda.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getFormaPago(id: number) {
  return prisma.formaPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true } })
}

export async function getCondicionPago(id: number) {
  return prisma.condicionPago.findFirst({ where: { id, eliminadoEn: null, bloqueado: false }, select: { id: true, tipo: true } })
}
