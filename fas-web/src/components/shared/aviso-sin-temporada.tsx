'use client'

import { IconAlertTriangle } from '@tabler/icons-react'

// Temporada obligatoria en todo registro (2026-11-09): sin temporada activa no
// se puede crear el documento. Se muestra junto al botón de guardar.
export function AvisoSinTemporada({ mostrar, className }: { mostrar: boolean; className?: string }) {
  if (!mostrar) return null
  return (
    <div className={`flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 ${className ?? ''}`}>
      <IconAlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
      <span>No hay temporada activa. Selecciona una temporada en el selector general (barra superior) para poder guardar.</span>
    </div>
  )
}
