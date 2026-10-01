'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type TipoReclamoItem = MantenedorSimple & {
  generaAnalisisCalidad?: boolean
}

function badgeSiNo(valor: boolean | undefined) {
  return valor
    ? <Badge variant='default' className='text-xs'>Sí</Badge>
    : <Badge variant='outline' className='text-xs text-muted-foreground'>No</Badge>
}

export const tipoReclamoExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'generaAnalisisCalidad',
    header: 'Genera análisis de Calidad',
    enableSorting: false,
    cell: ({ row }) => badgeSiNo((row.original as TipoReclamoItem).generaAnalisisCalidad)
  }
]
