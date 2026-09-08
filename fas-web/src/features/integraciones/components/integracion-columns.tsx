import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import type { IntegracionListItem } from '../types'

export function buildIntegracionColumns(): ColumnDef<IntegracionListItem>[] {
  return [
    {
      accessorKey: 'codigo',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Código' />,
      cell: ({ row }) => <span className='font-medium'>{row.original.codigo}</span>,
    },
    { accessorKey: 'descripcion', header: 'Descripción' },
    { accessorKey: 'url', header: 'URL', cell: ({ row }) => row.original.url || <span className='text-muted-foreground'>—</span> },
    {
      id: 'gestorLogistico',
      header: 'Gestor Logístico',
      cell: ({ row }) => row.original.gestorLogistico?.descripcion ?? <span className='text-muted-foreground'>—</span>,
    },
    {
      id: 'activo',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={row.original.activo ? 'default' : 'secondary'}>
          {row.original.activo ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
  ]
}
