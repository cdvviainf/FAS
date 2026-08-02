import { prisma } from '../../../lib/prisma.js'
import { getEmpresaIdActual } from '../../../lib/empresa-context.js'

export async function getConfiguracionCorreo() {
  return prisma.configuracionCorreo.findFirst({ orderBy: { id: 'desc' } })
}

export interface ConfiguracionCorreoData {
  host: string
  puerto: number
  seguridad: string
  usuario: string
  passwordCifrada: string
  remitenteNombre: string
  remitenteEmail: string
}

export async function upsertConfiguracionCorreo(data: ConfiguracionCorreoData, userId: string) {
  const existente = await getConfiguracionCorreo()
  if (existente) {
    return prisma.configuracionCorreo.update({
      where: { id: existente.id },
      data: { ...data, actualizadoPor: userId },
    })
  }
  return prisma.configuracionCorreo.create({
    // empresaId: la extensión de tenancy (prisma-tenancy.ts) sobrescribe este
    // valor con el resuelto en el request (o lanza EMPRESA_REQUERIDA si no
    // hay ninguno) — el `!` solo satisface el tipo generado por Prisma.
    data: { ...data, empresaId: getEmpresaIdActual()!, creadoPor: userId },
  })
}
