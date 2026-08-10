// Plantillas HTML de correos de Solicitudes de Inspección.
// Fechas formateadas en zona America/Santiago.

interface SolicitudParaCorreo {
  codigo: string
  fechaHora: Date
  observaciones?: string | null
  entidadProductor: { descripcion: string; razonSocial: string }
  direccion: {
    direccion: string
    latitud?: unknown
    longitud?: unknown
    comuna?: { descripcion: string } | null
  }
  contacto?: { nombre: string; telefono?: string | null; whatsapp?: string | null; email?: string | null } | null
  tipoInspeccion: 'COMPRA' | 'PROCESO'
  especie?: { descripcion: string } | null
  mercado?: { descripcion: string } | null
  cliente?: { razonSocial: string } | null
  fechaDespacho?: Date | null
  cantidadPallets?: number | null
  calificacion?: { descripcion: string } | null
  paises?: { pais: { descripcion: string } }[]
  variedades?: { variedad: { descripcion: string } }[]
  calibres?: { calibre: { descripcion: string } }[]
  categorias?: { categoria: { descripcion: string } }[]
  embalajes?: { articulo: { descripcion: string } }[]
  asignados: { funcion: string; usuario: { nombre: string; email: string } }[]
}

const TIPO_INSPECCION_LABELS: Record<'COMPRA' | 'PROCESO', string> = {
  COMPRA: 'Inspección de Compra',
  PROCESO: 'Inspección de Proceso',
}

const fmtFechaCorta = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeZone: 'America/Santiago' })

const fmtFecha = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
})

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fila(label: string, valor: string): string {
  return `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:4px 0">${valor}</td></tr>`
}

function cuerpoDetalle(s: SolicitudParaCorreo): string {
  const lugar = [s.direccion.direccion, s.direccion.comuna?.descripcion].filter(Boolean).join(', ')
  const mapa =
    s.direccion.latitud != null && s.direccion.longitud != null
      ? ` — <a href="https://www.google.com/maps?q=${s.direccion.latitud},${s.direccion.longitud}">Ver en mapa</a>`
      : ''
  const acuden = s.asignados.filter((a) => a.funcion === 'ACUDIR').map((a) => esc(a.usuario.nombre)).join(', ')

  let contactoStr = ''
  if (s.contacto) {
    const medios = [s.contacto.telefono, s.contacto.whatsapp, s.contacto.email].filter(Boolean).map((m) => esc(String(m))).join(' · ')
    contactoStr = `${esc(s.contacto.nombre)}${medios ? ` (${medios})` : ''}`
  }

  return `<table style="border-collapse:collapse;font-size:14px">
${fila('Solicitud', `<strong>${esc(s.codigo)}</strong>`)}
${fila('Productor', esc(s.entidadProductor.razonSocial))}
${fila('Lugar', `${esc(lugar)}${mapa}`)}
${contactoStr ? fila('Contacto en terreno', contactoStr) : ''}
${fila('Fecha y hora', fmtFecha.format(s.fechaHora))}
${fila('Tipo', TIPO_INSPECCION_LABELS[s.tipoInspeccion])}
${s.mercado ? fila('Mercado', esc(s.mercado.descripcion)) : ''}
${s.paises && s.paises.length > 0 ? fila('Países', s.paises.map((p) => esc(p.pais.descripcion)).join(', ')) : ''}
${s.cliente ? fila('Cliente', esc(s.cliente.razonSocial)) : ''}
${s.fechaDespacho ? fila('Fecha de despacho', fmtFechaCorta.format(s.fechaDespacho)) : ''}
${s.especie ? fila('Especie', esc(s.especie.descripcion)) : ''}
${s.embalajes && s.embalajes.length > 0 ? fila('Embalaje', s.embalajes.map((e) => esc(e.articulo.descripcion)).join(', ')) : ''}
${s.variedades && s.variedades.length > 0 ? fila('Variedades', s.variedades.map((v) => esc(v.variedad.descripcion)).join(', ')) : ''}
${s.calibres && s.calibres.length > 0 ? fila('Calibres', s.calibres.map((c) => esc(c.calibre.descripcion)).join(', ')) : ''}
${s.categorias && s.categorias.length > 0 ? fila('Categorías', s.categorias.map((c) => esc(c.categoria.descripcion)).join(', ')) : ''}
${s.calificacion ? fila('Calificación', esc(s.calificacion.descripcion)) : ''}
${s.cantidadPallets != null ? fila('Cant. pallets', String(s.cantidadPallets)) : ''}
${acuden ? fila('Debe(n) acudir', acuden) : ''}
${s.observaciones ? fila('Observaciones', esc(s.observaciones).replace(/\n/g, '<br>')) : ''}
</table>`
}

function envolver(titulo: string, contenido: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px">
<h2 style="color:#1a7f37;margin-bottom:4px">Frutera Agrosan — Sistema FAS</h2>
<h3 style="margin-top:0">${titulo}</h3>
${contenido}
<p style="color:#999;font-size:12px;margin-top:24px">Este es un correo automático del sistema FAS. No responder a esta casilla.</p>
</div>`
}

export function correoNotificacion(s: SolicitudParaCorreo) {
  return {
    subject: `[FAS] Solicitud de inspección ${s.codigo} — ${fmtFecha.format(s.fechaHora)}`,
    html: envolver(
      'Nueva solicitud de inspección',
      `<p>Se te ha asignado una solicitud de inspección:</p>${cuerpoDetalle(s)}`,
    ),
  }
}

export function correoModificacion(s: SolicitudParaCorreo) {
  return {
    subject: `[FAS] Solicitud de inspección ${s.codigo} MODIFICADA`,
    html: envolver(
      'Solicitud de inspección modificada',
      `<p>Una solicitud de inspección en la que participas fue <strong>modificada</strong>. Datos vigentes:</p>${cuerpoDetalle(s)}`,
    ),
  }
}

export function correoEliminacion(s: SolicitudParaCorreo) {
  return {
    subject: `[FAS] Solicitud de inspección ${s.codigo} ELIMINADA`,
    html: envolver(
      'Solicitud de inspección eliminada',
      `<p>La siguiente solicitud de inspección fue <strong>eliminada</strong> y ya no requiere tu asistencia:</p>${cuerpoDetalle(s)}`,
    ),
  }
}

export function correoCierre(s: SolicitudParaCorreo, comentarios: string, cantidadAdjuntos: number, resultado: 'APROBADA' | 'RECHAZADA' | 'OBJETADA') {
  const label = resultado
  return {
    subject: `[FAS] Solicitud de inspección ${s.codigo} ${label}`,
    html: envolver(
      'Inspección cerrada',
      `<p>La inspección fue realizada y la solicitud quedó <strong>${label.toLowerCase()}</strong>.</p>
${cuerpoDetalle(s)}
<h4 style="margin-bottom:4px">Comentarios del inspector</h4>
<p>${esc(comentarios).replace(/\n/g, '<br>')}</p>
${cantidadAdjuntos > 0 ? `<p>La inspección incluye <strong>${cantidadAdjuntos} archivo(s) adjunto(s)</strong> disponibles en el sistema.</p>` : ''}`,
    ),
  }
}

export function correoReapertura(s: SolicitudParaCorreo) {
  return {
    subject: `[FAS] Solicitud de inspección ${s.codigo} REABIERTA`,
    html: envolver(
      'Solicitud de inspección reabierta',
      `<p>La siguiente solicitud de inspección fue <strong>reabierta</strong>:</p>${cuerpoDetalle(s)}`,
    ),
  }
}

export function correoRecordatorio(s: SolicitudParaCorreo) {
  return {
    subject: `[FAS] Recordatorio: inspección ${s.codigo} — ${fmtFecha.format(s.fechaHora)}`,
    html: envolver(
      'Recordatorio de visita de inspección',
      `<p>Te recordamos la visita de inspección programada:</p>${cuerpoDetalle(s)}`,
    ),
  }
}
