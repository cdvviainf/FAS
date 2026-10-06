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
import { formatFechaCorta } from '@/lib/format'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { reclamoDetailOptions, reclamosKeys } from '../queries'
import { reclamosService } from '../service'
import {
  ESTADO_RECLAMO_LABELS,
  PROCEDENCIA_LABELS,
  TIPO_CALCULO_PROVISION_LABELS,
  numeroContenedorDeReclamo,
} from '../types'
import type { Procedencia, ReclamoDefectoInput } from '../types'

const gruposDefectoService = createMantenedorService('grupos-defecto')
const defectosService = createMantenedorService('defectos')

// Fila del catálogo de defectos (el service genérico devuelve grupoDefecto +
// especies en la fila de 'defectos').
interface DefectoOption {
  id: number
  descripcion: string
  grupoDefecto?: { id: number } | null
  especies?: { especieId: number }[]
}

const ITEM_ANALISIS = 'CAL_RECLAMOS'
const ITEM_CIERRE = 'RECLAMO_CIERRE'

// Pantalla de Calidad (split Ventas/Calidad, 2026-09-23): Análisis (comentario
// + documentos) y Veredicto Final/Cierre — Provisión y Valorización son de
// Comercial (ver ReclamoVentasDetailClient) y acá se muestran solo de lectura
// para que Calidad sepa qué hizo la otra área.
export function ReclamoDetailClient({ id }: { id: number }) {
  const queryClient = useQueryClient()
  const puedeAnalizar = usePuedeEscribir(ITEM_ANALISIS)
  const puedeCerrar = usePuedeEscribir(ITEM_CIERRE)

  const { data, isPending } = useQuery(reclamoDetailOptions(id))
  const reclamo = data?.data

  const [comentario, setComentario] = useState('')
  const [comentarioTocado, setComentarioTocado] = useState(false)
  const [procedencia, setProcedencia] = useState<Procedencia | ''>('')

  // Clasificación (GrupoDefecto) y líneas de defecto — patrón "tocado" (sin
  // useEffect, consistente con el comentario): mientras no se edita, se derivan
  // del reclamo cargado; al editar, mandan los estados locales.
  const [clasifState, setClasifState] = useState<number | null>(null)
  const [defectosState, setDefectosState] = useState<ReclamoDefectoInput[]>([])
  const [analisisTocado, setAnalisisTocado] = useState(false)
  // Editor de una línea de defecto nueva.
  const [lineaGrupoId, setLineaGrupoId] = useState<number | null>(null)
  const [lineaDefectoId, setLineaDefectoId] = useState<number | null>(null)
  const [lineaPorcentaje, setLineaPorcentaje] = useState('')

  const { data: gruposData } = useQuery({
    queryKey: ['grupos-defecto-options'],
    queryFn: () => gruposDefectoService.list({ soloActivos: true, limit: 300 }),
    staleTime: 5 * 60_000,
  })
  const { data: defectosData } = useQuery({
    queryKey: ['defectos-options'],
    queryFn: () => defectosService.list({ soloActivos: true, limit: 500 }),
    staleTime: 5 * 60_000,
  })
  const grupos = (gruposData?.data ?? []) as { id: number; descripcion: string }[]
  const defectos = (defectosData?.data ?? []) as unknown as DefectoOption[]

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: reclamosKeys.detail(id) })
    queryClient.invalidateQueries({ queryKey: reclamosKeys.all })
  }

  const guardarAnalisis = useMutation({
    mutationFn: (payload: { comentarioCalidad: string; grupoDefectoId: number | null; defectos: ReclamoDefectoInput[] }) =>
      reclamosService.actualizarAnalisis(id, payload),
    onSuccess: () => {
      toast.success('Análisis guardado')
      setComentarioTocado(false)
      setAnalisisTocado(false)
      invalidar()
    },
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

  if (isPending || !reclamo) return <p className='text-muted-foreground text-sm'>Cargando...</p>

  const cajasTotales = reclamo.lineas.reduce((acc, l) => acc + l.cantidadCajas, 0)
  const noCerrado = reclamo.estado !== 'CERRADO'
  const comentarioActual = comentarioTocado ? comentario : reclamo.comentarioCalidad ?? ''
  const provisionVigente = reclamo.provisiones.find((p) => p.estado === 'VIGENTE')
  const contenedor = numeroContenedorDeReclamo(reclamo)

  // Clasificación y líneas de defecto efectivas (derivadas del reclamo mientras
  // no se editó; de los estados locales una vez tocado).
  const clasifActual = analisisTocado ? clasifState : reclamo.grupoDefectoId
  const defectosActuales: ReclamoDefectoInput[] = analisisTocado
    ? defectosState
    : reclamo.defectos.map((d) => ({ grupoDefectoId: d.grupoDefecto.id, defectoId: d.defecto.id, porcentaje: Number(d.porcentaje) }))

  // Especies de la fruta reclamada (para filtrar el catálogo de Defecto por
  // especie — incluye los defectos genéricos sin especie asignada).
  const reclamoEspecieIds = new Set(reclamo.lineas.map((l) => l.palletLinea.especie.id))
  const defectosDelGrupo = defectos.filter((d) => {
    if (lineaGrupoId == null || d.grupoDefecto?.id !== lineaGrupoId) return false
    const esp = d.especies ?? []
    return esp.length === 0 || esp.some((e) => reclamoEspecieIds.has(e.especieId))
  })

  function nombreGrupo(gid: number) { return grupos.find((g) => g.id === gid)?.descripcion ?? String(gid) }
  function nombreDefecto(did: number) { return defectos.find((d) => d.id === did)?.descripcion ?? String(did) }

  function setAnalisis(fn: (prev: { clasif: number | null; defectos: ReclamoDefectoInput[] }) => { clasif: number | null; defectos: ReclamoDefectoInput[] }) {
    const base = { clasif: clasifActual, defectos: defectosActuales }
    const next = fn(base)
    setClasifState(next.clasif)
    setDefectosState(next.defectos)
    setAnalisisTocado(true)
  }

  function agregarLineaDefecto() {
    if (lineaGrupoId == null || lineaDefectoId == null || lineaPorcentaje === '') return
    const pct = Number(lineaPorcentaje)
    if (Number.isNaN(pct) || pct < 0 || pct > 100) { toast.error('El porcentaje debe estar entre 0 y 100'); return }
    if (defectosActuales.some((d) => d.grupoDefectoId === lineaGrupoId && d.defectoId === lineaDefectoId)) {
      toast.error('Ese defecto ya está en el detalle'); return
    }
    setAnalisis((p) => ({ ...p, defectos: [...p.defectos, { grupoDefectoId: lineaGrupoId, defectoId: lineaDefectoId, porcentaje: pct }] }))
    setLineaGrupoId(null); setLineaDefectoId(null); setLineaPorcentaje('')
  }

  function quitarLineaDefecto(idx: number) {
    setAnalisis((p) => ({ ...p, defectos: p.defectos.filter((_, i) => i !== idx) }))
  }

  return (
    <div className='max-w-4xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Reclamo <span className='font-mono'>{reclamo.codigo}</span>
            <Badge variant='outline'>{ESTADO_RECLAMO_LABELS[reclamo.estado]}</Badge>
            {reclamo.procedencia && <Badge variant='secondary'>{PROCEDENCIA_LABELS[reclamo.procedencia]}</Badge>}
            {reclamo.tipoReclamo && <Badge variant='outline'>{reclamo.tipoReclamo.descripcion}</Badge>}
            {reclamo.grupoDefecto && <Badge variant='secondary'>{reclamo.grupoDefecto.descripcion}</Badge>}
          </h2>
          <p className='text-muted-foreground text-sm'>
            Embarque {reclamo.embarque.numeroInstructivo}
            {contenedor && <> · Contenedor {contenedor}</>}
            {' '}· {reclamo.cliente.descripcion} · {reclamo.moneda.codigo} · {formatFechaCorta(reclamo.fechaReclamo)}
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
          </div>

          {/* Clasificación del reclamo (GrupoDefecto: Calidad/Condición) */}
          <div className='space-y-1.5'>
            <Label>Clasificación (Calidad / Condición)</Label>
            <Select
              value={clasifActual ? String(clasifActual) : '__none__'}
              disabled={!puedeAnalizar || !noCerrado}
              onValueChange={(v) => setAnalisis((p) => ({ ...p, clasif: v === '__none__' ? null : Number(v) }))}
            >
              <SelectTrigger><SelectValue placeholder='Sin clasificar' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>Sin clasificar</SelectItem>
                {grupos.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Líneas de defecto: Grupo (Calidad/Condición) + Defecto + % */}
          <div className='space-y-2'>
            <Label>Defectos</Label>
            {defectosActuales.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Defecto</TableHead>
                    <TableHead className='text-right'>%</TableHead>
                    {puedeAnalizar && noCerrado && <TableHead className='w-10' />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defectosActuales.map((d, i) => (
                    <TableRow key={`${d.grupoDefectoId}:${d.defectoId}`}>
                      <TableCell>{nombreGrupo(d.grupoDefectoId)}</TableCell>
                      <TableCell>{nombreDefecto(d.defectoId)}</TableCell>
                      <TableCell className='text-right tabular-nums'>{d.porcentaje}%</TableCell>
                      {puedeAnalizar && noCerrado && (
                        <TableCell>
                          <Button variant='ghost' size='icon' className='h-6 w-6' onClick={() => quitarLineaDefecto(i)}>
                            <Icons.trash className='h-3.5 w-3.5' />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {puedeAnalizar && noCerrado && (
              <div className='grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto] sm:items-end'>
                <div className='space-y-1'>
                  <Label className='text-xs'>Tipo</Label>
                  <Select value={lineaGrupoId ? String(lineaGrupoId) : ''} onValueChange={(v) => { setLineaGrupoId(Number(v)); setLineaDefectoId(null) }}>
                    <SelectTrigger><SelectValue placeholder='Grupo...' /></SelectTrigger>
                    <SelectContent>
                      {grupos.map((g) => (<SelectItem key={g.id} value={String(g.id)}>{g.descripcion}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label className='text-xs'>Defecto</Label>
                  <Select value={lineaDefectoId ? String(lineaDefectoId) : ''} onValueChange={(v) => setLineaDefectoId(Number(v))} disabled={lineaGrupoId == null}>
                    <SelectTrigger><SelectValue placeholder={lineaGrupoId == null ? 'Elige grupo' : 'Defecto...'} /></SelectTrigger>
                    <SelectContent>
                      {defectosDelGrupo.map((d) => (<SelectItem key={d.id} value={String(d.id)}>{d.descripcion}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1'>
                  <Label className='text-xs'>%</Label>
                  <Input type='number' min={0} max={100} value={lineaPorcentaje} onChange={(e) => setLineaPorcentaje(e.target.value)} />
                </div>
                <Button type='button' variant='secondary' onClick={agregarLineaDefecto} disabled={lineaGrupoId == null || lineaDefectoId == null || lineaPorcentaje === ''}>
                  <Icons.add className='mr-1 h-4 w-4' /> Agregar
                </Button>
              </div>
            )}
          </div>

          {puedeAnalizar && noCerrado && (
            <Button
              size='sm'
              onClick={() => guardarAnalisis.mutate({ comentarioCalidad: comentarioActual, grupoDefectoId: clasifActual, defectos: defectosActuales })}
              isLoading={guardarAnalisis.isPending}
              disabled={comentarioActual.trim() === ''}
            >
              Guardar análisis
            </Button>
          )}

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

      {/* Provisión y Valorización — de solo lectura acá (las gestiona Ventas,
          ver ReclamoVentasDetailClient); informa a Calidad qué hizo Comercial. */}
      <Card>
        <CardHeader><CardTitle className='text-sm'>Provisión y Valorización (Comercial)</CardTitle></CardHeader>
        <CardContent className='space-y-2 text-sm'>
          {provisionVigente ? (
            <p>
              Provisión vigente: <span className='font-medium'>{reclamo.moneda.codigo} {provisionVigente.montoCalculado}</span>{' '}
              <span className='text-muted-foreground'>({TIPO_CALCULO_PROVISION_LABELS[provisionVigente.tipoCalculo]})</span>
            </p>
          ) : (
            <p className='text-muted-foreground'>Sin Provisión vigente.</p>
          )}
          {reclamo.valorConfirmado != null ? (
            <p>Valorizado: <span className='font-medium'>{reclamo.moneda.codigo} {reclamo.valorConfirmado}</span></p>
          ) : (
            <p className='text-muted-foreground'>Aún no valorizado.</p>
          )}
        </CardContent>
      </Card>

      {/* Veredicto Final — solo se puede cerrar desde VALORIZADO (R5/IMP-QA-
          R1-020); antes de eso, el backend igual lo rechaza (422), pero no
          tiene sentido ofrecer el control. */}
      {puedeCerrar && (
        <Card>
          <CardHeader><CardTitle className='text-sm'>Veredicto Final</CardTitle></CardHeader>
          <CardContent className='flex items-end gap-3'>
            {reclamo.estado === 'VALORIZADO' ? (
              <>
                <div className='flex-1 space-y-1.5'>
                  <Label>Estado</Label>
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
              <p className='text-muted-foreground text-sm'>Ventas debe valorizar el Reclamo antes de poder cerrarlo.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
