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
          <TabsTrigger value='espacio'>Solicitud de Espacio</TabsTrigger>
          <TabsTrigger value='pallets'>Seleccionar Pallets</TabsTrigger>
          <TabsTrigger value='instructivos'>Generar Instructivos</TabsTrigger>
          <TabsTrigger value='despacho'>Despachar</TabsTrigger>
        </TabsList>
        <TabsContent value='espacio'>
          <TabPlaceholder titulo='Solicitud de Espacio' />
        </TabsContent>
        <TabsContent value='pallets'>
          <TabPlaceholder titulo='Seleccionar Pallets' />
        </TabsContent>
        <TabsContent value='instructivos'>
          <TabPlaceholder titulo='Generar Instructivos' />
        </TabsContent>
        <TabsContent value='despacho'>
          <TabPlaceholder titulo='Despachar' />
        </TabsContent>
      </Tabs>
    </div>
  )
}
