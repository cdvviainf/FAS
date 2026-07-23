import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const itemsMenu = [
  // Dashboard
  { codigo: 'DASHBOARD', nombre: 'Dashboard', seccion: 'Dashboard', ruta: '/dashboard', esAccion: false, orden: 1 },
  // Configuración
  { codigo: 'CONFIG_MANTENEDORES', nombre: 'Mantenedores Generales', seccion: 'Configuración', ruta: '/dashboard/configuracion', esAccion: false, orden: 10 },
  { codigo: 'CONFIG_USUARIOS', nombre: 'Usuarios', seccion: 'Configuración', ruta: '/dashboard/configuracion/usuarios', esAccion: false, orden: 11 },
  { codigo: 'CONFIG_PERFILES', nombre: 'Perfiles', seccion: 'Configuración', ruta: '/dashboard/configuracion/perfiles', esAccion: false, orden: 12 },
  { codigo: 'CONFIG_ENTIDADES', nombre: 'Entidades', seccion: 'Configuración', ruta: '/dashboard/configuracion/entidades', esAccion: false, orden: 9 },
  { codigo: 'CONFIG_GENERAL', nombre: 'Configuración General', seccion: 'Configuración', ruta: '/dashboard/configuracion/general', esAccion: false, orden: 13 },
  // Compras
  { codigo: 'COMPRAS_OC', nombre: 'Órdenes de Compra', seccion: 'Compras', ruta: '/dashboard/compras/ordenes', esAccion: false, orden: 20 },
  { codigo: 'OC_APROBACION', nombre: 'Aprobación de OC', seccion: 'Compras', ruta: null, esAccion: true, orden: 21 },
  // Productores
  { codigo: 'PROD_FICHA', nombre: 'Productores', seccion: 'Productores', ruta: '/dashboard/configuracion/productores', esAccion: false, orden: 30 },
  { codigo: 'PROD_CONTRATO', nombre: 'Contrato', seccion: 'Productores', ruta: '/dashboard/productores/contrato', esAccion: false, orden: 31 },
  { codigo: 'PROD_CTA_CTE', nombre: 'Cuenta Corriente', seccion: 'Productores', ruta: '/dashboard/productores/cuenta-corriente', esAccion: false, orden: 32 },
  { codigo: 'PROD_CONCEPTOS_LIQ', nombre: 'Conceptos de Liquidación', seccion: 'Productores', ruta: '/dashboard/configuracion/conceptos-liquidacion', esAccion: false, orden: 33 },
  // Ventas
  { codigo: 'VENTAS_NV', nombre: 'Cierre Comercial', seccion: 'Ventas', ruta: '/dashboard/ventas/notas', esAccion: false, orden: 40 },
  { codigo: 'VENTAS_COBRANZA', nombre: 'Cobranza / CRM', seccion: 'Ventas', ruta: '/dashboard/ventas/cobranza', esAccion: false, orden: 41 },
  // Operaciones
  { codigo: 'OPER_MATERIALES', nombre: 'Materiales', seccion: 'Operaciones', ruta: '/dashboard/configuracion/articulos', esAccion: false, orden: 50 },
  { codigo: 'OPER_STOCK', nombre: 'Stock Fruta', seccion: 'Operaciones', ruta: '/dashboard/operaciones/stock', esAccion: false, orden: 51 },
  // Finanzas
  { codigo: 'FIN_COSTOS', nombre: 'Gestión de Costos', seccion: 'Finanzas', ruta: '/dashboard/finanzas/costos', esAccion: false, orden: 60 },
  { codigo: 'FIN_PAGOS', nombre: 'Gestión de Pagos', seccion: 'Finanzas', ruta: '/dashboard/finanzas/pagos', esAccion: false, orden: 61 },
  { codigo: 'FIN_FACTURACION', nombre: 'Facturación', seccion: 'Finanzas', ruta: '/dashboard/finanzas/facturacion', esAccion: false, orden: 62 },
  // Calidad
  { codigo: 'CAL_SOLICITUDES', nombre: 'Solicitudes de Inspección', seccion: 'Calidad', ruta: '/dashboard/calidad/solicitudes', esAccion: false, orden: 69 },
  { codigo: 'CAL_CONTROL', nombre: 'Control de Calidad', seccion: 'Calidad', ruta: '/dashboard/calidad/control', esAccion: false, orden: 70 },
  { codigo: 'CAL_LOTES', nombre: 'Validación de Lotes', seccion: 'Calidad', ruta: '/dashboard/calidad/lotes', esAccion: false, orden: 71 },
  { codigo: 'CAL_RECLAMOS', nombre: 'Reclamos', seccion: 'Calidad', ruta: '/dashboard/calidad/reclamos', esAccion: false, orden: 72 },
  { codigo: 'RECLAMO_VALORIZACION', nombre: 'Valorización Reclamo', seccion: 'Calidad', ruta: null, esAccion: true, orden: 73 },
  { codigo: 'RECLAMO_CIERRE', nombre: 'Cierre/Reapertura Reclamo', seccion: 'Calidad', ruta: null, esAccion: true, orden: 74 },
  // Liquidaciones
  { codigo: 'LIQ_CLIENTES', nombre: 'Liquidación Clientes', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/clientes', esAccion: false, orden: 80 },
  { codigo: 'LIQ_COSTOS', nombre: 'Matriz de Costos', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/costos', esAccion: false, orden: 81 },
  { codigo: 'LIQ_PRECIOS', nombre: 'Determinación de Precios', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/precios', esAccion: false, orden: 82 },
  { codigo: 'LIQ_PRODUCTOR', nombre: 'Liquidación Productor', seccion: 'Liquidaciones', ruta: '/dashboard/liquidaciones/productor', esAccion: false, orden: 83 },
]

async function main() {
  console.log('Seeding ItemMenu...')

  for (const item of itemsMenu) {
    await prisma.itemMenu.upsert({
      where: { codigo: item.codigo },
      create: item,
      update: {
        nombre: item.nombre,
        seccion: item.seccion,
        ruta: item.ruta,
        esAccion: item.esAccion,
        orden: item.orden,
      },
    })
  }

  console.log(`ItemMenu: ${itemsMenu.length} ítems creados/actualizados.`)

  // Sincronizar accesos TOTAL para el perfil ADMIN a todos los ítems de menú.
  // Garantiza que cualquier ítem nuevo agregado al seed quede accesible para ADMIN.
  const adminPerfil = await prisma.perfil.findFirst({ where: { codigo: 'ADMIN', eliminadoEn: null } })
  if (adminPerfil) {
    const allItems = await prisma.itemMenu.findMany()
    for (const item of allItems) {
      await prisma.perfilAcceso.upsert({
        where: { perfilId_itemMenuId: { perfilId: adminPerfil.id, itemMenuId: item.id } },
        create: { perfilId: adminPerfil.id, itemMenuId: item.id, nivel: 'TOTAL' },
        update: { nivel: 'TOTAL' },
      })
    }
    console.log(`PerfilAcceso ADMIN: ${allItems.length} accesos TOTAL sincronizados.`)
  }

  console.log('Seed completado.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
