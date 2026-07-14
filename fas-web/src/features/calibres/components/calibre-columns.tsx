'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type CalibreItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
  orden?: number | null
}

export const calibreExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: 'Especie',
    enableSorting: false,
    cell: ({ row }) => (row.original as CalibreItem).especie?.descripcion ?? '—'
  },
  {
    id: 'orden',
    header: 'Orden',
    enableSorting: false,
    cell: ({ row }) => {
      const orden = (row.original as CalibreItem).orden
      return orden != null ? <span className='font-mono text-xs'>{orden}</span> : '—'
    }
  }
]
