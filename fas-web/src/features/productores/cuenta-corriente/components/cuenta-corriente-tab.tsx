'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { cuentaCorrienteService } from '../service'
import { MovimientoCCFormSheet } from './movimiento-cc-form-sheet'

const ITEM = 'productores.cuenta-corriente'
const fmt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' })
const fmtMoneda = new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function CuentaCorrienteTab({ entidadId }: { entidadId: number }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isPending } = useQuery({
    queryKey: ['cuenta-corriente', entidadId],
    queryFn: () => cuentaCorrienteService.getInforme(entidadId),
  })

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='rounded-md border px-4 py-2'>
          <span className='text-sm text-muted-foreground'>Saldo: </span>
          <span className={`text-lg font-semibold ${data && data.data.saldo < 0 ? 'text-destructive' : ''}`}>
            {isPending ? '...' : fmtMoneda.format(data?.data.saldo ?? 0)}
          </span>
        </div>
        {puedeEscribir && (
          <Button onClick={() => setFormOpen(true)}>
            <Icons.add className='mr-2 h-4 w-4' /> Nuevo Movimiento
          </Button>
        )}
      </div>

      {isPending ? (
        <p className='text-sm text-muted-foreground'>Cargando...</p>
      ) : (data?.data.movimientos ?? []).length === 0 ? (
        <p className='text-sm text-muted-foreground'>Sin movimientos registrados.</p>
      ) : (
        <div className='space-y-1'>
          {data!.data.movimientos.map((m) => (
            <div key={m.id} className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'>
              <div>
                <span className='font-medium'>{m.tipo.descripcion}</span>
                {m.glosa && <span className='text-muted-foreground'> — {m.glosa}</span>}
                <p className='text-xs text-muted-foreground'>{fmt.format(new Date(m.fecha))}{m.referencia ? ` · ${m.referencia}` : ''}</p>
              </div>
              <Badge variant={m.naturaleza === 'HABER' ? 'default' : 'secondary'}>
                {m.naturaleza === 'HABER' ? '+' : '-'} {fmtMoneda.format(Number(m.monto))}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <MovimientoCCFormSheet entidadId={entidadId} open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
