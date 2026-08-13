'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { prefijosCodigoService } from '../service'
import { MODELOS_CON_CODIGO_OPTIONS, MODELO_EMBARQUE_OPTION } from '../types'
import type { PrefijoCodigo } from '../types'

const ITEM = 'CONFIG_MANTENEDORES'
const tiposEmbarqueService = createMantenedorService('tipos-embarque')
const TODAS_LAS_OPCIONES = [...MODELOS_CON_CODIGO_OPTIONS, MODELO_EMBARQUE_OPTION]

interface PrefijoCodigoFormSheetProps {
  item?: PrefijoCodigo
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PrefijoCodigoFormSheet({ item, open, onOpenChange }: PrefijoCodigoFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [modelo, setModelo] = useState('')
  const [tipoEmbarqueId, setTipoEmbarqueId] = useState(0)
  const [prefijo, setPrefijo] = useState('')
  const [digitos, setDigitos] = useState('3')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const esEmbarque = modelo === 'embarque'
  const { data: tiposEmbarqueData } = useQuery({
    queryKey: ['tipos-embarque-options'],
    queryFn: () => tiposEmbarqueService.list({ limit: 200 }),
    staleTime: 5 * 60_000,
    enabled: esEmbarque,
  })
  const tiposEmbarque = tiposEmbarqueData?.data ?? []

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    setModelo(item?.modelo ?? '')
    setTipoEmbarqueId(item?.tipoEmbarqueId ?? 0)
    setPrefijo(item?.prefijo ?? '')
    setDigitos(item ? String(item.digitos) : '3')
  }, [open, item])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        modelo,
        tipoEmbarqueId: esEmbarque ? tipoEmbarqueId : undefined,
        prefijo: prefijo.trim().toUpperCase(),
        digitos: Number(digitos),
      }
      if (isEdit) return prefijosCodigoService.update(item!.id, { prefijo: payload.prefijo, digitos: payload.digitos })
      return prefijosCodigoService.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prefijos-codigo'] })
      toast.success(isEdit ? 'Prefijo actualizado' : 'Prefijo creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el prefijo'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!modelo) e.modelo = 'El mantenedor es requerido'
    if (esEmbarque && !tipoEmbarqueId) e.tipoEmbarqueId = 'El Tipo de Embarque es requerido'
    if (!prefijo.trim()) e.prefijo = 'El prefijo es requerido'
    if (!digitos || Number(digitos) < 1) e.digitos = 'Debe ser al menos 1 dígito'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  const preview = prefijo.trim()
    ? esEmbarque
      ? `${prefijo.trim().toUpperCase()}${'{folio}'.padStart(Math.max(Number(digitos) || 0, 1), '0')}`
      : `${prefijo.trim().toUpperCase()}${'1'.padStart(Math.max(Number(digitos) || 0, 1), '0')}`
    : ''

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Editar Prefijo de Código' : 'Nuevo Prefijo de Código'}</SheetTitle>
          <SheetDescription>
            Define el prefijo y la cantidad de dígitos del correlativo que se sugerirá al crear un registro nuevo en ese mantenedor
            (o, para Embarque, del número de instructivo generado a partir del folio del Cierre Comercial).
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Mantenedor <span className='text-destructive'>*</span></Label>
            <Select value={modelo} onValueChange={(v) => { setModelo(v); setTipoEmbarqueId(0) }} disabled={isEdit}>
              <SelectTrigger><SelectValue placeholder='Seleccionar mantenedor...' /></SelectTrigger>
              <SelectContent>
                {TODAS_LAS_OPCIONES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.modelo && <p className='text-xs text-destructive'>{errors.modelo}</p>}
          </div>

          {esEmbarque && (
            <div className='space-y-1.5'>
              <Label>Tipo de Embarque <span className='text-destructive'>*</span></Label>
              <Select value={tipoEmbarqueId ? String(tipoEmbarqueId) : ''} onValueChange={(v) => setTipoEmbarqueId(Number(v))} disabled={isEdit}>
                <SelectTrigger><SelectValue placeholder='Seleccionar...' /></SelectTrigger>
                <SelectContent>
                  {tiposEmbarque.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipoEmbarqueId && <p className='text-xs text-destructive'>{errors.tipoEmbarqueId}</p>}
              {isEdit && item?.tipoEmbarque && (
                <p className='text-xs text-muted-foreground'>Prefijo para: {item.tipoEmbarque.descripcion} (no editable)</p>
              )}
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Prefijo <span className='text-destructive'>*</span></Label>
              <Input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder='Ej: EN' maxLength={10} />
              {errors.prefijo && <p className='text-xs text-destructive'>{errors.prefijo}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Dígitos <span className='text-destructive'>*</span></Label>
              <Input type='number' min={1} max={10} value={digitos} onChange={(e) => setDigitos(e.target.value)} />
              {errors.digitos && <p className='text-xs text-destructive'>{errors.digitos}</p>}
            </div>
          </div>

          {preview && (
            <p className='text-xs text-muted-foreground'>Ejemplo de código sugerido: <span className='font-mono'>{preview}</span></p>
          )}
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear prefijo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function PrefijoCodigoFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Prefijo
      </Button>
      <PrefijoCodigoFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
