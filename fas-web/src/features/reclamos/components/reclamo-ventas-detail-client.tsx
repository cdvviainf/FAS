'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { reclamoDetailOptions, reclamosKeys } from '../queries'
import { reclamosService } from '../service'
import { ESTADO_RECLAMO_LABELS, PROCEDENCIA_LABELS, TIPO_CALCULO_PROVISION_LABELS } from '../types'
import { ProvisionForm } from './provision-form'
import type { ProvisionInput } from '../types'

const ITEM_VALORIZACION = 'RECLAMO_VALORIZACION'
const ITEM_PROVISION = 'RECLAMO_PROVISION'

// Pantalla de Ventas (split Ventas/Calidad, 2026-09-23): Provisión y
// Valorización — el análisis (comentario + documentos) y el Veredicto Final
// son de Calidad (ver ReclamoDetailClient), acá solo se muestra de lectura
// para que Comercial sepa en qué quedó.
export function ReclamoVentasDetailClient({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const puedeValorizar = usePuedeEscribir(ITEM_VALORIZACION)
  const puedeProvisionar = usePuedeEscribir(ITEM_PROVISION)

  const { data, isPending } = useQuery(reclamoDetailOptions(id))
  const reclamo = data?.data

  const [valorConfirmado, setValorConfirmado] = useState('')
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionInput, setProvisionInput] = useState<ProvisionInput>({ tipoCalculo: 'POR_UNIDAD_CAJA' })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: reclamosKeys.detail(id) })
    queryClient.invalidateQueries({ queryKey: reclamosKeys.all })
  }

  const valorizar = useMutation({
    mutationFn: () => reclamosService.valorizar(id, Number(valorConfirmado)),
    onSuccess: () => { toast.success('Reclamo valorizado'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al valorizar'),
  })

  const anularValorizacion = useMutation({
    mutationFn: () => reclamosService.anularValorizacion(id),
    onSuccess: () => { toast.success('Valorización anulada'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al anular la valorización'),
  })

  const crearProvision = useMutation({
    mutationFn: () => reclamosService.crearProvision(id, provisionInput),
    onSuccess: () => { toast.success('Provisión creada'); setProvisionOpen(false); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al crear la Provisión'),
  })

  const reversarProvision = useMutation({
    mutationFn: (provisionId: number) => reclamosService.reversarProvision(provisionId),
    onSuccess: () => { toast.success('Provisión reversada'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al reversar'),
  })

  if (isPending || !reclamo) return <p className='text-muted-foreground text-sm'>Cargando...</p>

  const cajasTotales = reclamo.lineas.reduce((acc, l) => acc + l.cantidadCajas, 0)
  const noCerrado = reclamo.estado !== 'CERRADO'

  return (
    <div className='max-w-4xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Reclamo — Embarque {reclamo.embarque.numeroInstructivo}
            <Badge variant='outline'>{ESTADO_RECLAMO_LABELS[reclamo.estado]}</Badge>
          </h2>
          <p className='text-muted-foreground text-sm'>
            {reclamo.cliente.descripcion} · {reclamo.moneda.codigo} · {reclamo.fechaReclamo}
          </p>
          {reclamo.resumenCliente && <p className='mt-1 text-sm'>{reclamo.resumenCliente}</p>}
        </div>
      </div>

      {/* Líneas reclamadas */}
      <Card>
        <CardHeader><CardTitle className='text-sm'>Fruta reclamada ({cajasTotales} cajas)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pallet</TableHead>
                <TableHead>Especie</TableHead>
                <TableHead>Variedad</TableHead>
                <TableHead>Calibre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className='text-right'>Cajas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reclamo.lineas.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className='text-muted-foreground'>{l.palletLinea.pallet.numeroPallet}</TableCell>
                  <TableCell>{l.palletLinea.especie.descripcion}</TableCell>
                  <TableCell>{l.palletLinea.variedad.descripcion}</TableCell>
                  <TableCell>{l.palletLinea.calibre.descripcion}</TableCell>
                  <TableCell>{l.palletLinea.categoria.descripcion}</TableCell>
                  <TableCell className='text-right tabular-nums'>{l.cantidadCajas}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Provisiones */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-sm'>Provisiones</CardTitle>
          {puedeProvisionar && noCerrado && !provisionOpen && (
            <Button size='sm' variant='outline' onClick={() => setProvisionOpen(true)}>
              <Icons.add className='mr-1 h-4 w-4' /> Nueva Provisión
            </Button>
          )}
        </CardHeader>
        <CardContent className='space-y-3'>
          {provisionOpen && (
            <div className='space-y-2 rounded-md border p-3'>
              <ProvisionForm value={provisionInput} onChange={setProvisionInput} cajasDisponibles={cajasTotales} />
              <div className='flex gap-2'>
                <Button size='sm' onClick={() => crearProvision.mutate()} isLoading={crearProvision.isPending}>Guardar</Button>
                <Button size='sm' variant='ghost' onClick={() => setProvisionOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          {reclamo.provisiones.length === 0 ? (
            <p className='text-muted-foreground text-sm'>Sin provisiones.</p>
          ) : (
            reclamo.provisiones.map((p) => (
              <div key={p.id} className='flex items-center justify-between rounded-md border p-2 text-sm'>
                <div>
                  <span className='font-medium'>{reclamo.moneda.codigo} {p.montoCalculado}</span>
                  <span className='text-muted-foreground ml-2'>{TIPO_CALCULO_PROVISION_LABELS[p.tipoCalculo]}</span>
                </div>
                {p.estado === 'VIGENTE' ? (
                  puedeProvisionar && noCerrado && (
                    <Button size='sm' variant='ghost' onClick={() => reversarProvision.mutate(p.id)}>Reversar</Button>
                  )
                ) : (
                  <Badge variant='secondary'>Reversada</Badge>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Valorización */}
      {puedeValorizar && noCerrado && (
        <Card>
          <CardHeader><CardTitle className='text-sm'>Valorización</CardTitle></CardHeader>
          <CardContent className='flex items-end gap-3'>
            {reclamo.estado === 'VALORIZADO' ? (
              <>
                <p className='flex-1 text-sm'>
                  Valorizado: <span className='font-medium'>{reclamo.moneda.codigo} {reclamo.valorConfirmado}</span>
                </p>
                <Button variant='outline' onClick={() => anularValorizacion.mutate()} isLoading={anularValorizacion.isPending}>
                  Anular Valorización
                </Button>
              </>
            ) : (
              <>
                <div className='flex-1 space-y-1.5'>
                  <Label>Monto confirmado ({reclamo.moneda.codigo})</Label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={valorConfirmado}
                    onChange={(e) => setValorConfirmado(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => valorizar.mutate()}
                  disabled={valorConfirmado.trim() === ''}
                  isLoading={valorizar.isPending}
                >
                  Valorizar
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Veredicto de Calidad — solo lectura, lo gestiona Calidad (ver
          ReclamoDetailClient). */}
      <Card>
        <CardHeader><CardTitle className='text-sm'>Veredicto de Calidad</CardTitle></CardHeader>
        <CardContent className='text-sm'>
          {reclamo.estado === 'CERRADO' && reclamo.procedencia ? (
            <Badge variant='secondary'>{PROCEDENCIA_LABELS[reclamo.procedencia]}</Badge>
          ) : (
            <p className='text-muted-foreground'>Calidad aún no emite veredicto.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
