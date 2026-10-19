'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { embarquesService } from '../service'
import { IND_TRASLADO_OPCIONES, INDTRASLADO_EXPORTACION } from '../types'
import type { GuiaDespachoDatos, GuiaDespachoPlanta, GuiaDespachoAgente } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const GUIA_KEY = (embarqueId: number) => ['guia-despacho', embarqueId] as const

// Popup con los datos de transporte exigidos por la norma del SII (origen/
// destino, transportista + RUT, chofer + RUT, patentes camión/remolque, tipo
// de traslado). Al confirmar emite el borrador del DTE 52 en LibreDTE.
function EmitirGuiaDialog({
  embarqueId,
  open,
  onOpenChange,
  datos,
  plantas,
  agente,
  onEmitido,
}: {
  embarqueId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  datos: GuiaDespachoDatos
  plantas: GuiaDespachoPlanta[]
  agente: GuiaDespachoAgente | null
  onEmitido: () => void
}) {
  interface FormState {
    indTraslado: string
    transporteId: string
    choferRut: string
    choferNombre: string
    patenteCamion: string
    patenteRemolque: string
    dirOrigen: string
    comunaOrigen: string
    dirDestino: string
    comunaDestino: string
  }
  const [form, setForm] = useState<FormState>({
    indTraslado: '', transporteId: '', choferRut: '', choferNombre: '', patenteCamion: '',
    patenteRemolque: '', dirOrigen: '', comunaOrigen: '', dirDestino: '', comunaDestino: '',
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Precargar desde los datos guardados/defaults cada vez que se abre.
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      indTraslado: datos.indTraslado != null ? String(datos.indTraslado) : '',
      transporteId: datos.transporteId != null ? String(datos.transporteId) : '',
      choferRut: datos.choferRut,
      choferNombre: datos.choferNombre,
      patenteCamion: datos.patenteCamion,
      patenteRemolque: datos.patenteRemolque,
      dirOrigen: datos.dirOrigen,
      comunaOrigen: datos.comunaOrigen,
      dirDestino: datos.dirDestino,
      comunaDestino: datos.comunaDestino,
    })
  }, [open, datos])

  const { data: transportistasData } = useQuery({
    queryKey: ['entidades-options', 'EMPRESA_TRANSPORTE'],
    queryFn: () => entidadesService.list({ tipo: 'EMPRESA_TRANSPORTE', activo: true, limit: 200 }),
    enabled: open,
  })
  const transportistas = transportistasData?.data ?? []

  const mutation = useMutation({
    mutationFn: () =>
      embarquesService.emitirGuiaDespacho(embarqueId, {
        indTraslado: Number(form.indTraslado),
        transporteId: form.transporteId ? Number(form.transporteId) : null,
        choferRut: form.choferRut.trim() || null,
        choferNombre: form.choferNombre.trim() || null,
        patenteCamion: form.patenteCamion.trim() || null,
        patenteRemolque: form.patenteRemolque.trim() || null,
        dirOrigen: form.dirOrigen.trim() || null,
        comunaOrigen: form.comunaOrigen.trim() || null,
        dirDestino: form.dirDestino.trim() || null,
        comunaDestino: form.comunaDestino.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Borrador de Guía de Despacho emitido — revísalo y luego tímbralo')
      onEmitido()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo emitir la Guía de Despacho'),
  })

  function handleSubmit() {
    if (!form.indTraslado) {
      toast.error('Selecciona el tipo de traslado')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>Emitir Guía de Despacho (DTE 52)</DialogTitle>
          <DialogDescription>
            Completa los datos de transporte. Se emitirá un borrador en LibreDTE; luego podrás timbrarlo
            para obtener el folio oficial del SII.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label>Tipo de traslado <span className='text-destructive'>*</span></Label>
            <Select value={form.indTraslado} onValueChange={(v) => set('indTraslado', v)}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar motivo del traslado...' />
              </SelectTrigger>
              <SelectContent>
                {IND_TRASLADO_OPCIONES.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {Number(form.indTraslado) === INDTRASLADO_EXPORTACION && (
            <div className='rounded-md border bg-muted/40 p-3 text-sm'>
              <p className='font-medium'>Receptor: Agente de Aduana</p>
              {agente ? (
                <div className='text-muted-foreground mt-1 space-y-0.5'>
                  <p>{agente.razonSocial}{agente.rut ? ` · ${agente.rut}` : ''}</p>
                  <p>{[agente.direccion, agente.comuna].filter(Boolean).join(', ') || 'Sin dirección asociada al puerto de zarpe'}</p>
                </div>
              ) : (
                <p className='text-destructive mt-1'>El Embarque no tiene Agente de Aduana asignado — complétalo en la Solicitud de Reserva / Instructivo antes de emitir.</p>
              )}
              <p className='text-muted-foreground mt-1 text-xs'>Traslado para exportación: $1/caja exento, con bloque Aduana. La dirección se elige según el puerto de zarpe.</p>
            </div>
          )}

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Empresa de transporte</Label>
              <Select value={form.transporteId} onValueChange={(v) => set('transporteId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder='Seleccionar transportista...' />
                </SelectTrigger>
                <SelectContent>
                  {transportistas.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.razonSocial}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>El RUT del transportista se toma de la entidad seleccionada.</p>
            </div>
            <div className='space-y-1.5'>
              <Label>RUT del chofer</Label>
              <Input value={form.choferRut} onChange={(e) => set('choferRut', e.target.value)} placeholder='12.345.678-9' />
            </div>
            <div className='space-y-1.5'>
              <Label>Nombre del chofer</Label>
              <Input value={form.choferNombre} onChange={(e) => set('choferNombre', e.target.value)} placeholder='Nombre completo' />
            </div>
            <div className='space-y-1.5'>
              <Label>Patente del camión</Label>
              <Input value={form.patenteCamion} onChange={(e) => set('patenteCamion', e.target.value)} placeholder='AABB12' />
            </div>
            <div className='space-y-1.5'>
              <Label>Patente del remolque</Label>
              <Input value={form.patenteRemolque} onChange={(e) => set('patenteRemolque', e.target.value)} placeholder='Si aplica' />
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            {plantas.length > 0 && (
              <div className='space-y-1.5 sm:col-span-2'>
                <Label>Planta de origen</Label>
                <Select
                  onValueChange={(v) => {
                    const p = plantas.find((x) => String(x.instructivoHijoId) === v)
                    if (p) setForm((f) => ({ ...f, dirOrigen: p.direccion ?? f.dirOrigen, comunaOrigen: p.comuna ?? f.comunaOrigen }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Elegir planta para precargar el origen...' />
                  </SelectTrigger>
                  <SelectContent>
                    {plantas.map((p) => (
                      <SelectItem key={p.instructivoHijoId} value={String(p.instructivoHijoId)}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-muted-foreground text-xs'>Precarga la dirección/comuna de origen con la de la planta elegida (editable).</p>
              </div>
            )}
            <div className='space-y-1.5'>
              <Label>Dirección de origen</Label>
              <Input value={form.dirOrigen} onChange={(e) => set('dirOrigen', e.target.value)} placeholder='Dirección de salida' />
            </div>
            <div className='space-y-1.5'>
              <Label>Comuna de origen</Label>
              <Input value={form.comunaOrigen} onChange={(e) => set('comunaOrigen', e.target.value)} placeholder='Comuna' />
            </div>
            <div className='space-y-1.5'>
              <Label>Dirección de destino</Label>
              <Input
                value={Number(form.indTraslado) === INDTRASLADO_EXPORTACION ? (agente?.direccion ?? '') : form.dirDestino}
                onChange={(e) => set('dirDestino', e.target.value)}
                disabled={Number(form.indTraslado) === INDTRASLADO_EXPORTACION}
                placeholder='Dirección de llegada'
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Comuna de destino</Label>
              <Input
                value={Number(form.indTraslado) === INDTRASLADO_EXPORTACION ? (agente?.comuna ?? '') : form.comunaDestino}
                onChange={(e) => set('comunaDestino', e.target.value)}
                disabled={Number(form.indTraslado) === INDTRASLADO_EXPORTACION}
                placeholder='Comuna'
              />
            </div>
            {Number(form.indTraslado) === INDTRASLADO_EXPORTACION && (
              <p className='text-muted-foreground -mt-1 text-xs sm:col-span-2'>
                En exportación el destino es la dirección del agente de aduana asociada al puerto de zarpe (se usa server-side).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='button' isLoading={mutation.isPending} onClick={handleSubmit}>
            <Icons.fileTypePdf className='mr-1 h-4 w-4' /> Emitir borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Popup para registrar una Guía emitida por un TERCERO (no la emitimos
// nosotros): entidad emisora (Productor o Planta), número de guía y fecha.
function RegistrarGuiaExternaDialog({
  embarqueId,
  open,
  onOpenChange,
  onRegistrado,
}: {
  embarqueId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegistrado: () => void
}) {
  const [emisorId, setEmisorId] = useState('')
  const [numero, setNumero] = useState('')
  const [fecha, setFecha] = useState('')

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmisorId('')
    setNumero('')
    setFecha('')
  }, [open])

  // Emisor = Productor o Planta. Dos consultas acotadas que se fusionan (el
  // service.list sólo acepta un `tipo`); dedupe por id porque una Entidad puede
  // ser ambos tipos.
  const { data: productoresData } = useQuery({
    queryKey: ['entidades-options', 'PRODUCTOR'],
    queryFn: () => entidadesService.list({ tipo: 'PRODUCTOR', activo: true, limit: 500 }),
    enabled: open,
  })
  const { data: plantasData } = useQuery({
    queryKey: ['entidades-options', 'PLANTA'],
    queryFn: () => entidadesService.list({ tipo: 'PLANTA', activo: true, limit: 500 }),
    enabled: open,
  })
  const emisores = (() => {
    const map = new Map<number, { id: number; razonSocial: string }>()
    for (const e of [...(productoresData?.data ?? []), ...(plantasData?.data ?? [])]) {
      if (!map.has(e.id)) map.set(e.id, { id: e.id, razonSocial: e.razonSocial })
    }
    return [...map.values()].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial))
  })()

  const mutation = useMutation({
    mutationFn: () =>
      embarquesService.registrarGuiaExterna(embarqueId, {
        emisorId: Number(emisorId),
        numero: numero.trim(),
        fecha: fecha || null,
      }),
    onSuccess: () => {
      toast.success('Guía de Despacho externa registrada')
      onRegistrado()
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo registrar la Guía externa'),
  })

  function handleSubmit() {
    if (!emisorId) {
      toast.error('Selecciona la entidad que emitió la guía')
      return
    }
    if (!numero.trim()) {
      toast.error('Ingresa el número de la guía')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Registrar Guía de Despacho de un tercero</DialogTitle>
          <DialogDescription>
            Cuando la Guía de Despacho no la emitimos nosotros, registra aquí el número y la entidad
            (Productor o Planta) que la emitió para dejar la trazabilidad.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label>Emisor de la guía <span className='text-destructive'>*</span></Label>
            <Select value={emisorId} onValueChange={setEmisorId}>
              <SelectTrigger>
                <SelectValue placeholder='Seleccionar Productor o Planta...' />
              </SelectTrigger>
              <SelectContent>
                {emisores.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>{e.razonSocial}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5'>
              <Label>Número de guía <span className='text-destructive'>*</span></Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder='N° de la guía emitida' />
            </div>
            <div className='space-y-1.5'>
              <Label>Fecha de la guía</Label>
              <Input type='date' value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='button' isLoading={mutation.isPending} onClick={handleSubmit}>
            <Icons.check className='mr-1 h-4 w-4' /> Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Bloque de la Guía de Despacho dentro de la pestaña Despachar (solo visible
// cuando el Embarque ya está despachado). Dos caminos EXCLUYENTES: emitimos
// nosotros el DTE 52 (emitir borrador → timbrar → ver PDF) o registramos la
// guía emitida por un tercero (número + emisor).
export function GuiaDespachoSection({ embarqueId }: { embarqueId: number }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [externaDialogOpen, setExternaDialogOpen] = useState(false)
  const [quitarOpen, setQuitarOpen] = useState(false)

  const { data } = useQuery({
    queryKey: GUIA_KEY(embarqueId),
    queryFn: () => embarquesService.obtenerGuiaDespacho(embarqueId),
  })
  const guia = data?.data
  const doc = guia?.documento ?? null
  const externa = guia?.externa ?? null

  const invalidar = () => queryClient.invalidateQueries({ queryKey: GUIA_KEY(embarqueId) })

  const firmarMutation = useMutation({
    mutationFn: () => embarquesService.firmarGuiaDespacho(embarqueId),
    onSuccess: (res) => {
      const d = res.data
      if (d.estado === 'GENERADO') toast.success(`Guía de Despacho timbrada — folio ${d.folio}`)
      else toast.error(d.errorMensaje || 'No se pudo timbrar la Guía — reintenta')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al timbrar la Guía'),
  })

  const quitarMutation = useMutation({
    mutationFn: () => embarquesService.quitarGuiaExterna(embarqueId),
    onSuccess: () => {
      toast.success('Guía externa quitada')
      setQuitarOpen(false)
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo quitar la Guía externa'),
  })

  const estado = doc?.estado
  const timbrada = estado === 'GENERADO'
  const borrador = estado === 'TEMPORAL_CREADO'
  const enProceso = estado === 'EMITIENDO' || estado === 'GENERANDO'
  // Puede iniciar una guía (propia o externa) sólo si no hay ninguna en curso:
  // sin externa registrada y sin DTE propio (o el propio quedó en ERROR).
  const sinGuiaVigente = externa == null && (!doc || estado === 'ERROR')

  return (
    <div className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Icons.fileTypePdf className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Guía de Despacho</span>
        </div>
        {externa != null && <Badge variant='secondary'>Emitida por un tercero</Badge>}
        {externa == null && timbrada && <Badge className='bg-emerald-600'>Timbrada — folio {doc?.folio}</Badge>}
        {externa == null && borrador && <Badge variant='secondary'>Borrador emitido</Badge>}
        {externa == null && estado === 'ERROR' && <Badge variant='destructive'>Error</Badge>}
        {sinGuiaVigente && <Badge variant='outline'>No emitida</Badge>}
      </div>

      {externa != null && (
        <div className='text-muted-foreground text-xs'>
          <p><span className='font-medium text-foreground'>Emisor:</span> {externa.emisor?.razonSocial ?? '—'}{externa.emisor?.rut ? ` (${externa.emisor.rut})` : ''}</p>
          <p><span className='font-medium text-foreground'>N° de guía:</span> {externa.numero}{externa.fecha ? ` · ${externa.fecha.slice(0, 10)}` : ''}</p>
        </div>
      )}

      {externa == null && doc?.errorMensaje && estado === 'ERROR' && (
        <p className='text-destructive text-xs'>{doc.errorMensaje}</p>
      )}

      {puedeEscribir && (
        <div className='flex flex-wrap gap-2'>
          {sinGuiaVigente && (
            <>
              <Button type='button' size='sm' onClick={() => setDialogOpen(true)}>
                <Icons.fileTypePdf className='mr-1 h-4 w-4' /> Emitir Guía
              </Button>
              <Button type='button' size='sm' variant='outline' onClick={() => setExternaDialogOpen(true)}>
                <Icons.edit className='mr-1 h-4 w-4' /> Registrar guía de un tercero
              </Button>
            </>
          )}

          {externa != null && (
            <Button type='button' size='sm' variant='outline' className='text-destructive' onClick={() => setQuitarOpen(true)}>
              <Icons.trash className='mr-1 h-4 w-4' /> Quitar guía externa
            </Button>
          )}

          {externa == null && borrador && (
            <>
              <Button type='button' size='sm' variant='outline' onClick={() => setDialogOpen(true)}>
                <Icons.edit className='mr-1 h-4 w-4' /> Editar datos
              </Button>
              <Button type='button' size='sm' isLoading={firmarMutation.isPending} onClick={() => firmarMutation.mutate()}>
                <Icons.check className='mr-1 h-4 w-4' /> Timbrar (SII)
              </Button>
            </>
          )}

          {externa == null && enProceso && <span className='text-muted-foreground text-xs'>Procesando en LibreDTE…</span>}

          {externa == null && (borrador || timbrada) && doc?.libredteCodigoTemporal && (
            <Button
              type='button'
              size='sm'
              variant='outline'
              onClick={() => {
                embarquesService
                  .abrirGuiaDespachoPdf(embarqueId)
                  .catch((e: Error) => toast.error(e.message || 'No se pudo abrir la Guía de Despacho'))
              }}
            >
              <Icons.fileTypePdf className='mr-1 h-4 w-4' /> Ver PDF
            </Button>
          )}
        </div>
      )}

      {guia && (
        <EmitirGuiaDialog
          embarqueId={embarqueId}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          datos={guia.datos}
          plantas={guia.plantas}
          agente={guia.agente}
          onEmitido={invalidar}
        />
      )}
      <RegistrarGuiaExternaDialog
        embarqueId={embarqueId}
        open={externaDialogOpen}
        onOpenChange={setExternaDialogOpen}
        onRegistrado={invalidar}
      />
      <AlertModal
        isOpen={quitarOpen}
        onClose={() => setQuitarOpen(false)}
        onConfirm={() => quitarMutation.mutate()}
        loading={quitarMutation.isPending}
        title='Quitar guía externa'
        description='¿Quitar la Guía de Despacho externa registrada? Luego podrás registrar otra o emitir una propia.'
      />
    </div>
  )
}
