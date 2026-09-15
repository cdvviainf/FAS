'use client'

import type { ColumnDef, Column } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type GrupoVariedadItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
}

export const grupoVariedadExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    accessorFn: (row) => (row as GrupoVariedadItem).especie?.descripcion ?? '',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Especie' />
    ),
    meta: { label: 'Especie' },
    cell: ({ row }) => (row.original as GrupoVariedadItem).especie?.descripcion ?? '—'
  }
]
