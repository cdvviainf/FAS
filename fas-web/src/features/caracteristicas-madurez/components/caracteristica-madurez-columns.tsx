'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { TIPO_DATO_MADUREZ_LABELS, type TipoDatoMadurez } from './caracteristica-madurez-form-sheet'

type Item = MantenedorSimple & {
  tipoDato?: TipoDatoMadurez
  unidad?: { id: number; descripcion: string } | null
  especies?: { especieId: number; especie: { id: number; descripcion: string } }[]
}

export const caracteristicaMadurezExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'tipoDato',
    header: () => 'Tipo de dato',
    meta: { label: 'Tipo de dato' },
    enableSorting: false,
    cell: ({ row }) => {
      const t = (row.original as Item).tipoDato
      return t ? TIPO_DATO_MADUREZ_LABELS[t] : '—'
    },
  },
  {
    id: 'unidad',
    header: () => 'Unidad',
    meta: { label: 'Unidad' },
    enableSorting: false,
    cell: ({ row }) => (row.original as Item).unidad?.descripcion ?? '—',
  },
  {
    id: 'especies',
    header: () => 'Especies',
    meta: { label: 'Especies' },
    enableSorting: false,
    cell: ({ row }) => {
      const especies = (row.original as Item).especies ?? []
      if (especies.length === 0) return <span className='text-muted-foreground'>Todas</span>
      return (
        <div className='flex flex-wrap gap-1'>
          {especies.map((e) => (
            <Badge key={e.especieId} variant='outline' className='text-xs'>{e.especie.descripcion}</Badge>
          ))}
        </div>
      )
    },
  },
]
