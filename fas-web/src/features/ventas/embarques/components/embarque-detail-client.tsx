'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { embarqueDetailOptions } from '../queries'
import { SeleccionarPalletsTab } from './seleccionar-pallets-tab'
import { DespacharTab } from './despachar-tab'
import { SolicitudReservaTab } from './solicitud-reserva-tab'
import { ReclamosTab } from './reclamos-tab'

function TabPlaceholder({ titulo }: { titulo: string }) {
  return (
    <p className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
      {titulo} — próximamente.
    </p>
  )
}

export function EmbarqueDetailClient({ embarqueId }: { embarqueId: number }) {
  const searchParams = useSearchParams()
  const tabInicial = searchParams.get('tab') ?? 'espacio'

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
          <TabsTrigger value='espacio'>Solicitud de Reserva</TabsTrigger>
          <TabsTrigger value='pallets'>Seleccionar Pallets</TabsTrigger>
          <TabsTrigger value='instructivos'>Generar Instructivos</TabsTrigger>
          <TabsTrigger value='despacho'>Despachar</TabsTrigger>
          <TabsTrigger value='reclamos'>Reclamos</TabsTrigger>
        </TabsList>
        <TabsContent value='espacio'>
          <SolicitudReservaTab embarque={embarque} />
        </TabsContent>
        <TabsContent value='pallets'>
          <SeleccionarPalletsTab embarque={embarque} />
        </TabsContent>
        <TabsContent value='instructivos'>
          <TabPlaceholder titulo='Generar Instructivos' />
        </TabsContent>
        <TabsContent value='despacho'>
          <DespacharTab embarque={embarque} />
        </TabsContent>
        <TabsContent value='reclamos'>
          <ReclamosTab embarque={embarque} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
