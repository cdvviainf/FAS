'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

type ClausulaVentaItem = MantenedorSimple & {
  requiereFlete?: boolean
  requiereSeguro?: boolean
}

// Estas 2 columnas son el motivo de existir de este mantenedor (2026-09-30):
// antes, como Parametro genérico, requiereFlete/requiereSeguro no eran
// visibles en ningún listado — solo se veían abriendo cada ítem a editar.
function badgeSiNo(valor: boolean | undefined) {
  return valor
    ? <Badge variant='default' className='text-xs'>Sí</Badge>
    : <Badge variant='outline' className='text-xs text-muted-foreground'>No</Badge>
}

export const clausulaVentaExtraColumns: ColumnDef<MantenedorSimple>[] = [
  {
    id: 'requiereFlete',
    header: 'Requiere Flete',
    enableSorting: false,
    cell: ({ row }) => badgeSiNo((row.original as ClausulaVentaItem).requiereFlete)
  },
  {
    id: 'requiereSeguro',
    header: 'Requiere Seguro',
    enableSorting: false,
    cell: ({ row }) => badgeSiNo((row.original as ClausulaVentaItem).requiereSeguro)
  }
]
