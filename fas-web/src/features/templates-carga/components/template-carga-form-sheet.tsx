'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { prefijosCodigoService } from '@/features/prefijos-codigo/service'
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
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { templatesCargaService } from '../service'
import { CAMPOS_TEMPLATE_CARGA, CAMPO_TEMPLATE_CARGA_LABELS } from '../types'
import type { TemplateCarga, CampoTemplateCarga } from '../types'

const ITEM = 'CONFIG_MANTENEDORES'

interface TemplateCargaFormSheetProps {
  item?: TemplateCarga
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ColumnasPorCampo = Record<CampoTemplateCarga, string>

function columnasVacias(): ColumnasPorCampo {
  return Object.fromEntries(CAMPOS_TEMPLATE_CARGA.map((c) => [c, ''])) as ColumnasPorCampo
}

export function TemplateCargaFormSheet({ item, open, onOpenChange }: TemplateCargaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [tieneCabecera, setTieneCabecera] = useState(true)
  const [filaCabecera, setFilaCabecera] = useState('')
  const [filaPrimerRegistro, setFilaPrimerRegistro] = useState('')
  const [columnas, setColumnas] = useState<ColumnasPorCampo>(columnasVacias())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setTieneCabecera(item.tieneCabecera)
      setFilaCabecera(item.filaCabecera != null ? String(item.filaCabecera) : '')
      setFilaPrimerRegistro(String(item.filaPrimerRegistro))
      const c = columnasVacias()
      for (const campo of item.campos) c[campo.campo] = campo.columna
      setColumnas(c)
    } else {
      setCodigo('')
      setDescripcion('')
      setTieneCabecera(true)
      setFilaCabecera('')
      setFilaPrimerRegistro('')
      setColumnas(columnasVacias())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  // Sugerencia de código (Prefijos de Código) — solo al crear.
  const { data: codigoSugerido } = useQuery({
    queryKey: ['prefijo-codigo-siguiente', 'templateCarga'],
    queryFn: () => prefijosCodigoService.siguienteCodigo('templateCarga'),
    enabled: open && !isEdit,
    staleTime: 0,
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && !isEdit && codigoSugerido) setCodigo(codigoSugerido)
  }, [codigoSugerido, open, isEdit])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!isEdit && !codigo.trim()) e.codigo = 'El código es requerido'
    if (!descripcion.trim()) e.descripcion = 'La descripción es requerida'
    if (tieneCabecera && !filaCabecera.trim()) e.filaCabecera = 'La fila de cabecera es requerida'
    if (!filaPrimerRegistro.trim()) e.filaPrimerRegistro = 'La fila del primer registro es requerida'
    if (
      tieneCabecera &&
      filaCabecera.trim() &&
      filaPrimerRegistro.trim() &&
      Number(filaPrimerRegistro) <= Number(filaCabecera)
    ) {
      e.filaPrimerRegistro = 'Debe ser posterior a la fila de cabecera'
    }
    // Los 8 campos son siempre obligatorios: el motor de carga necesita todos
    // para materializar Pallet/PalletLinea (compras.md §4.5-4.6, §7).
    const columnasVistas = new Map<string, string>()
    for (const campo of CAMPOS_TEMPLATE_CARGA) {
      const columna = columnas[campo].trim()
      if (!columna) { e.campos = 'Deben completarse las columnas de los 8 campos'; break }
      if (!tieneCabecera && !/^[A-Za-z]+$/.test(columna)) {
        e.campos = 'Sin cabecera, la columna debe ser una letra de Excel (A, B, C...)'
        break
      }
      // Dos campos no pueden apuntar a la misma columna (comparación
      // normalizada: trim + mayúsculas, mismo criterio que el backend).
      const normalizada = columna.toUpperCase()
      const otroCampo = columnasVistas.get(normalizada)
      if (otroCampo) {
        e.campos = `Los campos "${CAMPO_TEMPLATE_CARGA_LABELS[otroCampo as CampoTemplateCarga]}" y "${CAMPO_TEMPLATE_CARGA_LABELS[campo]}" no pueden apuntar a la misma columna`
        break
      }
      columnasVistas.set(normalizada, campo)
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        tieneCabecera,
        filaCabecera: tieneCabecera ? Number(filaCabecera) : null,
        filaPrimerRegistro: Number(filaPrimerRegistro),
        campos: CAMPOS_TEMPLATE_CARGA.map((campo) => ({ campo, columna: columnas[campo].trim() })),
      }
      if (isEdit) return templatesCargaService.update(item!.id, payload)
      return templatesCargaService.create({ ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates-carga'] })
      toast.success(isEdit ? 'Template de Carga actualizado' : 'Template de Carga creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el Template de Carga'),
  })

  function handleSubmit() {
    if (!validar()) return
    mutation.mutate()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar Template de Carga ${item?.codigo}` : 'Nuevo Template de Carga'}</SheetTitle>
          <SheetDescription>Define cómo leer el Excel de Recepción de Stock: en qué fila empieza y qué columna corresponde a cada campo.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Código <span className='text-destructive'>*</span></Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={isEdit} />
            {errors.codigo && <p className='text-xs text-destructive'>{errors.codigo}</p>}
          </div>
          <div className='space-y-1.5'>
            <Label>Descripción <span className='text-destructive'>*</span></Label>
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Ej: Formato Planta Norte' />
            {errors.descripcion && <p className='text-xs text-destructive'>{errors.descripcion}</p>}
          </div>

          <div className='flex items-center gap-3 rounded-lg border p-3'>
            <Switch id='tieneCabecera' checked={tieneCabecera} onCheckedChange={setTieneCabecera} />
            <Label htmlFor='tieneCabecera' className='cursor-pointer font-normal'>El Excel tiene fila de cabecera (títulos de columna)</Label>
          </div>

          <div className='grid gap-4 sm:grid-cols-2'>
            {tieneCabecera && (
              <div className='space-y-1.5'>
                <Label>Fila de Cabecera <span className='text-destructive'>*</span></Label>
                <Input type='number' min={1} value={filaCabecera} onChange={(e) => setFilaCabecera(e.target.value)} />
                {errors.filaCabecera && <p className='text-xs text-destructive'>{errors.filaCabecera}</p>}
              </div>
            )}
            <div className='space-y-1.5'>
              <Label>Fila del Primer Registro <span className='text-destructive'>*</span></Label>
              <Input type='number' min={1} value={filaPrimerRegistro} onChange={(e) => setFilaPrimerRegistro(e.target.value)} />
              {errors.filaPrimerRegistro && <p className='text-xs text-destructive'>{errors.filaPrimerRegistro}</p>}
            </div>
          </div>

          <div className='space-y-2'>
            <Label>Mapeo de Campos <span className='text-destructive'>*</span></Label>
            <p className='text-xs text-muted-foreground'>
              {tieneCabecera ? 'Indica el título exacto de la columna en el Excel para cada campo.' : 'Indica la letra de columna del Excel (A, B, C...) para cada campo.'}
            </p>
            <div className='space-y-2 rounded-md border p-3'>
              {CAMPOS_TEMPLATE_CARGA.map((campo) => (
                <div key={campo} className='grid grid-cols-2 items-center gap-2'>
                  <Label className='text-xs font-normal'>{CAMPO_TEMPLATE_CARGA_LABELS[campo]}</Label>
                  <Input
                    value={columnas[campo]}
                    onChange={(e) => setColumnas((prev) => ({ ...prev, [campo]: e.target.value }))}
                    placeholder={tieneCabecera ? 'Ej: N° Pallet' : 'Ej: A'}
                  />
                </div>
              ))}
            </div>
            {errors.campos && <p className='text-xs text-destructive'>{errors.campos}</p>}
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear Template de Carga'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export function TemplateCargaFormSheetTrigger() {
  const [open, setOpen] = useState(false)
  const puedeEscribir = usePuedeEscribir(ITEM)
  if (!puedeEscribir) return null
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Icons.add className='mr-2 h-4 w-4' /> Nuevo Template de Carga
      </Button>
      <TemplateCargaFormSheet open={open} onOpenChange={setOpen} />
    </>
  )
}
