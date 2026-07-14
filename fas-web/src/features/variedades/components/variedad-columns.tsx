'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type VariedadItem = MantenedorSimple & {
  especie?: { id: number; descripcion: string } | null
  grupoVariedad?: { id: number; descripcion: string } | null
}

export const variedadExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'especie',
    header: 'Especie',
    enableSorting: false,
    cell: ({ row }) => (row.original as VariedadItem).especie?.descripcion ?? '—'
  },
  {
    id: 'grupoVariedad',
    header: 'Grupo',
    enableSorting: false,
    cell: ({ row }) => {
      const gv = (row.original as VariedadItem).grupoVariedad
      return gv?.descripcion ?? <span className='text-muted-foreground text-xs'>Sin grupo</span>
    }
  }
]
