'use client'

import type { ColumnDef, Column } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type VariedadItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
  grupoVariedad?: { id: number; descripcion: string } | null
}

export const variedadExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Especie' />
    ),
    cell: ({ row }) => (row.original as VariedadItem).especie?.descripcion ?? '—'
  },
  {
    id: 'grupoVariedad',
    header: 'Grupo',
    enableSorting: false,
    cell: ({ row }) => (row.original as VariedadItem).grupoVariedad?.descripcion ?? '—'
  }
]
