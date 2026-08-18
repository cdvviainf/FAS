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
