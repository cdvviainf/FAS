import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import {
  listUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  changePassword,
  deleteUsuario,
} from './usuarios.controller.js'

const ITEM = 'CONFIG_USUARIOS'

export async function usuariosRoutes(app: FastifyInstance) {
  app.get('/usuarios', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, listUsuarios)
  app.get('/usuarios/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, getUsuarioById)
  app.post('/usuarios', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, createUsuario)
  app.patch('/usuarios/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, updateUsuario)
  app.post('/usuarios/:id/password', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, changePassword)
  app.delete('/usuarios/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, deleteUsuario)
}
