'use client'

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import type { ColumnDef, Column } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { MantenedorCellAction } from './mantenedor-cell-action'

export function createMantenedorColumns(
  recurso: string,
  titulo: string,
  extraColumns?: ColumnDef<MantenedorSimple>[],
  renderEditSheet?: (props: { item: MantenedorSimple; open: boolean; onOpenChange: (v: boolean) => void }) => React.ReactNode
): ColumnDef<MantenedorSimple>[] {
  return [
    {
      id: 'codigo',
      accessorKey: 'codigo',
      header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
        <DataTableColumnHeader column={column} title='Código' />
      ),
      cell: ({ cell }) => (
        <span className='font-mono text-xs font-semibold'>{cell.getValue<string>()}</span>
      ),
      meta: {
        label: 'Código',
        placeholder: 'Buscar por código o descripción...',
        variant: 'text',
        icon: Icons.search
      },
      enableColumnFilter: true,
      size: 80
    },
    {
      id: 'descripcion',
      accessorKey: 'descripcion',
      header: ({ column }: { column: Column<MantenedorSimple, unknown> }) => (
        <DataTableColumnHeader column={column} title='Descripción' />
      ),
      cell: ({ row }) => (
        <span className={row.original.bloqueado ? 'text-muted-foreground' : 'font-medium'}>
          {row.original.descripcion}
        </span>
      )
    },
    {
      id: 'descripcionExtranjera',
      accessorKey: 'descripcionExtranjera',
      header: 'Desc. Extranjera',
      enableSorting: false,
      cell: ({ cell }) => (
        <span className='text-sm text-muted-foreground'>{cell.getValue<string>() ?? '—'}</span>
      )
    },
    ...(extraColumns ?? []),
    {
      id: 'bloqueado',
      accessorKey: 'bloqueado',
      header: 'Estado',
      enableSorting: false,
      size: 100,
      cell: ({ row }) =>
        row.original.bloqueado ? (
          <Badge variant='destructive' className='text-xs'>Bloqueado</Badge>
        ) : (
          <Badge variant='outline' className='text-xs text-muted-foreground'>Activo</Badge>
        )
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <MantenedorCellAction data={row.original} recurso={recurso} titulo={titulo} renderEditSheet={renderEditSheet} />
      )
    }
  ]
}
