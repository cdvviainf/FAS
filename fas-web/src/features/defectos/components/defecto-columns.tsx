'use client'

import type { ColumnDef, Column } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type DefectoItem = MantenedorSimple & {
  grupoDefecto?: { id: number; descripcion: string } | null
  especies?: { especieId: number; especie: { id: number; descripcion: string } }[]
}

export const defectoExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'grupoDefecto',
    accessorFn: (row) => (row as DefectoItem).grupoDefecto?.descripcion ?? '',
    header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
      <DataTableColumnHeader column={column} title='Grupo' />
    ),
    meta: { label: 'Grupo' },
    cell: ({ row }) => (row.original as DefectoItem).grupoDefecto?.descripcion ?? '—'
  },
  {
    id: 'especies',
    header: () => 'Especies',
    meta: { label: 'Especies' },
    enableSorting: false,
    cell: ({ row }) => {
      const especies = (row.original as DefectoItem).especies ?? []
      if (especies.length === 0) return <span className='text-muted-foreground'>Todas</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {especies.map((e) => (
            <Badge key={e.especieId} variant='outline' className='text-xs'>{e.especie.descripcion}</Badge>
          ))}
        </div>
      )
    }
  }
]
