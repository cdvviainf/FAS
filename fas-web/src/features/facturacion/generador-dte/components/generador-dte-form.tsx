'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertModal } from '@/components/modal/alert-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { DocumentoPreviewDialog } from '@/features/documentos/components/documento-preview-dialog'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { condicionesPagoService } from '@/features/condiciones-pago/service'
import { FECHA_REFERENCIA_LABELS } from '@/features/condiciones-pago/types'
import { entidadesService } from '@/features/entidades/service'
import { articulosService } from '@/features/materiales/articulos/service'
import { facturaNacionalService } from '@/features/facturacion-nacional/service'
import { formatMonto } from '@/lib/format'
import { generadorDteDetailOptions, generadorDteKeys } from '../queries'
import { generadorDteService } from '../service'
import {
  CLASE_LABELS,
  ESTADO_LABELS,
  IND_TRASLADO_OPCIONES,
  COD_REF_OPCIONES,
} from '../types'
import type {
  ClaseDocumentoManual,
  DocumentoManualCreateInput,
  DocumentoManualLineaInput,
  DocumentoManualReferenciaInput,
  DocumentoManualTransporteInput,
} from '../types'
import { articuloDescripcionComercial } from '@/lib/articulo'

const monedasService = createMantenedorService('monedas')

const IVA_TASA = 0.19
const round2 = (n: number) => Math.round(n * 100) / 100
const hoyYmd = () => new Date().toISOString().slice(0, 10)

interface LineaEdit {
  descripcion: string
  articuloId: number | null
  cantidad: string
  precioUnitario: string
  exento: boolean
}

interface ReferenciaEdit {
  tipoDocRef: string
  folioRef: string
  fechaRef: string
  codRef: string // '' = sin motivo
  razonRef: string
  refOrigenTipo: string | null
  refOrigenId: number | null
}

interface TransporteEdit {
  indTraslado: string
  transporteId: number | null
  choferChileno: boolean
  choferRut: string
  choferNombre: string
  patenteCamion: string
  patenteRemolque: string
  dirOrigen: string
  comunaOrigen: string
  dirDestino: string
  comunaDestino: string
}

const LINEA_EMPTY: LineaEdit = { descripcion: '', articuloId: null, cantidad: '1', precioUnitario: '0', exento: false }
const REF_EMPTY: ReferenciaEdit = { tipoDocRef: '', folioRef: '', fechaRef: hoyYmd(), codRef: '', razonRef: '', refOrigenTipo: null, refOrigenId: null }
const TRANSPORTE_EMPTY: TransporteEdit = {
  indTraslado: '1', transporteId: null, choferChileno: true, choferRut: '', choferNombre: '',
  patenteCamion: '', patenteRemolque: '', dirOrigen: '', comunaOrigen: '', dirDestino: '', comunaDestino: '',
}

const ITEM = 'GENERADOR_DTE'

interface GeneradorDteFormProps {
  documentoId?: number
}

export function GeneradorDteForm({ documentoId }: GeneradorDteFormProps) {
  const isEdit = !!documentoId
  const router = useRouter()
  const queryClient = useQueryClient()
  const puedeEscribir = usePuedeEscribir(ITEM)

  const [clase, setClase] = useState<ClaseDocumentoManual>('FACTURA_NACIONAL')
  const [entidadId, setEntidadId] = useState(0)
  const [monedaId, setMonedaId] = useState(0)
  const [tipoCambio, setTipoCambio] = useState('')
  const [fechaDocumento, setFechaDocumento] = useState(hoyYmd())
  const [condicionPagoId, setCondicionPagoId] = useState<number | null>(null)
  const [idioma, setIdioma] = useState<'ES' | 'EN'>('ES')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<LineaEdit[]>(isEdit ? [] : [{ ...LINEA_EMPTY }])
  const [referencias, setReferencias] = useState<ReferenciaEdit[]>([])
  const [transporte, setTransporte] = useState<TransporteEdit>({ ...TRANSPORTE_EMPTY })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [anularOpen, setAnularOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const { data: documento, isLoading } = useQuery({
    ...generadorDteDetailOptions(documentoId ?? 0),
    enabled: isEdit,
  })

  const { data: entidadesData } = useQuery({
    queryKey: ['entidades-options', 'generador-dte'],
    queryFn: () => entidadesService.list({ activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: transportistasData } = useQuery({
    queryKey: ['entidades-options', 'EMPRESA_TRANSPORTE'],
    queryFn: () => entidadesService.list({ tipo: 'EMPRESA_TRANSPORTE', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: monedasData } = useQuery({ queryKey: ['monedas-options'], queryFn: () => monedasService.list({ limit: 200 }), staleTime: 5 * 60_000 })
  const { data: condicionesPagoData } = useQuery({ queryKey: ['condiciones-pago-options', 'VENTA'], queryFn: () => condicionesPagoService.list({ tipo: 'VENTA' }), staleTime: 60_000 })
  const { data: articulosData } = useQuery({ queryKey: ['articulos-options', 'generador-dte'], queryFn: () => articulosService.list({ activo: true, limit: 500 }), staleTime: 60_000 })
  // Facturas Nacionales para enlazar como documento de referencia (NC/ND).
  const esNotaRef = clase === 'NOTA_CREDITO' || clase === 'NOTA_DEBITO'
  const { data: facturasData } = useQuery({
    queryKey: ['facturas-nacional-ref-options'],
    queryFn: () => facturaNacionalService.list({ limit: 200 }),
    staleTime: 60_000,
    enabled: esNotaRef,
  })

  const entidades = entidadesData?.data ?? []
  const transportistas = transportistasData?.data ?? []
  const articulos = articulosData?.data ?? []
  const facturas = facturasData?.data ?? []

  const monedaSeleccionada = (monedasData?.data ?? []).find((m) => m.id === monedaId)
  const esMonedaNoClp = !!monedaSeleccionada && monedaSeleccionada.codigo !== 'CLP'

  const condicionPagoSeleccionada = (condicionesPagoData?.data ?? []).find((c) => c.id === condicionPagoId)
  const cuotasPreview = condicionPagoSeleccionada?.cuotas ?? []

  const esGuia = clase === 'GUIA_DESPACHO'
  const esFactura = clase === 'FACTURA_NACIONAL'

  useEffect(() => {
    if (documento) {
      const d = documento.data
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza el estado local con la respuesta del server al cargar (mismo patrón que proforma-productor-form.tsx)
      setClase(d.claseDocumento)
      setEntidadId(d.entidadId)
      setMonedaId(d.monedaId)
      setTipoCambio(d.tipoCambio ?? '')
      setFechaDocumento(d.fechaDocumento.slice(0, 10))
      setCondicionPagoId(d.condicionPagoId)
      setIdioma(d.idioma === 'EN' ? 'EN' : 'ES')
      setObservaciones(d.observaciones ?? '')
      setLineas(
        d.lineas.map((l) => ({
          descripcion: l.descripcion,
          articuloId: l.articuloId,
          cantidad: l.cantidad,
          precioUnitario: l.precioUnitario,
          exento: l.exento,
        })),
      )
      setReferencias(
        d.referencias.map((r) => ({
          tipoDocRef: r.tipoDocRef,
          folioRef: r.folioRef,
          fechaRef: r.fechaRef.slice(0, 10),
          codRef: r.codRef != null ? String(r.codRef) : '',
          razonRef: r.razonRef ?? '',
          refOrigenTipo: r.refOrigenTipo ?? null,
          refOrigenId: r.refOrigenId ?? null,
        })),
      )
      if (d.claseDocumento === 'GUIA_DESPACHO') {
        setTransporte({
          indTraslado: d.guiaIndTraslado != null ? String(d.guiaIndTraslado) : '1',
          transporteId: d.guiaTransporteId,
          choferChileno: d.guiaChoferChileno,
          choferRut: d.guiaChoferRut ?? '',
          choferNombre: d.guiaChoferNombre ?? '',
          patenteCamion: d.guiaPatenteCamion ?? '',
          patenteRemolque: d.guiaPatenteRemolque ?? '',
          dirOrigen: d.guiaDirOrigen ?? '',
          comunaOrigen: d.guiaComunaOrigen ?? '',
          dirDestino: d.guiaDirDestino ?? '',
          comunaDestino: d.guiaComunaDestino ?? '',
        })
      }
    }
  }, [documento])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!entidadId) e.entidadId = 'El receptor es requerido'
    if (!monedaId) e.monedaId = 'La moneda es requerida'
    if (esMonedaNoClp && !(Number(tipoCambio) > 0)) e.tipoCambio = 'Indica el tipo de cambio (la moneda no es CLP)'
    if (!fechaDocumento) e.fechaDocumento = 'La fecha es requerida'
    if (lineas.length === 0) e.lineas = 'Agrega al menos una línea'
    if (lineas.some((l) => !l.descripcion.trim())) e.lineas = 'Cada línea debe tener una glosa/descripción'
    if (lineas.some((l) => Number(l.cantidad) <= 0)) e.lineas = 'La cantidad de cada línea debe ser mayor a 0'
    if (lineas.some((l) => Number(l.precioUnitario) < 0)) e.lineas = 'El precio no puede ser negativo'
    if (esGuia) {
      if (!Number(transporte.indTraslado)) e.transporte = 'Selecciona el tipo de traslado'
      if (transporte.choferChileno && !transporte.choferRut.trim()) e.transporte = 'El RUT del chofer es obligatorio para choferes chilenos'
    }
    if (esNotaRef) {
      if (referencias.length === 0) e.referencias = 'Agrega al menos un documento de referencia'
      if (referencias.some((r) => !r.tipoDocRef.trim() || !r.folioRef.trim() || !r.fechaRef)) {
        e.referencias = 'Cada referencia debe tener tipo de documento, folio y fecha'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function buildLineasPayload(): DocumentoManualLineaInput[] {
    return lineas.map((l) => ({
      descripcion: l.descripcion.trim(),
      articuloId: l.articuloId,
      cantidad: Number(l.cantidad),
      precioUnitario: Number(l.precioUnitario),
      exento: l.exento,
    }))
  }

  function buildReferenciasPayload(): DocumentoManualReferenciaInput[] {
    return referencias.map((r) => ({
      tipoDocRef: r.tipoDocRef.trim(),
      folioRef: r.folioRef.trim(),
      fechaRef: r.fechaRef,
      codRef: r.codRef ? Number(r.codRef) : null,
      razonRef: r.razonRef.trim() || null,
      refOrigenTipo: r.refOrigenTipo,
      refOrigenId: r.refOrigenId,
    }))
  }

  function buildTransportePayload(): DocumentoManualTransporteInput {
    return {
      indTraslado: Number(transporte.indTraslado),
      transporteId: transporte.transporteId,
      choferChileno: transporte.choferChileno,
      choferRut: transporte.choferRut.trim() || null,
      choferNombre: transporte.choferNombre.trim() || null,
      patenteCamion: transporte.patenteCamion.trim() || null,
      patenteRemolque: transporte.patenteRemolque.trim() || null,
      dirOrigen: transporte.dirOrigen.trim() || null,
      comunaOrigen: transporte.comunaOrigen.trim() || null,
      dirDestino: transporte.dirDestino.trim() || null,
      comunaDestino: transporte.comunaDestino.trim() || null,
    }
  }

  function buildCreatePayload(): DocumentoManualCreateInput {
    return {
      claseDocumento: clase,
      entidadId,
      monedaId,
      tipoCambio: esMonedaNoClp && Number(tipoCambio) > 0 ? Number(tipoCambio) : null,
      fechaDocumento,
      condicionPagoId: esFactura ? condicionPagoId : null,
      idioma,
      observaciones: observaciones.trim() || undefined,
      transporte: esGuia ? buildTransportePayload() : null,
      referencias: esNotaRef ? buildReferenciasPayload() : undefined,
      lineas: buildLineasPayload(),
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: DocumentoManualCreateInput) => generadorDteService.create(data),
    onSuccess: (res) => {
      toast.success(`Documento creado — ${res.data.codigo}`)
      queryClient.invalidateQueries({ queryKey: generadorDteKeys.all })
      router.push(`/dashboard/facturacion/generador-dte/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al crear el documento'),
  })

  const updateMutation = useMutation({
    mutationFn: (data: DocumentoManualCreateInput) => generadorDteService.update(documentoId!, data),
    onSuccess: () => {
      toast.success('Documento actualizado')
      queryClient.invalidateQueries({ queryKey: generadorDteKeys.detail(documentoId!) })
    },
    onError: (e: Error) => toast.error(e.message || 'Error al actualizar el documento'),
  })

  const anularMutation = useMutation({
    mutationFn: () => generadorDteService.anular(documentoId!),
    onSuccess: () => {
      toast.success('Documento anulado')
      setAnularOpen(false)
      queryClient.invalidateQueries({ queryKey: generadorDteKeys.all })
      queryClient.invalidateQueries({ queryKey: generadorDteKeys.detail(documentoId!) })
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Error al anular el documento')
      setAnularOpen(false)
    },
  })

  function handleSubmit() {
    if (!validate()) {
      toast.error('Hay campos por corregir')
      return
    }
    if (isEdit) updateMutation.mutate(buildCreatePayload())
    else createMutation.mutate(buildCreatePayload())
  }

  function setLinea(idx: number, patch: Partial<LineaEdit>) {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }
  function onSelectArticulo(idx: number, articuloId: number | null) {
    const art = articulos.find((a) => a.id === articuloId)
    setLineas((prev) =>
      prev.map((l, i) =>
        i === idx
          ? { ...l, articuloId, descripcion: art && !l.descripcion.trim() ? articuloDescripcionComercial(art) : l.descripcion }
          : l,
      ),
    )
  }

  function setRef(idx: number, patch: Partial<ReferenciaEdit>) {
    setReferencias((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  function onEnlazarFactura(idx: number, facturaId: number | null) {
    const f = facturas.find((x) => x.id === facturaId)
    if (!f) {
      setRef(idx, { refOrigenTipo: null, refOrigenId: null })
      return
    }
    setRef(idx, {
      refOrigenTipo: 'factura-nacional',
      refOrigenId: f.id,
      tipoDocRef: String(f.tipoDte),
      folioRef: f.folio != null ? String(f.folio) : f.codigo,
      fechaRef: (f.fechaDocumento ?? f.fechaEmision ?? f.creadoEn).slice(0, 10),
    })
  }

  if (isEdit && isLoading) {
    return <p className='text-sm text-muted-foreground'>Cargando…</p>
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const estado = documento?.data.estado
  const editable = !isEdit || estado === 'BORRADOR'
  const soloLectura = !puedeEscribir || (isEdit && !editable)
  const puedeAnular = puedeEscribir && isEdit && estado === 'BORRADOR'
  const monedaCodigo = monedaSeleccionada?.codigo ?? ''

  let neto = 0
  let exento = 0
  for (const l of lineas) {
    const monto = round2(Number(l.cantidad) * Number(l.precioUnitario))
    if (l.exento) exento += monto
    else neto += monto
  }
  neto = round2(neto)
  exento = round2(exento)
  const iva = Math.round(neto * IVA_TASA)
  const total = round2(neto + iva + exento)

  return (
    <div className='space-y-6'>
      {isEdit && documento && (
        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant={estado === 'BORRADOR' ? 'secondary' : estado === 'ANULADA' || estado === 'RECHAZADA' ? 'destructive' : 'outline'}>
            {ESTADO_LABELS[documento.data.estado]}
          </Badge>
          <span className='text-sm font-medium'>{CLASE_LABELS[documento.data.claseDocumento]} ({documento.data.tipoDte})</span>
          {soloLectura && (
            <span className='text-xs text-muted-foreground'>
              {!puedeEscribir ? 'Solo lectura — sin permiso de edición' : 'No editable en este estado.'}
            </span>
          )}
          <Button type='button' variant='outline' size='sm' className='ml-auto' onClick={() => setPreviewOpen(true)}>
            <Icons.search className='mr-1 h-4 w-4' /> Previsualizar
          </Button>
        </div>
      )}

      <fieldset disabled={soloLectura} className='m-0 space-y-6 border-0 p-0'>
        <Card>
          <CardHeader>
            <CardTitle>{isEdit ? `${CLASE_LABELS[clase]} ${documento?.data.codigo}` : 'Nuevo documento'}</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Tipo de documento <span className='text-destructive'>*</span></Label>
                <Select value={clase} onValueChange={(v) => setClase(v as ClaseDocumentoManual)} disabled={isEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLASE_LABELS) as ClaseDocumentoManual[]).map((c) => (
                      <SelectItem key={c} value={c}>{CLASE_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isEdit && <p className='text-xs text-muted-foreground'>El tipo no se puede cambiar después de creado.</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Fecha del documento <span className='text-destructive'>*</span></Label>
                <Input type='date' value={fechaDocumento} onChange={(e) => setFechaDocumento(e.target.value)} />
                {errors.fechaDocumento && <p className='text-xs text-destructive'>{errors.fechaDocumento}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label>Idioma</Label>
                <Select value={idioma} onValueChange={(v) => setIdioma(v as 'ES' | 'EN')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ES'>Español</SelectItem>
                    <SelectItem value='EN'>Inglés</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className='space-y-1.5'>
              <Label>Receptor <span className='text-destructive'>*</span></Label>
              <Combobox
                value={entidadId ? String(entidadId) : ''}
                onChange={(v) => setEntidadId(Number(v))}
                placeholder='Seleccionar receptor...'
                searchPlaceholder='Buscar entidad...'
                options={entidades.map((e) => ({ value: String(e.id), label: `${e.descripcion}${e.razonSocial ? ` — ${e.razonSocial}` : ''}` }))}
                disabled={soloLectura}
              />
              {errors.entidadId && <p className='text-xs text-destructive'>{errors.entidadId}</p>}
            </div>

            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label>Moneda <span className='text-destructive'>*</span></Label>
                <Select value={monedaId ? String(monedaId) : ''} onValueChange={(v) => { setMonedaId(Number(v)); setTipoCambio('') }}>
                  <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                  <SelectContent>
                    {(monedasData?.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.codigo} — {m.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.monedaId && <p className='text-xs text-destructive'>{errors.monedaId}</p>}
              </div>
              {esMonedaNoClp && (
                <div className='space-y-1.5'>
                  <Label>Tipo de cambio <span className='text-destructive'>*</span></Label>
                  <Input
                    type='number' min='0' step='0.0001' inputMode='decimal'
                    placeholder={`CLP por 1 ${monedaCodigo}`}
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                  />
                  {errors.tipoCambio && <p className='text-xs text-destructive'>{errors.tipoCambio}</p>}
                </div>
              )}
              {esFactura && (
                <div className='space-y-1.5'>
                  <Label>Condición de Pago</Label>
                  <Select value={condicionPagoId ? String(condicionPagoId) : '__none__'} onValueChange={(v) => setCondicionPagoId(v === '__none__' ? null : Number(v))}>
                    <SelectTrigger><SelectValue placeholder='Sin definir' /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value='__none__'>Sin definir</SelectItem>
                      {(condicionesPagoData?.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {esFactura && cuotasPreview.length > 0 && (
              <div className='rounded-md border p-3'>
                <p className='mb-2 text-xs font-medium text-muted-foreground'>Cuotas de pago (determinadas por la Condición de Pago)</p>
                <div className='flex flex-wrap gap-2'>
                  {cuotasPreview.map((c, i) => (
                    <Badge key={i} variant='outline'>
                      {c.porcentaje}% a {c.plazoDias} días desde {FECHA_REFERENCIA_LABELS[c.fechaReferencia]}{c.descripcion ? ` — ${c.descripcion}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className='space-y-1.5'>
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
            </div>
          </CardContent>
        </Card>

        {esGuia && (
          <Card>
            <CardHeader>
              <CardTitle>Datos de Transporte</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='grid gap-4 sm:grid-cols-3'>
                <div className='space-y-1.5'>
                  <Label>Tipo de traslado <span className='text-destructive'>*</span></Label>
                  <Select value={transporte.indTraslado} onValueChange={(v) => setTransporte((t) => ({ ...t, indTraslado: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IND_TRASLADO_OPCIONES.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className='space-y-1.5 sm:col-span-2'>
                  <Label>Transportista</Label>
                  <Combobox
                    value={transporte.transporteId ? String(transporte.transporteId) : ''}
                    onChange={(v) => setTransporte((t) => ({ ...t, transporteId: v ? Number(v) : null }))}
                    placeholder='Seleccionar empresa de transporte...'
                    searchPlaceholder='Buscar transportista...'
                    options={transportistas.map((e) => ({ value: String(e.id), label: `${e.descripcion}${e.razonSocial ? ` — ${e.razonSocial}` : ''}` }))}
                    disabled={soloLectura}
                  />
                </div>
              </div>
              <div className='grid gap-4 sm:grid-cols-3'>
                <div className='flex items-center gap-2 pt-6'>
                  <Checkbox checked={transporte.choferChileno} onCheckedChange={(v) => setTransporte((t) => ({ ...t, choferChileno: v === true }))} disabled={soloLectura} />
                  <Label className='font-normal'>Chofer chileno</Label>
                </div>
                <div className='space-y-1.5'>
                  <Label>RUT chofer {transporte.choferChileno && <span className='text-destructive'>*</span>}</Label>
                  <Input value={transporte.choferRut} onChange={(e) => setTransporte((t) => ({ ...t, choferRut: e.target.value }))} placeholder='12.345.678-9' />
                </div>
                <div className='space-y-1.5'>
                  <Label>Nombre chofer</Label>
                  <Input value={transporte.choferNombre} onChange={(e) => setTransporte((t) => ({ ...t, choferNombre: e.target.value }))} />
                </div>
              </div>
              <div className='grid gap-4 sm:grid-cols-2'>
                <div className='space-y-1.5'>
                  <Label>Patente camión</Label>
                  <Input value={transporte.patenteCamion} onChange={(e) => setTransporte((t) => ({ ...t, patenteCamion: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Patente remolque</Label>
                  <Input value={transporte.patenteRemolque} onChange={(e) => setTransporte((t) => ({ ...t, patenteRemolque: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Dirección origen</Label>
                  <Input value={transporte.dirOrigen} onChange={(e) => setTransporte((t) => ({ ...t, dirOrigen: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Comuna origen</Label>
                  <Input value={transporte.comunaOrigen} onChange={(e) => setTransporte((t) => ({ ...t, comunaOrigen: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Dirección destino</Label>
                  <Input value={transporte.dirDestino} onChange={(e) => setTransporte((t) => ({ ...t, dirDestino: e.target.value }))} />
                </div>
                <div className='space-y-1.5'>
                  <Label>Comuna destino</Label>
                  <Input value={transporte.comunaDestino} onChange={(e) => setTransporte((t) => ({ ...t, comunaDestino: e.target.value }))} />
                </div>
              </div>
              {errors.transporte && <p className='text-xs text-destructive'>{errors.transporte}</p>}
            </CardContent>
          </Card>
        )}

        {esNotaRef && (
          <Card>
            <CardHeader>
              <CardTitle>Documentos de Referencia</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              <p className='text-xs text-muted-foreground'>
                Enlaza una Factura del sistema (prellena los campos) o digita la referencia manualmente.
              </p>
              {referencias.map((r, idx) => (
                <div key={idx} className='space-y-3 rounded-md border p-3'>
                  <div className='flex items-center justify-between'>
                    <span className='text-xs font-medium text-muted-foreground'>Referencia {idx + 1}</span>
                    {!soloLectura && (
                      <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setReferencias((prev) => prev.filter((_, i) => i !== idx))}>
                        <Icons.trash className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Enlazar Factura Nacional del sistema (opcional)</Label>
                    <Combobox
                      value={r.refOrigenId ? String(r.refOrigenId) : ''}
                      onChange={(v) => onEnlazarFactura(idx, v ? Number(v) : null)}
                      placeholder='Sin enlace — digitar manualmente'
                      searchPlaceholder='Buscar factura...'
                      options={facturas.map((f) => ({ value: String(f.id), label: `${f.codigo}${f.folio != null ? ` · Folio ${f.folio}` : ''} — ${f.cliente?.razonSocial ?? f.cliente?.descripcion ?? ''}` }))}
                      disabled={soloLectura}
                    />
                  </div>
                  <div className='grid gap-3 sm:grid-cols-4'>
                    <div className='space-y-1.5'>
                      <Label>Tipo doc. <span className='text-destructive'>*</span></Label>
                      <Input value={r.tipoDocRef} onChange={(e) => setRef(idx, { tipoDocRef: e.target.value })} placeholder='33' />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Folio <span className='text-destructive'>*</span></Label>
                      <Input value={r.folioRef} onChange={(e) => setRef(idx, { folioRef: e.target.value })} />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Fecha <span className='text-destructive'>*</span></Label>
                      <Input type='date' value={r.fechaRef} onChange={(e) => setRef(idx, { fechaRef: e.target.value })} />
                    </div>
                    <div className='space-y-1.5'>
                      <Label>Motivo</Label>
                      <Select value={r.codRef || '__none__'} onValueChange={(v) => setRef(idx, { codRef: v === '__none__' ? '' : v })}>
                        <SelectTrigger><SelectValue placeholder='—' /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value='__none__'>—</SelectItem>
                          {COD_REF_OPCIONES.map((o) => (
                            <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className='space-y-1.5'>
                    <Label>Razón de referencia</Label>
                    <Input value={r.razonRef} onChange={(e) => setRef(idx, { razonRef: e.target.value })} maxLength={90} />
                  </div>
                </div>
              ))}
              {errors.referencias && <p className='text-xs text-destructive'>{errors.referencias}</p>}
              {!soloLectura && (
                <Button type='button' variant='outline' size='sm' onClick={() => setReferencias((prev) => [...prev, { ...REF_EMPTY, fechaRef: hoyYmd() }])}>
                  <Icons.add className='mr-1 h-4 w-4' /> Agregar referencia
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Detalle</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='overflow-x-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='min-w-[200px]'>Artículo (opcional)</TableHead>
                    <TableHead className='min-w-[220px]'>Glosa</TableHead>
                    <TableHead className='w-28'>Cantidad</TableHead>
                    <TableHead className='w-32'>Precio Unitario</TableHead>
                    <TableHead className='w-20 text-center'>Exento</TableHead>
                    <TableHead className='w-32 text-right'>Monto</TableHead>
                    {!soloLectura && <TableHead className='w-12' />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineas.map((l, idx) => {
                    const monto = round2(Number(l.cantidad) * Number(l.precioUnitario))
                    return (
                      <TableRow key={idx}>
                        <TableCell>
                          <Combobox
                            value={l.articuloId ? String(l.articuloId) : ''}
                            onChange={(v) => onSelectArticulo(idx, v ? Number(v) : null)}
                            placeholder='Línea libre'
                            searchPlaceholder='Buscar artículo...'
                            options={articulos.map((a) => ({ value: String(a.id), label: `${a.codigo} — ${articuloDescripcionComercial(a)}` }))}
                            disabled={soloLectura}
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={l.descripcion} onChange={(e) => setLinea(idx, { descripcion: e.target.value })} placeholder='Glosa...' disabled={soloLectura} />
                        </TableCell>
                        <TableCell>
                          <Input type='number' step='0.001' min='0' className='w-24' value={l.cantidad} onChange={(e) => setLinea(idx, { cantidad: e.target.value })} />
                        </TableCell>
                        <TableCell>
                          <Input type='number' step='0.01' min='0' className='w-28' value={l.precioUnitario} onChange={(e) => setLinea(idx, { precioUnitario: e.target.value })} />
                        </TableCell>
                        <TableCell className='text-center'>
                          <Checkbox checked={l.exento} disabled={soloLectura} onCheckedChange={(v) => setLinea(idx, { exento: v === true })} />
                        </TableCell>
                        <TableCell className='text-right tabular-nums'>{formatMonto(monto)}</TableCell>
                        {!soloLectura && (
                          <TableCell className='text-right'>
                            <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))} disabled={lineas.length <= 1}>
                              <Icons.trash className='h-4 w-4' />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            {errors.lineas && <p className='text-xs text-destructive'>{errors.lineas}</p>}
            {!soloLectura && (
              <Button type='button' variant='outline' size='sm' onClick={() => setLineas((prev) => [...prev, { ...LINEA_EMPTY }])}>
                <Icons.add className='mr-1 h-4 w-4' /> Agregar línea
              </Button>
            )}
            <div className='flex flex-col items-end gap-0.5 text-sm'>
              <div>Neto: <span className='tabular-nums font-medium'>{formatMonto(neto)}</span></div>
              <div>Exento: <span className='tabular-nums font-medium'>{formatMonto(exento)}</span></div>
              <div>IVA (19%): <span className='tabular-nums font-medium'>{formatMonto(iva)}</span></div>
              <div className='text-base font-semibold'>Total: <span className='tabular-nums'>{formatMonto(total)}</span></div>
            </div>
          </CardContent>
        </Card>
      </fieldset>

      {!soloLectura && (
        <div className='flex justify-between gap-2'>
          {puedeAnular ? (
            <Button type='button' variant='destructive' onClick={() => setAnularOpen(true)}>
              <Icons.trash className='mr-1 h-4 w-4' /> Anular
            </Button>
          ) : <span />}
          <div className='flex gap-2'>
            <Button type='button' variant='outline' onClick={() => router.push('/dashboard/facturacion/generador-dte')} disabled={isPending}>
              Cancelar
            </Button>
            <Button type='button' onClick={handleSubmit} isLoading={isPending}>
              <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar' : 'Crear documento'}
            </Button>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={anularOpen}
        onClose={() => setAnularOpen(false)}
        onConfirm={() => anularMutation.mutate()}
        loading={anularMutation.isPending}
        title='Anular documento'
        description='Este documento quedará Anulado y no podrá reactivarse.'
      />

      {isEdit && documento && (
        <DocumentoPreviewDialog
          tipo='documento-manual'
          id={documento.data.id}
          titulo={`${CLASE_LABELS[documento.data.claseDocumento]} ${documento.data.codigo}`}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          controlCopia={false}
        />
      )}
    </div>
  )
}
