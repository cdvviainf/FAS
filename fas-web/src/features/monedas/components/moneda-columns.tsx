'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'

type MonedaItem = MantenedorSimple & {
  esMonedaBase?: boolean
  decimales?: number
}

export const monedaExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'esMonedaBase',
    header: 'Base',
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original as MonedaItem
      return item.esMonedaBase
        ? <Badge className='text-xs'><Icons.check className='mr-1 h-3 w-3' />Moneda base</Badge>
        : <span className='text-muted-foreground text-xs'>—</span>
    }
  },
  {
    id: 'decimales',
    header: 'Decimales',
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original as MonedaItem
      return item.decimales !== undefined ? String(item.decimales) : '—'
    }
  },
]
