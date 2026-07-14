'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Icons } from '@/components/icons';
import { ColumnDef, Column } from '@tanstack/react-table';
import type { Articulo } from '../../api/types';
import { CellAction } from './cell-action';
import { TIPO_OPTIONS } from './options';

const TIPO_LABELS: Record<string, string> = {
  EMBALAJE: 'Embalaje',
  ENVASE: 'Envase',
  MATERIAL_EMBALAJE: 'Mat. Embalaje',
  SERVICIO: 'Servicio'
};

const TIPO_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  EMBALAJE: 'default',
  ENVASE: 'secondary',
  MATERIAL_EMBALAJE: 'outline',
  SERVICIO: 'outline'
};

export const columns: ColumnDef<Articulo>[] = [
  {
    id: 'codigo',
    accessorKey: 'codigo',
    header: ({ column }: { column: Column<Articulo, unknown> }) => (
      <DataTableColumnHeader column={column} title='Código' />
    ),
    cell: ({ cell }) => (
      <span className='font-mono text-xs font-medium'>{cell.getValue<string>()}</span>
    ),
    meta: {
      label: 'Código',
      placeholder: 'Buscar por código o descripción...',
      variant: 'text',
      icon: Icons.search
    },
    enableColumnFilter: true
  },
  {
    id: 'descripcion',
    accessorKey: 'descripcion',
    header: ({ column }: { column: Column<Articulo, unknown> }) => (
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
    id: 'tipo',
    accessorKey: 'tipo',
    enableSorting: false,
    header: ({ column }: { column: Column<Articulo, unknown> }) => (
      <DataTableColumnHeader column={column} title='Tipo' />
    ),
    cell: ({ cell }) => {
      const tipo = cell.getValue<string>();
      return (
        <Badge variant={TIPO_VARIANTS[tipo] ?? 'outline'}>
          {TIPO_LABELS[tipo] ?? tipo}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Tipo',
      variant: 'multiSelect',
      options: TIPO_OPTIONS
    }
  },
  {
    accessorKey: 'unidad',
    header: 'Unidad',
    cell: ({ cell }) => (
      <span className='text-sm text-muted-foreground'>{cell.getValue<string>()}</span>
    )
  },
  {
    accessorKey: 'tipoCosteo',
    header: 'Costeo',
    cell: ({ cell }) => {
      const costeo = cell.getValue<string>();
      return (
        <Badge variant='outline' className='text-xs'>
          {costeo === 'ESTANDAR' ? 'Estándar' : 'PP'}
        </Badge>
      );
    }
  },
  {
    accessorKey: 'stockCritico',
    header: 'Stock Crítico',
    cell: ({ row }) => {
      if (!row.original.controlaStock) {
        return <span className='text-xs text-muted-foreground'>—</span>;
      }
      return (
        <span className='text-sm'>
          {row.original.stockCritico?.toLocaleString('es-CL') ?? '—'}
        </span>
      );
    }
  },
  {
    accessorKey: 'activo',
    header: 'Estado',
    enableSorting: false,
    cell: ({ cell }) => {
      const activo = cell.getValue<boolean>();
      return activo ? (
        <Badge variant='default' className='bg-green-600 hover:bg-green-700'>
          <Icons.circleCheck className='mr-1 h-3 w-3' />
          Activo
        </Badge>
      ) : (
        <Badge variant='secondary'>
          <Icons.xCircle className='mr-1 h-3 w-3' />
          Inactivo
        </Badge>
      );
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
