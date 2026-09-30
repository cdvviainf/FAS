// Formatea un campo de fecha pura (sin hora significativa, ej. NotaVenta.fecha
// u OrdenCompra.fecha — capturado con <Input type='date'>, guardado como
// DateTime con hora 00:00:00Z) sin desplazamiento de zona horaria: al armar
// el Date a partir de la parte YYYY-MM-DD sin sufijo 'Z', se interpreta en
// hora LOCAL, así el día calendario mostrado siempre coincide con el
// ingresado, sin importar el huso horario del navegador (ej. Chile UTC-3/-4,
// donde `new Date(iso).toLocaleDateString()` sobre una fecha-solo en UTC
// mostraba el día anterior).
export function formatFechaCorta(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CL')
}

// Semana ISO 8601 de una fecha — acepta "YYYY-MM-DD" o un ISO datetime
// completo (usa solo la parte de fecha, en hora local — mismo criterio que
// formatFechaCorta). Helper compartido (antes duplicado en
// reserva-info-base-card.tsx) — usado también por la columna "Semana de
// creación" del listado de Embarques.
export function semanaISO(fechaYmd: string): number | null {
  if (!fechaYmd) return null
  const d = new Date(`${fechaYmd.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const target = new Date(d.getTime())
  const dayNr = (d.getDay() + 6) % 7
  target.setDate(target.getDate() - dayNr + 3)
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const diff = target.getTime() - firstThursday.getTime()
  return 1 + Math.round(diff / (7 * 86_400_000))
}

// Monto con separador de miles (es-CL: miles con '.', decimales con ',').
// Acepta el string decimal que llega del backend (Decimal de Prisma) o un
// number ya calculado en el cliente. Devuelve '—' si no es un número finito.
export function formatMonto(value: number | string, decimals = 2): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
}

export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch {
    return '';
  }
}
