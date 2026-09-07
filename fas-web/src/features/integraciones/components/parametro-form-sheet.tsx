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
import { Combobox } from '@/components/ui/combobox'
import { Icons } from '@/components/icons'
import { integracionesService } from '../service'
import { integracionesKeys, opcionesMaestroOptions } from '../queries'
import { MAESTRO_INTEGRACION_LABELS } from '../types'
import type { IntegracionParametro, TipoParametroIntegracion, MaestroIntegracion } from '../types'

const MASCARA = '••••••••'

interface ParametroFormSheetProps {
  integracionId: number
  item?: IntegracionParametro
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ParametroFormSheet({ integracionId, item, open, onOpenChange }: ParametroFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [idExterno, setIdExterno] = useState('')
  const [tipo, setTipo] = useState<TipoParametroIntegracion>('TEXTO')
  const [maestro, setMaestro] = useState<MaestroIntegracion>('ENTIDAD')
  const [maestroId, setMaestroId] = useState<number | null>(null)
  const [valorLocal, setValorLocal] = useState('')
  const [valorExterno, setValorExterno] = useState('')
  const [sensible, setSensible] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: opciones } = useQuery(opcionesMaestroOptions(tipo === 'MAESTRO' ? maestro : null))

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    if (item) {
      setIdExterno(item.idExterno)
      setTipo(item.tipo)
      setMaestro(item.maestro ?? 'ENTIDAD')
      setMaestroId(item.maestroId)
      setValorLocal(item.valorLocal ?? '')
      // El valor real nunca vuelve del backend si es sensible (llega
      // enmascarado) — reenviarlo tal cual lo cifraría de nuevo. Se deja
      // vacío y el usuario solo lo escribe si quiere cambiarlo.
      setValorExterno(item.sensible ? '' : item.valorExterno)
      setSensible(item.sensible)
      setDescripcion(item.descripcion ?? '')
    } else {
      setIdExterno('')
      setTipo('TEXTO')
      setMaestro('ENTIDAD')
      setMaestroId(null)
      setValorLocal('')
      setValorExterno('')
      setSensible(false)
      setDescripcion('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const base = {
        idExterno: idExterno.trim(),
        tipo,
        maestro: tipo === 'MAESTRO' ? maestro : null,
        maestroId: tipo === 'MAESTRO' ? maestroId : null,
        valorLocal: tipo === 'MAESTRO' ? valorLocal.trim() : undefined,
        sensible,
        descripcion: descripcion.trim() || null,
      }
      if (isEdit) {
        return integracionesService.updateParametro(integracionId, item!.id, {
          ...base,
          // Vacío al editar un sensible = "no cambiar"; se omite del payload.
          ...(valorExterno.trim() ? { valorExterno: valorExterno.trim() } : {}),
        })
      }
      return integracionesService.addParametro(integracionId, { ...base, valorExterno: valorExterno.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integracionesKeys.detail(integracionId) })
      toast.success(isEdit ? 'Parámetro actualizado' : 'Parámetro agregado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el parámetro'),
  })

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!idExterno.trim()) e.idExterno = 'El ID externo es requerido'
    if (tipo === 'MAESTRO' && !maestroId) e.maestroId = 'Selecciona el registro local'
    if (!isEdit && !valorExterno.trim()) e.valorExterno = 'El valor es requerido'
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
          <SheetTitle>{isEdit ? `Editar parámetro ${item?.idExterno}` : 'Nuevo parámetro'}</SheetTitle>
          <SheetDescription>
            Mapea un ID/valor del sistema externo a un dato propio (o un texto libre, ej. un token).
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>ID externo <span className='text-destructive'>*</span></Label>
              <Input value={idExterno} onChange={(e) => setIdExterno(e.target.value)} placeholder='TOKEN, POD_123, ...' />
              {errors.idExterno && <p className='text-xs text-destructive'>{errors.idExterno}</p>}
            </div>
            <div className='space-y-1.5'>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoParametroIntegracion); setMaestroId(null); setValorLocal('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='TEXTO'>Texto libre</SelectItem>
                  <SelectItem value='MAESTRO'>Vínculo a maestro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === 'MAESTRO' && (
            <>
              <div className='space-y-1.5'>
                <Label>Maestro</Label>
                <Select value={maestro} onValueChange={(v) => { setMaestro(v as MaestroIntegracion); setMaestroId(null); setValorLocal('') }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(MAESTRO_INTEGRACION_LABELS) as MaestroIntegracion[]).map((m) => (
                      <SelectItem key={m} value={m}>{MAESTRO_INTEGRACION_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='space-y-1.5'>
                <Label>Registro local <span className='text-destructive'>*</span></Label>
                <Combobox
                  value={maestroId ? String(maestroId) : ''}
                  onChange={(v) => {
                    const opcion = opciones?.data.find((o) => String(o.id) === v)
                    setMaestroId(opcion ? opcion.id : null)
                    setValorLocal(opcion ? `${opcion.codigo} — ${opcion.descripcion}` : '')
                  }}
                  placeholder='Selecciona...'
                  searchPlaceholder='Buscar...'
                  options={(opciones?.data ?? []).map((o) => ({ value: String(o.id), label: `${o.codigo} — ${o.descripcion}` }))}
                />
                {errors.maestroId && <p className='text-xs text-destructive'>{errors.maestroId}</p>}
              </div>
            </>
          )}

          <div className='space-y-1.5'>
            <Label>
              Valor {isEdit && item?.sensible ? <span className='text-muted-foreground text-xs'>(dejar vacío para no cambiarlo)</span> : <span className='text-destructive'>*</span>}
            </Label>
            <Input
              type={sensible ? 'password' : 'text'}
              value={valorExterno}
              onChange={(e) => setValorExterno(e.target.value)}
              placeholder={isEdit && item?.sensible ? MASCARA : ''}
            />
            {errors.valorExterno && <p className='text-xs text-destructive'>{errors.valorExterno}</p>}
          </div>

          <div className='flex items-center gap-2'>
            <Switch id='sensible-parametro' checked={sensible} onCheckedChange={setSensible} />
            <Label htmlFor='sensible-parametro'>Sensible (se guarda cifrado, nunca se vuelve a mostrar)</Label>
          </div>

          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-muted-foreground text-xs'>(opcional)</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
