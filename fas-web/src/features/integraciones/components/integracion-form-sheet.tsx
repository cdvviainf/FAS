'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
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
import { integracionesService } from '../service'
import { integracionesKeys } from '../queries'
import type { Integracion, IntegracionListItem } from '../types'

interface IntegracionFormSheetProps {
  item?: Integracion | IntegracionListItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: number) => void
}

export function IntegracionFormSheet({ item, open, onOpenChange, onCreated }: IntegracionFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [url, setUrl] = useState('')
  const [activo, setActivo] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setUrl(item.url ?? '')
      setActivo(item.activo)
    } else {
      setCodigo('')
      setDescripcion('')
      setUrl('')
      setActivo(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        url: url.trim() || null,
        activo,
      }
      if (isEdit) return integracionesService.update(item!.id, payload)
      return integracionesService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: integracionesKeys.all })
      toast.success(isEdit ? 'Integración actualizada' : 'Integración creada')
      onOpenChange(false)
      if (!isEdit) onCreated?.(res.data.id)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la integración'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (url.trim()) {
      try {
        new URL(url.trim())
      } catch {
        e.url = 'La URL no es válida'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar integración ${item?.codigo}` : 'Nueva integración'}</SheetTitle>
          <SheetDescription>
            Credenciales y endpoint de un sistema externo (ej. AGL360). Los parámetros
            (tokens, mapeos) se agregan después de crearla.
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Código <span className='text-destructive'>*</span></Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
              disabled={isEdit}
              placeholder='AGL360'
            />
            {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>URL base</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder='https://api.ejemplo.com' />
            {errors.url && <p className='text-xs text-destructive'>{errors.url}</p>}
          </div>

          <div className='flex items-center gap-2'>
            <Switch id='activo-integracion' checked={activo} onCheckedChange={setActivo} />
            <Label htmlFor='activo-integracion'>Activa</Label>
          </div>
          {activo === false && (
            <p className='text-xs text-muted-foreground'>
              Con la integración inactiva, ningún adapter la usará aunque tenga sus parámetros configurados.
            </p>
          )}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
