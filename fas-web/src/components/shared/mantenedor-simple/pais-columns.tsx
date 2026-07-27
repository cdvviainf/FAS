'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Icons } from '@/components/icons'

// Pais has extra fields esPaisOrigen y mercado (Mercado agrupa varios Países)
export interface PaisItem extends MantenedorSimple {
  esPaisOrigen?: boolean
  mercado?: { id: number; descripcion: string } | null
}

export const paisExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'esPaisOrigen',
    accessorKey: 'esPaisOrigen',
    header: 'País Origen',
    enableSorting: false,
    cell: ({ row }) => {
      const pais = row.original as PaisItem
      return pais.esPaisOrigen ? (
        <span className='flex items-center gap-1 text-sm text-green-600'>
          <Icons.check className='h-4 w-4' />
          Sí
        </span>
      ) : (
        <span className='text-muted-foreground text-sm'>No</span>
      )
    }
  },
  {
    id: 'mercado',
    accessorKey: 'mercado',
    header: 'Mercado',
    enableSorting: false,
    cell: ({ row }) => {
      const pais = row.original as PaisItem
      return pais.mercado ? (
        <span className='text-sm'>{pais.mercado.descripcion}</span>
      ) : (
        <span className='text-muted-foreground text-xs'>—</span>
      )
    }
  }
]
