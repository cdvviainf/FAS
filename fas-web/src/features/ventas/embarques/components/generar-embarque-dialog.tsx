'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isHTTPError } from 'ky'
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

// 502 = AGL_INTEGRACION_FALLIDA (embarques.service.ts, ventas.md §4.3) — la
// integración con AGL360 falló, no un error de validación normal. Distingue
// este caso para ofrecer "Generar Embarque sin reserva" en vez de un toast.
function esFallaIntegracionAgl(e: unknown): boolean {
  return isHTTPError(e) && e.response.status === 502
}

export function GenerarEmbarqueDialog({ notaVentaId, open, onOpenChange }: GenerarEmbarqueDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [confirmarSinReservaOpen, setConfirmarSinReservaOpen] = useState(false)
  const [gestorLogisticoId, setGestorLogisticoId] = useState<number | null>(null)

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

  const mutation = useMutation({
    mutationFn: (forzarSinReserva: boolean) => embarquesService.create({ notaVentaId, gestorLogisticoId: gestorLogisticoId!, forzarSinReserva }),
    onSuccess: (res) => {
      toast.success(`Embarque generado — Folio ${res.data.numeroInstructivo}`)
      queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
      queryClient.invalidateQueries({ queryKey: notasVentaKeys.all })
      setConfirmarSinReservaOpen(false)
      onOpenChange(false)
      router.push(`/dashboard/ventas/embarques/${res.data.id}`)
    },
    onError: (e: Error) => {
      if (esFallaIntegracionAgl(e)) {
        setConfirmarSinReservaOpen(true)
        return
      }
      toast.error(e.message || 'Error al generar el Embarque')
    },
  })

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v) setGestorLogisticoId(null)
          onOpenChange(v)
        }}
      >
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Solicitar Reserva</DialogTitle>
            <DialogDescription>
              El número de instructivo (Folio) se asigna automáticamente a partir del folio de este Cierre Comercial y
              el prefijo configurado para su Tipo de Embarque. Si el Gestor Logístico elegido tiene una integración
              activa, se intentará reservar espacio automáticamente — si no, el Embarque quedará listo para ingresar
              los datos de la reserva a mano.
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

          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate(false)} isLoading={mutation.isPending} disabled={!gestorLogisticoId}>
              <Icons.check className='mr-1 h-4 w-4' />
              Solicitar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertModal
        isOpen={confirmarSinReservaOpen}
        onClose={() => setConfirmarSinReservaOpen(false)}
        onConfirm={() => mutation.mutate(true)}
        loading={mutation.isPending}
        title='No se pudo conectar con AGL360'
        description='No se pudo enviar la Solicitud de Reserva. ¿Generar el Embarque de todas formas, sin reserva? Podrás reintentar la solicitud después desde el propio Embarque.'
      />
    </>
  )
}
