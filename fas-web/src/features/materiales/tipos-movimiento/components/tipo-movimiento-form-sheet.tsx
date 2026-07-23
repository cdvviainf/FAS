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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Icons } from '@/components/icons'
import { tiposMovimientoService } from '../service'
import { tiposMovimientoKeys } from '../queries'
import { CLASE_MOVIMIENTO_LABELS, MODULO_SISTEMA_LABELS, TIPO_ENTIDAD_OPTIONS } from '../types'
import type { TipoMovimiento, ModuloSistema, ClaseMovimiento, TipoEntidad } from '../types'

interface TipoMovimientoFormSheetProps {
  item?: TipoMovimiento
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TipoMovimientoFormSheet({ item, open, onOpenChange }: TipoMovimientoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [modulos, setModulos] = useState<ModuloSistema[]>(['MATERIALES'])
  const [clase, setClase] = useState<ClaseMovimiento>('ENTRADA')
  const [requierePrecio, setRequierePrecio] = useState(false)
  const [entidadRelacionada, setEntidadRelacionada] = useState<TipoEntidad | 'none'>('none')
  const [emiteDTE, setEmiteDTE] = useState(false)
  const [activo, setActivo] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setModulos(item.modulos)
      setClase(item.clase)
      setRequierePrecio(item.requierePrecio)
      setEntidadRelacionada(item.entidadRelacionada ?? 'none')
      setEmiteDTE(item.emiteDTE)
      setActivo(item.activo)
    } else {
      setCodigo('')
      setDescripcion('')
      setModulos(['MATERIALES'])
      setClase('ENTRADA')
      setRequierePrecio(false)
      setEntidadRelacionada('none')
      setEmiteDTE(false)
      setActivo(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        modulos,
        clase,
        requierePrecio,
        entidadRelacionada: entidadRelacionada === 'none' ? null : entidadRelacionada,
        emiteDTE,
        activo,
      }
      if (isEdit) return tiposMovimientoService.update(item!.id, payload)
      return tiposMovimientoService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tiposMovimientoKeys.all })
      toast.success(isEdit ? 'Tipo de movimiento actualizado' : 'Tipo de movimiento creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar'),
  })

  function toggleModulo(m: ModuloSistema) {
    setModulos((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m])
  }

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (modulos.length === 0) e.modulos = 'Debe seleccionar al menos un módulo'
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
          <SheetTitle>{isEdit ? `Editar tipo de movimiento ${item?.codigo}` : 'Nuevo tipo de movimiento'}</SheetTitle>
          <SheetDescription>Mantenedor transversal usado por Materiales y Fruta.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código <span className='text-destructive'>*</span></Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
              {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Clase <span className='text-destructive'>*</span></Label>
              <Select value={clase} onValueChange={(v) => setClase(v as ClaseMovimiento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CLASE_MOVIMIENTO_LABELS) as ClaseMovimiento[]).map((c) => (
                    <SelectItem key={c} value={c}>{CLASE_MOVIMIENTO_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-2'>
            <Label>Módulos <span className='text-destructive'>*</span></Label>
            <div className='flex gap-4'>
              {(Object.keys(MODULO_SISTEMA_LABELS) as ModuloSistema[]).map((m) => (
                <div key={m} className='flex items-center gap-2'>
                  <Checkbox id={`mod-${m}`} checked={modulos.includes(m)} onCheckedChange={() => toggleModulo(m)} />
                  <Label htmlFor={`mod-${m}`}>{MODULO_SISTEMA_LABELS[m]}</Label>
                </div>
              ))}
            </div>
            {errors.modulos && <p className='text-xs text-destructive'>{errors.modulos}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Entidad relacionada <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
            <Select value={entidadRelacionada} onValueChange={(v) => setEntidadRelacionada(v as TipoEntidad | 'none')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>No exige entidad</SelectItem>
                {TIPO_ENTIDAD_OPTIONS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center gap-2'>
            <Switch id='requierePrecio' checked={requierePrecio} onCheckedChange={setRequierePrecio} />
            <Label htmlFor='requierePrecio'>Requiere precio unitario por línea</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch id='emiteDTE' checked={emiteDTE} onCheckedChange={setEmiteDTE} />
            <Label htmlFor='emiteDTE'>Emite DTE (exige datos de transporte)</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch id='activo-tm' checked={activo} onCheckedChange={setActivo} />
            <Label htmlFor='activo-tm'>Activo</Label>
          </div>
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

export function TipoMovimientoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Tipo de Movimiento
      </Button>
      <TipoMovimientoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
