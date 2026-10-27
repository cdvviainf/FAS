// Plantillas HTML de correos de Solicitudes de Inspección.
// Fechas formateadas en zona America/Santiago.

interface SolicitudParaCorreo {
  codigo: string
  // Fecha de visita: nullable desde 2026-10-13 (se fija al editar la visita o
  // en el cierre, no al crear).
  fechaHora: Date | null
  observaciones?: string | null
  entidadProductor: { descripcion: string; razonSocial: string }
  direccion: {
    direccion: string
    latitud?: unknown
    longitud?: unknown
    comuna?: { descripcion: string } | null
  }
  contacto?: { nombre: string; telefono?: string | null; whatsapp?: string | null; email?: string | null } | null
  mercado?: { descripcion: string } | null
  cliente?: { razonSocial: string } | null
  fechaDespacho?: Date | null
  paises?: { pais: { descripcion: string } }[]
  // Detalle de producto por línea (2026-10-27).
  lineas?: {
    especie: { descripcion: string }
    variedad: { descripcion: string }
    articulo: { descripcion: string }
    cantidadPallets?: number | null
    categorias: { categoria: { descripcion: string } }[]
    calibres: { calibre: { descripcion: string } }[]
    calidades: { notaCalidad: { descripcion: string }; notaCondicion: { descripcion: string } }[]
  }[]
  asignados: { funcion: string; usuario: { nombre: string; email: string } }[]
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
${fila('Fecha y hora de visita', s.fechaHora ? fmtFecha.format(s.fechaHora) : 'Por definir')}
${s.mercado ? fila('Mercado', esc(s.mercado.descripcion)) : ''}
${s.paises && s.paises.length > 0 ? fila('Países', s.paises.map((p) => esc(p.pais.descripcion)).join(', ')) : ''}
${s.cliente ? fila('Cliente', esc(s.cliente.razonSocial)) : ''}
${s.fechaDespacho ? fila('Fecha de despacho', fmtFechaCorta.format(s.fechaDespacho)) : ''}
${acuden ? fila('Debe(n) acudir', acuden) : ''}
${s.observaciones ? fila('Observaciones', esc(s.observaciones).replace(/\n/g, '<br>')) : ''}
</table>${bloqueLineas(s.lineas)}`
}

// Detalle de producto por línea (2026-10-27): una tabla por línea.
function bloqueLineas(lineas: SolicitudParaCorreo['lineas']): string {
  if (!lineas || lineas.length === 0) return ''
  const bloques = lineas.map((l, i) => {
    const filas = [
      fila('Especie', esc(l.especie.descripcion)),
      fila('Embalaje', esc(l.articulo.descripcion)),
      fila('Variedad', esc(l.variedad.descripcion)),
      l.categorias.length > 0 ? fila('Categorías', l.categorias.map((c) => esc(c.categoria.descripcion)).join(', ')) : '',
      l.calibres.length > 0 ? fila('Calibres', l.calibres.map((c) => esc(c.calibre.descripcion)).join(', ')) : '',
      l.calidades.length > 0 ? fila('Calidades permitidas', l.calidades.map((c) => esc(`${c.notaCalidad.descripcion}/${c.notaCondicion.descripcion}`)).join(', ')) : '',
      l.cantidadPallets != null ? fila('Cant. pallets', String(l.cantidadPallets)) : '',
    ].join('')
    return `<h4 style="margin:12px 0 4px">Línea ${i + 1}</h4><table style="border-collapse:collapse;font-size:14px">${filas}</table>`
  })
  return `<div style="margin-top:8px"><h4 style="margin:12px 0 4px">Detalle de producto</h4>${bloques.join('')}</div>`
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
    subject: `[FAS] Solicitud de inspección ${s.codigo}${s.fechaHora ? ` — ${fmtFecha.format(s.fechaHora)}` : ''}`,
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
    subject: `[FAS] Recordatorio: inspección ${s.codigo}${s.fechaHora ? ` — ${fmtFecha.format(s.fechaHora)}` : ''}`,
    html: envolver(
      'Recordatorio de visita de inspección',
      `<p>Te recordamos la visita de inspección programada:</p>${cuerpoDetalle(s)}`,
    ),
  }
}
