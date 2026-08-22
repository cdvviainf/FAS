'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { instructivoEmbalajeService } from '../service'
import { instructivosEmbalajeKeys } from '../queries'
import type { InstructivoEmbalajeListItem } from '../types'

interface InspeccionProcesoVeredictoDialogProps {
  instructivo: InstructivoEmbalajeListItem
  veredicto: 'APROBAR' | 'RECHAZAR'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InspeccionProcesoVeredictoDialog({
  instructivo,
  veredicto,
  open,
  onOpenChange,
}: InspeccionProcesoVeredictoDialogProps) {
  const queryClient = useQueryClient()
  const [comentario, setComentario] = useState('')
  const esAprobar = veredicto === 'APROBAR'

  const mutation = useMutation({
    mutationFn: () =>
      esAprobar
        ? instructivoEmbalajeService.aprobarInspeccion(instructivo.id, comentario.trim())
        : instructivoEmbalajeService.rechazarInspeccion(instructivo.id, comentario.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: instructivosEmbalajeKeys.all })
      toast.success(esAprobar ? 'Inspección de proceso aprobada' : 'Inspección de proceso rechazada')
      onOpenChange(false)
      setComentario('')
    },
    onError: (e: Error) => toast.error(e.message || 'Error al registrar el veredicto'),
  })

  function handleConfirmar() {
    if (!comentario.trim()) {
      toast.error('El comentario es requerido')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {esAprobar ? 'Aprobar' : 'Rechazar'} inspección de proceso N° {instructivo.numero}
          </DialogTitle>
          <DialogDescription>
            El comentario es obligatorio y queda registrado en el Instructivo.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-1.5 py-2'>
          <Label>Comentario <span className='text-destructive'>*</span></Label>
          <Textarea
            rows={5}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder={esAprobar ? 'Observaciones de la aprobación...' : 'Motivo del rechazo...'}
          />
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            isLoading={mutation.isPending}
            variant={esAprobar ? 'default' : 'destructive'}
          >
            <Icons.check className='mr-1 h-4 w-4' /> {esAprobar ? 'Aprobar' : 'Rechazar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
