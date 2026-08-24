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
  { codigo: 'CONFIG_EMPRESAS', nombre: 'Empresas', seccion: 'Configuración', ruta: '/dashboard/configuracion/empresas', esAccion: false, orden: 8 },
  { codigo: 'CONFIG_GENERAL', nombre: 'Configuración General', seccion: 'Configuración', ruta: '/dashboard/configuracion/general', esAccion: false, orden: 13 },
  // Compras
  // Gestión completa (ingresar/editar/notificar/cerrar) de la Solicitud de
  // Inspección — antes vivía únicamente bajo CAL_SOLICITUDES; Calidad ahora
  // solo ve y cierra (2026-08-10, ver Docs/Hallazgos/solicitud-inspeccion.md).
  { codigo: 'COMPRAS_SOLICITUDES', nombre: 'Solicitud de Inspección', seccion: 'Compras', ruta: '/dashboard/compras/solicitudes', esAccion: false, orden: 18 },
  { codigo: 'COMPRAS_INSTRUCTIVO', nombre: 'Instructivo de Embalaje', seccion: 'Compras', ruta: '/dashboard/compras/instructivo-embalaje', esAccion: false, orden: 19 },
  { codigo: 'COMPRAS_OC', nombre: 'Órdenes de Compra', seccion: 'Compras', ruta: '/dashboard/compras/ordenes', esAccion: false, orden: 20 },
  { codigo: 'OC_APROBACION', nombre: 'Aprobación de OC', seccion: 'Compras', ruta: null, esAccion: true, orden: 21 },
  { codigo: 'COMPRAS_RECEPCION', nombre: 'Recepción de Stock', seccion: 'Compras', ruta: '/dashboard/compras/recepciones', esAccion: false, orden: 22 },
  // Productores
  { codigo: 'PROD_FICHA', nombre: 'Productores', seccion: 'Productores', ruta: '/dashboard/configuracion/productores', esAccion: false, orden: 30 },
  { codigo: 'PROD_CONTRATO', nombre: 'Contrato', seccion: 'Productores', ruta: '/dashboard/productores/contrato', esAccion: false, orden: 31 },
  { codigo: 'PROD_CTA_CTE', nombre: 'Cuenta Corriente', seccion: 'Productores', ruta: '/dashboard/productores/cuenta-corriente', esAccion: false, orden: 32 },
  { codigo: 'PROD_CONCEPTOS_LIQ', nombre: 'Conceptos de Liquidación', seccion: 'Productores', ruta: '/dashboard/configuracion/conceptos-liquidacion', esAccion: false, orden: 33 },
  // Ventas
  { codigo: 'VENTAS_NV', nombre: 'Cierre Comercial', seccion: 'Ventas', ruta: '/dashboard/ventas/cierre', esAccion: false, orden: 40 },
  { codigo: 'VENTAS_EMBARQUES', nombre: 'Embarques', seccion: 'Ventas', ruta: '/dashboard/ventas/embarques', esAccion: false, orden: 41 },
  { codigo: 'VENTAS_COBRANZA', nombre: 'Cobranza / CRM', seccion: 'Ventas', ruta: '/dashboard/ventas/cobranza', esAccion: false, orden: 42 },
  // Operaciones
  { codigo: 'OPER_MATERIALES', nombre: 'Materiales', seccion: 'Operaciones', ruta: '/dashboard/configuracion/articulos', esAccion: false, orden: 50 },
  // Finanzas
  { codigo: 'FIN_COSTOS', nombre: 'Gestión de Costos', seccion: 'Finanzas', ruta: '/dashboard/finanzas/costos', esAccion: false, orden: 60 },
  { codigo: 'FIN_PAGOS', nombre: 'Gestión de Pagos', seccion: 'Finanzas', ruta: '/dashboard/finanzas/pagos', esAccion: false, orden: 61 },
  { codigo: 'FIN_FACTURACION', nombre: 'Facturación', seccion: 'Finanzas', ruta: '/dashboard/finanzas/facturacion', esAccion: false, orden: 62 },
  // Calidad
  // ruta = prefijo común '/dashboard/calidad' (no solo '/solicitudes'): cubre
  // también /inspeccion-compra e /inspeccion-proceso, que comparten el mismo
  // permiso (decisión de negocio, Christian, 2026-07-30) — son la misma
  // Solicitud de Inspección, solo filtrada por tipoInspeccion.
  // Supersesión (2026-08-10): Calidad pasa a rol de revisor — solo ver y
  // cerrar (Aprobada/Rechazada/Objetada). Ingresar/editar/notificar/eliminar
  // se trasladan a COMPRAS_SOLICITUDES (arriba).
  { codigo: 'CAL_SOLICITUDES', nombre: 'Solicitudes de Inspección', seccion: 'Calidad', ruta: '/dashboard/calidad', esAccion: false, orden: 69 },
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
  // Reportes (nuevo, 2026-08-24) — reemplaza a OPER_STOCK (ver limpieza más
  // abajo, antes del upsert): mismo reporte, reubicado de Operaciones a su
  // propia sección "Reportes".
  { codigo: 'REPORTES_STOCK_FRUTA', nombre: 'Stock de Fruta', seccion: 'Reportes', ruta: '/dashboard/reportes/stock-fruta', esAccion: false, orden: 90 },
]

const SISTEMA_USER = 'system'

// Empresas (multi-empresa). Agrosan es la empresa base a la que se hace
// backfill de todos los datos existentes en la fase de tenancy; AGDry se crea
// solo con el nombre (razón social) y el resto de sus datos se completa desde
// la UI (decisión de negocio, Christian, 2026-07-31).
const EMPRESAS = [
  { codigo: 'AGROSAN', razonSocial: 'Frutera Agrosan SpA' },
  { codigo: 'AGDRY', razonSocial: 'AGDry' },
]

// Código fijo de la Entidad placeholder "Cliente Sin Definir" (Cierre
// Comercial). Debe coincidir con CLIENTE_SIN_DEFINIR_CODIGO en
// fas-web/src/features/ventas/notas-venta/constants.ts.
const CLIENTE_SIN_DEFINIR_CODIGO = 'CLIENTE-SD'

// TipoParametro/Parametro para Cierre Comercial (Ventas). El catálogo
// genérico Parametro no tiene `codigo` único a nivel de BD, por lo que el
// upsert se hace manualmente (findFirst + create/update) en vez de
// `prisma.<modelo>.upsert`.
const tiposParametroVentas = [
  {
    codigo: 'TIPO_FLETE',
    descripcion: 'Tipo de Flete',
    valores: [
      { codigo: 'COLLECT', descripcion: 'Collect' },
      { codigo: 'PREPAID', descripcion: 'Prepaid' },
    ],
  },
  {
    codigo: 'MODALIDAD_VENTA',
    descripcion: 'Modalidad de Venta',
    valores: [
      { codigo: 'FIRME', descripcion: 'Firme' },
      { codigo: 'CONSIGNACION', descripcion: 'Consignación' },
    ],
  },
  {
    codigo: 'INCOTERM',
    descripcion: 'Incoterm / Cláusula de Venta',
    valores: [
      { codigo: 'FOB', descripcion: 'FOB' },
      { codigo: 'CFR', descripcion: 'CFR' },
      { codigo: 'CIF', descripcion: 'CIF' },
      { codigo: 'EXW', descripcion: 'EXW' },
    ],
  },
]

async function main() {
  console.log('Seeding Empresas...')
  for (const emp of EMPRESAS) {
    const existente = await prisma.empresa.findFirst({ where: { codigo: emp.codigo } })
    if (!existente) {
      await prisma.empresa.create({ data: { ...emp, creadoPor: SISTEMA_USER } })
    }
  }
  console.log(`Empresas: ${EMPRESAS.length} verificadas.`)

  // Backfill (Fase 1 multi-empresa): usuarios existentes sin ninguna empresa
  // asignada quedan como miembros de AGROSAN, con AGROSAN como predeterminada.
  // Idempotente — solo toca usuarios sin membresías, así que reintentar el
  // seed no duplica ni pisa asignaciones manuales posteriores.
  const agrosan = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (agrosan) {
    const usuariosSinEmpresa = await prisma.usuario.findMany({
      where: { eliminadoEn: null, empresas: { none: {} } },
      select: { id: true },
    })
    for (const u of usuariosSinEmpresa) {
      await prisma.usuarioEmpresa.create({
        data: { usuarioId: u.id, empresaId: agrosan.id, creadoPor: SISTEMA_USER },
      })
    }
    // Solo usuarios que SON miembros de AGROSAN (recién creados arriba, o ya
    // asignados manualmente antes) — nunca pisar la predeterminada de un
    // usuario cuya única membresía sea otra empresa (ej. solo AGDRY).
    await prisma.usuario.updateMany({
      where: { eliminadoEn: null, empresaPredeterminadaId: null, empresas: { some: { empresaId: agrosan.id } } },
      data: { empresaPredeterminadaId: agrosan.id },
    })
    console.log(`Usuarios backfill a AGROSAN: ${usuariosSinEmpresa.length} membresías nuevas.`)
  }

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

  // Migración de ítem renombrado (2026-08-24): OPER_STOCK -> REPORTES_STOCK_FRUTA
  // (mismo reporte, reubicado de Operaciones a Reportes). El upsert por
  // `codigo` de arriba no toca códigos que ya no están en `itemsMenu`, así que
  // acá se migra cualquier PerfilAcceso existente hacia el ítem nuevo (mismo
  // nivel) antes de borrar el ítem viejo — sin esto, un perfil no-ADMIN que ya
  // tuviera acceso a OPER_STOCK lo perdería silenciosamente (QAS-STK-001).
  const operStockObsoleto = await prisma.itemMenu.findUnique({ where: { codigo: 'OPER_STOCK' } })
  if (operStockObsoleto) {
    const itemNuevo = await prisma.itemMenu.findUniqueOrThrow({ where: { codigo: 'REPORTES_STOCK_FRUTA' } })
    const accesosExistentes = await prisma.perfilAcceso.findMany({ where: { itemMenuId: operStockObsoleto.id } })
    for (const acceso of accesosExistentes) {
      await prisma.perfilAcceso.upsert({
        where: { perfilId_itemMenuId: { perfilId: acceso.perfilId, itemMenuId: itemNuevo.id } },
        create: { perfilId: acceso.perfilId, itemMenuId: itemNuevo.id, nivel: acceso.nivel },
        update: { nivel: acceso.nivel },
      })
    }
    await prisma.perfilAcceso.deleteMany({ where: { itemMenuId: operStockObsoleto.id } })
    await prisma.itemMenu.delete({ where: { id: operStockObsoleto.id } })
    console.log(`OPER_STOCK migrado a REPORTES_STOCK_FRUTA: ${accesosExistentes.length} acceso(s) trasladados.`)
  }

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

  console.log('Seeding TipoParametro/Parametro (Ventas — Cierre Comercial)...')

  // TipoParametro/Parametro son tablas por-empresa desde multi-empresa (Fase 3):
  // este seed los crea en la empresa base AGROSAN.
  const agrosanParaParametros = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (!agrosanParaParametros) throw new Error('No se encontró la empresa base AGROSAN para sembrar parámetros.')

  let parametrosCreados = 0
  for (const tipo of tiposParametroVentas) {
    let tipoParametro = await prisma.tipoParametro.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: tipo.codigo, eliminadoEn: null },
    })
    if (!tipoParametro) {
      tipoParametro = await prisma.tipoParametro.create({
        data: {
          empresaId: agrosanParaParametros.id,
          codigo: tipo.codigo,
          descripcion: tipo.descripcion,
          creadoPor: SISTEMA_USER,
        },
      })
    }

    for (const valor of tipo.valores) {
      const existente = await prisma.parametro.findFirst({
        where: { empresaId: agrosanParaParametros.id, codigo: valor.codigo, tipoParametroId: tipoParametro.id, eliminadoEn: null },
      })
      if (!existente) {
        await prisma.parametro.create({
          data: {
            empresaId: agrosanParaParametros.id,
            codigo: valor.codigo,
            descripcion: valor.descripcion,
            tipoParametroId: tipoParametro.id,
            creadoPor: SISTEMA_USER,
          },
        })
        parametrosCreados++
      }
    }
  }
  console.log(`TipoParametro: ${tiposParametroVentas.length} tipos verificados. Parametro: ${parametrosCreados} valores nuevos creados.`)

  console.log('Seeding UnidadMedida (Caja/Kilo para cuota unitaria de Condición de Pago)...')
  const unidadesBase = [
    { codigo: 'CAJA', descripcion: 'Caja' },
    { codigo: 'KG', descripcion: 'Kilogramo' },
  ]
  let unidadesCreadas = 0
  for (const u of unidadesBase) {
    const existente = await prisma.unidadMedida.findFirst({
      where: { empresaId: agrosanParaParametros.id, codigo: u.codigo, eliminadoEn: null },
    })
    if (!existente) {
      await prisma.unidadMedida.create({ data: { ...u, empresaId: agrosanParaParametros.id, creadoPor: SISTEMA_USER } })
      unidadesCreadas++
    }
  }
  console.log(`UnidadMedida: ${unidadesCreadas} unidades nuevas creadas.`)

  // Entidad placeholder para Cierre Comercial sin cliente definido todavía
  // (decisión de negocio, Christian, 2026-07-30) — preseleccionada al crear
  // un Cierre Comercial nuevo, editable en cualquier momento después.
  // Entidad es por-empresa desde Fase 3 (lote Entidades) — este seed corre
  // fuera de cualquier request (sin contexto ALS), así que se acota
  // explícitamente a AGROSAN, mismo patrón que el backfill de arriba.
  console.log('Seeding Entidad placeholder "Cliente Sin Definir"...')
  const agrosanParaPlaceholder = await prisma.empresa.findFirst({ where: { codigo: 'AGROSAN' } })
  if (!agrosanParaPlaceholder) {
    console.warn('  Omitido: no se encontró la empresa "AGROSAN".')
  } else {
    const clientePlaceholderExistente = await prisma.entidad.findFirst({
      where: { empresaId: agrosanParaPlaceholder.id, codigo: CLIENTE_SIN_DEFINIR_CODIGO },
    })
    if (!clientePlaceholderExistente) {
      const chile = await prisma.pais.findFirst({ where: { codigo: 'CHL', eliminadoEn: null } })
      if (!chile) {
        console.warn('  Omitido: no se encontró el país "CHL" (correr seed de geografía primero).')
      } else {
        await prisma.entidad.create({
          data: {
            empresaId: agrosanParaPlaceholder.id,
            codigo: CLIENTE_SIN_DEFINIR_CODIGO,
            descripcion: 'Cliente Sin Definir',
            razonSocial: 'Cliente Sin Definir',
            paisId: chile.id,
            tipos: ['CLIENTE_NACIONAL'],
            creadoPor: SISTEMA_USER,
          },
        })
        console.log('  Entidad placeholder creada.')
      }
    }
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
