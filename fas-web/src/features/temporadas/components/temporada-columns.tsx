'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

interface TemporadaItem extends MantenedorSimple {
  fechaInicio?: string
  fechaTermino?: string
  predeterminada?: boolean
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return dateStr.slice(0, 10)
}

export const temporadaExtraColumns: ColumnDef<TemporadaItem>[] = [
  {
    id: 'fechaInicio',
    header: 'Inicio',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>{formatDate(row.original.fechaInicio)}</span>
    ),
  },
  {
    id: 'fechaTermino',
    header: 'Término',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>{formatDate(row.original.fechaTermino)}</span>
    ),
  },
  {
    id: 'predeterminada',
    header: 'Predeterminada',
    enableSorting: false,
    size: 120,
    cell: ({ row }) =>
      row.original.predeterminada ? (
        <Badge variant='default' className='text-xs'>Predeterminada</Badge>
      ) : null,
  },
]
