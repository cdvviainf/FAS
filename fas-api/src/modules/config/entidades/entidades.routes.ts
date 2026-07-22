import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import {
  listEntidades,
  getEntidadById,
  createEntidad,
  updateEntidad,
  deleteEntidad,
  createDireccion,
  updateDireccion,
  deleteDireccion,
  createContacto,
  updateContacto,
  deleteContacto,
} from './entidades.controller.js'

const ITEM = 'CONFIG_ENTIDADES'

export async function entidadesRoutes(app: FastifyInstance) {
  // ── Entidades ──────────────────────────────────────────────────────────────
  app.get(
    '/entidades',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    listEntidades,
  )
  app.get(
    '/entidades/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    getEntidadById,
  )
  app.post(
    '/entidades',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createEntidad,
  )
  app.patch(
    '/entidades/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateEntidad,
  )
  app.delete(
    '/entidades/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteEntidad,
  )

  // ── Direcciones ────────────────────────────────────────────────────────────
  app.post(
    '/entidades/:id/direcciones',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createDireccion,
  )
  app.patch(
    '/entidades/:id/direcciones/:dirId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateDireccion,
  )
  app.delete(
    '/entidades/:id/direcciones/:dirId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteDireccion,
  )

  // ── Contactos ──────────────────────────────────────────────────────────────
  app.post(
    '/entidades/:id/contactos',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createContacto,
  )
  app.patch(
    '/entidades/:id/contactos/:conId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateContacto,
  )
  app.delete(
    '/entidades/:id/contactos/:conId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteContacto,
  )
}
