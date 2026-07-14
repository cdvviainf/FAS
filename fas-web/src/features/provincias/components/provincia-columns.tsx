'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type ProvinciaItem = MantenedorSimple & {
  region?: { id: number; descripcion: string } | null
}

export const provinciaExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'region',
    header: 'Región',
    enableSorting: false,
    cell: ({ row }) => (row.original as ProvinciaItem).region?.descripcion ?? '—'
  }
]
