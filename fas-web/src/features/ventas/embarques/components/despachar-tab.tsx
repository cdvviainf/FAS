'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isHTTPError } from 'ky'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { templatesCargaService } from '@/features/templates-carga/service'
import { embarquesService } from '../service'
import { embarquesKeys } from '../queries'
import { estaDespachado } from '../types'
import type { EmbarqueDetalle } from '../types'

const ITEM = 'VENTAS_EMBARQUES'
const ACCEPT_PACKING_LIST = '.xlsx'

// Mismo criterio que recepcion-form.tsx: el motor junta TODAS las
// diferencias de la etapa que abortó en `error.details.diferencias`, un
// toast de una línea no alcanza.
function diferenciasDelError(err: unknown): string[] {
  if (!isHTTPError(err)) return []
  const data = err.data as { error?: { details?: { diferencias?: unknown } } } | undefined
  const diferencias = data?.error?.details?.diferencias
  return Array.isArray(diferencias) ? diferencias.filter((d): d is string => typeof d === 'string') : []
}

// "Anular Despacho" (2026-09-22, decisión de negocio Christian) — soft
// delete de la confirmación: no desvincula pallets (siguen reservados/
// seleccionados), pero borra los Instructivos por Planta y la reconciliación
// de Packing List vigente (ambos derivados de un despacho que ya no es
// válido). Confirmación explícita porque, aunque no toca los pallets, sí
// tiene efecto real y visible en otras dos pestañas.
function AnularDespachoDialog({
  embarque,
  open,
  onOpenChange,
}: {
  embarque: EmbarqueDetalle
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => embarquesService.anularDespacho(embarque.id),
    onSuccess: () => {
      toast.success('Despacho anulado')
      queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'No se pudo anular el despacho'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Anular Despacho</DialogTitle>
          <DialogDescription>
            Los {embarque.pallets.length} pallet{embarque.pallets.length === 1 ? '' : 's'} de este Embarque
            seguirán reservados/seleccionados — no se devuelven al stock automáticamente. Se eliminarán los
            Instructivos por Planta generados y la reconciliación de Packing List vigente; deberás rehacerlos
            antes de volver a despachar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type='button' variant='destructive' isLoading={mutation.isPending} onClick={() => mutation.mutate()}>
            <Icons.xCircle className='mr-1 h-4 w-4' /> Anular Despacho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DespacharTab({ embarque }: { embarque: EmbarqueDetalle }) {
  const puedeEscribir = usePuedeEscribir(ITEM)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [templateCargaId, setTemplateCargaId] = useState<string>('')
  const [erroresCarga, setErroresCarga] = useState<{ mensaje: string; diferencias: string[] } | null>(null)
  const [anulando, setAnulando] = useState(false)

  const despachado = estaDespachado(embarque)

  const { data: templatesData } = useQuery({
    queryKey: ['templates-carga', 'PACKING_LIST'],
    queryFn: () => templatesCargaService.list({ tipo: 'PACKING_LIST' }),
    enabled: !despachado,
  })
  const templates = templatesData?.data ?? []

  const invalidar = () => queryClient.invalidateQueries({ queryKey: embarquesKeys.detail(embarque.id) })

  const subirPackingListMutation = useMutation({
    mutationFn: (archivo: File) => embarquesService.subirPackingList(embarque.id, Number(templateCargaId), archivo),
    onSuccess: (res) => {
      setErroresCarga(null)
      invalidar()
      toast[res.data.estado === 'OK' ? 'success' : 'warning'](
        res.data.estado === 'OK' ? 'Packing List reconciliado sin diferencias' : 'El Packing List tiene discrepancias — revísalas abajo',
      )
    },
    onError: (e: Error) => {
      const diferencias = diferenciasDelError(e)
      if (diferencias.length > 0) {
        setErroresCarga({ mensaje: e.message, diferencias })
      } else {
        toast.error(e.message || 'Error al subir el Packing List')
      }
    },
  })

  const despacharMutation = useMutation({
    mutationFn: () => embarquesService.despachar(embarque.id),
    onSuccess: () => {
      toast.success('Despacho confirmado')
      invalidar()
    },
    onError: (e: Error) => toast.error(e.message || 'Error al confirmar el despacho'),
  })

  function agregarArchivo(files: FileList | null) {
    if (!files || files.length === 0) return
    const f = files[0]
    if (inputRef.current) inputRef.current.value = ''
    if (!templateCargaId) {
      toast.error('Elige un Template de Carga antes de subir el archivo')
      return
    }
    setErroresCarga(null)
    subirPackingListMutation.mutate(f)
  }

  if (despachado) {
    return (
      <div className='space-y-4'>
        <div className='space-y-2 rounded-md border border-dashed p-6 text-center'>
          <Badge>Despachado</Badge>
          <p className='text-muted-foreground text-sm'>
            Confirmado el {new Date(embarque.despachadoEn!).toLocaleString('es-CL')}
            {embarque.despachadoPor ? ` — ${embarque.despachadoPor}` : ''}
          </p>
          {puedeEscribir && (
            <Button type='button' variant='outline' size='sm' onClick={() => setAnulando(true)}>
              <Icons.xCircle className='mr-1 h-4 w-4' /> Anular Despacho
            </Button>
          )}
        </div>
        {embarque.packingList && (
          <div className='flex items-center gap-2 rounded-md border p-3 text-sm'>
            <Icons.paperclip className='text-muted-foreground h-4 w-4 shrink-0' />
            <a
              href={embarquesService.urlDescargaPackingList(embarque.id)}
              target='_blank'
              rel='noreferrer'
              className='underline underline-offset-2'
            >
              {embarque.packingList.nombreArchivo}
            </a>
            <span className='text-muted-foreground text-xs'>Packing List reconciliado</span>
          </div>
        )}
        <AnularDespachoDialog embarque={embarque} open={anulando} onOpenChange={setAnulando} />
      </div>
    )
  }

  const packingList = embarque.packingList
  const packingListOk = packingList?.estado === 'OK'

  return (
    <div className='space-y-4'>
      {embarque.despachoAnuladoEn && (
        <p className='text-muted-foreground rounded-md border border-dashed p-3 text-center text-xs'>
          Despacho anulado el {new Date(embarque.despachoAnuladoEn).toLocaleString('es-CL')}
          {embarque.despachoAnuladoPor ? ` — ${embarque.despachoAnuladoPor}` : ''} — reconcilia el Packing List de
          nuevo antes de volver a despachar.
        </p>
      )}
      <div className='space-y-3 rounded-md border p-6'>
        <p className='text-muted-foreground text-center text-sm'>
          {embarque.pallets.length} pallet{embarque.pallets.length === 1 ? '' : 's'} reservado
          {embarque.pallets.length === 1 ? '' : 's'} a este Embarque.
        </p>

        {puedeEscribir && (
          <div className='space-y-2'>
            <Label>Packing List</Label>
            <p className='text-muted-foreground text-xs'>
              Sube el Excel de Packing List de la planta para reconciliar los pallets antes de despachar (compras.md §9.3).
            </p>
            <div className='flex flex-wrap items-center gap-2'>
              <Select value={templateCargaId} onValueChange={setTemplateCargaId}>
                <SelectTrigger className='w-64'>
                  <SelectValue placeholder='Template de Carga' />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.codigo} — {t.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                ref={inputRef}
                type='file'
                accept={ACCEPT_PACKING_LIST}
                className='hidden'
                onChange={(e) => agregarArchivo(e.target.files)}
              />
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={!templateCargaId || subirPackingListMutation.isPending}
                isLoading={subirPackingListMutation.isPending}
                onClick={() => inputRef.current?.click()}
              >
                <Icons.upload className='mr-1 h-4 w-4' /> Subir Excel
              </Button>
            </div>
            <p className='text-muted-foreground text-xs'>Solo .xlsx. Máx. 10 MB.</p>
          </div>
        )}

        {erroresCarga && (
          <div className='space-y-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-3'>
            <p className='text-destructive text-sm font-medium'>{erroresCarga.mensaje}</p>
            <ul className='list-disc space-y-0.5 pl-4 text-xs text-destructive/90'>
              {erroresCarga.diferencias.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        )}

        {packingList && (
          <div
            className={`space-y-1.5 rounded-md border p-3 ${packingListOk ? 'border-emerald-600/40 bg-emerald-600/5' : 'border-amber-600/40 bg-amber-600/5'}`}
          >
            <div className='flex items-center gap-2'>
              {packingListOk ? (
                <Icons.check className='h-4 w-4 shrink-0 text-emerald-600' />
              ) : (
                <Icons.alertCircle className='h-4 w-4 shrink-0 text-amber-600' />
              )}
              <a
                href={embarquesService.urlDescargaPackingList(embarque.id)}
                target='_blank'
                rel='noreferrer'
                className='text-sm underline underline-offset-2'
              >
                {packingList.nombreArchivo}
              </a>
              <span className='text-muted-foreground text-xs'>
                {new Date(packingList.cargadoEn).toLocaleString('es-CL')} — {packingList.cargadoPor}
              </span>
            </div>
            {packingListOk ? (
              <p className='text-xs text-emerald-700'>Sin discrepancias contra los pallets reservados.</p>
            ) : (
              <ul className='list-disc space-y-0.5 pl-4 text-xs text-amber-800'>
                {packingList.discrepancias.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {puedeEscribir && (
          <div className='flex justify-center'>
            <Button
              type='button'
              onClick={() => despacharMutation.mutate()}
              disabled={embarque.pallets.length === 0 || !packingListOk || despacharMutation.isPending}
              isLoading={despacharMutation.isPending}
            >
              <Icons.check className='mr-1 h-4 w-4' /> Confirmar Despacho
            </Button>
          </div>
        )}
        {!packingListOk && (
          <p className='text-muted-foreground text-center text-xs'>
            Debes reconciliar el Packing List sin discrepancias antes de poder despachar.
          </p>
        )}
      </div>
    </div>
  )
}
