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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { solicitudesService } from '../service'
import { solicitudesKeys } from '../queries'
import { RESULTADO_CIERRE_LABELS } from '../types'
import type { ResultadoCierre, SolicitudInspeccion } from '../types'

// "Cerrar inspección" (2026-11-10): solo cambia el estado con lo guardado en
// "Editar inspección" y notifica a los involucrados. Las solicitudes legacy sin
// líneas eligen aquí su resultado (no hay veredicto por línea).
export function SolicitudConfirmarCierreDialog({
  solicitud,
  open,
  onOpenChange,
}: {
  solicitud: SolicitudInspeccion
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const sinLineas = solicitud.lineas.length === 0
  const [resultado, setResultado] = useState<ResultadoCierre | ''>('')

  const cerrar = useMutation({
    mutationFn: () => solicitudesService.cerrar(solicitud.id, sinLineas ? { resultado: resultado as ResultadoCierre } : {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: solicitudesKeys.all })
      toast.success('Inspección cerrada. Se notificó a los involucrados.')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al cerrar la inspección'),
  })

  function handleConfirmar() {
    if (sinLineas && !resultado) {
      toast.error('Indica el resultado de la inspección')
      return
    }
    cerrar.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Cerrar inspección {solicitud.codigo}</DialogTitle>
          <DialogDescription>
            Se cierra con los datos guardados en &quot;Editar inspección&quot; y se notifica a los asignados y al
            solicitante. Si falta algún dato, el sistema te indicará qué completar.
          </DialogDescription>
        </DialogHeader>
        {sinLineas && (
          <div className='space-y-1.5'>
            <Label>Resultado de la inspección <span className='text-destructive'>*</span></Label>
            <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoCierre)}>
              <SelectTrigger><SelectValue placeholder='Selecciona...' /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RESULTADO_CIERRE_LABELS) as ResultadoCierre[]).map((r) => (
                  <SelectItem key={r} value={r}>{RESULTADO_CIERRE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={cerrar.isPending}>Cancelar</Button>
          <Button onClick={handleConfirmar} isLoading={cerrar.isPending}>Cerrar inspección</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
