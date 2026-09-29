'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { notasVentaKeys } from '@/features/ventas/notas-venta/queries'
import { entidadesService } from '@/features/entidades/service'

interface GenerarEmbarqueDialogProps {
  notaVentaId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerarEmbarqueDialog({ notaVentaId, open, onOpenChange }: GenerarEmbarqueDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmarSinReservaOpen, setConfirmarSinReservaOpen] = useState(false)
  const [gestorLogisticoId, setGestorLogisticoId] = useState<number | null>(null)
  const [cantidad, setCantidad] = useState<number>(1)

  // Sugerencia de contenedores = techo(pallets del Cierre / 20). Editable.
  const { data: estimacion } = useQuery({
    queryKey: ['embarque-estimacion-contenedores', notaVentaId],
    queryFn: () => embarquesService.estimacionContenedores(notaVentaId),
    enabled: open,
    staleTime: 30_000,
  })
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && estimacion?.data) setCantidad(estimacion.data.contenedoresSugeridos)
  }, [open, estimacion])

  // Gestor Logístico (2026-09-07, ventas.md §4.3) — generaliza AGL360: si el
  // gestor elegido tiene una Integración activa vinculada, se intenta la
  // reserva automática; si no, el Embarque nace directo en modo manual.
  const { data: gestoresData } = useQuery({
    queryKey: ['entidades-gestor-logistico-options'],
    queryFn: () => entidadesService.list({ tipo: 'GESTOR_LOGISTICO', activo: true, limit: 200 }),
    staleTime: 60_000,
    enabled: open,
  })
  const gestores = gestoresData?.data ?? []

  // Cuántos contenedores faltan por generar tras un éxito parcial (la reserva
  // automática falló a mitad) — el reintento "sin reserva" cubre solo estos.
  const [faltantes, setFaltantes] = useState(0)

  function cerrarYRefrescar(navegarA?: number) {
    queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
    queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
    setConfirmarSinReservaOpen(false)
    onOpenChange(false)
    if (navegarA != null) router.push(`/dashboard/ventas/embarques/${navegarA}`)
  }

  const mutation = useMutation({
    mutationFn: (vars: { cantidad: number; forzar: boolean }) =>
      embarquesService.createMultiples({ notaVentaId, gestorLogisticoId: gestorLogisticoId!, cantidad: vars.cantidad, forzarSinReserva: vars.forzar }),
    onSuccess: (res) => {
      const embarques = res.data.embarques
      if (res.data.aglFallo) {
        // Éxito parcial: se crearon `creados`, la reserva del siguiente falló.
        // Se ofrece generar los restantes sin reserva (reintento acotado).
        setFaltantes(cantidad - res.data.creados)
        if (res.data.creados > 0) {
          toast.warning(`Se generaron ${res.data.creados} de ${cantidad} — la reserva automática falló en el siguiente`)
          queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
          queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
        }
        setConfirmarSinReservaOpen(true)
        return
      }
      const folios = embarques.map((e) => e.numeroInstructivo).join(', ')
      toast.success(
        embarques.length === 1
          ? `Embarque generado — Folio ${folios}`
          : `${embarques.length} Embarque(s) generado(s) — Folios ${folios}`,
      )
      // Con un solo Embarque se abre su detalle; con varios se vuelve al listado.
      cerrarYRefrescar(embarques.length === 1 ? embarques[0].id : undefined)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al generar el Embarque'),
  })

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) {
            setGestorLogisticoId(null)
            setCantidad(1)
          }
          onOpenChange(v)
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Solicitar Reserva</DialogTitle>
            <DialogDescription>
              El número de instructivo se asigna automáticamente como un correlativo secuencial por Tipo de Embarque
              (con su prefijo configurado). Si el Gestor Logístico elegido tiene una integración activa, se intentará
              reservar espacio automáticamente — si no, el Embarque quedará listo para ingresar los datos de la reserva
              a mano.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-1.5'>
            <Label>Gestor Logístico <span className='text-destructive'>*</span></Label>
            <Combobox
              value={gestorLogisticoId ? String(gestorLogisticoId) : ''}
              onChange={(v) => setGestorLogisticoId(v ? Number(v) : null)}
              placeholder='Selecciona un gestor logístico...'
              searchPlaceholder='Buscar entidad...'
              options={gestores.map((e) => ({ value: String(e.id), label: e.descripcion }))}
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Contenedores (reservas a generar) <span className='text-destructive'>*</span></Label>
            <Input
              type='number'
              min={1}
              max={100}
              value={cantidad}
              onChange={(e) => setCantidad(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            />
            {estimacion?.data && (
              <p className='text-muted-foreground text-xs'>
                Sugerido: {estimacion.data.contenedoresSugeridos} ({estimacion.data.totalPallets} pallets ÷ {estimacion.data.palletsPorContenedor} por contenedor).
                Se genera un Embarque con su reserva por cada contenedor; su N° de instructivo es un correlativo secuencial por Tipo de Embarque.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate({ cantidad, forzar: false })} isLoading={mutation.isPending} disabled={!gestorLogisticoId}>
              <Icons.check className='mr-1 h-4 w-4' />
              Solicitar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={confirmarSinReservaOpen}
        onClose={() => cerrarYRefrescar()}
        onConfirm={() => mutation.mutate({ cantidad: faltantes, forzar: true })}
        loading={mutation.isPending}
        title='No se pudo conectar con AGL360'
        description={`No se pudo enviar la Solicitud de Reserva${faltantes > 0 ? ` de ${faltantes} contenedor(es) restante(s)` : ''}. ¿Generar ese/esos Embarque(s) de todas formas, sin reserva? Podrás reintentar la solicitud después desde cada Embarque.`}
      />
    </>
  )
}
