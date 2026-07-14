'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type ParametroItem = MantenedorSimple & {
  tipoParametro?: { id: number; descripcion: string } | null
}

export const parametroExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'tipoParametro',
    header: 'Tipo de Parámetro',
    enableSorting: false,
    cell: ({ row }) => (row.original as ParametroItem).tipoParametro?.descripcion ?? '—'
  }
]
