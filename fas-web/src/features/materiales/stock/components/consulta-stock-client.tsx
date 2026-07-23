'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { articulosService } from '../../articulos/service'
import { stockService } from '../service'
import type { EmbalajeCantidad, ResultadoConsultaStock, EstadoStockReceta } from '../types'

const bodegasService = createMantenedorService('bodegas')

const ESTADO_CONFIG: Record<EstadoStockReceta, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  NA: { label: 'N/A', variant: 'outline' },
  OK: { label: 'OK', variant: 'default' },
  WARNING: { label: 'Advertencia', variant: 'secondary' },
  DANGER: { label: 'Sin Stock', variant: 'destructive' },
}

export function ConsultaStockClient() {
  const [embalajes, setEmbalajes] = useState<EmbalajeCantidad[]>([])
  const [bodegaIds, setBodegaIds] = useState<number[]>([])
  const [resultado, setResultado] = useState<ResultadoConsultaStock[] | null>(null)

  const { data: embalajesDisponibles } = useQuery({
    queryKey: ['embalajes-options-consulta'],
    queryFn: () => articulosService.list({ tipo: 'EMBALAJE', activo: true, limit: 500 }),
    staleTime: 60_000,
  })
  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-options-consulta'],
    queryFn: () => bodegasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: () => stockService.consultaStockReceta(embalajes, bodegaIds),
    onSuccess: (res) => setResultado(res.data),
    onError: (e: Error) => toast.error(e.message || 'Error al consultar stock'),
  })

  function agregarEmbalaje(articuloId: string) {
    const id = parseInt(articuloId)
    if (embalajes.some((e) => e.articuloId === id)) return
    setEmbalajes((prev) => [...prev, { articuloId: id, cantidad: 1 }])
  }
  function actualizarCantidad(articuloId: number, cantidad: number) {
    setEmbalajes((prev) => prev.map((e) => e.articuloId === articuloId ? { ...e, cantidad } : e))
  }
  function quitarEmbalaje(articuloId: number) {
    setEmbalajes((prev) => prev.filter((e) => e.articuloId !== articuloId))
  }
  function nombreEmbalaje(id: number) {
    return embalajesDisponibles?.data.find((e) => e.id === id)?.descripcion ?? String(id)
  }

  function toggleBodega(bodegaId: number) {
    setBodegaIds((prev) => prev.includes(bodegaId) ? prev.filter((b) => b !== bodegaId) : [...prev, bodegaId])
  }
  function nombreBodega(id: number) {
    return bodegas?.data.find((b) => b.id === id)?.descripcion ?? String(id)
  }

  return (
    <div className='space-y-6'>
      <div className='space-y-2'>
        <Label>Embalajes a producir</Label>
        <Select value='' onValueChange={agregarEmbalaje}>
          <SelectTrigger className='max-w-sm'><SelectValue placeholder='Agregar embalaje...' /></SelectTrigger>
          <SelectContent>
            {(embalajesDisponibles?.data ?? []).map((e) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.codigo} — {e.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {embalajes.length > 0 && (
          <div className='max-w-sm space-y-2 rounded-md border p-2'>
            {embalajes.map((e) => (
              <div key={e.articuloId} className='flex items-center gap-2'>
                <span className='flex-1 text-sm'>{nombreEmbalaje(e.articuloId)}</span>
                <Input
                  type='number' step='1' className='w-24'
                  value={e.cantidad} onChange={(ev) => actualizarCantidad(e.articuloId, Number(ev.target.value))}
                />
                <Button type='button' variant='ghost' size='icon' className='h-8 w-8' onClick={() => quitarEmbalaje(e.articuloId)}>
                  <Icons.trash className='h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='space-y-2'>
        <Label>Filtrar por bodegas <span className='text-muted-foreground text-xs'>(opcional — afecta el motivo &quot;Trasladar&quot;)</span></Label>
        <div className='flex flex-wrap gap-2'>
          {(bodegas?.data ?? []).map((b) => (
            <Badge
              key={b.id}
              variant={bodegaIds.includes(b.id) ? 'default' : 'outline'}
              className='cursor-pointer'
              onClick={() => toggleBodega(b.id)}
            >
              {b.descripcion}
            </Badge>
          ))}
        </div>
      </div>

      <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending} disabled={embalajes.length === 0}>
        <Icons.search className='mr-2 h-4 w-4' /> Consultar stock
      </Button>

      {resultado && (
        <div className='space-y-3'>
          {resultado.length === 0 ? (
            <p className='text-sm text-muted-foreground'>Los embalajes seleccionados no tienen recetas definidas.</p>
          ) : resultado.map((r) => (
            <div key={r.articuloId} className='rounded-md border p-3'>
              <div className='flex items-center justify-between'>
                <p className='font-medium'>{r.codigo} — {r.descripcion}</p>
                <div className='flex gap-1'>
                  <Badge variant={ESTADO_CONFIG[r.estado].variant}>{ESTADO_CONFIG[r.estado].label}</Badge>
                  {r.motivos.map((m) => <Badge key={m} variant='outline'>{m}</Badge>)}
                </div>
              </div>
              <p className='text-sm text-muted-foreground'>Demanda: {r.demanda} · Stock total: {r.stockTotal}</p>
              <div className='mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3'>
                {r.stockPorBodega.map((s) => (
                  <div key={s.bodegaId} className='text-xs'>
                    <span className='text-muted-foreground'>{s.bodega.descripcion}:</span> {s.cantidad}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
