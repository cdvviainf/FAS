import { prisma } from '../../../lib/prisma.js'
import type { PrefijoCodigoCreateInput, PrefijoCodigoUpdateInput } from './prefijos-codigo.types.js'

export async function listPrefijosCodigo() {
  return prisma.prefijoCodigo.findMany({
    where: { eliminadoEn: null },
    orderBy: { modelo: 'asc' },
  })
}

export async function getPrefijoCodigoById(id: number) {
  return prisma.prefijoCodigo.findFirst({ where: { id, eliminadoEn: null } })
}

export async function findPrefijoCodigoByModelo(modelo: string) {
  return prisma.prefijoCodigo.findFirst({ where: { modelo, eliminadoEn: null } })
}

export async function createPrefijoCodigo(data: PrefijoCodigoCreateInput, creadoPor: string) {
  return prisma.prefijoCodigo.create({ data: { ...data, creadoPor } })
}

export async function updatePrefijoCodigo(id: number, data: PrefijoCodigoUpdateInput, actualizadoPor: string) {
  return prisma.prefijoCodigo.update({ where: { id }, data: { ...data, actualizadoPor } })
}

export async function softDeletePrefijoCodigo(id: number, eliminadoPor: string) {
  return prisma.prefijoCodigo.update({ where: { id }, data: { eliminadoEn: new Date(), eliminadoPor } })
}

// Calcula el siguiente correlativo disponible para `modelo` con el prefijo
// configurado: busca el máximo sufijo numérico entre los códigos existentes
// que empiezan con ese prefijo (no cuenta filas — un código editado a mano
// fuera de secuencia no debe hacer que se repita un correlativo ya usado).
// Es una SUGERENCIA, no una reserva atómica: la unicidad real la sigue
// validando cada servicio al crear (mismo patrón que el resto del sistema).
export async function calcularSiguienteCodigo(modelo: string, prefijo: string, digitos: number): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (prisma as unknown as Record<string, any>)[modelo]
  const registros: { codigo: string }[] = await delegate.findMany({
    where: { codigo: { startsWith: prefijo } },
    select: { codigo: true },
  })

  let maximo = 0
  for (const { codigo } of registros) {
    const resto = codigo.slice(prefijo.length)
    const n = parseInt(resto, 10)
    if (!isNaN(n) && n > maximo) maximo = n
  }

  return `${prefijo}${String(maximo + 1).padStart(digitos, '0')}`
}
