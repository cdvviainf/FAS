'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'
import { Badge } from '@/components/ui/badge'

type ConceptoItem = MantenedorSimple & {
  naturaleza?: 'DEBE' | 'HABER' | 'AMBOS'
}

const naturalezaLabel: Record<string, string> = {
  DEBE: 'Debe',
  HABER: 'Haber',
  AMBOS: 'Ambos',
}

export const conceptoExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'naturaleza',
    header: 'Naturaleza',
    enableSorting: false,
    cell: ({ row }) => {
      const nat = (row.original as ConceptoItem).naturaleza
      if (!nat) return '—'
      return <Badge variant='outline'>{naturalezaLabel[nat] ?? nat}</Badge>
    }
  },
]
