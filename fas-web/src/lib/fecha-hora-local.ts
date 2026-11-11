// Inputs `datetime-local` (2026-11-11): el input entrega "YYYY-MM-DDTHH:mm"
// SIN zona. Enviado tal cual, el backend (UTC) lo interpreta como UTC y al
// mostrarlo en Chile aparece con −3 h. Siempre convertir en el navegador.

const pad = (n: number) => String(n).padStart(2, '0')

// ISO (UTC) del backend → valor del input en hora local del navegador.
export function isoAInputLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Valor del input (hora local) → ISO con zona (UTC) para el backend.
export function inputLocalAIso(valor: string): string
export function inputLocalAIso(valor: string | null | undefined): string | null
export function inputLocalAIso(valor: string | null | undefined): string | null {
  if (!valor) return null
  const d = new Date(valor)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
