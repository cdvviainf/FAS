'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Combobox } from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Icons } from '@/components/icons'
import { articulosService } from '@/features/materiales/articulos/service'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { cajasPorPalletService } from '../service'
import type { CajasPorPallet } from '../types'

const tiposPalletService = createMantenedorService('tipos-pallet')

interface Props {
  item?: CajasPorPallet
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CajasPorPalletFormSheet({ item, open, onOpenChange }: Props) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [articuloId, setArticuloId] = useState<number>(0)
  const [tipoPalletId, setTipoPalletId] = useState<number>(0)
  const [cajas, setCajas] = useState<string>('')

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratación del form al abrir
      setArticuloId(item?.articuloId ?? 0)
      setTipoPalletId(item?.tipoPalletId ?? 0)
      setCajas(item?.cajasPorPallet ? String(item.cajasPorPallet) : '')
    }
  }, [open, item])

  const { data: articulosData } = useQuery({
    queryKey: ['articulos-embalaje-cpp'],
    queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: tiposPalletData } = useQuery({
    queryKey: ['tipos-pallet-cpp'],
    queryFn: () => tiposPalletService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
  })
  const embalajes = articulosData?.data ?? []
  const tiposPallet = tiposPalletData?.data ?? []

  const guardar = useMutation({
    mutationFn: () => {
      const payload = { articuloId, tipoPalletId, cajasPorPallet: Number(cajas) }
      return isEdit ? cajasPorPalletService.update(item!.id, payload) : cajasPorPalletService.create(payload)
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Cifra actualizada' : 'Cifra creada')
      queryClient.invalidateQueries({ queryKey: ['cajas-por-pallet'] })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar'),
  })

  const valido = articuloId > 0 && tipoPalletId > 0 && Number(cajas) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Cajas por Pallet' : 'Nueva Cajas por Pallet'}</SheetTitle>
          <SheetDescription>Cajas teóricas para un embalaje en un tipo de pallet.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto py-2 px-1'>
          <div className='space-y-1.5'>
            <Label>Embalaje <span className='text-destructive'>*</span></Label>
            <Combobox
              options={embalajes.map((a) => ({ value: String(a.id), label: `${a.codigo} — ${a.descripcion}` }))}
              value={articuloId ? String(articuloId) : null}
              onChange={(v) => setArticuloId(Number(v))}
              placeholder='Seleccionar embalaje...'
              searchPlaceholder='Buscar embalaje...'
            />
          </div>

          <div className='space-y-1.5'>
            <Label>Tipo de Pallet <span className='text-destructive'>*</span></Label>
            <Select value={tipoPalletId ? String(tipoPalletId) : ''} onValueChange={(v) => setTipoPalletId(Number(v))}>
              <SelectTrigger className='w-full'><SelectValue placeholder='Seleccionar tipo de pallet...' /></SelectTrigger>
              <SelectContent>
                {tiposPallet.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.codigo} — {t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='space-y-1.5'>
            <Label>Cajas por Pallet (teórica) <span className='text-destructive'>*</span></Label>
            <Input type='number' min={1} value={cajas} onChange={(e) => setCajas(e.target.value)} placeholder='Ej: 108' />
          </div>
        </div>

        <SheetFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => guardar.mutate()} disabled={!valido} isLoading={guardar.isPending}>
            <Icons.check className='mr-1 h-4 w-4' />
            {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function CajasPorPalletFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' />
        Nueva
      </Button>
      <CajasPorPalletFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
