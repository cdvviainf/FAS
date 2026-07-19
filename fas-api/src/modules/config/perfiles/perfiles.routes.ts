import type { FastifyInstance } from 'fastify'
import {
  listPerfiles,
  getPerfilById,
  createPerfil,
  updatePerfil,
  deletePerfil,
  listItemsMenu,
} from './perfiles.controller.js'

export async function perfilesRoutes(app: FastifyInstance) {
  app.get('/items-menu', listItemsMenu)

  app.get('/perfiles', listPerfiles)
  app.get('/perfiles/:id', getPerfilById)
  app.post('/perfiles', createPerfil)
  app.patch('/perfiles/:id', updatePerfil)
  app.delete('/perfiles/:id', deletePerfil)
}
