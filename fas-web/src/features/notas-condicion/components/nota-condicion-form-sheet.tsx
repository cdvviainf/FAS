'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Icons } from '@/components/icons'
import { SelectMultiple } from '@/components/shared/select-multiple'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { notasCondicionService } from '../service'
import type { NotaCondicion } from '../types'

const especiesService = createMantenedorService('especies')
const ITEM = 'CONFIG_MANTENEDORES'

interface NotaCondicionFormSheetProps {
  item?: NotaCondicion
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotaCondicionFormSheet({ item, open, onOpenChange }: NotaCondicionFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [descripcionExtranjera, setDescripcionExtranjera] = useState('')
  const [especieIds, setEspecieIds] = useState<number[]>([])
  const [bloqueado, setBloqueado] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: especies } = useQuery({
    queryKey: ['especies-options-nota-condicion'],
    queryFn: () => especiesService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setDescripcionExtranjera(item.descripcionExtranjera ?? '')
      setEspecieIds(item.especies.map((e) => e.especieId))
      setBloqueado(item.bloqueado)
    } else {
      setCodigo('')
      setDescripcion('')
      setDescripcionExtranjera('')
      setEspecieIds([])
      setBloqueado(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        descripcionExtranjera: descripcionExtranjera.trim() || undefined,
        especieIds,
        ...(isEdit ? { bloqueado } : {}),
      }
      if (isEdit) return notasCondicionService.update(item!.id, payload)
      return notasCondicionService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notas-condicion'] })
      toast.success(isEdit ? 'Nota de Condición actualizada' : 'Nota de Condición creada')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la Nota de Condición'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  const especieOptions = (especies?.data ?? []).map((e) => ({ id: e.id, label: e.descripcion }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar Nota de Condición ${item?.codigo}` : 'Nueva Nota de Condición'}</SheetTitle>
          <SheetDescription>Catálogo de notas (ej. 1, 2, 3, 4) y las especies para las que es válida.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Código <span className='text-destructive'>*</span></Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
            {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción extranjera</Label>
            <Input value={descripcionExtranjera} onChange={(e) => setDescripcionExtranjera(e.target.value)} placeholder='Foreign description' />
          </div>

          <div className='space-y-1.5'>
            <Label>Especies válidas</Label>
            <SelectMultiple
              options={especieOptions}
              selectedIds={especieIds}
              onChange={setEspecieIds}
              placeholder='Agregar especie...'
            />
          </div>

          {isEdit && (
            <div className='flex items-center justify-between rounded-md border p-3'>
              <div className='space-y-0.5'>
                <Label>Bloqueado</Label>
                <p className='text-muted-foreground text-xs'>Un registro bloqueado no aparece en los selectores de nuevos registros.</p>
              </div>
              <Switch checked={bloqueado} onCheckedChange={setBloqueado} />
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Nota de Condición'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function NotaCondicionFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nueva Nota de Condición
      </Button>
      <NotaCondicionFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
