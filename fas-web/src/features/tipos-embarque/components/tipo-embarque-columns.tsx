'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type TipoEmbarqueItem = MantenedorSimple & {
  requiereReserva?: boolean
}

function badgeSiNo(valor: boolean | undefined) {
  return valor
    ? <Badge variant='default' className='text-xs'>Sí</Badge>
    : <Badge variant='outline' className='text-xs text-muted-foreground'>No</Badge>
}

export const tipoEmbarqueExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'requiereReserva',
    header: 'Requiere Reserva',
    enableSorting: false,
    cell: ({ row }) => badgeSiNo((row.original as TipoEmbarqueItem).requiereReserva)
  }
]
