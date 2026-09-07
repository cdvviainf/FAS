'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'
import type { ProformaMaterialListItem } from '../types'
import { ESTADO_PROFORMA_MATERIAL_LABELS } from '../types'

const ITEM = 'MATERIALES_PROFORMA'

const ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  BORRADOR: 'secondary',
  ENVIADA_VALIDACION: 'default',
  FACTURADA: 'outline',
  ANULADA: 'destructive',
}

function ProformaMaterialCellAction({ proforma }: { proforma: ProformaMaterialListItem }) {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={() => router.push(`/dashboard/operaciones/materiales/proformas/${proforma.id}`)}
    >
      {puedeEscribir ? 'Editar' : 'Ver detalle'}
    </Button>
  )
}

export const proformaMaterialColumns: ColumnDef<ProformaMaterialListItem>[] = [
  {
    id: 'numero',
    accessorKey: 'numero',
    header: ({ column }) => <DataTableColumnHeader column={column} title='N° Proforma' />,
    cell: ({ cell }) => <span className='font-mono text-sm'>{cell.getValue<string>()}</span>,
    size: 140,
  },
  {
    id: 'creadoEn',
    accessorKey: 'creadoEn',
    header: ({ column }) => <DataTableColumnHeader column={column} title='Fecha' />,
    cell: ({ cell }) => <span className='text-sm'>{formatFechaCorta(cell.getValue<string>())}</span>,
    size: 110,
  },
  {
    id: 'cliente',
    header: 'Cliente',
    cell: ({ row }) => (
      <div>
        <p className='font-medium'>{row.original.entidad.descripcion}</p>
        <p className='text-xs text-muted-foreground'>{row.original.entidad.razonSocial}</p>
      </div>
    ),
  },
  {
    id: 'moneda',
    header: 'Moneda',
    cell: ({ row }) => <span className='text-sm'>{row.original.moneda.codigo}</span>,
    size: 90,
  },
  {
    id: 'estado',
    accessorKey: 'estado',
    header: 'Estado',
    cell: ({ cell }) => {
      const estado = cell.getValue<keyof typeof ESTADO_PROFORMA_MATERIAL_LABELS>()
      return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_PROFORMA_MATERIAL_LABELS[estado]}</Badge>
    },
    size: 130,
  },
  {
    id: 'actions',
    size: 90,
    cell: ({ row }) => <ProformaMaterialCellAction proforma={row.original} />,
  },
]
