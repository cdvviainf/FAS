'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Icons } from '@/components/icons'
import { formatMonto, formatFechaCorta } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { facturaNacionalPorIdOptions, facturasNacionalKeys } from '../queries'
import { facturaNacionalService, hoyFecha } from '../service'
import type { EstadoFacturaNacional, FacturaNacional, FacturaNacionalLineaInput } from '../types'
import { ESTADO_FN_LABELS, ORIGEN_FN_LABELS } from '../types'

const ITEM = 'FACT_NACIONAL'

const ESTADO_VARIANT: Record<EstadoFacturaNacional, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  BORRADOR: 'secondary',
  ENVIADA_SII: 'secondary',
  APROBADA: 'default',
  RECHAZADA: 'destructive',
  ANULADA: 'outline',
}

// Timbrada (folio real), con veredicto del SII pendiente (ENVIADA_SII) o
// confirmado (APROBADA): habilita PDF/XML/anulación y la consulta al SII.
function esTimbrada(estado: EstadoFacturaNacional) {
  return estado === 'ENVIADA_SII' || estado === 'APROBADA'
}

type LineaEdit = {
  descripcion: string
  articuloId: number | null
  cantidad: string
  precioUnitario: string
  exento: boolean
}

export function FacturaNacionalDetalleClient({ id }: { id: number }) {
  const { data, isPending, isError } = useQuery(facturaNacionalPorIdOptions(id))

  if (isPending) return <p className='text-muted-foreground text-sm'>Cargando…</p>
  if (isError || !data?.data) return <p className='text-destructive text-sm'>No se encontró la Factura.</p>

  return <Detalle factura={data.data} />
}

function Detalle({ factura }: { factura: FacturaNacional }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const editable = factura.estado === 'BORRADOR' || factura.estado === 'RECHAZADA'
  const soloLectura = !editable || !puedeEscribir
  // Venta nacional: precio de la fruta en moneda de origen (USD) + tipo de
  // cambio editable; se factura en CLP convertido. Materiales: precio en CLP.
  const esVenta = factura.origenClase === 'VENTA_NACIONAL'
  // Moneda de origen real del Cierre (USD/EUR/…) — no asumir USD (VN-QA-003).
  const monedaOrigen = factura.embarque?.notaVenta.moneda.codigo ?? 'USD'
  // Cierre ya en CLP: no hay conversión (TC = 1), no se edita (VN-QA-004).
  const esClp = monedaOrigen === 'CLP'

  const [fechaDocumento, setFechaDocumento] = useState(factura.fechaDocumento?.slice(0, 10) ?? hoyFecha())
  const [observaciones, setObservaciones] = useState(factura.observaciones ?? '')
  const [tipoCambio, setTipoCambio] = useState(factura.tipoCambio ?? '')
  // Fecha de la paridad usada (null = ingreso manual) — se persiste (VN-QA-002).
  const [fechaTipoCambio, setFechaTipoCambio] = useState<string | null>(factura.fechaTipoCambio?.slice(0, 10) ?? null)
  const [lineas, setLineas] = useState<LineaEdit[]>(
    factura.lineas.map((l) => ({
      descripcion: l.descripcion,
      articuloId: l.articuloId,
      cantidad: l.cantidad,
      // En venta el precio editable es el de origen (USD); en materiales, CLP.
      precioUnitario: esVenta ? (l.precioUnitarioOrigen ?? l.precioUnitario) : l.precioUnitario,
      exento: l.exento,
    })),
  )
  const [dirty, setDirty] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  const [confirmarAnular, setConfirmarAnular] = useState(false)
  const [confirmarAnularNc, setConfirmarAnularNc] = useState(false)

  const dte = factura.dte
  const borradorEnviado = dte?.estado === 'TEMPORAL_CREADO' || dte?.estado === 'GENERADO'

  // Totales recalculados en cliente (el valor tributario real lo computa LibreDTE).
  // En venta, el monto CLP = cantidad × precio(USD) × tipo de cambio.
  const tc = esVenta ? Number(tipoCambio) || 0 : 1
  const montoLinea = (l: LineaEdit) => (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0) * tc
  const neto = lineas.filter((l) => !l.exento).reduce((a, l) => a + montoLinea(l), 0)
  const exento = lineas.filter((l) => l.exento).reduce((a, l) => a + montoLinea(l), 0)
  const iva = Math.round(neto * 0.19)
  const total = neto + iva + exento
  const tipoDtePrevisto = lineas.length > 0 && lineas.every((l) => l.exento) ? 34 : 33

  function patch<K extends keyof LineaEdit>(i: number, key: K, value: LineaEdit[K]) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)))
    setDirty(true)
  }
  function agregarLinea() {
    setLineas((prev) => [...prev, { descripcion: '', articuloId: null, cantidad: '1', precioUnitario: '0', exento: false }])
    setDirty(true)
  }
  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i))
    setDirty(true)
  }

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: facturasNacionalKeys.detalle(factura.id) })
    queryClient.invalidateQueries({ queryKey: facturasNacionalKeys.all })
  }

  function lineasInput(): FacturaNacionalLineaInput[] {
    return lineas.map((l) => ({
      descripcion: l.descripcion.trim(),
      articuloId: l.articuloId,
      cantidad: Number(l.cantidad) || 0,
      precioUnitario: Number(l.precioUnitario) || 0,
      exento: l.exento,
    }))
  }

  const guardar = useMutation({
    mutationFn: () =>
      facturaNacionalService.actualizar(factura.id, {
        fechaDocumento: fechaDocumento || null,
        observaciones: observaciones.trim() || null,
        ...(esVenta ? { tipoCambio: Number(tipoCambio) || null, fechaTipoCambio } : {}),
        lineas: lineasInput(),
      }),
    onSuccess: () => {
      setDirty(false)
      toast.success('Factura guardada')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la Factura'),
  })

  // Tipo de cambio sugerido (venta) — paridad de la fecha del documento.
  const obtenerTc = useMutation({
    mutationFn: () => facturaNacionalService.obtenerTipoCambio(factura.id, fechaDocumento || undefined),
    onSuccess: ({ data }) => {
      setTipoCambio(String(data.valor))
      setFechaTipoCambio(data.fecha)
      setDirty(true)
      toast.success(`Tipo de cambio ${data.valor} CLP/${data.moneda} (${data.fecha})`)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo obtener el tipo de cambio'),
  })

  // Enviar borrador = guardar primero (persiste fecha/observaciones/líneas y
  // descarta el temporal viejo) y luego crear el temporal fresco.
  const enviarSii = useMutation({
    mutationFn: async () => {
      await guardar.mutateAsync()
      return facturaNacionalService.enviarSii(factura.id)
    },
    onSuccess: () => {
      setDirty(false)
      toast.success('Borrador enviado al SII')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al enviar el borrador al SII'),
    onSettled: () => invalidar(),
  })

  const firmar = useMutation({
    mutationFn: () => facturaNacionalService.firmar(factura.id),
    onSuccess: () => toast.success('Factura firmada (timbrada)'),
    onError: (e: Error) => toast.error(e.message || 'Error al firmar el DTE'),
    onSettled: () => {
      setConfirmarFirma(false)
      invalidar()
    },
  })

  const reabrir = useMutation({
    mutationFn: () => facturaNacionalService.reabrir(factura.id),
    onSuccess: () => {
      toast.success('Factura reabierta como borrador')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al reabrir la Factura'),
  })

  // Reconciliación on-demand del veredicto real del SII (FAS-COB-SII).
  const consultarSii = useMutation({
    mutationFn: () => facturaNacionalService.consultarSii(factura.id),
    onSuccess: (r) => {
      const { veredicto, glosa } = r.data.sii
      if (veredicto === 'ACEPTADO') toast.success('El SII aceptó la factura — estado: Aprobada')
      else if (veredicto === 'RECHAZADO') toast.error(`El SII rechazó la factura: ${glosa}`)
      else toast.info('El SII aún no entrega veredicto — la factura sigue "Enviada al SII"')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo consultar el estado en el SII'),
  })

  const anular = useMutation({
    mutationFn: () => facturaNacionalService.anular(factura.id),
    onSuccess: () => {
      toast.success('Factura anulada')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al anular la Factura'),
    onSettled: () => setConfirmarAnular(false),
  })

  const verBorrador = useMutation({
    mutationFn: () => facturaNacionalService.verPdfBorrador(factura.id),
    onError: (e: Error) => toast.error(e.message || 'No se pudo obtener el PDF del borrador'),
  })

  // NC de anulación aprobada (cuando la factura está ANULADA).
  const ncAprobada = factura.notasCredito?.find((n) => n.estado === 'APROBADA') ?? null

  const anularConNc = useMutation({
    mutationFn: () => facturaNacionalService.anularConNc(factura.id),
    onSuccess: (r) => {
      toast.success(`Factura anulada con Nota de Crédito ${r.data.codigo}${r.data.folio ? ` (folio ${r.data.folio})` : ''}`)
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo anular la Factura con Nota de Crédito'),
    onSettled: () => setConfirmarAnularNc(false),
  })
  const verNcPdf = useMutation({
    mutationFn: () => facturaNacionalService.verPdfNc(ncAprobada!.id),
    onError: (e: Error) => toast.error(e.message || 'No se pudo abrir el PDF de la Nota de Crédito'),
  })
  async function descargarNcXml() {
    if (!ncAprobada) return
    try {
      await facturaNacionalService.descargarXmlNc(ncAprobada.id, `${ncAprobada.codigo}${ncAprobada.folio ? `-folio-${ncAprobada.folio}` : ''}.xml`)
    } catch (e) {
      toast.error((e as Error).message || 'No se pudo descargar el XML de la Nota de Crédito')
    }
  }

  function handleEnviarSii() {
    if (!fechaDocumento) {
      toast.error('La fecha del documento es obligatoria')
      return
    }
    if (lineas.length === 0) {
      toast.error('La factura no tiene líneas')
      return
    }
    if (esVenta && (!(Number(tipoCambio) > 0))) {
      toast.error('Indica el tipo de cambio antes de enviar al SII')
      return
    }
    enviarSii.mutate()
  }
  function handleFirmar() {
    if (dirty) {
      toast.error('Tienes cambios sin guardar — envía el borrador al SII antes de firmar')
      return
    }
    if (!borradorEnviado) {
      toast.error('Primero envía el borrador al SII')
      return
    }
    setConfirmarFirma(true)
  }

  const trabajando = guardar.isPending || enviarSii.isPending || firmar.isPending || reabrir.isPending || anular.isPending

  return (
    <div className='max-w-5xl space-y-4'>
      {/* ── Encabezado ── */}
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            {factura.codigo}
            <Badge variant={ESTADO_VARIANT[factura.estado]}>{ESTADO_FN_LABELS[factura.estado]}</Badge>
            <span className='text-muted-foreground text-sm font-normal'>DTE {factura.tipoDte}</span>
            {factura.folio != null && <span className='text-muted-foreground text-sm font-normal'>· Folio {factura.folio}</span>}
          </h2>
          <p className='text-muted-foreground text-sm'>
            {ORIGEN_FN_LABELS[factura.origenClase]}
            {factura.proformaMaterial ? ` · ${factura.proformaMaterial.numero}` : ''}
            {factura.embarque ? ` · Embarque ${factura.embarque.numeroInstructivo}` : ''} ·{' '}
            {factura.cliente.razonSocial ?? factura.cliente.descripcion}
            {factura.cliente.identificador ? ` (${factura.cliente.identificador})` : ''}
          </p>
        </div>
        <div className='flex flex-wrap gap-2'>
          {editable && puedeEscribir && (
            <Button variant='outline' disabled={trabajando || !dirty} onClick={() => guardar.mutate()}>
              <Icons.check className='mr-1 h-4 w-4' />
              Guardar
            </Button>
          )}
          {editable && puedeEscribir && !borradorEnviado && (
            <Button disabled={trabajando} onClick={handleEnviarSii}>
              <Icons.send className='mr-1 h-4 w-4' />
              Enviar borrador al SII
            </Button>
          )}
          {editable && puedeEscribir && borradorEnviado && (
            <>
              <Button variant='outline' disabled={verBorrador.isPending} onClick={() => verBorrador.mutate()}>
                <Icons.page className='mr-1 h-4 w-4' />
                Ver PDF borrador
              </Button>
              <Button disabled={trabajando} onClick={handleFirmar}>
                <Icons.check className='mr-1 h-4 w-4' />
                Firmar (timbrar)
              </Button>
            </>
          )}
          {factura.estado === 'RECHAZADA' && puedeEscribir && (
            <Button variant='outline' disabled={trabajando} onClick={() => reabrir.mutate()}>
              Reabrir
            </Button>
          )}
          {esTimbrada(factura.estado) && puedeEscribir && (
            <Button variant='outline' disabled={consultarSii.isPending} onClick={() => consultarSii.mutate()}>
              <Icons.search className='mr-1 h-4 w-4' />
              Consultar estado SII
            </Button>
          )}
          {esTimbrada(factura.estado) && dte?.tieneXml && (
            <Button variant='outline' onClick={() => facturaNacionalService.descargarXml(factura.id, `${factura.codigo}.xml`)}>
              <Icons.download className='mr-1 h-4 w-4' />
              Descargar XML
            </Button>
          )}
          {editable && puedeEscribir && (
            <Button variant='destructive' disabled={trabajando} onClick={() => setConfirmarAnular(true)}>
              <Icons.trash className='mr-1 h-4 w-4' />
              Anular
            </Button>
          )}
          {/* Anular una factura timbrada con Nota de Crédito (DTE 61). */}
          {esTimbrada(factura.estado) && puedeEscribir && (
            <Button variant='destructive' isLoading={anularConNc.isPending} onClick={() => setConfirmarAnularNc(true)}>
              <Icons.trash className='mr-1 h-4 w-4' />
              Anular con Nota de Crédito
            </Button>
          )}
          {ncAprobada && (
            <>
              <Button variant='outline' disabled={verNcPdf.isPending} onClick={() => verNcPdf.mutate()}>
                <Icons.download className='mr-1 h-4 w-4' />
                Ver NC Timbrada (SII)
              </Button>
              <Button variant='outline' onClick={descargarNcXml}>
                <Icons.download className='mr-1 h-4 w-4' />
                Descargar XML NC
              </Button>
            </>
          )}
        </div>
      </div>

      {ncAprobada && (
        <p className='text-muted-foreground text-sm'>
          Anulada con Nota de Crédito <span className='font-medium'>{ncAprobada.codigo}</span>
          {ncAprobada.folio != null && <> · DTE {ncAprobada.tipoDte} folio {ncAprobada.folio}</>}
        </p>
      )}

      {factura.estado === 'RECHAZADA' && factura.errorMensajeSii && (
        <div className='border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-3 text-sm'>
          <strong>Rechazo del SII:</strong> {factura.errorMensajeSii}
        </div>
      )}

      {/* ── Datos del documento ── */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Datos del documento</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <div className='grid gap-1.5'>
            <Label>Fecha del documento</Label>
            <Input
              type='date'
              value={fechaDocumento}
              disabled={soloLectura}
              onChange={(e) => {
                setFechaDocumento(e.target.value)
                setDirty(true)
              }}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label>Moneda</Label>
            <Input value={factura.moneda.codigo} disabled />
          </div>
          {esVenta && !esClp && (
            <div className='grid gap-1.5 sm:col-span-2'>
              <Label>Tipo de cambio (CLP por 1 {monedaOrigen})</Label>
              <div className='flex gap-2'>
                <Input
                  type='number'
                  className='w-48 text-right'
                  value={tipoCambio}
                  disabled={soloLectura}
                  placeholder='Ej. 950'
                  onChange={(e) => {
                    setTipoCambio(e.target.value)
                    setFechaTipoCambio(null) // ingreso manual: sin fecha de paridad
                    setDirty(true)
                  }}
                />
                {!soloLectura && (
                  <Button type='button' variant='outline' disabled={obtenerTc.isPending} onClick={() => obtenerTc.mutate()}>
                    Obtener
                  </Button>
                )}
              </div>
              <p className='text-muted-foreground text-xs'>
                Los precios se ingresan en {monedaOrigen} y se facturan en CLP convertidos con este valor.
              </p>
            </div>
          )}
          <div className='grid gap-1.5 sm:col-span-2'>
            <Label>Observaciones</Label>
            <Textarea
              value={observaciones}
              disabled={soloLectura}
              rows={2}
              onChange={(e) => {
                setObservaciones(e.target.value)
                setDirty(true)
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Líneas ── */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>
            Líneas <span className='text-muted-foreground font-normal'>· DTE previsto {tipoDtePrevisto}</span>
          </CardTitle>
          {!soloLectura && (
            <Button size='sm' variant='outline' onClick={agregarLinea}>
              <Icons.add className='mr-1 h-4 w-4' />
              Agregar línea
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[45%]'>Descripción</TableHead>
                <TableHead className='text-right'>Cantidad</TableHead>
                <TableHead className='text-right'>{esVenta ? `Precio (${monedaOrigen})` : 'Precio'}</TableHead>
                {!esVenta && <TableHead className='text-center'>Exenta</TableHead>}
                <TableHead className='text-right'>Monto {esVenta ? '(CLP)' : ''}</TableHead>
                {!soloLectura && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={(esVenta ? 3 : 4) + (soloLectura ? 0 : 1)} className='text-muted-foreground py-6 text-center'>
                    Sin líneas.
                  </TableCell>
                </TableRow>
              ) : (
                lineas.map((l, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input
                        value={l.descripcion}
                        disabled={soloLectura}
                        onChange={(e) => patch(i, 'descripcion', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Input
                        type='number'
                        className='text-right'
                        value={l.cantidad}
                        disabled={soloLectura}
                        onChange={(e) => patch(i, 'cantidad', e.target.value)}
                      />
                    </TableCell>
                    <TableCell className='text-right'>
                      <Input
                        type='number'
                        className='text-right'
                        value={l.precioUnitario}
                        disabled={soloLectura}
                        onChange={(e) => patch(i, 'precioUnitario', e.target.value)}
                      />
                    </TableCell>
                    {!esVenta && (
                      <TableCell className='text-center'>
                        <Checkbox
                          checked={l.exento}
                          disabled={soloLectura}
                          onCheckedChange={(v) => patch(i, 'exento', v === true)}
                        />
                      </TableCell>
                    )}
                    <TableCell className='text-right tabular-nums'>{formatMonto(montoLinea(l))}</TableCell>
                    {!soloLectura && (
                      <TableCell>
                        <Button size='icon' variant='ghost' onClick={() => quitarLinea(i)}>
                          <Icons.trash className='h-4 w-4' />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className='mt-4 flex flex-col items-end gap-1 text-sm'>
            <div className='text-muted-foreground'>Neto afecto: {formatMonto(neto)}</div>
            {exento > 0 && <div className='text-muted-foreground'>Exento: {formatMonto(exento)}</div>}
            <div className='text-muted-foreground'>IVA (19%): {formatMonto(iva)}</div>
            <div className='text-base font-semibold'>
              Total: {factura.moneda.codigo} {formatMonto(total)}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className='text-muted-foreground text-xs'>
        Emitida: {factura.fechaEmision ? formatFechaCorta(factura.fechaEmision) : '—'} · Creada:{' '}
        {formatFechaCorta(factura.creadoEn)}
      </p>

      {/* ── Confirmaciones ── */}
      <AlertDialog open={confirmarFirma} onOpenChange={setConfirmarFirma}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Firmar (timbrar) la factura</AlertDialogTitle>
            <AlertDialogDescription>
              Se timbrará el DTE {tipoDtePrevisto} ante el SII vía LibreDTE y obtendrá folio. Esta acción no se puede
              deshacer (requeriría una Nota de Crédito).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={firmar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => firmar.mutate()} disabled={firmar.isPending}>
              Firmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarAnular} onOpenChange={setConfirmarAnular}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular la factura</AlertDialogTitle>
            <AlertDialogDescription>
              La factura quedará anulada y el {esVenta ? 'Embarque' : 'documento'} de origen volverá a estar disponible para
              facturar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anular.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => anular.mutate()} disabled={anular.isPending}>
              Anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarAnularNc} onOpenChange={setConfirmarAnularNc}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular factura {factura.codigo} con Nota de Crédito</AlertDialogTitle>
            <AlertDialogDescription>
              Se emitirá y timbrará ante el SII una Nota de Crédito (DTE 61) que anula esta factura. La factura quedará
              ANULADA. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={anularConNc.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => anularConNc.mutate()} disabled={anularConNc.isPending}>
              Emitir NC y anular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
