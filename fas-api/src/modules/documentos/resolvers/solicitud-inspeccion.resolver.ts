import { NotFoundError } from '../../../shared/errors.js'
import { getSolicitudById } from '../../calidad/solicitudes/solicitudes.repository.js'
import { getEmpresaParaDocumento, getEntidadParaDocumento, logoDataUri } from '../documentos.repository.js'
import type { SolicitudInspeccionPdfPayload } from '../schemas/solicitud-inspeccion.schema.js'

// Labels — mismo texto que fas-web/src/features/solicitudes-inspeccion/types.ts
// (ESTADO_LABELS/FUNCION_LABELS/RESULTADO_CIERRE_LABELS).
// Duplicado a propósito: el frontend no es importable desde fas-api (repos
// separados, CLAUDE.md §2) y el payload debe viajar con el label ya resuelto
// (Etapa 4 §5: "prohibido formatear a mano dentro de una plantilla").
const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  NOTIFICADA: 'Notificada',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  OBJETADA: 'Objetada',
  CERRADA: 'Cerrada', // valor legado del enum, ver schema.prisma
}
const FUNCION_LABELS: Record<string, string> = {
  ACUDIR: 'Acudir',
  NOTIFICAR: 'Notificar',
}
const ESTADOS_CON_CIERRE = new Set(['APROBADA', 'RECHAZADA', 'OBJETADA'])

// Resolver de la Solicitud de Inspección — snapshot del pedido (quién,
// cuándo, dónde, alcance, asignados), no el informe de resultados por caja
// (ver nota en solicitud-inspeccion.schema.ts).
export async function resolverSolicitudInspeccion(id: number, empresaId: number): Promise<SolicitudInspeccionPdfPayload> {
  const solicitud = await getSolicitudById(id)
  if (!solicitud) throw new NotFoundError('Solicitud de Inspección', String(id))

  const [empresa, productor] = await Promise.all([
    getEmpresaParaDocumento(empresaId),
    getEntidadParaDocumento(solicitud.entidadProductorId),
  ])

  const direccionVisita = [
    solicitud.direccion.direccion,
    solicitud.direccion.comuna?.descripcion,
    solicitud.direccion.pais?.descripcion,
  ].filter(Boolean).join(', ')

  return {
    empresa: {
      razonSocial: empresa?.razonSocial ?? '—',
      rut: empresa?.rut ?? null,
      direccion: empresa?.direcciones[0]?.direccion ?? null,
      logoDataUri: logoDataUri(empresa?.logo),
    },
    codigo: solicitud.codigo,
    fecha: solicitud.creadoEn.toISOString(),
    estado: ESTADO_LABELS[solicitud.estado] ?? solicitud.estado,
    fechaHoraVisita: solicitud.fechaHora.toISOString(),
    productor: {
      razonSocial: productor?.razonSocial ?? solicitud.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: direccionVisita || (productor?.direcciones[0]?.direccion ?? null),
      contacto: solicitud.contacto?.nombre ?? productor?.contactos[0]?.nombre ?? null,
    },
    mercado: solicitud.mercado?.descripcion ?? null,
    cliente: solicitud.cliente?.descripcion ?? null,
    especie: solicitud.especie?.descripcion ?? null,
    fechaDespacho: solicitud.fechaDespacho ? solicitud.fechaDespacho.toISOString() : null,
    cantidadPallets: solicitud.cantidadPallets,
    calificacion: solicitud.calificacion?.descripcion ?? null,
    variedades: solicitud.variedades.map((v) => v.variedad.descripcion),
    // Descripción, no código (feedback Christian, 2026-08-19) — en las 3
    // plantillas del motor, no solo acá.
    calibres: solicitud.calibres.map((c) => c.calibre.descripcion),
    categorias: solicitud.categorias.map((c) => c.categoria.descripcion),
    articulos: solicitud.embalajes.map((e) => e.articulo.descripcion),
    paises: solicitud.paises.map((p) => p.pais.descripcion),
    asignados: solicitud.asignados.map((a) => ({
      nombre: a.usuario.nombre,
      funcion: FUNCION_LABELS[a.funcion] ?? a.funcion,
    })),
    observaciones: solicitud.observaciones,
    usuarioSolicitante: solicitud.usuarioSolicitante.nombre,
    cierre: ESTADOS_CON_CIERRE.has(solicitud.estado)
      ? {
          resultado: ESTADO_LABELS[solicitud.estado] ?? solicitud.estado,
          comentarios: solicitud.comentariosCierre,
          fecha: solicitud.fechaCierre ? solicitud.fechaCierre.toISOString() : null,
        }
      : null,
  }
}
