'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { integracionDetailOptions } from '../queries'
import { IntegracionFormSheet } from './integracion-form-sheet'
import { ParametrosTab } from './parametros-tab'

const ITEM = 'CONFIG_INTEGRACIONES'

export function IntegracionDetailClient({ id }: { id: number }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isPending } = useQuery(integracionDetailOptions(id))

  if (isPending || !data?.data) return <p className='text-sm text-muted-foreground'>Cargando...</p>
  const integracion = data.data

  return (
    <div className='max-w-4xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            {integracion.codigo} — {integracion.descripcion}
            <Badge variant={integracion.activo ? 'default' : 'secondary'}>
              {integracion.activo ? 'Activa' : 'Inactiva'}
            </Badge>
          </h2>
          <p className='text-sm text-muted-foreground'>{integracion.url || 'Sin URL configurada'}</p>
        </div>
        {puedeEscribir && (
          <Button variant='outline' onClick={() => setFormOpen(true)}>
            <Icons.edit className='mr-2 h-4 w-4' /> Editar
          </Button>
        )}
      </div>

      <div>
        <h3 className='mb-2 text-sm font-medium'>Parámetros</h3>
        <ParametrosTab integracionId={id} parametros={integracion.parametros} />
      </div>

      <IntegracionFormSheet item={integracion} open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
