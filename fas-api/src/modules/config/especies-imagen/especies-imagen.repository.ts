import { prisma } from '../../../lib/prisma.js'

// Imagen de especie para el banner de los PDF — una por especie (upsert, sin
// historial), mismo patrón que EmpresaLogo.
export async function upsertImagenEspecie(
  especieId: number,
  data: { mime: string; datos: Buffer },
  subidoPor: string,
) {
  return prisma.especieImagen.upsert({
    where: { especieId },
    create: { especieId, mime: data.mime, datos: data.datos, subidoPor },
    update: { mime: data.mime, datos: data.datos, subidoPor, subidoEn: new Date() },
  })
}

export async function findImagenEspecie(especieId: number) {
  return prisma.especieImagen.findUnique({ where: { especieId } })
}

export async function deleteImagenEspecie(especieId: number) {
  await prisma.especieImagen.deleteMany({ where: { especieId } })
}
