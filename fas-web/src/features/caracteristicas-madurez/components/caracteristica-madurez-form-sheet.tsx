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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { SelectMultiple } from '@/components/shared/select-multiple'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { createMantenedorQueries } from '@/features/mantenedor-simple/queries'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import type { MantenedorSimple } from '@/features/mantenedor-simple/types'

const caracteristicasService = createMantenedorService('caracteristicas-madurez')
const unidadesService = createMantenedorService('unidades-medida')
const especiesService = createMantenedorService('especies')
const ITEM = 'CONFIG_CARACTERISTICAS_MADUREZ'

export type TipoDatoMadurez = 'DECIMAL' | 'PORCENTAJE' | 'ENTERO' | 'TEXTO'

export const TIPO_DATO_MADUREZ_LABELS: Record<TipoDatoMadurez, string> = {
  DECIMAL: 'Decimal (ej. 12,5)',
  ENTERO: 'Entero',
  PORCENTAJE: 'Porcentaje (0–100)',
  TEXTO: 'Texto',
}

export interface CaracteristicaMadurezItem extends MantenedorSimple {
  tipoDato?: TipoDatoMadurez
  unidadId?: number | null
  unidad?: { id: number; codigo: string; descripcion: string } | null
  especies?: { especieId: number; especie: { id: number; descripcion: string } }[]
}

interface Props {
  item?: CaracteristicaMadurezItem
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CaracteristicaMadurezFormSheet({ item, open, onOpenChange }: Props) {
  const isEdit = !!item
  const queryClient = useQueryClient()
  const { keys } = createMantenedorQueries('caracteristicas-madurez')

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [descripcionExtranjera, setDescripcionExtranjera] = useState('')
  const [tipoDato, setTipoDato] = useState<TipoDatoMadurez>('DECIMAL')
  const [unidadId, setUnidadId] = useState<number | null>(null)
  const [especieIds, setEspecieIds] = useState<number[]>([])
  const [bloqueado, setBloqueado] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: unidadesData } = useQuery({
    queryKey: ['unidades-options-madurez'],
    queryFn: () => unidadesService.list({ soloActivos: true, limit: 300 }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: especies } = useQuery({
    queryKey: ['especies-options-madurez'],
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
      setTipoDato(item.tipoDato ?? 'DECIMAL')
      setUnidadId(item.unidadId ?? null)
      setEspecieIds((item.especies ?? []).map((e) => e.especieId))
      setBloqueado(item.bloqueado ?? false)
    } else {
      setCodigo('')
      setDescripcion('')
      setDescripcionExtranjera('')
      setTipoDato('DECIMAL')
      setUnidadId(null)
      setEspecieIds([])
      setBloqueado(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      // La unidad no aplica a TEXTO: se envía null.
      const payload = {
        descripcion: descripcion.trim(),
        descripcionExtranjera: descripcionExtranjera.trim() || undefined,
        tipoDato,
        unidadId: tipoDato === 'TEXTO' ? null : unidadId,
        especieIds,
        ...(isEdit ? { bloqueado } : {}),
      }
      if (isEdit) return caracteristicasService.update(item!.id, payload)
      return caracteristicasService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.all })
      toast.success(isEdit ? 'Característica actualizada' : 'Característica creada')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar la característica'),
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

  const unidades = unidadesData?.data ?? []
  const especieOptions = (especies?.data ?? []).map((e) => ({ id: e.id, label: e.descripcion }))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar Característica ${item?.codigo}` : 'Nueva Característica de Madurez'}</SheetTitle>
          <SheetDescription>Característica de calidad/madurez (ej. Firmeza, Brix): tipo de dato, unidad y especies para las que aplica.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Código <span className='text-destructive'>*</span></Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
            {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Firmeza, Brix...' />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción extranjera</Label>
            <Input value={descripcionExtranjera} onChange={(e) => setDescripcionExtranjera(e.target.value)} placeholder='Foreign description' />
          </div>

          <div className='space-y-1.5'>
            <Label>Tipo de dato <span className='text-destructive'>*</span></Label>
            <Select value={tipoDato} onValueChange={(v) => setTipoDato(v as TipoDatoMadurez)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TIPO_DATO_MADUREZ_LABELS) as TipoDatoMadurez[]).map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_DATO_MADUREZ_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className='text-muted-foreground text-xs'>Define cómo se ingresa el valor en el cierre de la inspección.</p>
          </div>

          {tipoDato !== 'TEXTO' && (
            <div className='space-y-1.5'>
              <Label>Unidad</Label>
              <Select value={unidadId ? String(unidadId) : '__none__'} onValueChange={(v) => setUnidadId(v === '__none__' ? null : parseInt(v, 10))}>
                <SelectTrigger><SelectValue placeholder='Sin unidad' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='__none__'>Sin unidad</SelectItem>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-muted-foreground text-xs'>Opcional (ej. lb, °Brix). Del mantenedor de Unidades de Medida.</p>
            </div>
          )}

          <div className='space-y-1.5'>
            <Label>Especies</Label>
            <SelectMultiple
              options={especieOptions}
              selectedIds={especieIds}
              onChange={setEspecieIds}
              placeholder='Agregar especie...'
            />
            <p className='text-muted-foreground text-xs'>Opcional. Sin especies, la característica aplica a todas.</p>
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
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Característica'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function CaracteristicaMadurezFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nueva Característica
      </Button>
      <CaracteristicaMadurezFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
