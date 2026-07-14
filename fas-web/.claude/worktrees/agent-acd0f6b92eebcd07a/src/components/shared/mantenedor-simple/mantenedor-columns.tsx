'use client'

import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Icons } from '@/components/icons'
import type { ColumnDef, Column } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { MantenedorCellAction } from './mantenedor-cell-action'

export function createMantenedorColumns(
  recurso: string,
  titulo: string,
  extraColumns?: ColumnDef<MantenedorSimple>[]
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
        <div>
          <p className='font-medium'>{row.original.descripcion}</p>
          {row.original.descripcionExtranjera && (
            <p className='text-xs text-muted-foreground'>{row.original.descripcionExtranjera}</p>
          )}
        </div>
      )
    },
    ...(extraColumns ?? []),
    {
      id: 'creadoEn',
      accessorKey: 'creadoEn',
      header: 'Creado',
      enableSorting: false,
      cell: ({ cell }) => (
        <span className='text-sm text-muted-foreground'>
          {new Date(cell.getValue<string>()).toLocaleDateString('es-CL')}
        </span>
      )
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <MantenedorCellAction data={row.original} recurso={recurso} titulo={titulo} />
      )
    }
  ]
}
