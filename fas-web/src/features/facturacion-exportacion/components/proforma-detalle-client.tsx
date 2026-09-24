'use client'

import { useQuery } from '@tanstack/react-query'
import { proformaPorIdOptions } from '../queries'
import { ProformaDetalleView } from './proforma-detalle-view'

// Detalle histórico por id de Proforma (FAS-PROF-EXP-003, QA ronda 2) — a
// diferencia de ProformaEmbarqueClient (que solo resuelve la activa del
// Embarque), esta pantalla trae la Proforma sea cual sea su estado, para que
// el listado pueda enlazar también las ANULADAS.
export function ProformaDetalleClient({ id }: { id: number }) {
  const { data, isPending, isError } = useQuery(proformaPorIdOptions(id))

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando...</p>
  if (isError || !data?.data) return <p className='text-destructive text-sm'>No se encontró la Proforma.</p>

  return <ProformaDetalleView proforma={data.data} />
}
