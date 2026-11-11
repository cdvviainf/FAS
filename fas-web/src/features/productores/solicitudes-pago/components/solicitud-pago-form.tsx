'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Combobox } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertModal } from '@/components/modal/alert-modal'
import { Icons } from '@/components/icons'
import { AvisoSinTemporada } from '@/components/shared/aviso-sin-temporada'
import { useTemporada } from '@/contexts/temporada-context'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { formatFechaCorta, formatMonto } from '@/lib/format'
import { entidadesService } from '@/features/entidades/service'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { solicitudesPagoKeys, solicitudesPagoService } from '../service'
import { ESTADO_SOLICITUD_PAGO_LABELS, ITEM_SOLICITUD_PAGO, ITEM_SOLICITUD_PAGO_CONFIRMAR } from '../types'
import type { GrupoDespachado, SolicitudPago, SolicitudPagoLineaInput } from '../types'
import { DespachadoSelector, claveCuota } from './despachado-selector'
import { ConfirmarPagoDialog } from './confirmar-pago-dialog'
import { ESTADO_VARIANT } from './solicitud-pago-listing-client'

// Selección → líneas a enviar (valida montos > 0 y ≤ saldo en pantalla; el
// backend vuelve a validar contra lo despachado recalculado).
function lineasDesdeSeleccion(grupos: GrupoDespachado[], seleccion: Record<string, string>): { lineas: SolicitudPagoLineaInput[]; error: string | null; total: number } {
  const lineas: SolicitudPagoLineaInput[] = []
  let total = 0
  for (const g of grupos) {
    for (const c of g.cuotas) {
      const k = claveCuota(g.ordenCompra.id, g.embarque.id, c.ordenCompraCuotaPagoId)
      if (!(k in seleccion)) continue
      const monto = Number(seleccion[k])
      const ref = `${g.ordenCompra.numero} / ${g.embarque.numeroInstructivo} / cuota ${c.numeroCuota}`
      if (!(monto > 0)) return { lineas, total, error: `${ref}: el monto a solicitar debe ser mayor a 0` }
      if (monto > c.saldo + 0.005) return { lineas, total, error: `${ref}: el monto supera el saldo de la cuota (${formatMonto(c.saldo)})` }
      lineas.push({ ordenCompraId: g.ordenCompra.id, embarqueId: g.embarque.id, ordenCompraCuotaPagoId: c.ordenCompraCuotaPagoId, montoSolicitado: Math.round(monto * 100) / 100 })
      total += Math.round(monto * 100) / 100
    }
  }
  return { lineas, total: Math.round(total * 100) / 100, error: null }
}

export function SolicitudPagoForm({ solicitudId }: { solicitudId?: number }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { temporada } = useTemporada()
  const puedeEscribir = usePuedeEscribir(ITEM_SOLICITUD_PAGO)
  const puedeConfirmar = usePuedeEscribir(ITEM_SOLICITUD_PAGO_CONFIRMAR)
  const isEdit = solicitudId != null

  const { data: detalle } = useQuery({
    queryKey: solicitudesPagoKeys.detalle(solicitudId ?? 0),
    queryFn: () => solicitudesPagoService.getById(solicitudId!),
    enabled: isEdit,
  })
  const solicitud: SolicitudPago | undefined = detalle?.data
  const editable = !isEdit || (solicitud?.estado === 'SOLICITADA' && puedeEscribir)

  const [productorId, setProductorId] = useState<number | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [seleccion, setSeleccion] = useState<Record<string, string>>({})
  const [confirmarOpen, setConfirmarOpen] = useState(false)
  const [anularOpen, setAnularOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Hidratación al cargar la solicitud existente.
  useEffect(() => {
    if (!solicitud) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación al cargar
    setProductorId(solicitud.entidadProductorId)
    setObservaciones(solicitud.observaciones ?? '')
    setSeleccion(
      Object.fromEntries((solicitud.lineas ?? []).map((l) => [claveCuota(l.ordenCompraId, l.embarqueId, l.ordenCompraCuotaPagoId), String(Number(l.montoSolicitado))])),
    )
  }, [solicitud])

  const { data: productoresData } = useQuery({
    queryKey: ['entidades-productores-options'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', activo: true, limit: 500 }),
    staleTime: 60_000,
    enabled: !isEdit,
  })

  // Solo OC de la temporada activa (nueva) o de la temporada de la solicitud (edición).
  const temporadaIdDespachado = isEdit ? (solicitud?.temporada?.id ?? null) : (temporada?.id ?? null)
  // En una solicitud nueva, cambiar la temporada activa descarta la selección.
  useEffect(() => {
    if (isEdit) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la selección depende de la temporada
    setSeleccion({})
  }, [isEdit, temporadaIdDespachado])
  const { data: despachadoData, isFetching: cargandoDespachado } = useQuery({
    queryKey: solicitudesPagoKeys.despachado(productorId ?? 0, temporadaIdDespachado ?? 0, isEdit ? solicitudId : undefined),
    queryFn: () =>
      solicitudesPagoService.despachado({
        entidadProductorId: productorId!,
        temporadaId: temporadaIdDespachado!,
        ...(isEdit ? { excluirSolicitudId: solicitudId } : {}),
      }),
    enabled: productorId != null && temporadaIdDespachado != null && editable,
  })
  const grupos = useMemo(() => despachadoData?.data ?? [], [despachadoData])
  const { total, error: errorSeleccion } = lineasDesdeSeleccion(grupos, seleccion)
  const monedasSeleccion = new Set(
    grupos.filter((g) => g.cuotas.some((c) => claveCuota(g.ordenCompra.id, g.embarque.id, c.ordenCompraCuotaPagoId) in seleccion)).map((g) => g.ordenCompra.moneda.codigo),
  )

  const invalidar = () => queryClient.invalidateQueries({ queryKey: solicitudesPagoKeys.all })

  const guardar = useMutation({
    mutationFn: () => {
      const { lineas, error } = lineasDesdeSeleccion(grupos, seleccion)
      if (error) return Promise.reject(new Error(error))
      if (lineas.length === 0) return Promise.reject(new Error('Selecciona al menos una cuota'))
      if (monedasSeleccion.size > 1) return Promise.reject(new Error('Las cuotas seleccionadas son de OC en monedas distintas: haz una solicitud por moneda'))
      const obs = observaciones.trim() || null
      return isEdit
        ? solicitudesPagoService.update(solicitudId!, { observaciones: obs, lineas })
        : solicitudesPagoService.create({ entidadProductorId: productorId!, temporadaId: temporada?.id ?? null, observaciones: obs, lineas })
    },
    onSuccess: (r) => {
      invalidar()
      if (isEdit) {
        toast.success('Solicitud actualizada')
        router.push('/dashboard/productores/pagos')
      } else {
        toast.success(`Solicitud ${r.data.numero} creada`)
        router.push(`/dashboard/productores/pagos/${r.data.id}`)
      }
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la solicitud'),
  })

  const anular = useMutation({
    mutationFn: () => solicitudesPagoService.anular(solicitudId!),
    onSuccess: () => {
      invalidar()
      setAnularOpen(false)
      toast.success('Solicitud anulada')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al anular la solicitud'),
  })

  const sinTemporada = !isEdit && !temporada
  const puedeAnular = !!solicitud && ((solicitud.estado === 'SOLICITADA' && puedeEscribir) || (solicitud.estado === 'PAGADA' && puedeConfirmar))

  return (
    <div className='space-y-4'>
      {isEdit && solicitud && (
        <Card>
          <CardHeader>
            <CardTitle className='flex flex-wrap items-center gap-3 text-base'>
              <span className='font-mono'>{solicitud.numero}</span>
              <Badge variant={ESTADO_VARIANT[solicitud.estado]}>{ESTADO_SOLICITUD_PAGO_LABELS[solicitud.estado]}</Badge>
              <span className='text-muted-foreground text-sm font-normal'>
                {solicitud.entidadProductor.razonSocial} · {formatFechaCorta(solicitud.fecha)} · {solicitud.moneda.codigo} {formatMonto(solicitud.montoTotal)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            {solicitud.estado === 'PAGADA' && (
              <p className='text-sm'>
                Pagada el {solicitud.fechaPago ? formatFechaCorta(solicitud.fechaPago) : '—'}
                {solicitud.numeroTransferencia ? ` · Transferencia ${solicitud.numeroTransferencia}` : ''}
                {solicitud.conceptoCtaCte ? ` · Concepto ${solicitud.conceptoCtaCte.descripcion}` : ''}. Registrada en la cuenta corriente del productor.
              </p>
            )}
            <div className='flex flex-wrap gap-2'>
              <Button variant='outline' size='sm' onClick={() => setPreviewOpen(true)}>
                <Icons.search className='mr-1 h-4 w-4' /> Ver PDF
              </Button>
              {solicitud.estado === 'SOLICITADA' && puedeConfirmar && (
                <Button size='sm' onClick={() => setConfirmarOpen(true)}>
                  <Icons.check className='mr-1 h-4 w-4' /> Confirmar pago
                </Button>
              )}
              {puedeAnular && (
                <Button variant='destructive' size='sm' onClick={() => setAnularOpen(true)}>
                  <Icons.close className='mr-1 h-4 w-4' /> Anular
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isEdit && solicitud && !editable && (
        <Card>
          <CardHeader><CardTitle className='text-sm'>Cuotas solicitadas</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OC</TableHead>
                  <TableHead>Embarque</TableHead>
                  <TableHead>Cuota</TableHead>
                  <TableHead>Vence</TableHead>
                  <TableHead className='text-right'>Monto cuota</TableHead>
                  <TableHead className='text-right'>Solicitado</TableHead>
                  <TableHead>N° Factura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(solicitud.lineas ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.ordenCompra.numero}</TableCell>
                    <TableCell>{l.embarque.numeroInstructivo}</TableCell>
                    <TableCell className='text-sm'>{l.numeroCuota} · {l.ordenCompraCuotaPago?.descripcion ?? (l.ordenCompraCuotaPagoId ? '' : 'Total')}</TableCell>
                    <TableCell>{l.fechaVencimiento ? formatFechaCorta(l.fechaVencimiento) : '—'}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.montoCalculado)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.montoSolicitado)}</TableCell>
                    <TableCell>{l.numeroFactura ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={5}>Total</TableCell>
                  <TableCell className='text-right tabular-nums'>{solicitud.moneda.codigo} {formatMonto(solicitud.montoTotal)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
            {solicitud.observaciones && <p className='text-muted-foreground mt-3 whitespace-pre-wrap text-sm'>{solicitud.observaciones}</p>}
          </CardContent>
        </Card>
      )}

      {editable && (
        <>
          <Card>
            <CardHeader><CardTitle className='text-sm'>Productor</CardTitle></CardHeader>
            <CardContent className='space-y-3'>
              {isEdit ? (
                <p className='text-sm'>{solicitud?.entidadProductor.razonSocial}</p>
              ) : (
                <div className='max-w-md space-y-1.5'>
                  <Label>Productor <span className='text-destructive'>*</span></Label>
                  <Combobox
                    value={productorId ? String(productorId) : ''}
                    onChange={(v) => { setProductorId(v ? Number(v) : null); setSeleccion({}) }}
                    placeholder='Seleccionar productor...'
                    searchPlaceholder='Buscar productor...'
                    options={(productoresData?.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion }))}
                  />
                </div>
              )}
              <p className='text-muted-foreground text-xs'>
                Se lista lo despachado (Embarques con despacho confirmado) de las OC del productor de la temporada activa, valorizado al precio de la línea de OC
                que calza. Se paga por cuota de la condición de pago de la OC; puedes solicitar un monto distinto, hasta el saldo de la cuota.
                Solicitar no afecta la cuenta corriente: eso ocurre al confirmar el pago.
              </p>
            </CardContent>
          </Card>

          {productorId != null && (
            <Card>
              <CardHeader><CardTitle className='text-sm'>Despachado por OC y Embarque</CardTitle></CardHeader>
              <CardContent>
                {cargandoDespachado && grupos.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>Cargando...</p>
                ) : (
                  <DespachadoSelector grupos={grupos} seleccion={seleccion} onChange={setSeleccion} />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className='space-y-3 pt-6'>
              <div className='space-y-1.5'>
                <Label>Observaciones</Label>
                <Textarea rows={3} maxLength={1000} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-sm'>
                  Total a solicitar: <span className='font-medium tabular-nums'>{[...monedasSeleccion][0] ?? ''} {formatMonto(total)}</span>
                  {errorSeleccion && <span className='ml-2 text-xs text-destructive'>{errorSeleccion}</span>}
                  {monedasSeleccion.size > 1 && <span className='ml-2 text-xs text-destructive'>Cuotas en monedas distintas</span>}
                </p>
                <div className='flex gap-2'>
                  <Button variant='outline' onClick={() => router.push('/dashboard/productores/pagos')}>Cancelar</Button>
                  <Button
                    onClick={() => guardar.mutate()}
                    isLoading={guardar.isPending}
                    disabled={sinTemporada || productorId == null || Object.keys(seleccion).length === 0}
                  >
                    <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear solicitud'}
                  </Button>
                </div>
              </div>
              <AvisoSinTemporada mostrar={sinTemporada} />
            </CardContent>
          </Card>
        </>
      )}

      {isEdit && solicitud && (
        <>
          <ConfirmarPagoDialog solicitud={solicitud} open={confirmarOpen} onOpenChange={setConfirmarOpen} />
          <AlertModal
            isOpen={anularOpen}
            onClose={() => setAnularOpen(false)}
            onConfirm={() => anular.mutate()}
            loading={anular.isPending}
            title={`Anular ${solicitud.numero}`}
            description={
              solicitud.estado === 'PAGADA'
                ? 'La solicitud ya está pagada: se registrará un contramovimiento (HABER) por cada cuota en la cuenta corriente del productor y las cuotas quedarán disponibles.'
                : 'Las cuotas quedarán disponibles para una nueva solicitud.'
            }
          />
          <DocumentoPreviewDialog
            tipo='solicitud-pago'
            id={solicitud.id}
            titulo={`Solicitud de Pago ${solicitud.numero}`}
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            controlCopia={false}
          />
        </>
      )}
    </div>
  )
}
