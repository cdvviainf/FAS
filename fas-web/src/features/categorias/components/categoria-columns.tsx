'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type CategoriaItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
  orden?: number | null
}

export const categoriaExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: 'Especie',
    enableSorting: false,
    cell: ({ row }) => (row.original as CategoriaItem).especie?.descripcion ?? '—'
  },
  {
    id: 'orden',
    header: 'Orden',
    enableSorting: false,
    cell: ({ row }) => {
      const orden = (row.original as CategoriaItem).orden
      return orden != null ? <span className='font-mono text-xs'>{orden}</span> : '—'
    }
  }
]
