import type { FastifyInstance } from 'fastify'
import { requireAuth, requireLevel } from '../../../plugins/auth-guard.js'
import {
  listEmpresas,
  getEmpresaById,
  createEmpresa,
  updateEmpresa,
  deleteEmpresa,
  createDireccion,
  updateDireccion,
  deleteDireccion,
  createContacto,
  updateContacto,
  deleteContacto,
  subirLogo,
  descargarLogo,
  eliminarLogo,
} from './empresas.controller.js'

const ITEM = 'CONFIG_EMPRESAS'

export async function empresasRoutes(app: FastifyInstance) {
  // ── Empresas ───────────────────────────────────────────────────────────────
  app.get(
    '/empresas',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    listEmpresas,
  )
  app.get(
    '/empresas/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    getEmpresaById,
  )
  app.post(
    '/empresas',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createEmpresa,
  )
  app.patch(
    '/empresas/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateEmpresa,
  )
  app.delete(
    '/empresas/:id',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteEmpresa,
  )

  // ── Direcciones ────────────────────────────────────────────────────────────
  app.post(
    '/empresas/:id/direcciones',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createDireccion,
  )
  app.patch(
    '/empresas/:id/direcciones/:dirId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateDireccion,
  )
  app.delete(
    '/empresas/:id/direcciones/:dirId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteDireccion,
  )

  // ── Contactos ──────────────────────────────────────────────────────────────
  app.post(
    '/empresas/:id/contactos',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    createContacto,
  )
  app.patch(
    '/empresas/:id/contactos/:conId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    updateContacto,
  )
  app.delete(
    '/empresas/:id/contactos/:conId',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    deleteContacto,
  )

  // ── Logo ───────────────────────────────────────────────────────────────────
  app.get(
    '/empresas/:id/logo',
    { preHandler: [requireAuth, requireLevel(ITEM, 'LECTURA')] },
    descargarLogo,
  )
  app.post(
    '/empresas/:id/logo',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    subirLogo,
  )
  app.delete(
    '/empresas/:id/logo',
    { preHandler: [requireAuth, requireLevel(ITEM, 'TOTAL')] },
    eliminarLogo,
  )
}
