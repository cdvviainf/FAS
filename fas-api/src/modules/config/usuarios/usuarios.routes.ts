import type { FastifyInstance } from 'fastify'
import {
  listUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  changePassword,
  deleteUsuario,
} from './usuarios.controller.js'

export async function usuariosRoutes(app: FastifyInstance) {
  app.get('/usuarios', listUsuarios)
  app.get('/usuarios/:id', getUsuarioById)
  app.post('/usuarios', createUsuario)
  app.patch('/usuarios/:id', updateUsuario)
  app.post('/usuarios/:id/password', changePassword)
  app.delete('/usuarios/:id', deleteUsuario)
}
