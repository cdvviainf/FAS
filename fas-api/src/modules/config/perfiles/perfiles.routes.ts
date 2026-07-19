import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import {
  listPerfiles,
  getPerfilById,
  createPerfil,
  updatePerfil,
  deletePerfil,
  listItemsMenu,
} from './perfiles.controller.js'

const ITEM = 'CONFIG_PERFILES'

export async function perfilesRoutes(app: FastifyInstance) {
  app.get('/items-menu', { preHandler: [requireAuth] }, listItemsMenu)

  app.get('/perfiles', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, listPerfiles)
  app.get('/perfiles/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] }, getPerfilById)
  app.post('/perfiles', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, createPerfil)
  app.patch('/perfiles/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, updatePerfil)
  app.delete('/perfiles/:id', { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] }, deletePerfil)
}
