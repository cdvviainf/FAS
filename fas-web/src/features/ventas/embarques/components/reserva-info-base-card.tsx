'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { semanaISO } from '@/lib/format'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import type { EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const NINGUNO = '__NINGUNO__'
const tiposParametroService = createMantenedorService('tipos-parametro')
const parametrosService = createMantenedorService('parametros')

function especiesDistintas(embarque: EmbarqueDetalle): string {
  const set = new Set(embarque.notaVenta.detalles.map((d) => d.especie.descripcion))
  return set.size > 0 ? [...set].join(', ') : '—'
}

export function ReservaInfoBaseCard({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()

  const [fechaCompromiso, setFechaCompromiso] = useState(embarque.fechaCompromiso ? embarque.fechaCompromiso.slice(0, 10) : '')
  const [temperatura, setTemperatura] = useState(embarque.temperatura != null ? String(embarque.temperatura) : '')
  const [cbm, setCbm] = useState(embarque.cbm != null ? String(embarque.cbm) : '')
  const [tipoBlId, setTipoBlId] = useState<string>(embarque.tipoBlId != null ? String(embarque.tipoBlId) : NINGUNO)

  const { data: tiposParam } = useQuery({
    queryKey: ['tipos-parametro-options'],
    queryFn: () => tiposParametroService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  })
  const tipoBlTipoId = tiposParam?.data.find((t) => t.codigo === 'TIPO_BL')?.id
  const { data: tiposBl } = useQuery({
    queryKey: ['parametros-options', tipoBlTipoId],
    queryFn: () => parametrosService.list({ limit: 200, tipoParametroId: tipoBlTipoId }),
    staleTime: 5 * 60_000,
    enabled: !!tipoBlTipoId,
  })

  const guardar = useMutation({
    mutationFn: () =>
      embarquesService.guardarDatosReservaBase(embarque.id, {
        fechaCompromiso: fechaCompromiso || null,
        temperatura: temperatura !== '' ? Math.trunc(Number(temperatura)) : null,
        cbm: cbm !== '' ? Math.trunc(Number(cbm)) : null,
        tipoBlId: tipoBlId !== NINGUNO ? Number(tipoBlId) : null,
      }),
    onSuccess: () => {
      toast.success('Información de reserva guardada')
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar'),
  })

  const semana = semanaISO(fechaCompromiso)

  return (
    <Card>
      <CardHeader><CardTitle className='text-sm'>Información base de la reserva</CardTitle></CardHeader>
      <CardContent className='space-y-4'>
        {/* Derivados de la Nota de Venta (solo lectura) */}
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <div>
            <p className='text-muted-foreground text-[10.5px] tracking-wide uppercase'>Tipo de Embarque</p>
            <p className='text-sm'>{embarque.notaVenta.tipoEmbarque?.descripcion ?? '—'}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-[10.5px] tracking-wide uppercase'>Puerto de Destino</p>
            <p className='text-sm'>{embarque.notaVenta.puertoDestino?.descripcion ?? '—'}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-[10.5px] tracking-wide uppercase'>Especie</p>
            <p className='text-sm'>{especiesDistintas(embarque)}</p>
          </div>
          <div>
            <p className='text-muted-foreground text-[10.5px] tracking-wide uppercase'>Consignatario</p>
            <p className='text-sm'>{embarque.notaVenta.consignatario?.razonSocial ?? '—'}</p>
          </div>
        </div>

        {/* Capturables */}
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <div className='space-y-1.5'>
            <Label>Fecha de compromiso</Label>
            <Input type='date' value={fechaCompromiso} onChange={(e) => setFechaCompromiso(e.target.value)} disabled={!puedeEscribir} />
            {semana != null && <p className='text-muted-foreground text-xs'>Semana {semana}</p>}
          </div>
          <div className='space-y-1.5'>
            <Label>Temperatura (°C)</Label>
            <Input type='number' step='1' value={temperatura} onChange={(e) => setTemperatura(e.target.value)} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>CBM</Label>
            <Input type='number' step='1' min={0} value={cbm} onChange={(e) => setCbm(e.target.value)} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Tipo de BL</Label>
            <Select value={tipoBlId} onValueChange={setTipoBlId} disabled={!puedeEscribir}>
              <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NINGUNO}>—</SelectItem>
                {(tiposBl?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {puedeEscribir && (
          <Button onClick={() => guardar.mutate()} isLoading={guardar.isPending} size='sm'>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar información base
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
