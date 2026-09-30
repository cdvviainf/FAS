'use client'

import { useQuery } from '@tanstack/react-query'
import { facturaPorIdOptions } from '../queries'
import { FacturaEditor } from './factura-editor'
import { FacturaDetalleView } from './factura-detalle-view'

// Enruta según el estado: BORRADOR/RECHAZADA abren el editor (valores/agrupación
// + flujo SII); APROBADA/ANULADA muestran el detalle de solo lectura.
export function FacturaDetalleClient({ id }: { id: number }) {
  const { data, isPending, isError } = useQuery(facturaPorIdOptions(id))

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>
  if (isError || !data?.data) return <p className='text-destructive text-sm'>No se encontró la Factura.</p>

  const editable = data.data.estado === 'BORRADOR' || data.data.estado === 'RECHAZADA'
  return editable ? <FacturaEditor factura={data.data} /> : <FacturaDetalleView factura={data.data} />
}
