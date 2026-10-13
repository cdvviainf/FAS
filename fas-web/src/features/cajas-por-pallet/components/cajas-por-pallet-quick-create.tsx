'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { cajasPorPalletService } from '../service'

// Alta inline de "Cajas por Pallet" (2026-10-13): cuando un embalaje + tipo de
// pallet no tiene cantidad configurada, el formulario muestra el error y este
// botón permite cargarla sin salir de la pantalla. Reemplaza el default 108.
// Gated por CONFIG_CAJAS_POR_PALLET (igual que el mantenedor); si el usuario no
// tiene permiso, no se renderiza (solo verá el error).
interface Props {
  articuloId: number
  tipoPalletId: number
  embalajeLabel?: string
  tipoPalletLabel?: string
  // Se invoca con la cantidad recién guardada para que el form la aplique.
  onCreated: (cajasPorPallet: number) => void
}

function CajasPorPalletQuickDialog({
  articuloId,
  tipoPalletId,
  embalajeLabel,
  tipoPalletLabel,
  open,
  onOpenChange,
  onCreated,
}: Props & { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient()
  const [cajas, setCajas] = useState('')

  const mutation = useMutation({
    // Create-only (no upsert): si otro usuario creó la combinación entre el
    // lookup vacío y este alta, el backend responde "Ya existe una cifra…" y no
    // se sobrescribe su valor (CPP-QA-003).
    mutationFn: async () => {
      const valor = Math.trunc(Number(cajas))
      const res = await cajasPorPalletService.create({ articuloId, tipoPalletId, cajasPorPallet: valor })
      return res.data.cajasPorPallet
    },
    onSuccess: (valor) => {
      queryClient.invalidateQueries({ queryKey: ['cajas-por-pallet'] })
      toast.success('Cantidad de cajas por pallet guardada')
      onCreated(valor)
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo guardar la cantidad'),
  })

  function submit() {
    const valor = Number(cajas)
    if (!Number.isFinite(valor) || !Number.isInteger(valor) || valor <= 0) {
      toast.error('Ingresa una cantidad de cajas válida (entero mayor a 0)')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Cajas por Pallet</DialogTitle>
          <DialogDescription>
            Define la cantidad teórica de cajas para
            {embalajeLabel ? ` el embalaje "${embalajeLabel}"` : ' este embalaje'}
            {tipoPalletLabel ? ` y el tipo de pallet "${tipoPalletLabel}"` : ' y este tipo de pallet'}.
            Quedará disponible de inmediato.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-1.5 py-2'>
          <Label>Cantidad de cajas <span className='text-destructive'>*</span></Label>
          <Input
            type='number'
            min={1}
            value={cajas}
            onChange={(e) => setCajas(e.target.value)}
            placeholder='Ej: 108'
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='button' isLoading={mutation.isPending} onClick={submit}>
            <Icons.check className='mr-1 h-4 w-4' /> Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CajasPorPalletQuickCreate(props: Props) {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir('CONFIG_CAJAS_POR_PALLET')

  if (!puedeEscribir) return null

  return (
    <>
      <Button type='button' variant='outline' size='sm' onClick={() => setOpen(true)}>
        <Icons.add className='mr-1 h-4 w-4' /> Agregar cantidad
      </Button>
      {open && <CajasPorPalletQuickDialog {...props} open onOpenChange={setOpen} />}
    </>
  )
}
