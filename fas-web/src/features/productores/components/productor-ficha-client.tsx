'use client'

import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePuedeLeer } from '@/hooks/use-item-acceso'
import { productorFichaOptions } from '../queries'
import { PrediosTab } from '../predios/components/predios-tab'
import { ContratosTab } from '../contratos/components/contratos-tab'
import { CuentaCorrienteTab } from '../cuenta-corriente/components/cuenta-corriente-tab'

export function ProductorFichaClient({ entidadId }: { entidadId: number }) {
  const searchParams = useSearchParams()
  // PROD-01: Contrato y Cuenta Corriente tienen permiso propio (PROD_CONTRATO /
  // PROD_CTA_CTE); ocultar la pestaña si el perfil no tiene ni siquiera LECTURA,
  // en vez de mostrarla vacía / disparar un 403 del backend.
  const puedeVerContrato = usePuedeLeer('PROD_CONTRATO')
  const puedeVerCtaCte = usePuedeLeer('PROD_CTA_CTE')
  // Si se pidió un tab por URL que el perfil no puede ver, caer a Predios
  // (siempre visible) en vez de dejar el contenedor de tabs en blanco.
  const tabPedido = searchParams.get('tab') ?? 'predios'
  const tabInicial =
    (tabPedido === 'contrato' && !puedeVerContrato) ||
    (tabPedido === 'cuenta-corriente' && !puedeVerCtaCte)
      ? 'predios'
      : tabPedido

  const { data, isPending } = useQuery(productorFichaOptions(entidadId))

  if (isPending || !data?.data) return <p className='text-sm text-muted-foreground'>Cargando...</p>
  const productor = data.data

  return (
    <div className='max-w-4xl space-y-4'>
      <div>
        <h2 className='flex items-center gap-2 text-xl font-semibold'>
          {productor.codigo} — {productor.razonSocial}
          <Badge variant={productor.activo ? 'default' : 'secondary'}>{productor.activo ? 'Activo' : 'Inactivo'}</Badge>
        </h2>
        <p className='text-sm text-muted-foreground'>{productor.descripcion}</p>
        {!productor.tieneRepresentanteLegal && (
          <p className='mt-1 text-sm text-destructive'>
            Sin representante legal registrado. Agrega un contacto marcado como representante legal (con RUT) antes de crear un contrato.
          </p>
        )}
      </div>

      <Tabs defaultValue={tabInicial}>
        <TabsList>
          <TabsTrigger value='predios'>Predios</TabsTrigger>
          {puedeVerContrato && <TabsTrigger value='contrato'>Contrato</TabsTrigger>}
          {puedeVerCtaCte && <TabsTrigger value='cuenta-corriente'>Cuenta Corriente</TabsTrigger>}
        </TabsList>
        <TabsContent value='predios'>
          <PrediosTab entidadId={entidadId} predios={productor.predios} />
        </TabsContent>
        {puedeVerContrato && (
          <TabsContent value='contrato'>
            <ContratosTab entidadId={entidadId} contratos={productor.contratos} tieneRepresentanteLegal={productor.tieneRepresentanteLegal} />
          </TabsContent>
        )}
        {puedeVerCtaCte && (
          <TabsContent value='cuenta-corriente'>
            <CuentaCorrienteTab entidadId={entidadId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
