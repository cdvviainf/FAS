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
import { Icons } from '@/components/icons'
import { createMantenedorService } from '@/features/mantenedor-simple/service'
import { prediosService } from '../service'
import type { Predio } from '../types'

const comunasService = createMantenedorService('comunas')
const tiposProduccionService = createMantenedorService('tipos-produccion')
const zonasService = createMantenedorService('zonas')

interface PredioFormSheetProps {
  entidadId: number
  item?: Predio
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PredioFormSheet({ entidadId, item, open, onOpenChange }: PredioFormSheetProps) {
  const isEdit = !!item
  const queryClient = useQueryClient()

  const [codigo, setCodigo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [codigoCsg, setCodigoCsg] = useState('')
  const [nombreCsg, setNombreCsg] = useState('')
  const [codigoSdp, setCodigoSdp] = useState('')
  const [codigoGgn, setCodigoGgn] = useState('')
  const [direccion, setDireccion] = useState('')
  const [comunaId, setComunaId] = useState<number | null>(null)
  const [tipoProduccionId, setTipoProduccionId] = useState<number | null>(null)
  const [zonaId, setZonaId] = useState<number | null>(null)
  const [latitud, setLatitud] = useState('')
  const [longitud, setLongitud] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: comunas } = useQuery({
    queryKey: ['comunas-options-predio'],
    queryFn: () => comunasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: tiposProduccion } = useQuery({
    queryKey: ['tipos-produccion-options'],
    queryFn: () => tiposProduccionService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })
  const { data: zonas } = useQuery({
    queryKey: ['zonas-options'],
    queryFn: () => zonasService.list({ soloActivos: true, limit: 500 }),
    staleTime: 60_000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (item) {
      setCodigo(item.codigo)
      setDescripcion(item.descripcion)
      setCodigoCsg(item.codigoCsg ?? '')
      setNombreCsg(item.nombreCsg ?? '')
      setCodigoSdp(item.codigoSdp ?? '')
      setCodigoGgn(item.codigoGgn ?? '')
      setDireccion(item.direccion ?? '')
      setComunaId(item.comunaId)
      setTipoProduccionId(item.tipoProduccionId)
      setZonaId(item.zonaId)
      setLatitud(item.latitud ?? '')
      setLongitud(item.longitud ?? '')
    } else {
      setCodigo('')
      setDescripcion('')
      setCodigoCsg('')
      setNombreCsg('')
      setCodigoSdp('')
      setCodigoGgn('')
      setDireccion('')
      setComunaId(null)
      setTipoProduccionId(null)
      setZonaId(null)
      setLatitud('')
      setLongitud('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id])

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        descripcion: descripcion.trim(),
        codigoCsg: codigoCsg.trim() || null,
        nombreCsg: nombreCsg.trim() || null,
        codigoSdp: codigoSdp.trim() || null,
        codigoGgn: codigoGgn.trim() || null,
        direccion: direccion.trim() || null,
        comunaId,
        tipoProduccionId,
        zonaId,
        latitud: latitud ? Number(latitud) : null,
        longitud: longitud ? Number(longitud) : null,
      }
      if (isEdit) return prediosService.update(entidadId, item!.id, payload)
      return prediosService.create(entidadId, { ...payload, codigo: codigo.trim() })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productores', 'ficha', entidadId] })
      toast.success(isEdit ? 'Predio actualizado' : 'Predio creado')
      onOpenChange(false)
    },
    onError: (e: Error) => toast.error(e.message || 'Error al guardar el predio'),
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full flex-col sm:max-w-lg'>
        <SheetHeader>
          <SheetTitle>{isEdit ? `Editar predio ${item?.codigo}` : 'Nuevo predio'}</SheetTitle>
          <SheetDescription>El código debe ser único para este productor.</SheetDescription>
        </SheetHeader>

        <div className='flex-1 space-y-4 overflow-auto px-1 py-2'>
          <div className='grid grid-cols-2 gap-3'>
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
          </div>

          <div className='grid grid-cols-3 gap-3'>
            <div className='space-y-1.5'>
              <Label>Código CSG</Label>
              <Input value={codigoCsg} onChange={(e) => setCodigoCsg(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Código SDP</Label>
              <Input value={codigoSdp} onChange={(e) => setCodigoSdp(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Código GGN</Label>
              <Input value={codigoGgn} onChange={(e) => setCodigoGgn(e.target.value)} />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label>Nombre CSG</Label>
            <Input value={nombreCsg} onChange={(e) => setNombreCsg(e.target.value)} />
          </div>

          <div className='space-y-1.5'>
            <Label>Dirección</Label>
            <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Comuna</Label>
              <Select value={comunaId ? String(comunaId) : 'none'} onValueChange={(v) => setComunaId(v === 'none' ? null : parseInt(v))}>
                <SelectTrigger><SelectValue placeholder='Sin comuna' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin comuna</SelectItem>
                  {(comunas?.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1.5'>
              <Label>Zona</Label>
              <Select value={zonaId ? String(zonaId) : 'none'} onValueChange={(v) => setZonaId(v === 'none' ? null : parseInt(v))}>
                <SelectTrigger><SelectValue placeholder='Sin zona' /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>Sin zona</SelectItem>
                  {(zonas?.data ?? []).map((z) => (
                    <SelectItem key={z.id} value={String(z.id)}>{z.descripcion}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label>Tipo de producción</Label>
            <Select value={tipoProduccionId ? String(tipoProduccionId) : 'none'} onValueChange={(v) => setTipoProduccionId(v === 'none' ? null : parseInt(v))}>
              <SelectTrigger><SelectValue placeholder='Sin tipo' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin tipo</SelectItem>
                {(tiposProduccion?.data ?? []).map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.descripcion}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label>Latitud</Label>
              <Input type='number' step='any' value={latitud} onChange={(e) => setLatitud(e.target.value)} />
            </div>
            <div className='space-y-1.5'>
              <Label>Longitud</Label>
              <Input type='number' step='any' value={longitud} onChange={(e) => setLongitud(e.target.value)} />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancelar</Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            <Icons.check className='mr-1 h-4 w-4' /> {isEdit ? 'Guardar cambios' : 'Crear predio'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
