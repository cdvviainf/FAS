'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Badge } from '@/components/ui/badge'

type PuertoItem = MantenedorSimple & {
  pais?: { id: number; descripcion: string; codigo: string; esPaisOrigen: boolean } | null
  tipoEmbarque?: { id: number; descripcion: string } | null
  latitud?: number | null
  longitud?: number | null
}

export const puertoExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'pais',
    header: 'País',
    enableSorting: false,
    cell: ({ row }) => {
      const item = row.original as PuertoItem
      if (!item.pais) return '—'
      return (
        <span className='flex items-center gap-1.5'>
          <span className='font-mono text-xs text-muted-foreground'>{item.pais.codigo}</span>
          {item.pais.descripcion}
          {item.pais.esPaisOrigen && (
            <Badge variant='outline' className='text-xs py-0'>Origen</Badge>
          )}
        </span>
      )
    }
  },
  {
    id: 'tipoEmbarque',
    header: 'Tipo Embarque',
    enableSorting: false,
    cell: ({ row }) => (row.original as PuertoItem).tipoEmbarque?.descripcion ?? '—'
  },
]
