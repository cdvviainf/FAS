'use client'

import { useState, useRef } from 'react'
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
import { solicitudesService } from '../service'
import { solicitudesKeys } from '../queries'
import type { SolicitudInspeccion } from '../types'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic'

function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

interface SolicitudCerrarDialogProps {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SolicitudCerrarDialog({ solicitud, open, onOpenChange }: SolicitudCerrarDialogProps) {
  const queryClient = useQueryClient()
  const [comentarios, setComentarios] = useState('')
  const [pendientes, setPendientes] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const cerrarMutation = useMutation({
    mutationFn: async () => {
      // Primero suben los adjuntos de cierre, luego se cierra la solicitud
      for (const archivo of pendientes) {
        await solicitudesService.subirAdjunto(solicitud.id, archivo, 'CIERRE')
      }
      return solicitudesService.cerrar(solicitud.id, comentarios.trim())
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Inspección cerrada. Se notificó a los involucrados.')
      onOpenChange(false)
      setComentarios('')
      setPendientes([])
    },
    onError: (e: Error) => toast.error(e.message || 'Error al cerrar la inspección'),
  })

  function agregarArchivos(files: FileList | null) {
    if (!files) return
    const validos: File[] = []
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) {
        toast.error(`"${f.name}" supera los 10 MB`)
        continue
      }
      validos.push(f)
    }
    setPendientes((prev) => [...prev, ...validos])
    if (inputRef.current) inputRef.current.value = ''
  }

  function quitarArchivo(idx: number) {
    setPendientes((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleCerrar() {
    if (!comentarios.trim()) {
      toast.error('Los comentarios de cierre son requeridos')
      return
    }
    cerrarMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle>Cerrar inspección {solicitud.codigo}</DialogTitle>
          <DialogDescription>
            Registra los comentarios y adjunta los archivos de la inspección. Al cerrar se notificará
            a los asignados y al solicitante.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          <div className='space-y-1.5'>
            <Label>Comentarios <span className='text-destructive'>*</span></Label>
            <Textarea
              rows={5}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              placeholder='Resultado de la inspección, hallazgos, observaciones...'
            />
          </div>

          <div className='space-y-2'>
            <Label>Archivos adjuntos</Label>
            <input
              ref={inputRef}
              type='file'
              multiple
              accept={ACCEPT}
              className='hidden'
              onChange={(e) => agregarArchivos(e.target.files)}
            />
            <Button type='button' variant='outline' size='sm' onClick={() => inputRef.current?.click()}>
              <Icons.upload className='mr-1 h-4 w-4' /> Agregar archivos
            </Button>
            <p className='text-xs text-muted-foreground'>PDF, Word, Excel o imágenes. Máx. 10 MB por archivo.</p>

            {pendientes.length > 0 && (
              <div className='space-y-1 rounded-md border p-2'>
                {pendientes.map((f, idx) => (
                  <div key={idx} className='flex items-center gap-2 text-sm'>
                    <Icons.paperclip className='h-4 w-4 shrink-0 text-muted-foreground' />
                    <span className='flex-1 truncate'>{f.name}</span>
                    <span className='text-xs text-muted-foreground'>{formatoBytes(f.size)}</span>
                    <Button type='button' variant='ghost' size='icon' className='h-7 w-7' onClick={() => quitarArchivo(idx)}>
                      <Icons.close className='h-4 w-4' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={cerrarMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleCerrar} isLoading={cerrarMutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> Cerrar inspección
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
