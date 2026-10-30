// Conversión de un monto a palabras para documentos comerciales (Proforma /
// Factura de Exportación). Formato de referencia estilo "Export Invoice":
//   `<palabras de la parte entera>, NN/100[ MONEDA]`
// Ej. EN: "Sixty-one thousand one hundred and sixty, 00/100 USD"
//     ES: "Sesenta y un mil ciento sesenta, 00/100 USD"
// Solo la parte entera se escribe en palabras; los centavos van como NN/100
// (mismo criterio que los "Amount in words" de las facturas de exportación).

// ─── Español ────────────────────────────────────────────────────────────────
const UNIDADES_ES = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const DECENAS_ES = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS_ES = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

// 0..99. `apocope` → "uno"/"veintiuno" se vuelven "un"/"veintiún" (antes de
// un sustantivo: mil, millones).
function dosDigitosES(n: number, apocope: boolean): string {
  if (n < 30) {
    if (apocope && n === 1) return 'un'
    if (apocope && n === 21) return 'veintiún'
    return UNIDADES_ES[n]
  }
  const d = Math.floor(n / 10)
  const u = n % 10
  if (u === 0) return DECENAS_ES[d]
  return `${DECENAS_ES[d]} y ${apocope && u === 1 ? 'un' : UNIDADES_ES[u]}`
}

// 0..999.
function tresDigitosES(n: number, apocope: boolean): string {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(CENTENAS_ES[c])
  if (resto > 0) partes.push(dosDigitosES(resto, apocope))
  return partes.join(' ')
}

// 0..999999.
function grupoMilesES(n: number, apocope: boolean): string {
  const miles = Math.floor(n / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (miles > 0) partes.push(miles === 1 ? 'mil' : `${tresDigitosES(miles, true)} mil`)
  if (resto > 0) partes.push(tresDigitosES(resto, apocope))
  return partes.join(' ')
}

function enterosES(num: number): string {
  if (num === 0) return 'cero'
  const millones = Math.floor(num / 1_000_000)
  const resto = num % 1_000_000
  const partes: string[] = []
  if (millones > 0) partes.push(millones === 1 ? 'un millón' : `${grupoMilesES(millones, true)} millones`)
  if (resto > 0) partes.push(grupoMilesES(resto, false))
  return partes.join(' ')
}

// ─── Inglés ─────────────────────────────────────────────────────────────────
const ONES_EN = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const TENS_EN = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

function dosDigitosEN(n: number): string {
  if (n < 20) return ONES_EN[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  return u ? `${TENS_EN[d]}-${ONES_EN[u]}` : TENS_EN[d]
}

function tresDigitosEN(n: number): string {
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes: string[] = []
  if (c > 0) partes.push(`${ONES_EN[c]} hundred`)
  if (resto > 0) partes.push(partes.length ? `and ${dosDigitosEN(resto)}` : dosDigitosEN(resto))
  return partes.join(' ')
}

function enterosEN(num: number): string {
  if (num === 0) return 'zero'
  const escalas: Array<[number, string]> = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ]
  const partes: string[] = []
  let resto = num
  for (const [valor, nombre] of escalas) {
    const q = Math.floor(resto / valor)
    if (q > 0) {
      partes.push(`${tresDigitosEN(q)} ${nombre}`)
      resto %= valor
    }
  }
  if (resto > 0) partes.push(tresDigitosEN(resto))
  return partes.join(' ')
}

function capitalizar(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Convierte el monto a palabras (parte entera) + centavos NN/100. La moneda es
// opcional: si se entrega, se agrega como sufijo (ej. "... 00/100 USD").
export function montoEnPalabras(monto: number, idioma: 'ES' | 'EN', moneda?: string): string {
  const total = Math.round(Math.abs(monto) * 100)
  const entero = Math.floor(total / 100)
  const centavos = total % 100
  const palabras = idioma === 'EN' ? enterosEN(entero) : enterosES(entero)
  const base = `${palabras}, ${String(centavos).padStart(2, '0')}/100`
  const conMoneda = moneda ? `${base} ${moneda}` : base
  return capitalizar(conMoneda)
}
