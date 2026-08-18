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
  kilos: (v: number | string) => `${numero(v, 2)} kg`,
  fecha: (iso: string) => {
    // Mismo criterio que formatFechaCorta en fas-web (fas-web/src/lib/format.ts):
    // el payload trae fechas puras (sin hora significativa) como
    // DateTime con hora 00:00:00Z — parsear la parte YYYY-MM-DD como hora
    // LOCAL evita el corrimiento de un día por huso horario.
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CL')
  },
  fechaHora: (iso: string) => new Date(iso).toLocaleString('es-CL'),
  rut: (rut: string | null | undefined) => rut ?? '—',
}
