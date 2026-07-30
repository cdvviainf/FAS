'use client'

import { useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [numeroInstructivo, setNumeroInstructivo] = useState('')
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => embarquesService.create({ notaVentaId, numeroInstructivo: numeroInstructivo.trim() }),
    onSuccess: (res) => {
      toast.success(`Embarque generado — Folio ${res.data.numeroInstructivo}`)
      queryClient.invalidateQueries({ queryKey: embarquesKeys.list({ notaVentaId }) })
      onOpenChange(false)
      setNumeroInstructivo('')
      router.push(`/dashboard/ventas/embarques/${res.data.id}`)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al generar el Embarque'),
  })

  function handleSubmit() {
    if (!numeroInstructivo.trim()) {
      setError('El número de instructivo (Folio) es requerido')
      return
    }
    setError('')
    mutation.mutate()
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setNumeroInstructivo('')
      setError('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Generar Embarque</DialogTitle>
          <DialogDescription>
            Ingresa el número de instructivo (Folio) para el nuevo Embarque asociado a este Cierre Comercial.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-1.5'>
          <Label>Folio (N° de Instructivo) <span className='text-destructive'>*</span></Label>
          <Input
            value={numeroInstructivo}
            onChange={(e) => setNumeroInstructivo(e.target.value)}
            placeholder='Ej: 001A'
            autoFocus
          />
          {error && <p className='text-xs text-destructive'>{error}</p>}
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            Generar Embarque
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
