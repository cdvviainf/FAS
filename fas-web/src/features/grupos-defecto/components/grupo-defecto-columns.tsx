'use client'

import type { ColumnDef, Column } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type GrupoDefectoItem = MantenedorSimple & {
  tipoDefecto?: { id: number; descripcion: string } | null
}

export const grupoDefectoExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'tipoDefecto',
    accessorFn: (row) => (row as GrupoDefectoItem).tipoDefecto?.descripcion ?? '',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Tipo de Defecto' />
    ),
    meta: { label: 'Tipo de Defecto' },
    cell: ({ row }) => (row.original as GrupoDefectoItem).tipoDefecto?.descripcion ?? '—'
  }
]
