'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type ComunaItem = MantenedorSimple & {
  provincia?: { id: number; descripcion: string; region?: { id: number; descripcion: string } | null } | null
}

export const comunaExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'provincia',
    header: 'Provincia',
    enableSorting: false,
    cell: ({ row }) => (row.original as ComunaItem).provincia?.descripcion ?? '—'
  },
  {
    id: 'region',
    header: 'Región',
    enableSorting: false,
    cell: ({ row }) => (row.original as ComunaItem).provincia?.region?.descripcion ?? '—'
  }
]
