'use client'

import { useState } from 'react'

interface ExpandableTextProps {
  text: string | null | undefined
  // Máximo de caracteres antes de truncar (default 80).
  max?: number
  // Texto a mostrar cuando no hay contenido (default '—').
  empty?: string
  className?: string
}

// Texto con truncado y toggle "…más"/"menos" — para mostrar resúmenes/
// comentarios largos en celdas de tabla sin perder la posibilidad de leerlos
// completos (2026-10-06). No existía un componente compartido para esto; los
// patrones previos eran `truncate` seco o `truncate` + `title`.
export function ExpandableText({ text, max = 80, empty = '—', className }: ExpandableTextProps) {
  const [expandido, setExpandido] = useState(false)
  const valor = (text ?? '').trim()

  if (!valor) return <span className={className}>{empty}</span>

  const esLargo = valor.length > max
  if (!esLargo) return <span className={className}>{valor}</span>

  return (
    <span className={className}>
      <span className='whitespace-pre-wrap'>{expandido ? valor : `${valor.slice(0, max).trimEnd()}…`}</span>{' '}
      <button
        type='button'
        onClick={(e) => {
          e.stopPropagation()
          setExpandido((v) => !v)
        }}
        className='text-primary hover:underline text-xs font-medium whitespace-nowrap'
      >
        {expandido ? 'menos' : 'más'}
      </button>
    </span>
  )
}
