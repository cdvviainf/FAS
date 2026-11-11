// Único lugar donde se formatea para impresión (Etapa 4 §5: "prohibido
// formatear a mano dentro de una plantilla"). Todo lo que una plantilla
// muestra pasa por acá.

function numero(valor: number | string, decimales: number): string {
  const n = typeof valor === 'string' ? Number(valor) : valor
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n)
}

export const fmt = {
  entero: (v: number | string) => numero(v, 0),
  // Decimal de Prisma serializa a string por el borde HTTP — todo lo que
  // llega acá desde un payload ya viaja como string, nunca number de JS
  // (CLAUDE.md §7 "Siempre usar Decimal — nunca number de JavaScript").
  usd: (v: number | string) => `US$ ${numero(v, 2)}`,
  clp: (v: number | string) => `$ ${numero(v, 0)}`,
  // Monto con código de moneda dinámico (a diferencia de usd/clp, fijos) —
  // para documentos cuya moneda depende de la fila (ej. OrdenCompraMaterial).
  moneda: (v: number | string, codigo: string) => `${codigo} ${numero(v, 2)}`,
  kilos: (v: number | string) => `${numero(v, 2)} kg`,
  fecha: (iso: string) => {
    // Mismo criterio que formatFechaCorta en fas-web (fas-web/src/lib/format.ts):
    // el payload trae fechas puras (sin hora significativa) como
    // DateTime con hora 00:00:00Z — parsear la parte YYYY-MM-DD como hora
    // LOCAL evita el corrimiento de un día por huso horario.
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CL')
  },
  // Hora de Chile explícita (2026-11-11): el servidor corre en UTC y sin
  // timeZone el PDF mostraba la hora desplazada (+3 h).
  fechaHora: (iso: string) => new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
  rut: (rut: string | null | undefined) => rut ?? '—',
  // Por idioma del documento (2026-11-06, OC v3): EN usa separadores en-US
  // (1,080.00) y fecha "Oct 3, 2026"; ES usa es-CL (1.080,00) y "3 oct 2026".
  numeroIdioma: (v: number | string, decimales: number, idioma: 'ES' | 'EN') => {
    const n = typeof v === 'string' ? Number(v) : v
    if (!Number.isFinite(n)) return '—'
    return new Intl.NumberFormat(idioma === 'EN' ? 'en-US' : 'es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(n)
  },
  fechaLarga: (iso: string, idioma: 'ES' | 'EN') =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString(idioma === 'EN' ? 'en-US' : 'es-CL', { day: 'numeric', month: 'short', year: 'numeric' }),
}
