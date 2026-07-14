'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type GrupoVariedadItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
}

export const grupoVariedadExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: 'Especie',
    enableSorting: false,
    cell: ({ row }) => (row.original as GrupoVariedadItem).especie?.descripcion ?? '—'
  }
]
