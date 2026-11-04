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
  MIXTO: 'Mixto', // rollup del cierre por línea (2026-11-03)
  CERRADA: 'Cerrada', // valor legado del enum, ver schema.prisma
}
const FUNCION_LABELS: Record<string, string> = {
  ACUDIR: 'Acudir',
  NOTIFICAR: 'Notificar',
}
const TIPO_INSPECCION_LABELS: Record<string, string> = {
  PRODUCTO_TERMINADO: 'Producto Terminado',
  PROCESO: 'Proceso',
}
const ESTADOS_CON_CIERRE = new Set(['APROBADA', 'RECHAZADA', 'OBJETADA', 'MIXTO'])

// Formatea un defecto/característica a texto para el PDF (la plantilla no formatea).
function fmtDefecto(d: { grupoDefecto: { descripcion: string }; defecto: { descripcion: string; tipoMedida: string }; valor: unknown }): string {
  const sufijo = d.defecto.tipoMedida === 'PORCENTAJE' ? '%' : ' u.'
  return `${d.grupoDefecto.descripcion} · ${d.defecto.descripcion}: ${String(d.valor).replace('.', ',')}${sufijo}`
}
function fmtMadurez(m: { caracteristica: { descripcion: string; tipoDato: string; unidad: { codigo: string } | null }; valorNumerico: unknown; valorTexto: string | null }): string {
  if (m.valorTexto != null) return `${m.caracteristica.descripcion}: ${m.valorTexto}`
  const sufijo = m.caracteristica.tipoDato === 'PORCENTAJE' ? '%' : m.caracteristica.unidad ? ` ${m.caracteristica.unidad.codigo}` : ''
  return `${m.caracteristica.descripcion}: ${String(m.valorNumerico ?? '').replace('.', ',')}${sufijo}`
}

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
    fechaHoraVisita: solicitud.fechaHora?.toISOString() ?? null,
    tipoInspeccion: solicitud.tipoInspeccion ? TIPO_INSPECCION_LABELS[solicitud.tipoInspeccion] ?? solicitud.tipoInspeccion : null,
    productor: {
      razonSocial: productor?.razonSocial ?? solicitud.entidadProductor.razonSocial,
      rut: productor?.identificador ?? null,
      direccion: direccionVisita || (productor?.direcciones[0]?.direccion ?? null),
      contacto: solicitud.contacto?.nombre ?? productor?.contactos[0]?.nombre ?? null,
    },
    mercado: solicitud.mercado?.descripcion ?? null,
    cliente: solicitud.cliente?.descripcion ?? null,
    fechaDespacho: solicitud.fechaDespacho ? solicitud.fechaDespacho.toISOString() : null,
    paises: solicitud.paises.map((p) => p.pais.descripcion),
    // Detalle de producto por línea (2026-10-27). Descripción, no código
    // (feedback Christian, 2026-08-19).
    lineas: solicitud.lineas.map((l) => ({
      especie: l.especie.descripcion,
      embalaje: l.articulo.descripcion,
      variedad: l.variedad.descripcion,
      categorias: l.categorias.map((c) => c.categoria.descripcion),
      calibres: l.calibres.map((c) => c.calibre.descripcion),
      calidadesPermitidas: l.calidades.map((c) => `${c.notaCalidad.descripcion}/${c.notaCondicion.descripcion}`).join(', ') || null,
      cantidadPallets: l.cantidadPallets,
      // Resultado del cierre POR LÍNEA (2026-11-03): veredicto + defectos + madurez.
      estadoCierre: l.estadoCierre ? (ESTADO_LABELS[l.estadoCierre] ?? l.estadoCierre) : null,
      defectos: solicitud.defectos.filter((d) => d.solicitudLineaId === l.id).map(fmtDefecto),
      madurez: solicitud.madurez.filter((m) => m.solicitudLineaId === l.id).map(fmtMadurez),
    })),
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
          // Resultado general histórico: defectos/madurez de cierres previos a
          // nivel solicitud (solicitudLineaId NULL), que el detalle web muestra.
          historico: [
            ...solicitud.defectos.filter((d) => d.solicitudLineaId == null).map(fmtDefecto),
            ...solicitud.madurez.filter((m) => m.solicitudLineaId == null).map(fmtMadurez),
          ],
        }
      : null,
  }
}
