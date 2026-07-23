import { prisma } from '../../../lib/prisma.js'

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
    data: { ...data, creadoPor: userId },
  })
}
