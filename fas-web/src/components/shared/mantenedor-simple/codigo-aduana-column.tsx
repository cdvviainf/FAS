'use client'

import type { ColumnDef } from '@tanstack/react-table'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

// Columna compartida "Código SII" (codigoAduana) para los maestros del bloque
// Aduana (País, Puerto, Tipo de Embarque, Cláusula de Venta, Parámetro). Permite
// validar de un vistazo qué registros tienen su código de Aduana cargado — sin él
// no se puede emitir Guía de Despacho / Factura de Exportación al SII.
export const codigoAduanaColumn: ColumnDef<MantenedorSimple> = {
  id: 'codigoAduana',
  accessorKey: 'codigoAduana',
  header: 'Código SII',
  enableSorting: false,
  cell: ({ row }) => {
    const codigo = row.original.codigoAduana
    return codigo && codigo.trim() ? (
      <span className='font-mono text-xs'>{codigo}</span>
    ) : (
      <span className='text-muted-foreground text-xs'>— sin código</span>
    )
  },
}
