import { NotFoundError, ValidationError } from '../../../shared/errors.js'
import * as configRepo from '../config.repository.js'
import * as repo from './especies-imagen.repository.js'

// Mismos formatos/límite que el logo de empresa: viajan embebidos como data URI
// dentro del payload del PDF (Playwright no toca la red al renderizar).
const MIMES_PERMITIDOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
const TAMANO_MAX = 2 * 1024 * 1024 // 2MB

// Verifica que la especie exista en la empresa activa (getMantenedorById queda
// tenant-scoped por la extensión Prisma).
async function verificarEspecie(especieId: number) {
  const especie = await configRepo.getMantenedorById('especie', especieId)
  if (!especie) throw new NotFoundError('Especie', String(especieId))
}

export async function subirImagen(
  especieId: number,
  archivo: { mime: string; datos: Buffer },
  subidoPor: string,
) {
  await verificarEspecie(especieId)
  if (!MIMES_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError(`Formato de imagen no soportado: "${archivo.mime}". Usa PNG, JPEG, WebP o SVG.`)
  }
  if (archivo.datos.length > TAMANO_MAX) {
    throw new ValidationError('La imagen no puede superar los 2MB')
  }
  await repo.upsertImagenEspecie(especieId, archivo, subidoPor)
}

export async function descargarImagen(especieId: number) {
  await verificarEspecie(especieId)
  const imagen = await repo.findImagenEspecie(especieId)
  if (!imagen) throw new NotFoundError('Imagen de la especie', String(especieId))
  return imagen
}

export async function eliminarImagen(especieId: number) {
  await verificarEspecie(especieId)
  await repo.deleteImagenEspecie(especieId)
}
