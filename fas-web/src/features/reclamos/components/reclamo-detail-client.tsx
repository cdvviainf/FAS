'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { reclamoDetailOptions, reclamosKeys } from '../queries'
import { reclamosService } from '../service'
import {
  ESTADO_RECLAMO_LABELS,
  PROCEDENCIA_LABELS,
  TIPO_CALCULO_PROVISION_LABELS,
} from '../types'
import type { Procedencia } from '../types'
import { ProvisionForm } from './provision-form'
import type { ProvisionInput } from '../types'

const ITEM_ANALISIS = 'CAL_RECLAMOS'
const ITEM_VALORIZACION = 'RECLAMO_VALORIZACION'
const ITEM_CIERRE = 'RECLAMO_CIERRE'
const ITEM_PROVISION = 'RECLAMO_PROVISION'

export function ReclamoDetailClient({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const puedeAnalizar = usePuedeEscribir(ITEM_ANALISIS)
  const puedeValorizar = usePuedeEscribir(ITEM_VALORIZACION)
  const puedeCerrar = usePuedeEscribir(ITEM_CIERRE)
  const puedeProvisionar = usePuedeEscribir(ITEM_PROVISION)

  const { data, isPending } = useQuery(reclamoDetailOptions(id))
  const reclamo = data?.data

  const [comentario, setComentario] = useState('')
  const [comentarioTocado, setComentarioTocado] = useState(false)
  const [valorConfirmado, setValorConfirmado] = useState('')
  const [procedencia, setProcedencia] = useState<Procedencia | ''>('')
  const [provisionOpen, setProvisionOpen] = useState(false)
  const [provisionInput, setProvisionInput] = useState<ProvisionInput>({ tipoCalculo: 'POR_UNIDAD_CAJA' })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: reclamosKeys.detail(id) })
    queryClient.invalidateQueries({ queryKey: reclamosKeys.all })
  }

  const guardarAnalisis = useMutation({
    mutationFn: () => reclamosService.actualizarAnalisis(id, comentario),
    onSuccess: () => { toast.success('Análisis guardado'); setComentarioTocado(false); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar'),
  })

  const subirDocumento = useMutation({
    mutationFn: (file: File) => reclamosService.subirDocumento(id, file),
    onSuccess: () => { toast.success('Documento subido'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al subir el documento'),
  })

  const eliminarDocumento = useMutation({
    mutationFn: (documentoId: number) => reclamosService.eliminarDocumento(id, documentoId),
    onSuccess: () => { toast.success('Documento eliminado'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al eliminar'),
  })

  const valorizar = useMutation({
    mutationFn: () => reclamosService.valorizar(id, Number(valorConfirmado)),
    onSuccess: () => { toast.success('Reclamo valorizado'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al valorizar'),
  })

  const cerrar = useMutation({
    mutationFn: () => reclamosService.cerrar(id, procedencia as Procedencia),
    onSuccess: () => { toast.success('Reclamo cerrado'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al cerrar'),
  })

  const reabrir = useMutation({
    mutationFn: () => reclamosService.reabrir(id),
    onSuccess: () => { toast.success('Reclamo reabierto'); invalidar() },
    onError: (e: Error) => toast.error(e.message || 'Error al reabrir'),
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
  const comentarioActual = comentarioTocado ? comentario : reclamo.comentarioCalidad ?? ''

  return (
    <div className='max-w-4xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Reclamo — Embarque {reclamo.embarque.numeroInstructivo}
            <Badge variant='outline'>{ESTADO_RECLAMO_LABELS[reclamo.estado]}</Badge>
            {reclamo.procedencia && <Badge variant='secondary'>{PROCEDENCIA_LABELS[reclamo.procedencia]}</Badge>}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {reclamo.cliente.descripcion} · {reclamo.moneda.codigo} · {reclamo.fechaReclamo ?? 'sin fecha'}
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

      {/* Análisis de Calidad */}
      <Card>
        <CardHeader><CardTitle className='text-sm'>Análisis de Calidad</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          <div className='space-y-1.5'>
            <Label>Comentario</Label>
            <Textarea
              rows={3}
              value={comentarioActual}
              disabled={!puedeAnalizar || !noCerrado}
              onChange={(e) => { setComentario(e.target.value); setComentarioTocado(true) }}
            />
            {puedeAnalizar && noCerrado && (
              <Button size='sm' onClick={() => guardarAnalisis.mutate()} isLoading={guardarAnalisis.isPending}>
                Guardar comentario
              </Button>
            )}
          </div>

          <div className='space-y-1.5'>
            <Label>Documentos</Label>
            {puedeAnalizar && noCerrado && (
              <Input
                type='file'
                onChange={(e) => { const f = e.target.files?.[0]; if (f) subirDocumento.mutate(f) }}
              />
            )}
            {reclamo.documentos.length === 0 ? (
              <p className='text-muted-foreground text-sm'>Sin documentos.</p>
            ) : (
              <div className='space-y-1'>
                {reclamo.documentos.map((d) => (
                  <div key={d.id} className='flex items-center justify-between rounded-md border p-2 text-sm'>
                    <a href={reclamosService.urlDescargaDocumento(id, d.id)} className='text-primary hover:underline' target='_blank' rel='noreferrer'>
                      {d.nombre}
                    </a>
                    <div className='text-muted-foreground flex items-center gap-2 text-xs'>
                      {(d.tamano / 1024).toFixed(0)} KB
                      {puedeAnalizar && noCerrado && (
                        <Button variant='ghost' size='icon' className='h-6 w-6' onClick={() => eliminarDocumento.mutate(d.id)}>
                          <Icons.trash className='h-3.5 w-3.5' />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
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
            <div className='flex-1 space-y-1.5'>
              <Label>Monto confirmado ({reclamo.moneda.codigo})</Label>
              <Input
                type='number'
                min={0}
                step='0.01'
                value={valorConfirmado || reclamo.valorConfirmado || ''}
                onChange={(e) => setValorConfirmado(e.target.value)}
              />
            </div>
            <Button onClick={() => valorizar.mutate()} isLoading={valorizar.isPending}>Valorizar</Button>
          </CardContent>
        </Card>
      )}
      {reclamo.valorConfirmado != null && (
        <p className='text-muted-foreground text-sm'>Valorizado: {reclamo.moneda.codigo} {reclamo.valorConfirmado}</p>
      )}

      {/* Cierre — solo se puede cerrar desde VALORIZADO (R5/IMP-QA-R1-020);
          antes de eso, el backend igual lo rechaza (422), pero no tiene
          sentido ofrecer el control. */}
      {puedeCerrar && (
        <Card>
          <CardHeader><CardTitle className='text-sm'>Cierre</CardTitle></CardHeader>
          <CardContent className='flex items-end gap-3'>
            {reclamo.estado === 'VALORIZADO' ? (
              <>
                <div className='flex-1 space-y-1.5'>
                  <Label>Procedencia</Label>
                  <Select value={procedencia} onValueChange={(v) => setProcedencia(v as Procedencia)}>
                    <SelectTrigger><SelectValue placeholder='Selecciona...' /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PROCEDENCIA_LABELS) as Procedencia[]).map((p) => (
                        <SelectItem key={p} value={p}>{PROCEDENCIA_LABELS[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => cerrar.mutate()} disabled={!procedencia} isLoading={cerrar.isPending}>Cerrar Reclamo</Button>
              </>
            ) : reclamo.estado === 'CERRADO' ? (
              <Button variant='outline' onClick={() => reabrir.mutate()} isLoading={reabrir.isPending}>Reabrir Reclamo</Button>
            ) : (
              <p className='text-muted-foreground text-sm'>Valoriza el Reclamo antes de poder cerrarlo.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
