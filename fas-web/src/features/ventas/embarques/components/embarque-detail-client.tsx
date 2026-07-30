'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { embarqueDetailOptions } from '../queries'

function TabPlaceholder({ titulo }: { titulo: string }) {
  return (
    <p className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
      {titulo} — próximamente.
    </p>
  )
}

export function EmbarqueDetailClient({ embarqueId }: { embarqueId: number }) {
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab') ?? 'reserva'

  const { data, isPending } = useQuery(embarqueDetailOptions(embarqueId))

  if (isPending || !data?.data) return <p className='text-sm text-muted-foreground'>Cargando...</p>
  const embarque = data.data

  return (
    <div className='max-w-4xl space-y-4'>
      <div>
        <h2 className='text-xl font-semibold'>Embarque {embarque.numeroInstructivo}</h2>
        <p className='text-sm text-muted-foreground'>
          Cierre Comercial Folio {embarque.notaVenta.folio}
        </p>
      </div>

      <Tabs defaultValue={tabInicial}>
        <TabsList>
          <TabsTrigger value='reserva'>Solicitud de Reserva</TabsTrigger>
          <TabsTrigger value='instructivo'>Generación de Instructivo</TabsTrigger>
          <TabsTrigger value='seleccion-fruta'>Selección de Fruta</TabsTrigger>
          <TabsTrigger value='confirmacion-fruta'>Confirmación de Fruta</TabsTrigger>
        </TabsList>
        <TabsContent value='reserva'>
          <TabPlaceholder titulo='Solicitud de Reserva' />
        </TabsContent>
        <TabsContent value='instructivo'>
          <TabPlaceholder titulo='Generación de Instructivo' />
        </TabsContent>
        <TabsContent value='seleccion-fruta'>
          <TabPlaceholder titulo='Selección de Fruta' />
        </TabsContent>
        <TabsContent value='confirmacion-fruta'>
          <TabPlaceholder titulo='Confirmación de Fruta' />
        </TabsContent>
      </Tabs>
    </div>
  )
}
