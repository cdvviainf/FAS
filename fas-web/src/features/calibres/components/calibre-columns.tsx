'use client'

import type { ColumnDef, Column } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type CalibreItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
  orden?: number | null
}

export const calibreExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Especie' />
    ),
    cell: ({ row }) => (row.original as CalibreItem).especie?.descripcion ?? '—'
  },
  {
    id: 'orden',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Orden' />
    ),
    cell: ({ row }) => {
      const orden = (row.original as CalibreItem).orden
      return orden != null ? <span className='font-mono text-xs'>{orden}</span> : '—'
    }
  }
]
