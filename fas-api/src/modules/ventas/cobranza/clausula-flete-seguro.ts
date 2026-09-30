import { ValidationError } from '../../../shared/errors.js'

// Cláusula de venta (Incoterm) y sus exigencias de Flete/Seguro. Los flags
// viven en ClausulaVenta.requiereFlete/requiereSeguro y llegan aquí vía la
// Nota de Venta del Embarque.
export interface ClausulaFlags {
  descripcion?: string | null
  requiereFlete: boolean
  requiereSeguro: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function normalizarComponente(
  requiere: boolean,
  valor: number | null | undefined,
  label: string,
  sufijoClausula: string,
): number | null {
  // Si la cláusula NO lo exige (ej. FOB), se ignora cualquier valor informado.
  if (!requiere) return null
  if (valor == null || valor <= 0) {
    throw new ValidationError(`La cláusula de venta${sufijoClausula} exige informar el monto de ${label}`)
  }
  return round2(valor)
}

// Valida y normaliza los montos de Flete/Seguro contra las exigencias de la
// cláusula. Devuelve null en el componente que la cláusula no exige. Falla si
// falta un componente exigido, o si Flete + Seguro dejaría el valor FOB de la
// mercadería en cero o negativo (no tendría sentido tributario).
export function resolverFleteSeguro(
  clausula: ClausulaFlags | null | undefined,
  montoTotal: number,
  entrada: { montoFlete?: number | null; montoSeguro?: number | null },
): { montoFlete: number | null; montoSeguro: number | null } {
  const sufijo = clausula?.descripcion ? ` (${clausula.descripcion})` : ''
  const montoFlete = normalizarComponente(clausula?.requiereFlete ?? false, entrada.montoFlete, 'Flete', sufijo)
  const montoSeguro = normalizarComponente(clausula?.requiereSeguro ?? false, entrada.montoSeguro, 'Seguro', sufijo)

  const reduccion = round2((montoFlete ?? 0) + (montoSeguro ?? 0))
  if (reduccion > 0 && reduccion >= round2(montoTotal)) {
    throw new ValidationError(
      'El Flete y el Seguro no pueden igualar ni superar el valor de venta — el valor FOB de la mercadería quedaría en cero o negativo',
    )
  }
  return { montoFlete, montoSeguro }
}

// Factor que lleva el precio de venta (cláusula/CIF) al valor FOB de la
// mercadería: (montoTotal − flete − seguro) / montoTotal. Los montos de flete y
// seguro son un monto cerrado DENTRO del total (restan al valor de venta), no
// se suman encima.
export function factorFob(montoTotal: number, montoFlete: number | null, montoSeguro: number | null): number {
  const reduccion = (montoFlete ?? 0) + (montoSeguro ?? 0)
  if (montoTotal <= 0 || reduccion <= 0) return 1
  return (montoTotal - reduccion) / montoTotal
}

// Unitario a valor FOB, redondeado a 4 decimales (misma precisión que la
// columna precioUnitario @db.Decimal(14,4)).
export function unitarioFob(precioUnitarioClausula: number, factor: number): number {
  return Math.round(precioUnitarioClausula * factor * 10_000) / 10_000
}
