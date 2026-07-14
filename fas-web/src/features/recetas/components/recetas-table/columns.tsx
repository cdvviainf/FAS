'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import type { Receta } from '../../api/types';
import { CellAction } from './cell-action';

export const columns: ColumnDef<Receta>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label='Seleccionar todo'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label='Seleccionar fila'
      />
    ),
    enableSorting: false,
    enableHiding: false
  },
  {
    accessorKey: 'codigo',
    id: 'codigo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
    cell: ({ row }) => (
      <span className='font-mono text-sm font-medium'>{row.getValue('codigo')}</span>
    ),
    enableColumnFilter: true,
    meta: { variant: 'text', label: 'Código' }
  },
  {
    accessorKey: 'descripcion',
    id: 'descripcion',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Descripción' />,
    cell: ({ row }) => (
      <div className='max-w-[240px]'>
        <p className='truncate font-medium'>{row.getValue('descripcion')}</p>
      </div>
    )
  },
  {
    id: 'embalaje',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Embalaje' />,
    cell: ({ row }) => {
      const receta = row.original;
      return (
        <div className='flex flex-col'>
          <span className='font-mono text-xs text-muted-foreground'>{receta.embalajeCodigo}</span>
          <span className='text-sm'>{receta.embalajeDescripcion}</span>
        </div>
      );
    },
    enableSorting: false
  },
  {
    accessorKey: 'cantidadAProducir',
    id: 'cantidadAProducir',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Cant. a Producir' />,
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>
        {row.getValue<number>('cantidadAProducir').toLocaleString('es-CL')}
      </span>
    )
  },
  {
    accessorKey: 'cantidadComponentes',
    id: 'cantidadComponentes',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Componentes' />,
    cell: ({ row }) => (
      <Badge variant='secondary' className='tabular-nums'>
        {row.getValue<number>('cantidadComponentes')}
      </Badge>
    )
  },
  {
    accessorKey: 'activo',
    id: 'activo',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Estado' />,
    cell: ({ row }) =>
      row.getValue('activo') ? (
        <Badge className='bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'>
          Activa
        </Badge>
      ) : (
        <Badge variant='secondary'>Inactiva</Badge>
      )
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction receta={row.original} />
  }
];
