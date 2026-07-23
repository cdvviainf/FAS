import { NotFoundError, ValidationError, ConflictError } from '../../../shared/errors.js'
import { validatePasswordComplexity } from '../../../shared/password-validator.js'
import { auth } from '../../../lib/auth.js'
import { findPerfilById } from '../perfiles/perfiles.repository.js'
import * as repo from './usuarios.repository.js'
import type { UsuarioCreateInput, UsuarioUpdateInput, CambiarPasswordInput } from './usuarios.schema.js'

const SISTEMA_USER = 'system'

export async function listarUsuarios(page: number, limit: number, q?: string, perfilId?: number) {
  const { data, total } = await repo.findAllUsuarios(page, limit, q, perfilId)
  return {
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  }
}

export async function obtenerUsuario(id: string) {
  const usuario = await repo.findUsuarioById(id)
  if (!usuario) throw new NotFoundError('Usuario', id)
  return usuario
}

export async function crearUsuario(input: UsuarioCreateInput, currentUserId = SISTEMA_USER) {
  // RU2: validar complejidad de contraseña
  const passwordError = validatePasswordComplexity(input.password)
  if (passwordError) throw new ValidationError(passwordError)

  // RU2: validar confirmación
  if (input.password !== input.passwordConfirm) {
    throw new ValidationError('Las contraseñas no coinciden')
  }

  // RU3: perfil obligatorio
  const perfil = await findPerfilById(input.perfilId)
  if (!perfil) throw new ValidationError(`El perfil con ID ${input.perfilId} no existe`)

  // RU1: email único entre no eliminados
  const emailExistente = await repo.findUsuarioByEmail(input.email)
  if (emailExistente) {
    throw new ConflictError(`Ya existe un usuario con el email "${input.email}"`)
  }

  // Crear usuario en Better Auth usando el internal adapter
  const ctx = await auth.$context
  const userId = ctx.generateId({ model: 'user' }) || crypto.randomUUID()

  const authUser = await ctx.internalAdapter.createUser({
    id: userId,
    email: input.email,
    name: input.nombre,
    emailVerified: false,
  })

  // Compensar si cualquier paso posterior falla — evita dejar un User huérfano en Better Auth
  try {
    const hashedPassword = await ctx.password.hash(input.password)
    await ctx.internalAdapter.linkAccount({
      userId: authUser.id,
      providerId: 'credential',
      accountId: authUser.email,
      password: hashedPassword,
    })

    const usuario = await repo.createUsuario({
      id: authUser.id,
      nombre: input.nombre,
      email: input.email,
      whatsapp: input.whatsapp,
      perfilId: input.perfilId,
      creadoPor: currentUserId,
    })

    return usuario
  } catch (err) {
    await ctx.internalAdapter.deleteUser(authUser.id).catch(() => {})
    throw err
  }
}

export async function actualizarUsuario(id: string, input: UsuarioUpdateInput, currentUserId = SISTEMA_USER) {
  const usuario = await repo.findUsuarioById(id)
  if (!usuario) throw new NotFoundError('Usuario', id)

  // Validar perfil si se cambia
  if (input.perfilId !== undefined) {
    const perfil = await findPerfilById(input.perfilId)
    if (!perfil) throw new ValidationError(`El perfil con ID ${input.perfilId} no existe`)
  }

  return repo.updateUsuario(id, {
    nombre: input.nombre,
    whatsapp: input.whatsapp,
    perfilId: input.perfilId,
    actualizadoPor: currentUserId,
  })
}

// ─── Avatar (UP7) ────────────────────────────────────────────────────────────
// Mismo patrón que documentos de Articulo: metadata + binario, servido por endpoint
// propio. `imagenUrl` deja de ser editable manualmente y pasa a ser la ruta de este
// endpoint, gestionada solo por el servidor.

const AVATAR_MIMES_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])
export const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export async function subirAvatar(id: string, archivo: { mime: string; datos: Buffer }) {
  await obtenerUsuario(id)
  if (!AVATAR_MIMES_PERMITIDOS.has(archivo.mime)) {
    throw new ValidationError('Tipo de imagen no permitido. Se aceptan JPG, PNG o WEBP')
  }
  if (archivo.datos.length > MAX_AVATAR_BYTES) {
    throw new ValidationError('La imagen supera el tamaño máximo de 3 MB')
  }
  return repo.upsertAvatar(id, { mime: archivo.mime, tamano: archivo.datos.length, datos: archivo.datos })
}

export async function descargarAvatar(id: string) {
  const avatar = await repo.getAvatarContenido(id)
  if (!avatar) throw new NotFoundError('Avatar', id)
  return { mime: avatar.mime, datos: Buffer.from(avatar.datos) }
}

export async function eliminarAvatar(id: string) {
  await obtenerUsuario(id)
  await repo.deleteAvatar(id)
}

export async function cambiarPassword(id: string, input: CambiarPasswordInput) {
  const usuario = await repo.findUsuarioById(id)
  if (!usuario) throw new NotFoundError('Usuario', id)

  // RU2: validar complejidad
  const passwordError = validatePasswordComplexity(input.password)
  if (passwordError) throw new ValidationError(passwordError)

  // RU2: validar confirmación
  if (input.password !== input.passwordConfirm) {
    throw new ValidationError('Las contraseñas no coinciden')
  }

  // Actualizar contraseña vía Better Auth internal adapter (hashear antes de guardar)
  const ctx = await auth.$context
  const hashedPassword = await ctx.password.hash(input.password)
  await ctx.internalAdapter.updatePassword(id, hashedPassword)
}

export async function eliminarUsuario(id: string, currentUserId = SISTEMA_USER) {
  const usuario = await repo.findUsuarioById(id)
  if (!usuario) throw new NotFoundError('Usuario', id)

  // QAS-SI-001: no eliminar si está vinculado (asignado o solicitante) a solicitudes vigentes
  const vinculadas = await repo.countSolicitudesVinculadas(id)
  if (vinculadas > 0) {
    throw new ConflictError(
      `No se puede eliminar el usuario: está vinculado a ${vinculadas} solicitud${vinculadas === 1 ? '' : 'es'} de inspección vigente${vinculadas === 1 ? '' : 's'} (como asignado o solicitante).`,
    )
  }

  // RU4: soft delete — no puede autenticarse luego
  await repo.softDeleteUsuario(id, currentUserId)
}
