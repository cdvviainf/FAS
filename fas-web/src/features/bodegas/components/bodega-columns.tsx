'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Badge } from '@/components/ui/badge'

const TIPO_LABELS: Record<string, string> = {
  MATERIALES: 'Materiales',
  EMBARQUE: 'Embarque',
  DESPACHO: 'Despacho',
}

interface BodegaItem extends MantenedorSimple {
  direccion?: string
  tipos?: string[]
  comuna?: { id: number; descripcion: string; provincia?: { id: number; descripcion: string } }
}

export const bodegaExtraColumns: ColumnDef<BodegaItem>[] = [
  {
    id: 'comuna',
    header: 'Comuna',
    enableSorting: false,
    cell: ({ row }) => {
      const c = row.original.comuna
      if (!c) return <span className='text-muted-foreground text-sm'>—</span>
      return (
        <span className='text-sm'>
          {c.descripcion}
          {c.provincia && (
            <span className='text-muted-foreground text-xs ml-1'>({c.provincia.descripcion})</span>
          )}
        </span>
      )
    },
  },
  {
    id: 'tipos',
    header: 'Tipos',
    enableSorting: false,
    cell: ({ row }) => {
      const tipos = row.original.tipos ?? []
      if (tipos.length === 0) return <span className='text-muted-foreground text-sm'>—</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {tipos.map((t) => (
            <Badge key={t} variant='secondary' className='text-xs py-0'>
              {TIPO_LABELS[t] ?? t}
            </Badge>
          ))}
        </div>
      )
    },
  },
]
