'use client'

import { useQuery } from '@tanstack/react-query'
import { facturaPorIdOptions } from '../queries'
import { FacturaEditor } from './factura-editor'
import { FacturaDetalleView } from './factura-detalle-view'

// Enruta según el estado: BORRADOR abre el editor (valores/agrupación + emitir);
// EMITIDA/ANULADA muestra el detalle de solo lectura con cuotas y folio.
export function FacturaDetalleClient({ id }: { id: number }) {
  const { data, isPending, isError } = useQuery(facturaPorIdOptions(id))

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>
  if (isError || !data?.data) return <p className='text-destructive text-sm'>No se encontró la Factura.</p>

  return data.data.estado === 'BORRADOR' ? (
    <FacturaEditor factura={data.data} />
  ) : (
    <FacturaDetalleView factura={data.data} />
  )
}
