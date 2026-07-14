'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import { ColumnDef, Column } from '@tanstack/react-table';
import type { Mercado } from '../../api/types';
import { CellAction } from './cell-action';

export const columns: ColumnDef<Mercado>[] = [
  {
    id: 'codigo',
    accessorKey: 'codigo',
    header: ({ column }: { column: Column<Mercado, unknown> }) => (
      <DataTableColumnHeader column={column} title='Código' />
    ),
    cell: ({ cell }) => (
      <span className='font-mono text-xs font-semibold'>{cell.getValue<string>()}</span>
    ),
    meta: {
      label: 'Código',
      placeholder: 'Buscar por código, descripción o grupo...',
      variant: 'text',
      icon: Icons.search
    },
    enableColumnFilter: true,
    size: 100
  },
  {
    id: 'descripcion',
    accessorKey: 'descripcion',
    header: ({ column }: { column: Column<Mercado, unknown> }) => (
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
  {
    id: 'grupoMercado',
    accessorKey: 'grupoMercado',
    header: 'Grupo',
    enableSorting: false,
    cell: ({ row }) => {
      const desc = row.original.grupoMercado?.descripcion
      return desc ? <Badge variant='secondary'>{desc}</Badge> : <span className='text-muted-foreground text-xs'>—</span>
    }
  },
  {
    id: 'pais',
    accessorKey: 'pais',
    header: 'País',
    enableSorting: false,
    cell: ({ row }) => {
      const p = row.original.pais
      if (!p) return <span className='text-muted-foreground text-xs'>—</span>
      return (
        <span className='text-sm text-muted-foreground'>
          <span className='font-mono text-xs mr-1'>{p.codigo}</span>
          {p.descripcion}
        </span>
      )
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
