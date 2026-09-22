'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { entidadesService } from '@/features/entidades/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { ESTADO_RESERVA_LABELS } from '../types'
import type { DatosInstructivoInput, DatosReservaManualInput, EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const puertosService = createMantenedorService('puertos')

interface DatosReservaForm {
  numeroBooking: string
  nave: string
  numeroContenedor: string
  fechaZarpe: string
  fechaRetiroPlanta: string
}

function formReservaInicial(embarque: EmbarqueDetalle): DatosReservaForm {
  return {
    numeroBooking: embarque.numeroBookingManual ?? '',
    nave: embarque.naveManual ?? '',
    numeroContenedor: embarque.numeroContenedorManual ?? '',
    fechaZarpe: embarque.fechaZarpeManual ? embarque.fechaZarpeManual.slice(0, 10) : '',
    fechaRetiroPlanta: embarque.fechaRetiroPlantaManual ? embarque.fechaRetiroPlantaManual.slice(0, 10) : '',
  }
}

function soloFecha(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
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
  }
}

export function SolicitudReservaTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DatosReservaForm>(() => formReservaInicial(embarque))
  const [formInstructivo, setFormInstructivo] = useState<DatosInstructivoForm>(() => formInstructivoInicial(embarque))

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

  const guardarDatosMutation = useMutation({
    mutationFn: (datos: DatosReservaManualInput) => embarquesService.guardarDatosReservaManual(embarque.id, datos),
    onSuccess: () => {
      toast.success('Datos de la reserva guardados')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron guardar los datos de la reserva'),
  })

  // ─── Datos del Instructivo (ventas.md R11) — independientes de
  // reservaManual/estadoReserva, siempre editables desde esta misma pantalla
  // (2026-09-22, decisión de negocio Christian: "todos los datos del
  // instructivo deben quedar en la misma pantalla"; la pestaña "Generar
  // Instructivos" queda solo con la generación por planta).

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

  const guardarDatosInstructivoMutation = useMutation({
    mutationFn: (datos: DatosInstructivoInput) => embarquesService.guardarDatosInstructivo(embarque.id, datos),
    onSuccess: () => {
      toast.success('Datos del Instructivo guardados')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudieron guardar los datos del Instructivo'),
  })

  const guardarDatosInstructivo = () => {
    guardarDatosInstructivoMutation.mutate({
      puertoZarpeId: formInstructivo.puertoZarpeId ? Number(formInstructivo.puertoZarpeId) : null,
      voyageNumber: formInstructivo.voyageNumber || null,
      deposito: formInstructivo.deposito || null,
      awbBl: formInstructivo.awbBl || null,
      cutoffDate: formInstructivo.cutoffDate || null,
      tipoBultos: formInstructivo.tipoBultos || null,
      agenteAduanaId: formInstructivo.agenteAduanaId ? Number(formInstructivo.agenteAduanaId) : null,
      embarcadorId: formInstructivo.embarcadorId ? Number(formInstructivo.embarcadorId) : null,
      navieraId: formInstructivo.navieraId ? Number(formInstructivo.navieraId) : null,
    })
  }

  const solicitud = embarque.solicitudReserva

  const guardarDatos = () => {
    guardarDatosMutation.mutate({
      numeroBooking: form.numeroBooking || null,
      nave: form.nave || null,
      numeroContenedor: form.numeroContenedor || null,
      fechaZarpe: form.fechaZarpe || null,
      fechaRetiroPlanta: form.fechaRetiroPlanta || null,
    })
  }

  return (
    <div className='space-y-6'>
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

        {embarque.reservaManual && embarque.estadoReserva !== 'SOLICITADA' && (
          <div className='space-y-3'>
            <p className='text-sm text-muted-foreground'>
              Reserva manual — ingresa los datos de booking a medida que los recibas del gestor logístico.
            </p>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label>N° Booking</Label>
                <Input value={form.numeroBooking} onChange={(e) => setForm((f) => ({ ...f, numeroBooking: e.target.value }))} disabled={!puedeEscribir} />
              </div>
              <div className='space-y-1.5'>
                <Label>Nave</Label>
                <Input value={form.nave} onChange={(e) => setForm((f) => ({ ...f, nave: e.target.value }))} disabled={!puedeEscribir} />
              </div>
              <div className='space-y-1.5'>
                <Label>Contenedor</Label>
                <Input value={form.numeroContenedor} onChange={(e) => setForm((f) => ({ ...f, numeroContenedor: e.target.value }))} disabled={!puedeEscribir} />
              </div>
              <div className='space-y-1.5'>
                <Label>Fecha Zarpe</Label>
                <Input type='date' value={form.fechaZarpe} onChange={(e) => setForm((f) => ({ ...f, fechaZarpe: e.target.value }))} disabled={!puedeEscribir} />
              </div>
              <div className='space-y-1.5'>
                <Label>Retiro Planta</Label>
                <Input type='date' value={form.fechaRetiroPlanta} onChange={(e) => setForm((f) => ({ ...f, fechaRetiroPlanta: e.target.value }))} disabled={!puedeEscribir} />
              </div>
            </div>
            {puedeEscribir && (
              <Button type='button' onClick={guardarDatos} isLoading={guardarDatosMutation.isPending}>
                <Icons.check className='mr-1 h-4 w-4' /> Guardar
              </Button>
            )}
          </div>
        )}

        {embarque.estadoReserva === 'CONFIRMADA' && !embarque.reservaManual && solicitud && (
          <div className='grid grid-cols-2 gap-3 text-sm'>
            {solicitud.numeroBooking && <div><span className='text-muted-foreground'>N° Booking:</span> {solicitud.numeroBooking}</div>}
            {solicitud.naviera && <div><span className='text-muted-foreground'>Naviera:</span> {solicitud.naviera}</div>}
            {solicitud.nave && <div><span className='text-muted-foreground'>Nave:</span> {solicitud.nave}</div>}
            {solicitud.numeroContenedor && <div><span className='text-muted-foreground'>Contenedor:</span> {solicitud.numeroContenedor}</div>}
            {solicitud.fechaZarpe && <div><span className='text-muted-foreground'>Fecha zarpe:</span> {new Date(solicitud.fechaZarpe).toLocaleDateString('es-CL')}</div>}
            {solicitud.fechaRetiroPlanta && <div><span className='text-muted-foreground'>Retiro planta:</span> {new Date(solicitud.fechaRetiroPlanta).toLocaleDateString('es-CL')}</div>}
          </div>
        )}
      </div>

      <div className='space-y-3 rounded-md border p-6'>
        <h3 className='text-sm font-semibold'>Datos del Instructivo</h3>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1.5'>
            <Label>Puerto de zarpe</Label>
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
            <Label>Agente de aduana</Label>
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
            <Label>Voyage Number</Label>
            <Input value={formInstructivo.voyageNumber} onChange={(e) => setFormInstructivo((f) => ({ ...f, voyageNumber: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Depósito</Label>
            <Input value={formInstructivo.deposito} onChange={(e) => setFormInstructivo((f) => ({ ...f, deposito: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>AWB / BL</Label>
            <Input value={formInstructivo.awbBl} onChange={(e) => setFormInstructivo((f) => ({ ...f, awbBl: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Tipo de bultos</Label>
            <Input value={formInstructivo.tipoBultos} onChange={(e) => setFormInstructivo((f) => ({ ...f, tipoBultos: e.target.value }))} disabled={!puedeEscribir} />
          </div>
          <div className='space-y-1.5'>
            <Label>Cutoff</Label>
            <Input type='date' value={formInstructivo.cutoffDate} onChange={(e) => setFormInstructivo((f) => ({ ...f, cutoffDate: e.target.value }))} disabled={!puedeEscribir} />
          </div>
        </div>
        {puedeEscribir && (
          <Button type='button' onClick={guardarDatosInstructivo} isLoading={guardarDatosInstructivoMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        )}
      </div>
    </div>
  )
}
