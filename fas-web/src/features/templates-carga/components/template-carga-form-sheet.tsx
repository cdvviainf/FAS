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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { usePuedeEscribir } from '@/hooks/use-item-acceso'
import { templatesCargaService } from '../service'
import { TIPOS_TEMPLATE_CARGA, TIPO_TEMPLATE_CARGA_LABELS, CAMPOS_POR_TIPO, CAMPOS_OPCIONALES_POR_TIPO, CAMPO_TEMPLATE_CARGA_LABELS } from '../types'
import type { TemplateCarga, TipoTemplateCarga } from '../types'

const ITEM = 'CONFIG_MANTENEDORES'

interface TemplateCargaFormSheetProps {
  item?: TemplateCarga
  open: boolean
  onOpenChange: (open: boolean) => void
}

type ColumnasPorCampo = Record<string, string>

function columnasVacias(tipo: TipoTemplateCarga): ColumnasPorCampo {
  return Object.fromEntries(CAMPOS_POR_TIPO[tipo].map((c) => [c, '']))
}

export function TemplateCargaFormSheet({ item, open, onOpenChange }: TemplateCargaFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState<TipoTemplateCarga>('RECEPCION')
  const [descripcion, setDescripcion] = useState('')
  const [tieneCabecera, setTieneCabecera] = useState(true)
  const [filaCabecera, setFilaCabecera] = useState('')
  const [filaPrimerRegistro, setFilaPrimerRegistro] = useState('')
  const [columnas, setColumnas] = useState<ColumnasPorCampo>(columnasVacias('RECEPCION'))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const camposDelTipo = CAMPOS_POR_TIPO[tipo]
  const camposOpcionales = CAMPOS_OPCIONALES_POR_TIPO[tipo]
  const tipoSinCampos = camposDelTipo.length === 0

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setTipo(item.tipo)
      setDescripcion(item.descripcion)
      setTieneCabecera(item.tieneCabecera)
      setFilaCabecera(item.filaCabecera != null ? String(item.filaCabecera) : '')
      setFilaPrimerRegistro(String(item.filaPrimerRegistro))
      const c = columnasVacias(item.tipo)
      for (const campo of item.campos) c[campo.campo] = campo.columna
      setColumnas(c)
    } else {
      setCodigo('')
      setTipo('RECEPCION')
      setDescripcion('')
      setTieneCabecera(true)
      setFilaCabecera('')
      setFilaPrimerRegistro('')
      setColumnas(columnasVacias('RECEPCION'))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  // Cambiar de tipo al crear reinicia el mapeo de columnas: los campos
  // disponibles son distintos por tipo, no tiene sentido conservar valores.
  function handleTipoChange(nuevoTipo: TipoTemplateCarga) {
    setTipo(nuevoTipo)
    setColumnas(columnasVacias(nuevoTipo))
  }

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
    if (tipoSinCampos) {
      e.campos = `El tipo "${TIPO_TEMPLATE_CARGA_LABELS[tipo]}" todavía no tiene campos definidos`
    } else {
      // Todos los campos del tipo son obligatorios: el motor de carga los
      // necesita todos para materializar Pallet/PalletLinea (compras.md
      // §4.5-4.6, §7).
      const columnasVistas = new Map<string, string>()
      for (const campo of camposDelTipo) {
        const columna = columnas[campo].trim()
        if (!columna) {
          if (camposOpcionales.includes(campo)) continue
          e.campos = `Deben completarse las columnas de los campos obligatorios`
          break
        }
        if (!tieneCabecera && !/^[A-Za-z]+$/.test(columna)) {
          e.campos = 'Sin cabecera, la columna debe ser una letra de Excel (A, B, C...)'
          break
        }
        // Dos campos no pueden apuntar a la misma columna (comparación
        // normalizada: trim + mayúsculas, mismo criterio que el backend).
        const normalizada = columna.toUpperCase()
        const otroCampo = columnasVistas.get(normalizada)
        if (otroCampo) {
          e.campos = `Los campos "${CAMPO_TEMPLATE_CARGA_LABELS[otroCampo]}" y "${CAMPO_TEMPLATE_CARGA_LABELS[campo]}" no pueden apuntar a la misma columna`
          break
        }
        columnasVistas.set(normalizada, campo)
      }
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
        campos: camposDelTipo
          .map((campo) => ({ campo, columna: columnas[campo].trim() }))
          .filter((c) => c.columna || !camposOpcionales.includes(c.campo)),
      }
      if (isEdit) return templatesCargaService.update(item!.id, payload)
      return templatesCargaService.create({ ...payload, codigo: codigo.trim(), tipo })
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
          <SheetDescription>Define cómo leer el Excel: en qué fila empieza y qué columna corresponde a cada campo.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='space-y-1.5'>
            <Label>Tipo <span className='text-destructive'>*</span></Label>
            <Select value={tipo} onValueChange={(v) => handleTipoChange(v as TipoTemplateCarga)} disabled={isEdit}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS_TEMPLATE_CARGA.map((t) => (
                  <SelectItem key={t} value={t}>{TIPO_TEMPLATE_CARGA_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isEdit && <p className='text-xs text-muted-foreground'>No se puede cambiar después de creado.</p>}
          </div>
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
            {tipoSinCampos ? (
              <p className='rounded-md border border-dashed p-3 text-sm text-muted-foreground'>
                El tipo &quot;{TIPO_TEMPLATE_CARGA_LABELS[tipo]}&quot; todavía no tiene campos definidos — no se puede crear un template de este tipo por ahora.
              </p>
            ) : (
              <>
                <p className='text-xs text-muted-foreground'>
                  {tieneCabecera ? 'Indica el título exacto de la columna en el Excel para cada campo.' : 'Indica la letra de columna del Excel (A, B, C...) para cada campo.'}
                </p>
                <div className='space-y-2 rounded-md border p-3'>
                  {camposDelTipo.map((campo) => (
                    <div key={campo} className='grid grid-cols-2 items-center gap-2'>
                      <Label className='text-xs font-normal'>
                        {CAMPO_TEMPLATE_CARGA_LABELS[campo]}
                        {camposOpcionales.includes(campo) && <span className='text-muted-foreground'> (opcional)</span>}
                      </Label>
                      <Input
                        value={columnas[campo] ?? ''}
                        onChange={(e) => setColumnas((prev) => ({ ...prev, [campo]: e.target.value }))}
                        placeholder={tieneCabecera ? 'Ej: N° Pallet' : 'Ej: A'}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
            {errors.campos && <p className='text-xs text-destructive'>{errors.campos}</p>}
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending} disabled={tipoSinCampos}>
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
