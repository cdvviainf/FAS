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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { embarquesService } from '../service'
import { IND_TRASLADO_OPCIONES, INDTRASLADO_EXPORTACION } from '../types'
import type { GuiaDespachoDatos, GuiaDespachoPlanta, GuiaDespachoAgente, GuiaDespachoValidacion } from '../types'

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
  validacion,
  onEmitido,
}: {
  embarqueId: number
  open: boolean
  onOpenChange: (open: boolean) => void
  datos: GuiaDespachoDatos
  plantas: GuiaDespachoPlanta[]
  agente: GuiaDespachoAgente | null
  validacion: GuiaDespachoValidacion
  onEmitido: () => void
}) {
  interface FormState {
    indTraslado: string
    transporteId: string
    // 'SI' = chofer chileno (RUT obligatorio) / 'NO' = extranjero (RUT opcional).
    choferChileno: string
    choferRut: string
    choferNombre: string
    patenteCamion: string
    patenteRemolque: string
    // Planta de origen elegida (instructivoHijoId) y dirección elegida de esa
    // planta (id de EntidadDireccion); dirOrigen/comunaOrigen se derivan de ella.
    plantaId: string
    dirOrigenId: string
    dirOrigen: string
    comunaOrigen: string
    dirDestino: string
    comunaDestino: string
  }
  const [form, setForm] = useState<FormState>({
    // Tipo de traslado fijo: la Guía desde Embarque es siempre "Traslado para
    // exportación (no venta)" — no elegible (decisión de negocio).
    indTraslado: String(INDTRASLADO_EXPORTACION), transporteId: '', choferChileno: 'SI', choferRut: '', choferNombre: '', patenteCamion: '',
    patenteRemolque: '', plantaId: '', dirOrigenId: '', dirOrigen: '', comunaOrigen: '', dirDestino: '', comunaDestino: '',
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Precargar desde los datos guardados/defaults cada vez que se abre.
  useEffect(() => {
    if (!open) return
    // Si la dirección de origen guardada coincide con una de las direcciones de
    // alguna planta, se preselecciona esa dirección en el select.
    const dirGuardada = datos.dirOrigen
    let plantaIdPre = ''
    let dirOrigenIdPre = ''
    for (const p of plantas) {
      const match = p.direcciones.find((d) => d.direccion === dirGuardada)
      if (match) { plantaIdPre = String(p.instructivoHijoId); dirOrigenIdPre = String(match.id); break }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      // Fijo en exportación (no venta) — ver nota en el estado inicial.
      indTraslado: String(INDTRASLADO_EXPORTACION),
      transporteId: datos.transporteId != null ? String(datos.transporteId) : '',
      choferChileno: datos.choferChileno === false ? 'NO' : 'SI',
      choferRut: datos.choferRut,
      choferNombre: datos.choferNombre,
      patenteCamion: datos.patenteCamion,
      patenteRemolque: datos.patenteRemolque,
      plantaId: plantaIdPre,
      dirOrigenId: dirOrigenIdPre,
      dirOrigen: datos.dirOrigen,
      comunaOrigen: datos.comunaOrigen,
      dirDestino: datos.dirDestino,
      comunaDestino: datos.comunaDestino,
    })
  }, [open, datos, plantas])

  const { data: transportistasData } = useQuery({
    queryKey: ['entidades-options', 'EMPRESA_TRANSPORTE'],
    queryFn: () => entidadesService.list({ tipo: 'EMPRESA_TRANSPORTE', activo: true, limit: 200 }),
    enabled: open,
  })
  const transportistas = transportistasData?.data ?? []

  const esChileno = form.choferChileno === 'SI'
  // Planta de origen elegida y sus direcciones (para el select de origen).
  const plantaSel = plantas.find((p) => String(p.instructivoHijoId) === form.plantaId)
  const dirsOrigen = plantaSel?.direcciones ?? []
  // Falta la dirección del agente por puerto (destino): server-side bloquea,
  // pero se deshabilita el emitir para avisar antes.
  const faltaDestino = !agente?.direccion
  const faltaOrigen = !form.dirOrigenId
  // Datos del bloque Aduana sin Código de Aduana / sin selección: bloquean el SII.
  const faltanAduana = validacion.faltantes.length > 0
  const puedeEmitir = !faltaDestino && !faltaOrigen && !faltanAduana

  const mutation = useMutation({
    mutationFn: () =>
      embarquesService.emitirGuiaDespacho(embarqueId, {
        indTraslado: Number(form.indTraslado),
        transporteId: form.transporteId ? Number(form.transporteId) : null,
        choferChileno: esChileno,
        choferRut: form.choferRut.trim() || null,
        choferNombre: form.choferNombre.trim() || null,
        patenteCamion: form.patenteCamion.trim() || null,
        patenteRemolque: form.patenteRemolque.trim() || null,
        instructivoHijoId: form.plantaId ? Number(form.plantaId) : null,
        direccionOrigenId: form.dirOrigenId ? Number(form.dirOrigenId) : null,
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
    if (esChileno && !form.choferRut.trim()) {
      toast.error('El RUT del chofer es obligatorio para un chofer chileno (o marca el chofer como no chileno)')
      return
    }
    if (faltaOrigen) {
      toast.error('Selecciona la dirección de origen de la planta')
      return
    }
    if (faltaDestino) {
      toast.error('El Agente de Aduana no tiene una dirección asociada al puerto de zarpe — asóciala antes de emitir')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-auto sm:max-w-[900px]'>
        <DialogHeader>
          <DialogTitle>Emitir Guía de Despacho (DTE 52)</DialogTitle>
          <DialogDescription>
            Completa los datos de transporte. Se emitirá un borrador en LibreDTE; luego podrás timbrarlo
            para obtener el folio oficial del SII.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label>Tipo de traslado</Label>
            {/* Fijo en "Traslado para exportación (no venta)" — no elegible
                (la Guía desde Embarque siempre es exportación). */}
            <Select value={form.indTraslado} disabled>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(INDTRASLADO_EXPORTACION)}>
                  {IND_TRASLADO_OPCIONES.find((o) => o.value === INDTRASLADO_EXPORTACION)?.label}
                </SelectItem>
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

          {/* Resumen pre-vuelo: todo lo que irá en la Guía (bloque Aduana del SII),
              marcando en rojo lo que falta (sin Código de Aduana o sin selección). */}
          <div className='rounded-md border p-3'>
            <div className='flex items-center justify-between gap-2'>
              <p className='text-sm font-medium'>Datos para el SII (bloque Aduana)</p>
              {faltanAduana ? (
                <Badge variant='destructive'>Faltan {validacion.faltantes.length} dato(s)</Badge>
              ) : (
                <Badge className='bg-emerald-600'>Completo</Badge>
              )}
            </div>
            {faltanAduana && (
              <p className='text-destructive mt-1 text-xs'>
                Completa el <span className='font-medium'>Código de Aduana (SII)</span> en el mantenedor correspondiente
                (Cláusula de Venta, Tipo de Embarque, Puerto, País) o selecciona el Puerto de Zarpe en el Embarque.
              </p>
            )}
            <div className='mt-2 overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-muted-foreground text-left text-xs'>
                    <th className='py-1 pr-3 font-medium'>Campo</th>
                    <th className='py-1 pr-3 font-medium'>Valor</th>
                    <th className='py-1 font-medium'>Código SII</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Receptor = Agente de Aduana: exige RUT + dirección por puerto. */}
                  <tr className={validacion.receptor.falta ? 'text-destructive' : ''}>
                    <td className='py-1 pr-3'>{validacion.receptor.etiqueta}</td>
                    <td className='py-1 pr-3' colSpan={2}>
                      {!validacion.receptor.razonSocial
                        ? '⚠ Sin Agente de Aduana asignado'
                        : !validacion.receptor.rut
                          ? `⚠ ${validacion.receptor.razonSocial} — sin RUT configurado`
                          : !validacion.receptor.direccion
                            ? `⚠ ${validacion.receptor.razonSocial} · ${validacion.receptor.rut} — sin dirección para el puerto de zarpe`
                            : `${validacion.receptor.razonSocial} · ${validacion.receptor.rut} — ${[validacion.receptor.direccion, validacion.receptor.comuna].filter(Boolean).join(', ')}`}
                    </td>
                  </tr>
                  {validacion.bloqueAduana.map((it) => (
                    <tr key={it.etiqueta} className={it.falta ? 'text-destructive' : ''}>
                      <td className='py-1 pr-3'>
                        {it.etiqueta}
                        {it.requerido && <span className='text-destructive'> *</span>}
                      </td>
                      <td className='py-1 pr-3'>{it.valor ?? (it.requerido ? '⚠ Sin dato' : '—')}</td>
                      <td className='py-1'>
                        {it.codigoAduana?.trim()
                          ? it.codigoAduana
                          : it.requerido
                            ? <span className='font-medium'>⚠ Falta código de Aduana</span>
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-1.5'>
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
            </div>
            <div className='space-y-1.5'>
              <Label>Nombre del chofer</Label>
              <Input value={form.choferNombre} onChange={(e) => set('choferNombre', e.target.value)} placeholder='Nombre completo' />
            </div>
            <div className='space-y-1.5'>
              <Label>Chofer chileno</Label>
              <Select value={form.choferChileno} onValueChange={(v) => set('choferChileno', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='SI'>Sí</SelectItem>
                  <SelectItem value='NO'>No</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>RUT del chofer {esChileno && <span className='text-destructive'>*</span>}</Label>
              <Input
                value={form.choferRut}
                onChange={(e) => set('choferRut', e.target.value)}
                placeholder={esChileno ? '12.345.678-9' : 'Opcional (chofer extranjero)'}
              />
            </div>
            <div className='space-y-1.5'>
              <Label>Patente del camión</Label>
              <Input value={form.patenteCamion} onChange={(e) => set('patenteCamion', e.target.value)} placeholder='AABB12' />
            </div>
            <div className='space-y-1.5'>
              <Label>Patente del remolque</Label>
              <Input value={form.patenteRemolque} onChange={(e) => set('patenteRemolque', e.target.value)} placeholder='Si aplica' />
            </div>
            <p className='text-muted-foreground text-xs sm:col-span-2'>El RUT del transportista se toma de la entidad seleccionada.</p>
          </div>

          <div className='grid gap-3 sm:grid-cols-2'>
            {plantas.length > 0 && (
              <div className='space-y-1.5 sm:col-span-2'>
                <Label>Planta de origen</Label>
                <Select
                  value={form.plantaId}
                  onValueChange={(v) => {
                    const p = plantas.find((x) => String(x.instructivoHijoId) === v)
                    const d = p?.direcciones[0]
                    setForm((f) => ({
                      ...f,
                      plantaId: v,
                      dirOrigenId: d ? String(d.id) : '',
                      dirOrigen: d?.direccion ?? '',
                      comunaOrigen: d?.comuna ?? '',
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Elegir planta de origen...' />
                  </SelectTrigger>
                  <SelectContent>
                    {plantas.map((p) => (
                      <SelectItem key={p.instructivoHijoId} value={String(p.instructivoHijoId)}>{p.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Dirección de origen <span className='text-destructive'>*</span></Label>
              <Select
                value={form.dirOrigenId}
                disabled={!form.plantaId}
                onValueChange={(v) => {
                  const d = dirsOrigen.find((x) => String(x.id) === v)
                  setForm((f) => ({ ...f, dirOrigenId: v, dirOrigen: d?.direccion ?? '', comunaOrigen: d?.comuna ?? '' }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.plantaId ? 'Elegir dirección de la planta...' : 'Elige primero la planta'} />
                </SelectTrigger>
                <SelectContent>
                  {dirsOrigen.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>{[d.direccion, d.comuna].filter(Boolean).join(', ') || 'Sin dirección'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.plantaId && dirsOrigen.length === 0 && (
                <p className='text-destructive text-xs'>La planta no tiene direcciones cargadas — agrégale una en Entidades.</p>
              )}
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Comuna de origen</Label>
              <Input value={form.comunaOrigen} disabled placeholder='—' />
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
              <Label>Dirección de destino</Label>
              <Input
                value={Number(form.indTraslado) === INDTRASLADO_EXPORTACION ? (agente?.direccion ?? '') : form.dirDestino}
                onChange={(e) => set('dirDestino', e.target.value)}
                disabled={Number(form.indTraslado) === INDTRASLADO_EXPORTACION}
                placeholder='Dirección de llegada'
              />
            </div>
            <div className='space-y-1.5 sm:col-span-2'>
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
          {!puedeEmitir && (
            <p className='text-destructive mr-auto self-center text-xs'>
              {faltanAduana
                ? `Faltan datos del bloque Aduana: ${validacion.faltantes.join('; ')}.`
                : faltaDestino
                  ? 'Falta la dirección del Agente de Aduana asociada al puerto de zarpe.'
                  : 'Selecciona la dirección de origen de la planta.'}
            </p>
          )}
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='button' isLoading={mutation.isPending} onClick={handleSubmit} disabled={!puedeEmitir}>
            <Icons.fileTypePdf className='mr-1 h-4 w-4' /> Emitir borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Bloque de la Guía de Despacho dentro de la pestaña Despachar (solo visible
// cuando el Embarque ya está despachado): emitimos nosotros el DTE 52 (emitir
// borrador → timbrar → ver PDF). Las guías con que llegó la fruta de cada
// productor/planta se registran por pallet desde el Packing List.
export function GuiaDespachoSection({ embarqueId }: { embarqueId: number }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data } = useQuery({
    queryKey: GUIA_KEY(embarqueId),
    queryFn: () => embarquesService.obtenerGuiaDespacho(embarqueId),
  })
  const guia = data?.data
  const doc = guia?.documento ?? null

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

  const estado = doc?.estado
  const timbrada = estado === 'GENERADO'
  const borrador = estado === 'TEMPORAL_CREADO'
  const enProceso = estado === 'EMITIENDO' || estado === 'GENERANDO'
  // Puede emitir una guía propia sólo si no hay ninguna en curso (sin DTE propio o
  // el propio quedó en ERROR).
  const sinGuiaVigente = !doc || estado === 'ERROR'

  return (
    <div className='space-y-3 rounded-md border p-4'>
      <div className='flex items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <Icons.fileTypePdf className='text-muted-foreground h-4 w-4' />
          <span className='text-sm font-medium'>Guía de Despacho</span>
        </div>
        {timbrada && <Badge className='bg-emerald-600'>Timbrada — folio {doc?.folio}</Badge>}
        {borrador && <Badge variant='secondary'>Borrador emitido</Badge>}
        {estado === 'ERROR' && <Badge variant='destructive'>Error</Badge>}
        {sinGuiaVigente && <Badge variant='outline'>No emitida</Badge>}
      </div>

      {doc?.errorMensaje && estado === 'ERROR' && (
        <p className='text-destructive text-xs'>{doc.errorMensaje}</p>
      )}

      {puedeEscribir && (
        <div className='flex flex-wrap gap-2'>
          {sinGuiaVigente && (
            <Button type='button' size='sm' onClick={() => setDialogOpen(true)}>
              <Icons.fileTypePdf className='mr-1 h-4 w-4' /> Emitir Guía
            </Button>
          )}

          {borrador && (
            <>
              <Button type='button' size='sm' variant='outline' onClick={() => setDialogOpen(true)}>
                <Icons.edit className='mr-1 h-4 w-4' /> Editar datos
              </Button>
              <Button type='button' size='sm' isLoading={firmarMutation.isPending} onClick={() => firmarMutation.mutate()}>
                <Icons.check className='mr-1 h-4 w-4' /> Timbrar (SII)
              </Button>
            </>
          )}

          {enProceso && <span className='text-muted-foreground text-xs'>Procesando en LibreDTE…</span>}

          {(borrador || timbrada) && doc?.libredteCodigoTemporal && (
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
          validacion={guia.validacion}
          onEmitido={invalidar}
        />
      )}
    </div>
  )
}
