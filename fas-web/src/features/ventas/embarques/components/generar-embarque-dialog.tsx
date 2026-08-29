'use client'

import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { Icons } from '@/components/icons'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'

interface GenerarEmbarqueDialogProps {
  notaVentaId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GenerarEmbarqueDialog({ notaVentaId, open, onOpenChange }: GenerarEmbarqueDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => embarquesService.create({ notaVentaId }),
    onSuccess: (res) => {
      toast.success(`Embarque generado — Folio ${res.data.numeroInstructivo}`)
      queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
      onOpenChange(false)
      router.push(`/dashboard/ventas/embarques/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al generar el Embarque'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Solicitar espacio</DialogTitle>
          <DialogDescription>
            El número de instructivo (Folio) se asigna automáticamente a partir del folio de este Cierre Comercial y
            el prefijo configurado para su Tipo de Embarque.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Solicitar espacio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
