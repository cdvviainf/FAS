import { prisma } from '../../lib/prisma.js'
import { getEmpresaIdActual } from '../../lib/empresa-context.js'
import { LOCK_NAMESPACE_DOCUMENTOS_EMISION } from '../../shared/advisory-locks.js'

// ─── Lookups auxiliares para resolvers ────────────────────────────────────
// Los resolvers de cada documento (resolvers/*.ts) reusan el repository del
// módulo dueño de los datos (ej. ordenes-compra.repository.ts) para lo que
// ya expone. Estos dos helpers cubren campos que SOLO el PDF necesita
// (RUT, dirección/contacto por defecto) y que agregar al select de otro
// módulo inflaría su respuesta HTTP normal sin necesidad.

export async function getEmpresaParaDocumento(id: number) {
  return prisma.empresa.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      // codigo: agregado (2026-08-20) — la OC lo usa para decidir si aplica
      // el disclaimer legal de facturación de Agrosan (orden-compra/v1),
      // que todavía no está definido para otras empresas del tenant (AGDry).
      codigo: true,
      razonSocial: true,
      rut: true,
      // telefono: lo usa el bloque "Exportador" del PDF de Proforma/Factura de
      // Exportación (2026-10-30) — dato de contacto para el cliente extranjero.
      telefono: true,
      direcciones: {
        where: { eliminadoEn: null },
        select: { direccion: true },
        orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
        take: 1,
      },
      logo: { select: { mime: true, datos: true } },
    },
  })
}

// Data URI listo para <img src> — Encabezado.tsx no formatea, solo pinta lo
// que le llega (Etapa 4 §5: "prohibido formatear a mano dentro de una
// plantilla"). null si la empresa no tiene logo subido (mantenedor de
// Empresas, pestaña Logo).
export function logoDataUri(logo: { mime: string; datos: Buffer } | null | undefined): string | null {
  if (!logo) return null
  return `data:${logo.mime};base64,${logo.datos.toString('base64')}`
}

// Imagen de la especie para el banner del encabezado (mitad derecha) — data URI
// listo para <img src>. null si la especie no tiene imagen cargada. El resolver
// pasa la "primera especie por ID" del documento (menor id del maestro).
export async function getEspecieImagenDataUri(especieId: number | null | undefined): Promise<string | null> {
  if (especieId == null) return null
  const img = await prisma.especieImagen.findUnique({ where: { especieId }, select: { mime: true, datos: true } })
  return img ? `data:${img.mime};base64,${Buffer.from(img.datos).toString('base64')}` : null
}

export async function getEntidadParaDocumento(id: number) {
  return prisma.entidad.findFirst({
    where: { id, eliminadoEn: null },
    select: {
      razonSocial: true,
      identificador: true,
      taxId: true,
      // telefono de la entidad + datos del contacto (nombre/teléfono): usados
      // por la AGA en el Instructivo para Notify/Consignatario (2026-10-12).
      telefono: true,
      direcciones: {
        where: { eliminadoEn: null },
        select: { direccion: true },
        orderBy: [{ esPorDefecto: 'desc' }, { codigo: 'asc' }],
        take: 1,
      },
      contactos: {
        where: { eliminadoEn: null },
        select: { nombre: true, telefono: true },
        orderBy: [{ esRepresentanteLegal: 'desc' }, { codigo: 'asc' }],
        take: 1,
      },
    },
  })
}

// Datos ricos del Embarque + Nota de Venta para los PDF de exportación
// (Proforma / Factura de Exportación, 2026-10-30) — transporte, puertos,
// notify/consignatario, incoterm/flete/modalidad. Mismo criterio de resolución
// manual-vs-AGL360 que getEmbarqueParaFacturaDte (cobranza), pero orientado a
// lo que el PDF muestra (descripciones legibles), no al XML del SII. Se queda
// en este repo (no en el de cobranza) porque añade relaciones — notify,
// consignatario, tipoFlete, tipoBl — que solo el documento necesita.
export async function getEmbarqueParaDocumentoExport(embarqueId: number) {
  const direccionPorDefecto = {
    where: { eliminadoEn: null },
    select: { direccion: true },
    orderBy: [{ esPorDefecto: 'desc' as const }, { codigo: 'asc' as const }],
    take: 1,
  }
  const entidadNotify = {
    select: {
      razonSocial: true,
      identificador: true,
      taxId: true,
      direcciones: direccionPorDefecto,
    },
  }
  return prisma.embarque.findFirst({
    where: { id: embarqueId, eliminadoEn: null },
    select: {
      id: true,
      numeroInstructivo: true,
      reservaManual: true,
      fechaZarpeManual: true,
      fechaArribo: true,
      naveManual: true,
      numeroBookingManual: true,
      numeroContenedorManual: true,
      numeroSelloManual: true,
      awbBl: true,
      naviera: { select: { razonSocial: true } },
      solicitudReserva: {
        select: { fechaZarpe: true, nave: true, numeroBooking: true, numeroContenedor: true, numeroSello: true },
      },
      puertoZarpe: { select: { descripcion: true } },
      notaVenta: {
        select: {
          tipoEmbarque: { select: { descripcion: true } },
          puertoDestino: { select: { descripcion: true } },
          modalidadVenta: { select: { descripcion: true } },
          clausulaVenta: { select: { descripcion: true } },
          tipoFlete: { select: { descripcion: true } },
          tipoBl: { select: { descripcion: true } },
          notify: entidadNotify,
          consignatario: entidadNotify,
        },
      },
    },
  })
}

// Pesos del embarque desde los pallets físicos (cada PalletLinea trae su
// embalaje con kgNeto/BrutoEnvase) — mismo origen que el DTE 110
// (getLineasPalletParaPeso en cobranza). El helper de formateo suma.
export async function getPesosEmbarque(embarqueId: number) {
  return prisma.palletLinea.findMany({
    where: { pallet: { embarqueId } },
    select: { cajas: true, articulo: { select: { kgNetoEnvase: true, kgBrutoEnvase: true } } },
  })
}

// ─── documentos_emitidos ───────────────────────────────────────────────────

interface DatosDocumentoEmitido {
  tipo: string
  documentoId: number
  plantillaVersion: string
  folio: string
  payload: unknown
  pdf: Buffer
  hashSha256: string
  creadoPor: string
}

// Búsqueda exacta por la clave de idempotencia completa — no "la última
// emisión" (DOC-QA-003, ronda 2: si el payload cambia y vuelve a un estado
// ya emitido antes, la comparación contra solo la última fila no lo
// detectaba). Usado como fast-path optimista antes de renderizar — si ya
// existe, ni siquiera hace falta abrir Chromium.
export async function getDocumentoEmitidoPorHash(
  tipo: string,
  documentoId: number,
  plantillaVersion: string,
  hashSha256: string,
) {
  return prisma.documentoEmitido.findFirst({ where: { tipo, documentoId, plantillaVersion, hashSha256 } })
}

// Mecanismo primario de idempotencia (DOC-QA-003, ronda 2): mismo patrón que
// el resto del código base para "check optimista afuera + relectura bajo
// lock antes de escribir" (recepciones.repository.ts, ordenes-compra.repository.ts)
// en vez de un upsert con clave compuesta — evita depender de cómo la
// extensión de tenancy reescribe un `where` de clave compuesta en `upsert`.
// El namespace es compartido entre todos los tipos de documento; la clave
// combina tipo+documentoId con `hashtext()` para no colisionar entre tipos
// distintos que reusen el mismo id numérico.
export async function crearDocumentoEmitidoIdempotente(data: DatosDocumentoEmitido) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${LOCK_NAMESPACE_DOCUMENTOS_EMISION}::int, hashtext(${`${data.tipo}:${data.documentoId}`}))`

    const existente = await tx.documentoEmitido.findFirst({
      where: {
        tipo: data.tipo,
        documentoId: data.documentoId,
        plantillaVersion: data.plantillaVersion,
        hashSha256: data.hashSha256,
      },
    })
    if (existente) return existente

    return tx.documentoEmitido.create({
      data: {
        empresaId: getEmpresaIdActual()!,
        tipo: data.tipo,
        documentoId: data.documentoId,
        plantillaVersion: data.plantillaVersion,
        folio: data.folio,
        payload: data.payload as never, // JSON de Prisma — el shape real lo valida el schema Zod del registro antes de llegar acá
        pdf: data.pdf,
        hashSha256: data.hashSha256,
        creadoPor: data.creadoPor,
      },
    })
  })
}

export async function getDocumentoEmitidoById(id: number) {
  return prisma.documentoEmitido.findFirst({ where: { id } })
}

// Lookup liviano para el guard de permisos de reimpresión (documentos.routes.ts,
// DOC-QA-001) — solo el tipo, sin traer payload/pdf, para resolver el
// itemMenu del registro antes de decidir si se entrega el PDF completo.
export async function getTipoDeDocumentoEmitido(id: number) {
  return prisma.documentoEmitido.findFirst({ where: { id }, select: { tipo: true } })
}
