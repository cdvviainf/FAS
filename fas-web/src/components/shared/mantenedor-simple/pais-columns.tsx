'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Icons } from '@/components/icons'

// Pais has extra fields esPaisNacional/puedeSerOrigen y mercados (N:M, Fase 2b:
// un país puede pertenecer a varios Mercados por empresa — ver MercadoPais).
export interface PaisItem extends MantenedorSimple {
  esPaisNacional?: boolean
  puedeSerOrigen?: boolean
  mercados?: { id: number; descripcion: string }[]
}

export const paisExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'esPaisNacional',
    accessorKey: 'esPaisNacional',
    header: 'Nacional',
    enableSorting: false,
    cell: ({ row }) => {
      const pais = row.original as PaisItem
      return pais.esPaisNacional ? (
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
    id: 'puedeSerOrigen',
    accessorKey: 'puedeSerOrigen',
    header: 'Puede ser Origen',
    enableSorting: false,
    cell: ({ row }) => {
      const pais = row.original as PaisItem
      return pais.puedeSerOrigen ? (
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
    accessorKey: 'mercados',
    header: 'Mercado',
    enableSorting: false,
    cell: ({ row }) => {
      const pais = row.original as PaisItem
      const mercados = pais.mercados ?? []
      return mercados.length > 0 ? (
        <span className='text-sm'>{mercados.map((m) => m.descripcion).join(', ')}</span>
      ) : (
        <span className='text-muted-foreground text-xs'>—</span>
      )
    }
  }
]
