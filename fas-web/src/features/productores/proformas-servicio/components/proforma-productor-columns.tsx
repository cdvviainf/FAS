'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta } from '@/lib/format'
import type { ProformaProductorListItem } from '../types'
import { ESTADO_PROFORMA_PRODUCTOR_LABELS } from '../types'

const ITEM = 'PRODUCTORES_PROFORMA'

const ESTADO_VARIANT: Record<string, 'secondary' | 'default' | 'outline' | 'destructive'> = {
  BORRADOR: 'secondary',
  ENVIADA_VALIDACION: 'default',
  FACTURADA: 'outline',
  ANULADA: 'destructive',
}

function ProformaProductorCellAction({ proforma }: { proforma: ProformaProductorListItem }) {
  const router = useRouter()
  const puedeEscribir = usePuedeEscribir(ITEM)

  return (
    <Button
      variant='ghost'
      size='sm'
      onClick={() => router.push(`/dashboard/productores/proformas/${proforma.id}`)}
    >
      {puedeEscribir ? 'Editar' : 'Ver detalle'}
    </Button>
  )
}

export const proformaProductorColumns: ColumnDef<ProformaProductorListItem>[] = [
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
    id: 'productor',
    header: 'Productor',
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
      const estado = cell.getValue<keyof typeof ESTADO_PROFORMA_PRODUCTOR_LABELS>()
      return <Badge variant={ESTADO_VARIANT[estado]}>{ESTADO_PROFORMA_PRODUCTOR_LABELS[estado]}</Badge>
    },
    size: 150,
  },
  {
    id: 'actions',
    size: 90,
    cell: ({ row }) => <ProformaProductorCellAction proforma={row.original} />,
  },
]
