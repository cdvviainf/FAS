'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Icons } from '@/components/icons'
import { AlertModal } from '@/components/modal/alert-modal'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { notasVentaKeys } from '@/features/ventas/notas-venta/queries'

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

  const mutation = useMutation({
    mutationFn: (forzarSinReserva: boolean) => embarquesService.create({ notaVentaId, forzarSinReserva }),
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>Solicitar Reserva</DialogTitle>
            <DialogDescription>
              El número de instructivo (Folio) se asigna automáticamente a partir del folio de este Cierre Comercial y
              el prefijo configurado para su Tipo de Embarque. Se generará el Embarque e intentará reservar espacio con
              AGL360.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => mutation.mutate(false)} isLoading={mutation.isPending}>
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
