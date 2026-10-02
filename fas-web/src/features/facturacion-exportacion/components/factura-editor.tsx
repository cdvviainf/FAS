'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { formatMonto } from '@/lib/format'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { facturasKeys } from '../queries'
import { facturaExportacionService, hoyFecha, proformaService } from '../service'
import { DIMENSION_LABELS } from '../types'
import type { DimensionProforma, FacturaExportacion, ProformaLineaSugerida } from '../types'

// "YYYY-MM-DD" para el input date desde una fecha ISO (o null).
function aFechaInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

const ITEM = 'FACT_EXPORTACION'
const TODAS_LAS_DIMENSIONES: DimensionProforma[] = ['VARIEDAD', 'ARTICULO', 'CALIBRE', 'CATEGORIA', 'MARCA']

function lineasDesdeFactura(factura: FacturaExportacion): ProformaLineaSugerida[] {
  return factura.lineas.map((l) => ({
    descripcion: l.descripcion,
    especieId: l.especieId,
    variedadId: l.variedadId,
    articuloId: l.articuloId,
    calibreId: l.calibreId,
    categoriaId: l.categoriaId,
    etiquetaId: l.etiquetaId,
    cantidadCajas: l.cantidadCajas,
    montoLinea: Number(l.montoLinea),
    precioUnitario: Number(l.precioUnitario),
  }))
}

export function FacturaEditor({ factura }: { factura: FacturaExportacion }) {
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)
  const embarqueId = factura.embarque.id

  const [dimensiones, setDimensiones] = useState<DimensionProforma[]>(factura.dimensionesAgrupacion)
  const [lineas, setLineas] = useState<ProformaLineaSugerida[]>(() => lineasDesdeFactura(factura))
  const [regrupando, setRegrupando] = useState(false)
  const [confirmarFirma, setConfirmarFirma] = useState(false)
  // Cambios locales sin persistir: mientras `dirty`, el temporal enviado no
  // refleja la pantalla, así que Firmar se bloquea y Enviar guarda primero
  // (FAS-COB-F1-007).
  const [dirty, setDirty] = useState(false)

  const [idioma, setIdioma] = useState<'ES' | 'EN'>(factura.idioma === 'EN' ? 'EN' : 'ES')
  // Sugerir hoy si la Factura aún no tiene fecha (la fecha es obligatoria).
  const [fechaDocumento, setFechaDocumento] = useState<string>(aFechaInput(factura.fechaDocumento) || hoyFecha())

  const clausula = factura.embarque.notaVenta?.clausulaVenta ?? null
  const requiereFlete = clausula?.requiereFlete ?? false
  const requiereSeguro = clausula?.requiereSeguro ?? false
  const [montoFlete, setMontoFlete] = useState<string>(factura.montoFlete ?? '')
  const [montoSeguro, setMontoSeguro] = useState<string>(factura.montoSeguro ?? '')

  // Tipo de cambio: solo aplica si la moneda no es la base (CLP). Lo exige el SII
  // para emitir el DTE 110 en moneda extranjera.
  const esMonedaExtranjera = factura.moneda.codigo !== 'CLP'
  const [tipoCambio, setTipoCambio] = useState<string>(factura.tipoCambio ?? '')
  const [fechaTipoCambio, setFechaTipoCambio] = useState<string | null>(factura.fechaTipoCambio)

  // Faltantes de descripción extranjera para las dimensiones actuales — para
  // advertir/bloquear el idioma inglés (misma fuente que el backend).
  const { data: sugerencia } = useQuery({
    queryKey: ['factura-sugerencia-faltantes', embarqueId, dimensiones],
    queryFn: () => proformaService.sugerirLineas(embarqueId, dimensiones),
    staleTime: 10_000,
  })
  const faltantesExtranjera = sugerencia?.faltantesExtranjera ?? []
  const enBloqueadoPorFaltantes = idioma === 'EN' && faltantesExtranjera.length > 0

  // Estado del flujo SII (derivado del DocumentoDte): borrador enviado = temporal.
  const borradorEnviado = factura.dte?.estado === 'TEMPORAL_CREADO'
  const esRechazada = factura.estado === 'RECHAZADA'

  const montoTotal = lineas.reduce((acc, l) => acc + l.montoLinea, 0)
  // Valor FOB de la mercadería = total (cláusula/CIF) − flete − seguro. Es lo
  // que se timbra en el detalle del DTE; el total sigue siendo el valor CIF.
  const fleteNum = requiereFlete ? Number(montoFlete) || 0 : 0
  const seguroNum = requiereSeguro ? Number(montoSeguro) || 0 : 0
  const subtotalFob = Math.round((montoTotal - fleteNum - seguroNum) * 100) / 100

  async function toggleDimension(dim: DimensionProforma, marcado: boolean) {
    const nuevas = marcado ? [...dimensiones, dim] : dimensiones.filter((d) => d !== dim)
    setDimensiones(nuevas)
    setDirty(true)
    // Reagrupar recalcula las líneas canónicas contra los pallets reales (mismo
    // endpoint que la Proforma) — resetea los precios a los sugeridos.
    setRegrupando(true)
    try {
      const res = await proformaService.sugerirLineas(embarqueId, nuevas)
      setLineas(res.data)
    } catch {
      toast.error('No se pudieron recalcular las líneas')
    } finally {
      setRegrupando(false)
    }
  }

  function actualizarLinea(index: number, cambios: Partial<ProformaLineaSugerida>) {
    setDirty(true)
    setLineas((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l
        const actualizada = { ...l, ...cambios }
        actualizada.montoLinea = Math.round(actualizada.precioUnitario * actualizada.cantidadCajas * 100) / 100
        return actualizada
      }),
    )
  }

  const guardar = useMutation({
    mutationFn: () =>
      facturaExportacionService.actualizar(factura.id, {
        dimensiones,
        lineas: lineas.map((l) => ({
          descripcion: l.descripcion,
          especieId: l.especieId,
          variedadId: l.variedadId,
          articuloId: l.articuloId,
          calibreId: l.calibreId,
          categoriaId: l.categoriaId,
          etiquetaId: l.etiquetaId,
          cantidadCajas: l.cantidadCajas,
          precioUnitario: l.precioUnitario,
        })),
        idioma,
        fechaDocumento: fechaDocumento || null,
        montoFlete: requiereFlete ? Number(montoFlete) || 0 : null,
        montoSeguro: requiereSeguro ? Number(montoSeguro) || 0 : null,
        tipoCambio: esMonedaExtranjera ? Number(tipoCambio) || null : null,
        // Fecha de la paridad observada (la real del Banco Central cuando viene
        // de "Obtener"); null en ingreso manual → el backend sella con la fecha
        // de edición. BRT-R1-003.
        fechaTipoCambio: esMonedaExtranjera ? (fechaTipoCambio ? fechaTipoCambio.slice(0, 10) : null) : null,
      }),
    onSuccess: () => {
      setDirty(false)
      toast.success('Factura guardada')
      queryClient.invalidateQueries({ queryKey: facturasKeys.detalle(factura.id) })
      queryClient.invalidateQueries({ queryKey: facturasKeys.all })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la Factura'),
  })

  function invalidarTodo() {
    queryClient.invalidateQueries({ queryKey: facturasKeys.detalle(factura.id) })
    queryClient.invalidateQueries({ queryKey: facturasKeys.porEmbarque(factura.embarqueId) })
    queryClient.invalidateQueries({ queryKey: facturasKeys.all })
  }

  // Enviar borrador = guardar primero (persiste idioma/fecha/precios/flete y
  // descarta el temporal viejo) y luego crear el temporal fresco desde lo
  // persistido — así el temporal SIEMPRE refleja la pantalla (FAS-COB-F1-007).
  const enviarSii = useMutation({
    mutationFn: async () => {
      await guardar.mutateAsync()
      return facturaExportacionService.enviarSii(factura.id)
    },
    onSuccess: () => { setDirty(false); toast.success('Borrador enviado al SII') },
    onError: (e: Error) => toast.error(e.message || 'Error al enviar el borrador al SII'),
    // Refresca en éxito y en error: el backend puede haber cambiado el estado del
    // DocumentoDte aunque la operación termine en error (FAS-COB-F1-002).
    onSettled: () => invalidarTodo(),
  })

  const firmar = useMutation({
    mutationFn: () => facturaExportacionService.firmar(factura.id),
    onSuccess: () => { toast.success('Factura firmada (timbrada)') },
    onError: (e: Error) => toast.error(e.message || 'Error al firmar el DTE'),
    // Un rechazo del SII deja la Factura en RECHAZADA en el backend: hay que
    // refetch en error también para reflejar el estado y el motivo (FAS-COB-F1-002).
    onSettled: () => { setConfirmarFirma(false); invalidarTodo() },
  })

  const obtenerTc = useMutation({
    mutationFn: () => facturaExportacionService.obtenerTipoCambio(factura.id),
    onSuccess: ({ data }) => {
      setTipoCambio(String(data.valor))
      setFechaTipoCambio(data.fecha)
      setDirty(true)
      toast.success(`Tipo de cambio ${data.valor} CLP/${data.moneda} (${data.fecha})`)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo obtener el tipo de cambio'),
  })

  const reabrir = useMutation({
    mutationFn: () => facturaExportacionService.reabrir(factura.id),
    onSuccess: () => { toast.success('Factura reabierta como borrador'); invalidarTodo() },
    onError: (e: Error) => toast.error(e.message || 'Error al reabrir la Factura'),
  })

  // Validaciones comunes antes de tocar el SII.
  function validarPrevio(): boolean {
    if (!fechaDocumento) {
      toast.error('La fecha del documento es obligatoria')
      return false
    }
    if (requiereFlete && (!montoFlete || Number(montoFlete) <= 0)) {
      toast.error('La cláusula de venta exige informar el monto de Flete')
      return false
    }
    if (requiereSeguro && (!montoSeguro || Number(montoSeguro) <= 0)) {
      toast.error('La cláusula de venta exige informar el monto de Seguro')
      return false
    }
    if ((requiereFlete || requiereSeguro) && subtotalFob <= 0) {
      toast.error('El Flete y el Seguro no pueden igualar ni superar el valor de venta')
      return false
    }
    if (esMonedaExtranjera && (!tipoCambio || Number(tipoCambio) <= 0)) {
      toast.error('Indica el tipo de cambio (el SII lo exige para facturar en moneda extranjera)')
      return false
    }
    if (enBloqueadoPorFaltantes) {
      toast.error(`No se puede emitir en inglés: faltan descripciones extranjeras (${faltantesExtranjera.join(' · ')})`)
      return false
    }
    return true
  }

  // Diagnóstico: abre en una pestaña nueva el payload exacto que se manda a
  // simpleDTE (+ resumen de códigos Aduana), sin enviar nada.
  const verPayload = useMutation({
    mutationFn: () => facturaExportacionService.previsualizarPayloadDte(factura.id),
    onSuccess: ({ data }) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer')
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo obtener el payload'),
  })

  // Rescata el PDF del borrador (DTE temporal) desde LibreDTE y lo abre.
  const verBorrador = useMutation({
    mutationFn: () => facturaExportacionService.verPdfBorrador(factura.id),
    onError: (e: Error) => toast.error(e.message || 'No se pudo obtener el PDF del borrador'),
  })

  function handleEnviarSii() {
    if (!validarPrevio()) return
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
    if (!validarPrevio()) return
    setConfirmarFirma(true)
  }

  return (
    <div className='max-w-3xl space-y-4'>
      <div className='flex items-start justify-between'>
        <div>
          <h2 className='flex items-center gap-2 text-xl font-semibold'>
            Factura {factura.codigo}
            <Badge variant={esRechazada ? 'destructive' : borradorEnviado ? 'default' : 'secondary'}>
              {esRechazada ? 'Rechazada' : borradorEnviado ? 'Borrador enviado al SII' : 'Borrador'}
            </Badge>
          </h2>
          <dl className='text-muted-foreground mt-1 grid gap-x-2 text-sm sm:grid-cols-[auto_1fr]'>
            <dt className='font-medium'>Embarque:</dt><dd>{factura.embarque.numeroInstructivo}</dd>
            <dt className='font-medium'>Cliente:</dt><dd>{factura.cliente.descripcion}</dd>
            <dt className='font-medium'>Moneda:</dt><dd>{factura.moneda.codigo}</dd>
            {factura.condicionPago && (
              <>
                <dt className='font-medium'>Condición de pago:</dt><dd>{factura.condicionPago.descripcion}</dd>
              </>
            )}
            {factura.proforma && (
              <>
                <dt className='font-medium'>Proforma:</dt><dd>{factura.proforma.codigo}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {esRechazada && factura.errorMensajeSii && (
        <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'>
          <p className='font-medium'>El SII rechazó el timbrado</p>
          <p className='text-xs'>{factura.errorMensajeSii}</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className='text-sm'>Documento</CardTitle></CardHeader>
        <CardContent className='flex flex-wrap items-end gap-4'>
          <div className='space-y-1.5'>
            <Label>Idioma</Label>
            <Select value={idioma} onValueChange={(v) => { setIdioma(v as 'ES' | 'EN'); setDirty(true) }}>
              <SelectTrigger className='h-9 w-40'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='ES'>Español</SelectItem>
                <SelectItem value='EN'>Inglés</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label>Fecha del documento</Label>
            <Input type='date' value={fechaDocumento} onChange={(e) => { setFechaDocumento(e.target.value); setDirty(true) }} className='h-9 w-44' disabled={!puedeEscribir} />
          </div>
          {esMonedaExtranjera && (
            <div className='space-y-1.5'>
              <Label>Tipo de cambio (CLP/{factura.moneda.codigo})</Label>
              <div className='flex items-center gap-2'>
                <Input
                  type='number'
                  min={0}
                  step='0.0001'
                  value={tipoCambio}
                  onChange={(e) => { setTipoCambio(e.target.value); setFechaTipoCambio(null); setDirty(true) }}
                  className='h-9 w-32 text-right'
                  disabled={!puedeEscribir}
                />
                <Button type='button' variant='outline' size='sm' onClick={() => obtenerTc.mutate()} isLoading={obtenerTc.isPending} disabled={!puedeEscribir}>
                  <Icons.download className='mr-2 h-4 w-4' /> Obtener
                </Button>
              </div>
              <p className='text-muted-foreground text-xs'>
                {fechaTipoCambio
                  ? `Dólar/euro observado del Banco Central · ${fechaTipoCambio.slice(0, 10)}`
                  : 'El SII lo exige para facturar en moneda extranjera.'}
              </p>
            </div>
          )}
          {enBloqueadoPorFaltantes && (
            <p className='w-full text-xs text-destructive'>
              No se puede emitir en inglés: falta la descripción extranjera de — {faltantesExtranjera.join(' · ')}.
              Complétala en el mantenedor o usa español.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Agrupación de líneas</CardTitle></CardHeader>
        <CardContent className='space-y-3'>
          <p className='text-muted-foreground text-xs'>
            Especie siempre se factura por separado. Marca qué más quieres desglosar (al cambiar, se recalculan las líneas).
          </p>
          <div className='flex flex-wrap gap-4'>
            {TODAS_LAS_DIMENSIONES.map((dim) => (
              <label key={dim} className='flex items-center gap-2 text-sm'>
                <Checkbox
                  checked={dimensiones.includes(dim)}
                  disabled={regrupando || !puedeEscribir}
                  onCheckedChange={(c) => toggleDimension(dim, !!c)}
                />
                {DIMENSION_LABELS[dim]}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-sm'>Líneas</CardTitle></CardHeader>
        <CardContent>
          {regrupando ? (
            <p className='text-muted-foreground text-sm'>Recalculando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className='text-right'>Cajas</TableHead>
                  <TableHead className='w-36 text-right'>Precio Unitario</TableHead>
                  <TableHead className='w-36 text-right'>Total Línea</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((l, i) => (
                  <TableRow key={i}>
                    {/* Descripción derivada de los mantenedores según idioma (se
                        arma en el PDF/DTE); no es texto libre. */}
                    <TableCell className='text-sm'>{l.descripcion}</TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.cantidadCajas, 0)}</TableCell>
                    <TableCell>
                      <Input
                        type='number'
                        min={0}
                        step='0.0001'
                        value={l.precioUnitario}
                        onChange={(e) => actualizarLinea(i, { precioUnitario: Number(e.target.value) })}
                        className='h-8 text-right'
                        disabled={!puedeEscribir}
                      />
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{formatMonto(l.montoLinea)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className='text-right tabular-nums'>{formatMonto(lineas.reduce((a, l) => a + l.cantidadCajas, 0), 0)}</TableCell>
                  <TableCell />
                  <TableCell className='text-right tabular-nums'>{factura.moneda.codigo} {formatMonto(montoTotal)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {(requiereFlete || requiereSeguro) && (
        <Card>
          <CardHeader>
            <CardTitle className='text-sm'>
              Cláusula de venta{clausula?.descripcion ? ` — ${clausula.descripcion}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <p className='text-muted-foreground text-xs'>
              El Flete y el Seguro son un monto cerrado dentro del total: restan al valor de venta para obtener el
              valor FOB de la mercadería (lo que se timbra en el detalle del DTE). El total y las cuotas siguen sobre el
              valor de la cláusula.
            </p>
            <div className='flex flex-wrap gap-4'>
              {requiereFlete && (
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium'>Flete ({factura.moneda.codigo}) *</label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoFlete}
                    onChange={(e) => { setMontoFlete(e.target.value); setDirty(true) }}
                    className='h-8 w-40 text-right'
                    disabled={!puedeEscribir}
                  />
                </div>
              )}
              {requiereSeguro && (
                <div className='space-y-1.5'>
                  <label className='text-sm font-medium'>Seguro ({factura.moneda.codigo}) *</label>
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    value={montoSeguro}
                    onChange={(e) => { setMontoSeguro(e.target.value); setDirty(true) }}
                    className='h-8 w-40 text-right'
                    disabled={!puedeEscribir}
                  />
                </div>
              )}
            </div>
            <div className='space-y-1 border-t pt-2 text-sm tabular-nums'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Valor FOB (mercadería)</span>
                <span>{factura.moneda.codigo} {formatMonto(subtotalFob)}</span>
              </div>
              {requiereFlete && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Flete</span>
                  <span>{factura.moneda.codigo} {formatMonto(fleteNum)}</span>
                </div>
              )}
              {requiereSeguro && (
                <div className='flex justify-between'>
                  <span className='text-muted-foreground'>Seguro</span>
                  <span>{factura.moneda.codigo} {formatMonto(seguroNum)}</span>
                </div>
              )}
              <div className='flex justify-between font-semibold'>
                <span>Total (valor cláusula)</span>
                <span>{factura.moneda.codigo} {formatMonto(montoTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {puedeEscribir && (
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' onClick={() => guardar.mutate()} isLoading={guardar.isPending} disabled={regrupando}>
            <Icons.check className='mr-2 h-4 w-4' /> Guardar
          </Button>
          <Button variant='ghost' size='sm' onClick={() => verPayload.mutate()} isLoading={verPayload.isPending} title='Ver el JSON exacto que se manda al SII (diagnóstico)'>
            <Icons.page className='mr-2 h-4 w-4' /> Ver payload SII
          </Button>
          {borradorEnviado && (
            <Button variant='ghost' size='sm' onClick={() => verBorrador.mutate()} isLoading={verBorrador.isPending} title='Rescata el PDF del borrador desde LibreDTE'>
              <Icons.page className='mr-2 h-4 w-4' /> Ver borrador (PDF)
            </Button>
          )}
          {esRechazada && (
            <Button variant='outline' onClick={() => reabrir.mutate()} isLoading={reabrir.isPending}>
              <Icons.edit className='mr-2 h-4 w-4' /> Reabrir para editar
            </Button>
          )}
          {/* Paso 1: enviar el borrador al SII (crea el DTE temporal). */}
          <Button
            variant={borradorEnviado ? 'outline' : 'default'}
            onClick={handleEnviarSii}
            isLoading={enviarSii.isPending}
            disabled={regrupando || lineas.length === 0}
          >
            <Icons.upload className='mr-2 h-4 w-4' /> {borradorEnviado ? 'Reenviar borrador al SII' : 'Enviar borrador al SII'}
          </Button>
          {/* Paso 2: firmar (timbrar el folio real). Habilitado tras enviar y
              sin cambios sin guardar (FAS-COB-F1-007). */}
          <Button onClick={handleFirmar} disabled={regrupando || lineas.length === 0 || !borradorEnviado || dirty}>
            <Icons.billing className='mr-2 h-4 w-4' /> Firmar (timbrar)
          </Button>
          {dirty && <p className='w-full text-xs text-muted-foreground'>Tienes cambios sin guardar. Envía el borrador al SII para incluirlos antes de firmar.</p>}
        </div>
      )}

      <AlertModal
        isOpen={confirmarFirma}
        onClose={() => setConfirmarFirma(false)}
        onConfirm={() => firmar.mutate()}
        loading={firmar.isPending}
        title='Firmar Factura de Exportación (DTE 110)'
        description='Se timbrará el documento con folio real ante el SII vía LibreDTE. Esta acción no se puede deshacer.'
      />
    </div>
  )
}
