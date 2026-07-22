/**
 * Validador de RUT chileno.
 * Formato esperado: XXXXXXXX-Y  (sin puntos, con guión)
 * También acepta entrada sin guión o con puntos (se limpia automáticamente).
 */

/**
 * Verifica el dígito verificador de un RUT chileno usando el algoritmo módulo 11.
 */
export function validarRutChileno(rut: string): boolean {
  // Limpiar puntos y espacios, mantener guión para separar luego
  const limpio = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase()

  // Debe contener exactamente un guión
  const guion = limpio.lastIndexOf('-')
  if (guion <= 0) return false

  const cuerpo = limpio.slice(0, guion)
  const dv = limpio.slice(guion + 1)

  // El cuerpo solo debe contener dígitos
  if (!/^\d+$/.test(cuerpo)) return false

  // El DV debe ser un dígito o 'K'
  if (!/^[\dK]$/.test(dv)) return false

  // Algoritmo módulo 11
  const dvCalculado = calcularDV(cuerpo)
  return dvCalculado === dv
}

/**
 * Formatea un RUT asegurando el formato XXXXXXXX-Y (sin puntos).
 * Si el RUT no tiene guión se asume que el último carácter es el DV.
 */
export function formatearRut(rut: string): string {
  const limpio = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase()

  const guion = limpio.lastIndexOf('-')
  if (guion > 0) {
    return `${limpio.slice(0, guion)}-${limpio.slice(guion + 1)}`
  }

  // Sin guión: separar último carácter como DV
  if (limpio.length >= 2) {
    const cuerpo = limpio.slice(0, -1)
    const dv = limpio.slice(-1)
    return `${cuerpo}-${dv}`
  }

  return limpio
}

// ─── Interno ──────────────────────────────────────────────────────────────────

function calcularDV(cuerpo: string): string {
  const digits = cuerpo.split('').reverse()
  const factores = [2, 3, 4, 5, 6, 7]

  let suma = 0
  digits.forEach((d, i) => {
    suma += parseInt(d, 10) * factores[i % factores.length]
  })

  const resto = 11 - (suma % 11)
  if (resto === 11) return '0'
  if (resto === 10) return 'K'
  return String(resto)
}
