'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { ESTADO_RESERVA_LABELS } from '../types'
import type { DatosInstructivoInput, DatosReservaManualInput, EmbarqueDetalle, StackingRangoInput } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const puertosService = createMantenedorService('puertos')

// Datos de booking manual (2026-09-07, ventas.md §4.3) — "Retiro Planta"
// salió del formulario (2026-09-22, decisión de negocio Christian), sin
// reemplazo.
interface DatosReservaForm {
  numeroBooking: string
  nave: string
  numeroContenedor: string
  fechaZarpe: string
}

function formReservaInicial(embarque: EmbarqueDetalle): DatosReservaForm {
  return {
    numeroBooking: embarque.numeroBookingManual ?? '',
    nave: embarque.naveManual ?? '',
    numeroContenedor: embarque.numeroContenedorManual ?? '',
    fechaZarpe: embarque.fechaZarpeManual ? embarque.fechaZarpeManual.slice(0, 10) : '',
  }
}

function soloFecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

// Valor para un input `datetime-local` (formato `YYYY-MM-DDTHH:mm`, sin zona).
function soloFechaHora(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface DatosInstructivoForm {
  puertoZarpeId: string
  voyageNumber: string
  deposito: string
  awbBl: string
  cutoffDate: string
  tipoBultos: string
  agenteAduanaId: string
  embarcadorId: string
  navieraId: string
  fechaArribo: string
  observacionesInstructivo: string
}

function formInstructivoInicial(embarque: EmbarqueDetalle): DatosInstructivoForm {
  return {
    puertoZarpeId: embarque.puertoZarpeId ? String(embarque.puertoZarpeId) : '',
    voyageNumber: embarque.voyageNumber ?? '',
    deposito: embarque.deposito ?? '',
    awbBl: embarque.awbBl ?? '',
    cutoffDate: soloFecha(embarque.cutoffDate),
    tipoBultos: embarque.tipoBultos ?? '',
    agenteAduanaId: embarque.agenteAduanaId ? String(embarque.agenteAduanaId) : '',
    embarcadorId: embarque.embarcadorId ? String(embarque.embarcadorId) : '',
    navieraId: embarque.navieraId ? String(embarque.navieraId) : '',
    fechaArribo: soloFecha(embarque.fechaArribo),
    observacionesInstructivo: embarque.observacionesInstructivo ?? '',
  }
}

// Un rango en edición — strings vacíos mientras se está completando una fila
// nueva; se descartan al guardar si quedan incompletas (ver validarRangos).
interface RangoForm {
  desde: string
  hasta: string
}

function rangosInicial(embarque: EmbarqueDetalle): RangoForm[] {
  return embarque.stackingRangos.map((r) => ({ desde: soloFechaHora(r.desde), hasta: soloFechaHora(r.hasta) }))
}

export function SolicitudReservaTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DatosReservaForm>(() => formReservaInicial(embarque))
  const [formInstructivo, setFormInstructivo] = useState<DatosInstructivoForm>(() => formInstructivoInicial(embarque))
  const [rangos, setRangos] = useState<RangoForm[]>(() => rangosInicial(embarque))

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
    queryClient.invalidateQueries({ queryKey: embarquesKeys.all })
  }

  const solicitarMutation = useMutation({
    mutationFn: () => embarquesService.solicitarReserva(embarque.id),
    onSuccess: () => {
      toast.success('Solicitud de Reserva enviada')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo conectar con la integración — inténtalo de nuevo más tarde'),
  })

  // "Dejar Manual" (2026-09-07, ventas.md §4.3) — desde un Embarque
  // PENDIENTE (nunca se intentó, o el último intento automático falló),
  // abandona el camino automático y habilita el tipeo directo de los datos
  // de booking.
  const dejarManualMutation = useMutation({
    mutationFn: () => embarquesService.dejarReservaManual(embarque.id),
    onSuccess: () => {
      toast.success('Reserva pasada a modo manual — ingresa los datos de booking')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo pasar a modo manual'),
  })

  const { data: puertosData } = useQuery({
    queryKey: ['puertos-options-instructivo'],
    queryFn: () => puertosService.list({ limit: 200 }),
    staleTime: 60_000,
  })
  const { data: agentesData } = useQuery({
    queryKey: ['entidades-agente-aduana-options'],
    queryFn: () => entidadesService.list({ tipo: 'AGENTE_ADUANA', activo: true, limit: 200 }),
    staleTime: 60_000,
  })
  const { data: embarcadoresData } = useQuery({
    queryKey: ['entidades-embarcador-options'],
    queryFn: () => entidadesService.list({ tipo: 'COMPANIA_EMBARQUE', activo: true, limit: 200 }),
    staleTime: 60_000,
  })
  const { data: navierasData } = useQuery({
    queryKey: ['entidades-naviera-options'],
    queryFn: () => entidadesService.list({ tipo: 'NAVIERA', activo: true, limit: 200 }),
    staleTime: 60_000,
  })

  const solicitud = embarque.solicitudReserva

  // El booking (Booking/Contenedor/Nave/Fecha Embarque) solo es editable en
  // modo manual — en modo automático (AGL360) se muestra de solo lectura,
  // tomado de `solicitud` una vez confirmada (2026-09-22: unificado en un
  // solo bloque junto a los Datos del Instructivo, ver campoBooking abajo).
  const bookingEditable = embarque.reservaManual && embarque.estadoReserva !== 'SOLICITADA'

  function campoBooking(valor: string, onChange: (v: string) => void, automatico: string | null | undefined, tipo: 'text' | 'date' = 'text') {
    if (bookingEditable) {
      return <Input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} disabled={!puedeEscribir} />
    }
    const texto = tipo === 'date' && automatico ? new Date(automatico).toLocaleDateString('es-CL') : (automatico ?? '—')
    return <p className='text-muted-foreground py-2 text-sm'>{texto}</p>
  }

  function agregarRango() {
    setRangos((r) => [...r, { desde: '', hasta: '' }])
  }
  function quitarRango(i: number) {
    setRangos((r) => r.filter((_, idx) => idx !== i))
  }
  function actualizarRango(i: number, campo: 'desde' | 'hasta', valor: string) {
    setRangos((r) => r.map((row, idx) => (idx === i ? { ...row, [campo]: valor } : row)))
  }

  // Solo filas completas viajan al backend — una fila con un solo lado
  // lleno se rechaza acá mismo (mensaje claro) en vez de dejar que el 422
  // del backend sea la primera noticia.
  function rangosParaGuardar(): StackingRangoInput[] | null {
    const completos: StackingRangoInput[] = []
    for (const r of rangos) {
      if (!r.desde && !r.hasta) continue
      if (!r.desde || !r.hasta) {
        toast.error('Hay un rango de Stacking con solo una fecha completada — llena ambas o elimina la fila')
        return null
      }
      if (new Date(r.hasta) <= new Date(r.desde)) {
        toast.error('En cada rango de Stacking, "hasta" debe ser posterior a "desde"')
        return null
      }
      completos.push({ desde: r.desde, hasta: r.hasta })
    }
    return completos
  }

  // "Un solo Guardar para todo" (2026-09-22, decisión de negocio Christian):
  // un único bloque (Reserva + Instructivo, ya no dos cards separadas) con
  // un único botón — sigue habiendo dos PATCH distintos en el backend
  // (dominios separados), pero un solo click dispara ambos.
  const guardarTodoMutation = useMutation({
    mutationFn: async () => {
      const stackingRangos = rangosParaGuardar()
      if (stackingRangos === null) throw new Error('__VALIDACION_LOCAL__')

      const tareas: Promise<unknown>[] = []
      if (bookingEditable) {
        const datosReserva: DatosReservaManualInput = {
          numeroBooking: form.numeroBooking || null,
          nave: form.nave || null,
          numeroContenedor: form.numeroContenedor || null,
          fechaZarpe: form.fechaZarpe || null,
        }
        tareas.push(embarquesService.guardarDatosReservaManual(embarque.id, datosReserva))
      }
      const datosInstructivo: DatosInstructivoInput = {
        puertoZarpeId: formInstructivo.puertoZarpeId ? Number(formInstructivo.puertoZarpeId) : null,
        voyageNumber: formInstructivo.voyageNumber || null,
        deposito: formInstructivo.deposito || null,
        awbBl: formInstructivo.awbBl || null,
        cutoffDate: formInstructivo.cutoffDate || null,
        tipoBultos: formInstructivo.tipoBultos || null,
        agenteAduanaId: formInstructivo.agenteAduanaId ? Number(formInstructivo.agenteAduanaId) : null,
        embarcadorId: formInstructivo.embarcadorId ? Number(formInstructivo.embarcadorId) : null,
        navieraId: formInstructivo.navieraId ? Number(formInstructivo.navieraId) : null,
        fechaArribo: formInstructivo.fechaArribo || null,
        stackingRangos,
        observacionesInstructivo: formInstructivo.observacionesInstructivo || null,
      }
      tareas.push(embarquesService.guardarDatosInstructivo(embarque.id, datosInstructivo))
      await Promise.all(tareas)
    },
    onSuccess: () => {
      toast.success('Datos guardados')
      invalidar()
    },
    onError: (e: Error) => {
      if (e.message === '__VALIDACION_LOCAL__') return // toast ya mostrado en rangosParaGuardar()
      toast.error(e.message || 'No se pudieron guardar los datos')
    },
  })

  return (
    <div className='space-y-4 rounded-md border p-6'>
      <div className='flex items-center gap-2'>
        <Badge variant={embarque.estadoReserva === 'CONFIRMADA' ? 'default' : embarque.estadoReserva === 'SOLICITADA' ? 'secondary' : 'destructive'}>
          {ESTADO_RESERVA_LABELS[embarque.estadoReserva]}
        </Badge>
        {embarque.reservaManual && <Badge variant='outline'>Manual</Badge>}
        <span className='text-sm text-muted-foreground'>
          Gestor: {embarque.gestorLogistico?.descripcion ?? 'Sin gestor asignado (Embarque anterior a esta función)'}
        </span>
      </div>

      {embarque.estadoReserva === 'PENDIENTE' && !embarque.reservaManual && (
        <div className='space-y-3 text-center'>
          <p className='text-sm text-muted-foreground'>
            Este Embarque no tiene una Solicitud de Reserva enviada — la última integración falló o nunca se
            intentó.
          </p>
          {puedeEscribir && (
            <div className='flex justify-center gap-2'>
              <Button type='button' onClick={() => solicitarMutation.mutate()} isLoading={solicitarMutation.isPending}>
                <Icons.check className='mr-1 h-4 w-4' /> Reintentar
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => dejarManualMutation.mutate()}
                isLoading={dejarManualMutation.isPending}
              >
                Dejar Manual
              </Button>
            </div>
          )}
        </div>
      )}

      {embarque.estadoReserva === 'SOLICITADA' && (
        <p className='text-sm text-muted-foreground'>
          Solicitud enviada el {solicitud ? new Date(solicitud.enviadoEn).toLocaleString('es-CL') : '—'} — esperando
          confirmación del gestor logístico.
        </p>
      )}

      {/* Un solo bloque (2026-09-22, decisión de negocio Christian): booking
          (manual o automático, ver campoBooking) y Datos del Instructivo
          conviven en la misma grilla, en pares lógicos. */}
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1.5'>
          <Label>Booking</Label>
          {campoBooking(form.numeroBooking, (v) => setForm((f) => ({ ...f, numeroBooking: v })), solicitud?.numeroBooking)}
        </div>
        <div className='space-y-1.5'>
          <Label>AWB / BL</Label>
          <Input value={formInstructivo.awbBl} onChange={(e) => setFormInstructivo((f) => ({ ...f, awbBl: e.target.value }))} disabled={!puedeEscribir} />
        </div>

        <div className='space-y-1.5'>
          <Label>Contenedor</Label>
          {campoBooking(form.numeroContenedor, (v) => setForm((f) => ({ ...f, numeroContenedor: v })), solicitud?.numeroContenedor)}
        </div>
        <div className='space-y-1.5'>
          <Label>Naviera</Label>
          <Combobox
            value={formInstructivo.navieraId}
            onChange={(v) => setFormInstructivo((f) => ({ ...f, navieraId: v }))}
            placeholder='Seleccionar naviera...'
            searchPlaceholder='Buscar naviera...'
            options={(navierasData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
            disabled={!puedeEscribir}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>Nave</Label>
          {campoBooking(form.nave, (v) => setForm((f) => ({ ...f, nave: v })), solicitud?.nave)}
        </div>
        <div className='space-y-1.5'>
          <Label>Número de Viaje</Label>
          <Input value={formInstructivo.voyageNumber} onChange={(e) => setFormInstructivo((f) => ({ ...f, voyageNumber: e.target.value }))} disabled={!puedeEscribir} />
        </div>

        <div className='space-y-1.5'>
          <Label>Fecha Embarque</Label>
          {campoBooking(form.fechaZarpe, (v) => setForm((f) => ({ ...f, fechaZarpe: v })), solicitud?.fechaZarpe, 'date')}
        </div>
        <div className='space-y-1.5'>
          <Label>Fecha Arribo</Label>
          <Input type='date' value={formInstructivo.fechaArribo} onChange={(e) => setFormInstructivo((f) => ({ ...f, fechaArribo: e.target.value }))} disabled={!puedeEscribir} />
        </div>

        <div className='space-y-1.5'>
          <Label>Puerto Embarque</Label>
          <Combobox
            value={formInstructivo.puertoZarpeId}
            onChange={(v) => setFormInstructivo((f) => ({ ...f, puertoZarpeId: v }))}
            placeholder='Seleccionar puerto...'
            searchPlaceholder='Buscar puerto...'
            options={(puertosData?.data ?? []).map((p) => ({ value: String(p.id), label: p.descripcion }))}
            disabled={!puedeEscribir}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>Depósito</Label>
          <Input value={formInstructivo.deposito} onChange={(e) => setFormInstructivo((f) => ({ ...f, deposito: e.target.value }))} disabled={!puedeEscribir} />
        </div>

        <div className='space-y-1.5'>
          <Label>Embarcador</Label>
          <Combobox
            value={formInstructivo.embarcadorId}
            onChange={(v) => setFormInstructivo((f) => ({ ...f, embarcadorId: v }))}
            placeholder='Seleccionar embarcador...'
            searchPlaceholder='Buscar embarcador...'
            options={(embarcadoresData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
            disabled={!puedeEscribir}
          />
        </div>
        <div className='space-y-1.5'>
          <Label>Agente de Aduana</Label>
          <Combobox
            value={formInstructivo.agenteAduanaId}
            onChange={(v) => setFormInstructivo((f) => ({ ...f, agenteAduanaId: v }))}
            placeholder='Seleccionar agente...'
            searchPlaceholder='Buscar agente...'
            options={(agentesData?.data ?? []).map((e) => ({ value: String(e.id), label: e.descripcion }))}
            disabled={!puedeEscribir}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>Tipo de Bulto</Label>
          <Input value={formInstructivo.tipoBultos} onChange={(e) => setFormInstructivo((f) => ({ ...f, tipoBultos: e.target.value }))} disabled={!puedeEscribir} />
        </div>
        <div className='space-y-1.5'>
          <Label>Cutoff</Label>
          <Input type='date' value={formInstructivo.cutoffDate} onChange={(e) => setFormInstructivo((f) => ({ ...f, cutoffDate: e.target.value }))} disabled={!puedeEscribir} />
        </div>
      </div>

      <div className='space-y-2'>
        <Label>Stacking</Label>
        {rangos.length === 0 && <p className='text-muted-foreground text-sm'>Sin rangos de stacking definidos.</p>}
        {rangos.map((r, i) => (
          <div key={i} className='flex items-center gap-2'>
            <Input type='datetime-local' value={r.desde} onChange={(e) => actualizarRango(i, 'desde', e.target.value)} disabled={!puedeEscribir} />
            <span className='text-muted-foreground text-sm'>a</span>
            <Input type='datetime-local' value={r.hasta} onChange={(e) => actualizarRango(i, 'hasta', e.target.value)} disabled={!puedeEscribir} />
            {puedeEscribir && (
              <Button type='button' variant='ghost' size='icon' onClick={() => quitarRango(i)}>
                <Icons.trash className='h-4 w-4' />
              </Button>
            )}
          </div>
        ))}
        {puedeEscribir && (
          <Button type='button' variant='outline' size='sm' onClick={agregarRango}>
            <Icons.add className='mr-1 h-4 w-4' /> Agregar rango
          </Button>
        )}
      </div>

      <div className='space-y-1.5'>
        <Label>Observaciones</Label>
        <Textarea
          value={formInstructivo.observacionesInstructivo}
          onChange={(e) => setFormInstructivo((f) => ({ ...f, observacionesInstructivo: e.target.value }))}
          disabled={!puedeEscribir}
        />
      </div>

      {puedeEscribir && (
        <div className='flex justify-center'>
          <Button type='button' onClick={() => guardarTodoMutation.mutate()} isLoading={guardarTodoMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        </div>
      )}
    </div>
  )
}
