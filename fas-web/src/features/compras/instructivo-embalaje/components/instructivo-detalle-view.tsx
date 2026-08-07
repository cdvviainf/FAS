'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { instructivoEmbalajeDetailOptions } from '../queries'

export function InstructivoDetalleView({ id }: { id: number }) {
  const { data, isLoading } = useQuery(instructivoEmbalajeDetailOptions(id))

  if (isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }
  if (!data) return null

  const instructivo = data.data

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Instructivo de Embalaje N° {instructivo.numero}</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2 text-sm'>
          <p><span className='text-muted-foreground'>Cierre Comercial:</span> Folio {instructivo.notaVenta.folio} — {instructivo.notaVenta.cliente.descripcion}</p>
          <p><span className='text-muted-foreground'>Emitido:</span> {new Date(instructivo.creadoEn).toLocaleString('es-CL')}</p>
          <p><span className='text-muted-foreground'>Emitido por:</span> {instructivo.creadoPor}</p>
          <Badge variant='secondary'>Documento emitido — no editable</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalle — qué embalar</CardTitle>
        </CardHeader>
        <CardContent className='space-y-2'>
          {instructivo.detalle.map((d) => (
            <div key={d.id} className='flex flex-wrap items-center gap-2 border-b pb-2 text-sm last:border-b-0 last:pb-0'>
              <span className='font-medium'>{d.especie.descripcion} / {d.variedad.descripcion}</span>
              <span className='text-muted-foreground'>{d.articulo.codigo} — {d.articulo.descripcion}</span>
              <span className='text-muted-foreground'>· {d.categoria.descripcion}</span>
              <span className='text-muted-foreground'>· Calibre {d.calibreMin.descripcion} a {d.calibreMax.descripcion}</span>
              <span className='ml-auto text-muted-foreground'>{d.cantidadPallets} pallets · {d.cajas} cajas</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
